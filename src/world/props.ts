// 院中陈设：莲花灯、石灯、石塔、香炉与香烟、长椅、围墙、山门
import * as THREE from 'three';
import { HALL, COURT, INCENSE, PAGODA, STONE_LANTERNS, BENCHES, BENCH_SEATS } from '../layout';
import { stoneTexture, woodTexture, roofTexture, lanternTexture, rng } from '../textures';
import { mesh, worldBox, lathe } from './util';
import { buildRoof } from './hall';

const LANTERN_COLORS = ['#f4a3b5', '#f7c1a0', '#fbe3b0', '#f6f0e6', '#f29aa8', '#e9b5d2'];

export interface PropsBuild {
  interactives: THREE.Object3D[];
  setLanternLevel(level: number): void;
  setIncense(list: { id: string; mine: boolean; remain: number }[]): void;
  update(dt: number, t: number): void;
}

function makeLanternMaterial() {
  const mat = new THREE.MeshStandardMaterial({ map: lanternTexture('#ffffff'), roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.3 });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'
    );
  };
  return mat;
}

export function buildProps(scene: THREE.Scene): PropsBuild {
  const group = new THREE.Group();
  const r = rng(202);
  const interactives: THREE.Object3D[] = [];
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(61, '#a19c90'), roughness: 0.92 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(21, ['#6b4a32', '#57391f', '#7d5a3d']), roughness: 0.8 });
  const darkWood = new THREE.MeshStandardMaterial({ map: woodTexture(22, ['#3a2a20', '#2a1d16', '#4a3527']), roughness: 0.8 });
  const redWood = new THREE.MeshStandardMaterial({ map: woodTexture(23, ['#7a2c20', '#5e1f18', '#8e3a28']), roughness: 0.7 });

  // —— 莲花灯：沿参道两侧的灯绳 + 屋檐下一排 + 殿内几盏 ——
  const lanternPos: THREE.Vector3[] = [];
  const wireMat = new THREE.LineBasicMaterial({ color: '#3a2e26' });
  const poleZ = [6.5, 12.5, 18.5, 24.5];
  for (const sx of [-1, 1]) {
    const x = sx * 2.45;
    for (const z of poleZ) {
      const pole = mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.9, 8), darkWood);
      pole.position.set(x, 1.95, z);
      group.add(pole);
    }
    // 灯绳（略有下垂）
    for (let i = 0; i < poleZ.length - 1; i++) {
      const z0 = poleZ[i], z1 = poleZ[i + 1];
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 16; k++) {
        const tt = k / 16;
        pts.push(new THREE.Vector3(x, 3.85 - Math.sin(tt * Math.PI) * 0.28, z0 + (z1 - z0) * tt));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      for (let k = 1; k < 8; k++) {
        const tt = k / 8;
        lanternPos.push(new THREE.Vector3(x, 3.85 - Math.sin(tt * Math.PI) * 0.28 - 0.36, z0 + (z1 - z0) * tt));
      }
    }
  }
  // 屋檐下
  for (let x = -9.6; x <= 9.6; x += 0.8) lanternPos.push(new THREE.Vector3(x, HALL.baseH + HALL.colH - 0.65 + Math.sin(x) * 0.05, HALL.colZFront + 0.55));
  // 殿内
  for (const x of [-6.6, -3.3, 3.3, 6.6]) for (const z of [-6, -9.5]) lanternPos.push(new THREE.Vector3(x, HALL.baseH + HALL.colH - 0.2, z));

  const lanternMat = makeLanternMaterial();
  const lanternGeo = new THREE.SphereGeometry(0.15, 14, 10);
  lanternGeo.scale(1, 0.85, 1);
  const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, lanternPos.length);
  const tassels = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.018, 0.12, 5), new THREE.MeshStandardMaterial({ color: '#d8c07a', roughness: 0.8 }), lanternPos.length);
  const strings: number[] = [];
  const m4 = new THREE.Matrix4();
  lanternPos.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y, p.z);
    lanterns.setMatrixAt(i, m4);
    lanterns.setColorAt(i, new THREE.Color(LANTERN_COLORS[Math.floor(r() * LANTERN_COLORS.length)]));
    m4.makeTranslation(p.x, p.y - 0.18, p.z);
    tassels.setMatrixAt(i, m4);
    strings.push(p.x, p.y + 0.13, p.z, p.x, p.y + 0.36, p.z);
  });
  lanterns.castShadow = false;
  group.add(lanterns, tassels);
  const stringGeo = new THREE.BufferGeometry();
  stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
  group.add(new THREE.LineSegments(stringGeo, wireMat));

  const pathLights = [new THREE.PointLight('#ffb07a', 0, 12, 1.5), new THREE.PointLight('#ffb07a', 0, 12, 1.5)];
  pathLights[0].position.set(0, 3.2, 10);
  pathLights[1].position.set(0, 3.2, 21);
  group.add(...pathLights);

  // —— 石灯 ——
  const fireMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', emissive: '#ffb066', emissiveIntensity: 0.3 });
  for (const [x, z] of STONE_LANTERNS) {
    const g = new THREE.Group();
    const base = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 8), stoneMat);
    base.position.y = 0.11;
    const pillar = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 8), stoneMat);
    pillar.position.y = 0.67;
    const tray = mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.14, 8), stoneMat);
    tray.position.y = 1.18;
    const box = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8), fireMat);
    box.position.y = 1.44;
    const cap = mesh(new THREE.ConeGeometry(0.42, 0.24, 8), stoneMat);
    cap.position.y = 1.75;
    const knob = mesh(new THREE.SphereGeometry(0.08, 8, 6), stoneMat);
    knob.position.y = 1.92;
    g.add(base, pillar, tray, box, cap, knob);
    g.position.set(x, 0, z);
    group.add(g);
  }

  // —— 三层石塔 ——
  {
    const g = new THREE.Group();
    const pm = new THREE.MeshStandardMaterial({ map: stoneTexture(71, '#9d988b'), roughness: 0.95 });
    let y = 0;
    const tier = (w: number, h: number) => {
      const b = mesh(worldBox(w, h, w, 1.5), pm);
      b.position.y = y + h / 2;
      g.add(b);
      y += h;
    };
    tier(2.5, 0.35);
    tier(2.1, 0.55);
    tier(1.8, 0.12);
    const bodyW = [1.0, 0.82, 0.68];
    const bodyH = [0.9, 0.5, 0.42];
    for (let s = 0; s < 3; s++) {
      tier(bodyW[s], bodyH[s]);
      // 屋檐石：四角微翘
      const roofW = bodyW[s] + 0.95;
      const geo = new THREE.BoxGeometry(roofW, 0.16, roofW, 4, 1, 4);
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(p.getX(i)) / (roofW / 2), az = Math.abs(p.getZ(i)) / (roofW / 2);
        if (p.getY(i) > 0) p.setY(i, p.getY(i) - (1 - Math.max(ax, az)) * 0.0);
        p.setY(i, p.getY(i) + Math.pow(ax * az, 3) * 0.12);
      }
      geo.computeVertexNormals();
      const rm = mesh(geo, pm);
      rm.position.y = y + 0.08;
      g.add(rm);
      const steps = mesh(new THREE.BoxGeometry(bodyW[s] + 0.4, 0.1, bodyW[s] + 0.4), pm);
      steps.position.y = y - 0.02;
      g.add(steps);
      y += 0.16;
    }
    const fin = mesh(lathe([[0.12, 0], [0.14, 0.1], [0.06, 0.2], [0.12, 0.32], [0.05, 0.45], [0.09, 0.55], [0.03, 0.75], [0, 0.8]], 12), pm);
    fin.position.y = y;
    g.add(fin);
    g.position.set(PAGODA.x, 0, PAGODA.z);
    group.add(g);
  }

  // —— 香炉 ——
  const bronze = new THREE.MeshStandardMaterial({ color: '#5a4a32', metalness: 0.8, roughness: 0.45 });
  const burner = new THREE.Group();
  const bowl = mesh(lathe([[0, 0.45], [0.55, 0.45], [0.72, 0.6], [0.78, 0.85], [0.74, 1.0], [0.82, 1.06], [0.78, 1.1], [0, 1.0]], 32), bronze);
  burner.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 8), bronze);
    leg.position.set(Math.cos(a) * 0.45, 0.27, Math.sin(a) * 0.45);
    burner.add(leg);
  }
  for (const s of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI), bronze);
    handle.position.set(s * 0.72, 1.1, 0);
    handle.rotation.y = Math.PI / 2;
    burner.add(handle);
  }
  const sand = mesh(new THREE.CircleGeometry(0.72, 32), new THREE.MeshStandardMaterial({ color: '#8f8676', roughness: 1 }), false);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 1.02;
  burner.add(sand);
  const pedestal = mesh(worldBox(1.6, 0.18, 1.6, 1.5), stoneMat);
  pedestal.position.y = -0.09;
  burner.add(pedestal);
  burner.position.set(INCENSE.x, 0.18, INCENSE.z);
  burner.traverse((o) => {
    o.userData.interact = { type: 'incense' };
  });
  group.add(burner);
  interactives.push(burner);

  // 香和烟
  const MAX_STICKS = 24;
  const stickGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 5);
  stickGeo.translate(0, 0.5, 0);
  const stickMat = new THREE.MeshStandardMaterial({ color: '#9a4a2a', roughness: 0.8 });
  const myStickMat = new THREE.MeshStandardMaterial({ color: '#b8742f', roughness: 0.8 });
  const emberMat = new THREE.MeshBasicMaterial({ color: '#ff7a3a' });
  const sticks: { stick: THREE.Mesh; ember: THREE.Mesh; id: string }[] = [];
  for (let i = 0; i < MAX_STICKS; i++) {
    const a = i * 2.399;
    const d = 0.12 + Math.sqrt(i / MAX_STICKS) * 0.5;
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.set(INCENSE.x + Math.cos(a) * d, 1.2, INCENSE.z + Math.sin(a) * d);
    stick.rotation.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), emberMat);
    stick.visible = ember.visible = false;
    group.add(stick, ember);
    sticks.push({ stick, ember, id: '' });
  }

  const smokeN = 260;
  const smokeGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(smokeN * 3);
  const sa = new Float32Array(smokeN);
  const ss = new Float32Array(smokeN);
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(sa, 1));
  smokeGeo.setAttribute('size', new THREE.BufferAttribute(ss, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { color: { value: new THREE.Color('#e9e6df') }, scale: { value: 400 } },
    vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float scale;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(color, a); #include <colorspace_fragment> }`,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  group.add(smoke);
  const parts = Array.from({ length: smokeN }, () => ({ x: 0, y: -100, z: 0, age: 99, life: 1, src: 0, seed: Math.random() * 10 }));
  let activeSticks: number[] = [];
  let spawnAcc = 0;

  // —— 长椅 ——
  for (const b of BENCHES) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const slat = mesh(new THREE.BoxGeometry(2.3, 0.05, 0.11), woodMat);
      slat.position.set(0, 0.44, -0.18 + k * 0.13);
      g.add(slat);
    }
    for (let k = 0; k < 3; k++) {
      const back = mesh(new THREE.BoxGeometry(2.3, 0.08, 0.04), woodMat);
      back.position.set(0, 0.62 + k * 0.15, -0.3);
      back.rotation.x = -0.12;
      g.add(back);
    }
    for (const lx of [-0.98, 0.98]) {
      const leg = mesh(new THREE.BoxGeometry(0.08, 0.44, 0.48), darkWood);
      leg.position.set(lx, 0.22, -0.02);
      g.add(leg);
      const post = mesh(new THREE.BoxGeometry(0.07, 0.55, 0.06), darkWood);
      post.position.set(lx, 0.7, -0.31);
      g.add(post);
    }
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.yaw;
    group.add(g);
  }
  for (const s of BENCH_SEATS) {
    // 透明点击区，方便点中座位
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.75), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.x, 0.45, s.z);
    hit.rotation.y = s.yaw;
    hit.userData.interact = { type: 'seat', id: s.id };
    group.add(hit);
    interactives.push(hit);
  }

  // —— 围墙（石墙 + 瓦顶）——
  const wallStone = new THREE.MeshStandardMaterial({ map: stoneTexture(81, '#8f887a'), roughness: 0.95 });
  const capMat = new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.85 });
  const addWall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const w = mesh(worldBox(len, 1.25, 0.5, 1.6), wallStone);
    w.position.set((x0 + x1) / 2, 0.62, (z0 + z1) / 2);
    w.rotation.y = -ang;
    group.add(w);
    const capGeo = new THREE.CylinderGeometry(0.55, 0.55, len, 3, 1);
    capGeo.rotateZ(Math.PI / 2);
    const uv = capGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 2);
    const cap = mesh(capGeo, capMat);
    cap.scale.set(1, 0.45, 1);
    cap.position.set((x0 + x1) / 2, 1.38, (z0 + z1) / 2);
    cap.rotation.y = -ang;
    group.add(cap);
  };
  const { x0, x1, z0, z1, gateX } = COURT;
  addWall(x0, z0, x1, z0);
  addWall(x0, z0, x0, z1);
  addWall(x1, z0, x1, z1);
  addWall(x0, z1, -gateX - 0.4, z1);
  addWall(gateX + 0.4, z1, x1, z1);

  // —— 山门 ——
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const c = mesh(new THREE.CylinderGeometry(0.24, 0.27, 3.6, 16), redWood);
      c.position.set(s * gateX, 1.8, z1);
      g.add(c);
      const p = mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.25, 12), stoneMat);
      p.position.set(s * gateX, 0.12, z1);
      g.add(p);
    }
    const beam = mesh(new THREE.BoxGeometry(gateX * 2 + 0.8, 0.4, 0.36), new THREE.MeshStandardMaterial({ color: '#2f6b5b' }));
    beam.position.set(0, 3.5, z1);
    g.add(beam);
    const roof = buildRoof({ cx: 0, cz: z1, W: gateX + 1.5, D: 1.5, rx: gateX - 0.2, eaveY: 3.85, ridgeY: 5.0, lift: 0.35 });
    g.add(roof);
    group.add(g);
  }

  scene.add(group);

  let lanternLevel = 0.3;
  return {
    interactives,
    setLanternLevel(level) {
      lanternLevel = level;
      lanternMat.emissiveIntensity = level;
      fireMat.emissiveIntensity = 0.2 + level * 0.8;
      for (const l of pathLights) l.intensity = Math.max(0, level - 0.8) * 6;
    },
    setIncense(list) {
      activeSticks = [];
      sticks.forEach((s, i) => {
        const item = list[i];
        if (!item) {
          s.stick.visible = s.ember.visible = false;
          s.id = '';
          return;
        }
        s.id = item.id;
        const len = 0.12 + 0.36 * Math.max(0, Math.min(1, item.remain));
        s.stick.scale.set(1, len, 1);
        s.stick.material = item.mine ? myStickMat : stickMat;
        s.stick.visible = s.ember.visible = true;
        s.stick.updateMatrix();
        const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(s.stick.matrix);
        s.ember.position.copy(tip);
        activeSticks.push(i);
      });
    },
    update(dt, t) {
      void lanternLevel;
      // 烟：每根点着的香持续冒出细烟
      if (activeSticks.length) {
        spawnAcc += dt * (10 + activeSticks.length * 6);
        while (spawnAcc > 1) {
          spawnAcc -= 1;
          const p = parts.find((q) => q.age >= q.life);
          if (!p) break;
          const s = sticks[activeSticks[Math.floor(Math.random() * activeSticks.length)]];
          p.x = s.ember.position.x;
          p.y = s.ember.position.y;
          p.z = s.ember.position.z;
          p.age = 0;
          p.life = 4 + Math.random() * 3;
          p.seed = Math.random() * 10;
        }
      }
      for (let i = 0; i < smokeN; i++) {
        const p = parts[i];
        if (p.age < p.life) {
          p.age += dt;
          const k = p.age / p.life;
          p.y += dt * (0.32 + k * 0.12);
          p.x += Math.sin(t * 0.9 + p.seed + p.age * 1.3) * dt * 0.08 * (0.3 + k) + dt * 0.03;
          p.z += Math.cos(t * 0.7 + p.seed * 1.7 + p.age) * dt * 0.06 * (0.3 + k);
          sp[i * 3] = p.x;
          sp[i * 3 + 1] = p.y;
          sp[i * 3 + 2] = p.z;
          sa[i] = Math.sin(Math.min(1, k) * Math.PI) * 0.16 * (1 - k * 0.5);
          ss[i] = 0.05 + k * 0.5;
        } else {
          sa[i] = 0;
          sp[i * 3 + 1] = -100;
        }
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.alpha.needsUpdate = true;
      smokeGeo.attributes.size.needsUpdate = true;
      for (const i of activeSticks) {
        const e = sticks[i].ember;
        (e.material as THREE.MeshBasicMaterial).color.setHSL(0.05, 1, 0.5 + Math.sin(t * 3 + i) * 0.08);
      }
    },
  };
}
