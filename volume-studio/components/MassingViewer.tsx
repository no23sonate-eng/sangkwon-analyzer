"use client";

/* ── 3D 매스 뷰어 (three.js) ──
   필지 폴리곤(대지) 위에 층별 발자국을 적층한 건물 매스 하나만 그린다.
   룩: "밝고 낙관적인" 렌더 — 스카이 그라디언트 배경 · 이미지 기반 조명(IBL) ·
   부드러운 실제 그림자 · 베벨 슬래브(층선) · ACES 톤매핑. (Huge If True 톤)
*/

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Pt } from "@/lib/massing-geometry";

export interface MassFloor {
  ring: Pt[]; // 발자국 (로컬 m, y=북)
  z0: number; // 바닥 높이 (m)
  h: number; // 층고 (m)
  color: string;
  below?: boolean; // 지하층
}

export default function MassingViewer({ parcel, floors }: {
  parcel: Pt[] | null;
  floors: MassFloor[];
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene;
    camera: THREE.PerspectiveCamera; controls: OrbitControls;
    group: THREE.Group; key: THREE.DirectionalLight;
  } | null>(null);

  // 1회 초기화
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 8000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    // 이미지 기반 조명 — 부드러운 반사/명암(프리미엄 룩)
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // 밝은 채움광 + 그림자 만드는 키라이트
    const hemi = new THREE.HemisphereLight(0xffffff, 0xdfe6ec, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff6e8, 2.1);
    key.position.set(70, 120, 40); // 남서 상공, 따뜻한 햇빛
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.5;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdcecff, 0.35);
    fill.position.set(-80, 50, -60); // 차가운 하늘 반대편 채움
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.minDistance = 12;

    const group = new THREE.Group();
    scene.add(group);

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();

    stateRef.current = { renderer, scene, camera, controls, group, key };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // 데이터 변경 시 매스 재구성
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { group, camera, controls, key } = st;

    // 기존 정리
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    group.clear();

    // three 좌표: x=동, z=남(북=-z), y=높이 → ring [x, yN] → (x, -yN)
    const toShape = (ring: Pt[]) => {
      const s = new THREE.Shape();
      ring.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, -y) : s.lineTo(x, -y)));
      s.closePath();
      return s;
    };

    let maxR = 30;

    // 대지 슬래브 (따뜻한 오프화이트, 그림자 받음)
    if (parcel && parcel.length >= 3) {
      const g = new THREE.ExtrudeGeometry(toShape(parcel), { depth: 0.5, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: 0xeef1f4, roughness: 0.95, metalness: 0,
      }));
      mesh.position.y = -0.5;
      mesh.receiveShadow = true;
      group.add(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({ color: 0xc2ccd6 }),
      );
      edge.position.y = -0.5;
      group.add(edge);
      maxR = Math.max(...parcel.map(([x, y]) => Math.hypot(x, y))) * 1.2;
    }

    // 층 매스 — 베벨 슬래브(층선 표현) · PBR · 그림자
    let topY = 10;
    for (const f of floors) {
      if (f.ring.length < 3) continue;
      const bevel = Math.min(0.12, f.h * 0.06);
      const g = new THREE.ExtrudeGeometry(toShape(f.ring), {
        depth: Math.max(f.h - bevel * 2, f.h * 0.6),
        bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
      });
      g.rotateX(-Math.PI / 2);
      const col = new THREE.Color(f.color);
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: f.below ? 0.85 : 0.42,
        metalness: 0.02,
        transparent: !!f.below,
        opacity: f.below ? 0.32 : 1,
        envMapIntensity: 0.9,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.y = f.z0 + bevel;
      if (!f.below) { mesh.castShadow = true; mesh.receiveShadow = true; }
      group.add(mesh);
      // 은은한 밝은 외곽선(어두운 선 대신 화이트 하이라이트)
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(g, 24),
        new THREE.LineBasicMaterial({
          color: f.below ? 0x9fb0c0 : 0xffffff,
          transparent: true, opacity: f.below ? 0.2 : 0.28,
        }),
      );
      edge.position.y = f.z0 + bevel;
      group.add(edge);
      topY = Math.max(topY, f.z0 + f.h);
    }

    // 북쪽 마커 (코럴 콘 — 낙관적 톤)
    if (parcel && parcel.length >= 3) {
      const nDist = maxR * 0.98;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 4.2, 20),
        new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.5, metalness: 0.1 }),
      );
      cone.position.set(0, 0.6, -nDist);
      cone.rotateX(-Math.PI / 2);
      cone.castShadow = true;
      group.add(cone);
    }

    // 지면 그림자 캐처 + 아주 옅은 그리드
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.ceil(maxR / 10) * 80, Math.ceil(maxR / 10) * 80),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    ground.rotateX(-Math.PI / 2);
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    group.add(ground);
    const grid = new THREE.GridHelper(Math.ceil(maxR / 10) * 40, 40, 0xd3dbe3, 0xe9edf1);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.position.y = -0.48;
    group.add(grid);

    // 키라이트 그림자 범위를 씬 크기에 맞춤
    const span = Math.max(maxR * 1.6, topY * 1.1, 60);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
    sc.near = 1; sc.far = span * 6;
    key.position.set(span * 0.7, span * 1.4, span * 0.45);
    key.target.position.set(0, topY * 0.3, 0);
    key.target.updateMatrixWorld();
    sc.updateProjectionMatrix();

    // 카메라 프레이밍 (남동측 상공에서 북향)
    const dist = Math.max(maxR * 2.5, topY * 2.0, 45);
    camera.position.set(dist * 0.7, dist * 0.6, dist * 0.72);
    controls.target.set(0, Math.min(topY * 0.4, 32), 0);
    controls.update();
  }, [parcel, floors]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, #dcecff 0%, #eef4fb 46%, #f7f6f2 100%)",
      }}
    />
  );
}
