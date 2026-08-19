// ── 3D 점 → 화면 좌표 ────────────────────────────────────────────────────
// 3D 판에 라벨을 붙이려면 "이 덩어리가 화면 어디에 있나" 를 알아야 한다.
// three.js 안에서 HTML 을 띄우는 방법(drei 의 <Html>)은 이 프로젝트에 없고,
// 있어도 Remotion 의 프레임 단위 렌더와 섞으면 타이밍이 어긋난다.
//
// 카메라를 우리가 고정해 두고 쓰므로 **투영을 직접 계산하는 편이 안전하다.**
// 값이 순수 함수라 카드 바깥에서 계산해 HTML 라벨에 그대로 넘길 수 있다.
//
// 좌표계는 three.js 와 같다 (오른손, y 가 위).

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
                         a[2] * b[0] - a[0] * b[2],
                         a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// camera: {pos:[x,y,z], target:[x,y,z], up:[0,1,0], fov(도)}
// 반환: (p) => [screenX, screenY, depth]  — depth 는 카메라 앞쪽 거리
export const projector = ({pos, target, up = [0, 1, 0], fov = 42,
                           width = 1920, height = 1080}) => {
  const zAxis = norm(sub(pos, target));          // 카메라가 보는 반대 방향
  const xAxis = norm(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);
  const f = 1 / Math.tan((fov * Math.PI / 180) / 2);
  const aspect = width / height;

  return (p) => {
    const d = sub(p, pos);
    const x = dot(d, xAxis);
    const y = dot(d, yAxis);
    const z = -dot(d, zAxis);                    // 카메라 앞이 양수
    if (z <= 0.001) return [NaN, NaN, z];        // 뒤에 있으면 안 그린다
    return [
      width / 2 + (f / aspect) * (x / z) * (width / 2),
      height / 2 - f * (y / z) * (height / 2),
      z,
    ];
  };
};
