"use client";

/* ── 3D 매스 뷰어 (three.js) ──
   필지 폴리곤(대지) 위에 층별 발자국을 적층한 건물 매스 하나만 그린다.
   밸류맵 Buildit류 규모검토 뷰 — 주변 맵 없음, 궤도 회전/줌만.
*/

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
    group: THREE.Group;
  } | null>(null);

  // 1회 초기화
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef1f5);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8dde4, 1.05);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.35);
    dir.position.set(60, 90, 80); // 남서측 상공 (그림자감)
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;

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

    stateRef.current = { renderer, scene, camera, controls, group };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // 데이터 변경 시 매스 재구성
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { group, camera, controls } = st;

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

    // 대지
    if (parcel && parcel.length >= 3) {
      const g = new THREE.ExtrudeGeometry(toShape(parcel), { depth: 0.4, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xd7dce3 }));
      mesh.position.y = -0.4;
      group.add(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({ color: 0x9aa6b4 }),
      );
      edge.position.y = -0.4;
      group.add(edge);
      maxR = Math.max(...parcel.map(([x, y]) => Math.hypot(x, y))) * 1.2;
    }

    // 층 매스
    let topY = 10;
    for (const f of floors) {
      if (f.ring.length < 3) continue;
      const g = new THREE.ExtrudeGeometry(toShape(f.ring), { depth: f.h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2); // extrude(+z) → +y
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(f.color),
        transparent: !!f.below,
        opacity: f.below ? 0.35 : 1,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.y = f.z0;
      group.add(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(g, 20),
        new THREE.LineBasicMaterial({ color: 0x223042, transparent: true, opacity: f.below ? 0.25 : 0.5 }),
      );
      edge.position.y = f.z0;
      group.add(edge);
      topY = Math.max(topY, f.z0 + f.h);
    }

    // 북쪽 화살표 (N, -z 방향)
    if (parcel && parcel.length >= 3) {
      const nDist = maxR * 0.95;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 4.5, 12),
        new THREE.MeshLambertMaterial({ color: 0xdc2626 }),
      );
      cone.position.set(0, 0.5, -nDist);
      cone.rotateX(-Math.PI / 2);
      group.add(cone);
    }

    // 바닥 그리드
    const grid = new THREE.GridHelper(Math.ceil(maxR / 10) * 40, 40, 0xcbd4dd, 0xe2e7ed);
    grid.position.y = -0.45;
    group.add(grid);

    // 카메라 프레이밍 (남동측 상공에서 북향)
    const dist = Math.max(maxR * 2.6, topY * 2.1, 45);
    camera.position.set(dist * 0.72, dist * 0.62, dist * 0.72);
    controls.target.set(0, Math.min(topY * 0.38, 30), 0);
    controls.update();
  }, [parcel, floors]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
