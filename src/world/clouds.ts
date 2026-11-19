// 云海：登上塔顶（和开场标题画面）才浮现，其余时候完全透明、也不画。
// 近处三层低云铺满院子和墙外的山谷，高到院墙上沿：殿顶、塔、钟楼和树冠从云里露出来，寺院像浮在云上；
// 大殿、配殿里面不铺，免得从门里看到殿内有云。
// 接收场景的日光、天光和雾，所以清晨偏粉金、白天雪白、傍晚橘红、夜里是暗蓝的。
import * as THREE from 'three';
import { COURT, HALL, HALLS } from '../layout';

// far：远处山腰的云带（离院墙 70 米外才有）；scale：云团大小（越小越大团）
const LAYERS = [
  { y: 2.8, a: 0.86, off: [0, 0], far: 0, scale: 0.035 },
  { y: 3.5, a: 0.66, off: [37.1, 11.3], far: 0, scale: 0.03 },
  { y: 4.3, a: 0.5, off: [-21.7, 53.9], far: 0, scale: 0.026 },
  // 原先还有一层 42 米高的山腰云带：比塔顶还高，塔上平视时从底下看过去是一整片亮雾，去掉了
];

export function buildCloudSea(scene: THREE.Scene) {
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  for (const L of LAYERS) {
    // 只有漫反射、没有高光：贴地的云层斜着看过去，逆光时高光会把阳光整片反进镜头，泛光一放大就成了一片白雾
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, depthWrite: false, emissive: '#ffffff', emissiveIntensity: 0.06 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.uniforms.uOpacity = uniforms.uOpacity;
      sh.uniforms.uLayer = { value: new THREE.Vector4(L.off[0], L.off[1], L.a, L.scale) };
      sh.uniforms.uFar = { value: L.far };
      sh.uniforms.uCourt = { value: new THREE.Vector4(COURT.x1 + 2.5, COURT.z0 - 2.5, COURT.z1 + 2.5, 0) };
      // 殿内不铺：大殿、两座配殿和藏经阁的矩形（x0, z0, x1, z1）；配殿横着放，藏经阁正着放
      const rect = (h: (typeof HALLS)[number]) => {
        const across = Math.abs(Math.sin(h.yaw)) > 0.5;
        const ax = (across ? h.w : h.d) / 2, az = (across ? h.d : h.w) / 2;
        return new THREE.Vector4(h.x - ax, h.z - az, h.x + ax, h.z + az);
      };
      sh.uniforms.uHall = { value: new THREE.Vector4(-HALL.wallX - 0.3, HALL.backZ - 0.3, HALL.wallX + 0.3, HALL.colZFront + 0.3) };
      sh.uniforms.uSideA = { value: rect(HALLS[0]) };
      sh.uniforms.uSideB = { value: rect(HALLS[1]) };
      sh.uniforms.uSideC = { value: rect(HALLS[2]) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWp;
          uniform float uTime, uOpacity, uFar;
          uniform vec4 uLayer, uCourt, uHall, uSideA, uSideB, uSideC;
          float inRect(vec2 p, vec4 r) { return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
          float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p) {
            vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
            return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
            return v;
          }`
        )
        .replace(
          '#include <alphamap_fragment>',
          `#include <alphamap_fragment>
          {
            vec2 p = (vWp.xz + uLayer.xy) * uLayer.w + uTime * vec2(0.012, 0.005);
            vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
            float d = fbm(p + q * 1.6);
            float cover = mix(smoothstep(0.24, 0.6, d), smoothstep(0.4, 0.7, d), uFar);
            // 到院墙矩形的距离：近处的云铺满院子，殿内挖掉；远处的云带只在墙外 70 米以外；很远处淡出
            float dc = max(abs(vWp.x) - uCourt.x, max(uCourt.y - vWp.z, vWp.z - uCourt.z));
            float halls = max(max(inRect(vWp.xz, uHall), inRect(vWp.xz, uSideC)), max(inRect(vWp.xz, uSideA), inRect(vWp.xz, uSideB)));
            float keep = mix(1.0 - halls, smoothstep(70.0, 130.0, dc), uFar) * smoothstep(470.0, 360.0, length(vWp.xz));
            diffuseColor.a *= cover * keep * uLayer.z * uOpacity;
            // 云团中间亮、边缘和薄处发灰，看得出一团一团的起伏
            diffuseColor.rgb *= mix(0.68, 1.0, cover * cover);
          }`
        );
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(960, 960).rotateX(-Math.PI / 2), mat);
    m.position.y = L.y;
    m.renderOrder = 1;
    m.frustumCulled = false;
    group.add(m);
    meshes.push(m);
  }
  group.visible = false;
  scene.add(group);
  let k = 0;
  return {
    // show：登塔或开场时为真。浮出来慢、散去快；只在镜头够高时显示，免得从塔上下来的那一下还在雾里
    update(dt: number, time: number, show: boolean, camY: number) {
      const want = show ? THREE.MathUtils.smoothstep(camY, 6, 9) : 0;
      k += (want - k) * Math.min(1, dt * (want > k ? 0.6 : 3));
      uniforms.uOpacity.value = k;
      uniforms.uTime.value = time;
      group.visible = k > 0.01;
    },
  };
}
