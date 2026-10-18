(() => {
'use strict';
const $ = s => document.querySelector(s);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const R = 1000;
const DECL = 7.5; // 日本の磁北のずれ（西へおよそ7〜9°）
const store = {
  get(k, d) { try { const v = localStorage.getItem('hzn_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hzn_' + k, JSON.stringify(v)); } catch (e) {} }
};
if (!window.THREE) {
  $('#loading').innerHTML = '<div style="padding:24px;text-align:center;line-height:1.8">インターネットにつながっていないため、<br>星の画面を作れませんでした。<br>つながってから、もう一度ひらいてね。</div>';
  return;
}

const S = {
  lat: 35.68, lon: 139.69, place: '東京',
  time: new Date(), live: true,
  fov: 70, yaw: 180, pitch: 35,
  sensor: false, cam: false,
  magLim: store.get('magLim', 4.5),
  allLines: store.get('allLines', false),
  showAst: store.get('showAst', true),
  lines: store.get('lines', store.get('allLines', false) ? 'all' : 'feat'),
  nameCon: store.get('nameCon', store.get('showNames', true)), nameStar: store.get('nameStar', store.get('showNames', true)), namePl: store.get('namePl', store.get('showNames', true)), showDir: store.get('showDir', true),
  showNames: store.get('showNames', true),
  showArt: store.get('showArt', false),
  seeThru: store.get('seeThru', false),
  azNudge: (() => { const v = store.get('azNudge', 0); if (!store.get('nudgeV2', false)) { store.set('nudgeV2', true); if (Math.abs(v) > 45) { store.set('azNudge', 0); return 0; } } return v; })(),
  target: null, quiz: null, play: 0, quizCon: null
};
const stamps = store.get('stamps', {});
const canSave = (() => { try { localStorage.setItem('hzn__t', '1'); localStorage.removeItem('hzn__t'); return true; } catch (e) { return false; } })();

/* ---------- 計算のための小道具 ---------- */
const eq = (ra, dec, r = 1) => new THREE.Vector3(Math.cos(dec * D2R) * Math.cos(ra * D2R) * r, Math.cos(dec * D2R) * Math.sin(ra * D2R) * r, Math.sin(dec * D2R) * r);
const toRaDec = v => { const n = v.clone().normalize(); return { ra: ASTRO.norm(Math.atan2(n.y, n.x) * R2D), dec: Math.asin(n.z) * R2D }; };
const hor = (az, alt, r = 1) => new THREE.Vector3(Math.sin(az * D2R) * Math.cos(alt * D2R) * r, Math.sin(alt * D2R) * r, -Math.cos(az * D2R) * Math.cos(alt * D2R) * r);
const DIR8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
const dirName = az => DIR8[Math.round(ASTRO.norm(az) / 45) % 8];
const hira = s => (s || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\sー・座]/g, '').toLowerCase();
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const fmtTime = d => { const h = d.getHours(), m = d.getMinutes(); return (h === 12 ? '昼の12' : (h < 12 ? '午前' : '午後') + (h % 12)) + '時' + (m ? m + '分' : ''); };
const fmtDate = d => (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WD[d.getDay()] + '）';
const fist = alt => { const n = Math.round(alt / 5) / 2; return n < 0.5 ? '地平線のすぐ上' : 'にぎりこぶし' + (n % 1 ? Math.floor(n) + 'こ半' : n + 'こ') + '分'; };
const magName = m => m < 1.5 ? '1等星' : m < 2.5 ? '2等星' : m < 3.5 ? '3等星' : m < 4.5 ? '4等星' : '5等星';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- データの下ごしらえ ---------- */
const HIP = {};
SKY.stars.forEach(s => { HIP[s[5]] = s; });
const conName = id => (SKY.cons[id] ? SKY.cons[id][0] : '');
const conCenter = {};
for (const id in SKY.lines) {
  const c = new THREE.Vector3();
  SKY.lines[id].forEach(l => l.forEach(p => c.add(eq(p[0], p[1]))));
  conCenter[id] = toRaDec(c);
}
const OBJ = {};
CONS.forEach(c => { OBJ[c.id] = Object.assign({ kind: 'con', pos: () => conCenter[c.id] }, c); });
STARS.forEach(s => { const d = HIP[s.hip]; OBJ['s' + s.hip] = Object.assign({ kind: 'star', id: 's' + s.hip, mag: d[2], pos: () => ({ ra: d[0], dec: d[1] }) }, s); });
ASTERISMS.forEach(a => {
  const c = new THREE.Vector3(); a.stars.slice(0, a.id === 'hokuto' ? 7 : a.stars.length - 1).forEach(h => c.add(eq(HIP[h][0], HIP[h][1])));
  const p = toRaDec(c); OBJ[a.id] = Object.assign({ kind: 'ast', pos: () => p }, a);
});
const body = {};
PLANETS.forEach(p => { OBJ[p.id] = Object.assign({ kind: 'planet', pos: () => body[p.id] }, p); });
OBJ.moon = { id: 'moon', kind: 'moon', name: '月', yomi: 'つき', pos: () => body.moon };
OBJ.sun = { id: 'sun', kind: 'sun', name: '太陽', yomi: 'たいよう', pos: () => body.sun };
TIPS.forEach(t => { OBJ[t.id] = Object.assign({ kind: 'tip' }, t); });
const STAMPABLE = [...CONS.map(c => c.id), ...ASTERISMS.map(a => a.id), ...STARS.map(s => 's' + s.hip), ...PLANETS.map(p => p.id), 'moon'];

function updateBodies() {
  const t = S.time;
  PLANETS.forEach(p => { body[p.id] = ASTRO.planet(p.id, t); });
  body.sun = ASTRO.sun(t);
  body.moon = ASTRO.moon(t);
  body.phase = ASTRO.moonPhase(t);
}
function altAzOf(o, t) {
  t = t || S.time;
  let p;
  if (o.kind === 'planet') p = ASTRO.planet(o.id, t);
  else if (o.kind === 'moon') p = ASTRO.moon(t);
  else if (o.kind === 'sun') p = ASTRO.sun(t);
  else p = o.pos();
  const a = ASTRO.altAz(p.ra, p.dec, t, S.lat, S.lon);
  if (o.kind === 'moon') a.alt -= 0.95 * Math.cos(a.alt * D2R); // 見る場所による月のずれ
  if (o.kind === 'moon' || o.kind === 'sun') a.alt += 0.83; // 日の出・月の出の決まり（上のふち＋空気による浮き上がり）
  return a;
}
function nextRise(o) {
  let prev = altAzOf(o).alt;
  for (let m = 10; m <= 1440; m += 10) {
    const t = new Date(S.time.getTime() + m * 60000), a = altAzOf(o, t).alt;
    if (prev < 0 && a >= 0) return { t, az: altAzOf(o, t).az };
    prev = a;
  }
  return null;
}

/* ---------- three.js の空 ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
catch (e) {
  $('#loading').innerHTML = '<div style="padding:24px;text-align:center;line-height:1.8">このタブレット（ブラウザ）では、<br>星の3Dの画面を作れませんでした。<br>ほかのブラウザ（Chrome や Safari）でひらいてみてね。</div>';
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
$('#stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.fov, 1, 1, 8000);
camera.rotation.order = 'YXZ';
const sky = new THREE.Group(); sky.matrixAutoUpdate = false; scene.add(sky);

// 空の色
const domeMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, -1, 0) }, glowK: { value: 0 } },
  vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'uniform vec3 zen,hor,glow,sunDir;uniform float glowK;varying vec3 vD;void main(){float h=clamp(vD.y,0.0,1.0);vec3 c=mix(hor,zen,pow(h,0.45));float s=max(dot(vD,sunDir),0.0);c+=glow*glowK*(pow(s,6.0)*0.8+pow(s,40.0)*0.6)*(1.0-h*0.6);gl_FragColor=vec4(c,1.0);}'
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 3, 48, 24), domeMat);
dome.renderOrder = -10; scene.add(dome);

// 星
const bvColor = bv => {
  const A = [[-0.4, [150, 180, 255]], [0, [205, 220, 255]], [0.3, [245, 246, 255]], [0.6, [255, 244, 214]], [1.0, [255, 222, 160]], [1.4, [255, 165, 100]], [1.9, [255, 105, 80]]];
  bv = Math.max(-0.4, Math.min(1.9, bv));
  for (let i = 1; i < A.length; i++) if (bv <= A[i][0]) {
    const k = (bv - A[i - 1][0]) / (A[i][0] - A[i - 1][0]);
    return A[i - 1][1].map((c, j) => (c + (A[i][1][j] - c) * k) / 255);
  }
  return A[A.length - 1][1].map(c => c / 255);
};
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { scale: { value: 1 }, magLim: { value: S.magLim }, bright: { value: 1 } },
  vertexShader: 'attribute float size;attribute float mag;attribute vec3 color;uniform float scale,magLim,bright;varying vec3 vC;varying float vA;void main(){vC=color;float on=1.0-smoothstep(magLim-0.4,magLim+0.1,mag);vA=on*bright;gl_PointSize=on<0.01?0.0:size*scale;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'varying vec3 vC;varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float d=length(c)*2.0;if(d>1.0)discard;float core=smoothstep(0.6,0.22,d);float g=exp(-d*d*4.0)*0.85;float a=clamp(core+g,0.0,1.0)*vA;gl_FragColor=vec4(mix(vC,vec3(1.0),smoothstep(0.3,0.0,d)*0.45)*a,a);}'
});
const starSize = m => Math.max(2.4, Math.min(30, 18 - 3 * m));
function makePoints(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('mag', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}
const starGeo = makePoints(SKY.stars.length);
const STARV = [];
SKY.stars.forEach((s, i) => {
  const v = eq(s[0], s[1], R); STARV.push(v);
  starGeo.attributes.position.setXYZ(i, v.x, v.y, v.z);
  const c = bvColor(s[3]); starGeo.attributes.color.setXYZ(i, c[0], c[1], c[2]);
  starGeo.attributes.size.setX(i, starSize(s[2])); starGeo.attributes.mag.setX(i, s[2]);
});
const starPts = new THREE.Points(starGeo, starMat); starPts.frustumCulled = false; starPts.renderOrder = 3; sky.add(starPts);

// 天の川（銀河の面にそって、うすい光をならべる）
(() => {
  const N = 2600, ngp = eq(192.859, 27.128), gc = eq(266.405, -28.936), b2 = new THREE.Vector3().crossVectors(ngp, gc).normalize();
  const g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), al = new Float32Array(N), sz = new Float32Array(N);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const l = rnd() * Math.PI * 2, near = Math.cos(l) * 0.5 + 0.5; // 銀河の中心ほど太く明るい
    const gb = ((rnd() + rnd() + rnd()) / 3 - 0.5) * (14 + 16 * near) * D2R;
    const v = gc.clone().multiplyScalar(Math.cos(l)).add(b2.clone().multiplyScalar(Math.sin(l))).multiplyScalar(Math.cos(gb)).add(ngp.clone().multiplyScalar(Math.sin(gb))).normalize().multiplyScalar(R * 1.01);
    pos.set([v.x, v.y, v.z], i * 3); al[i] = (0.25 + 0.75 * near) * (0.4 + rnd() * 0.6); sz[i] = 30 + rnd() * 60;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('al', new THREE.BufferAttribute(al, 1)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { k: { value: 1 }, scale: { value: 1 } },
    vertexShader: 'attribute float al,sz;uniform float k,scale;varying float vA;void main(){vA=al*k;gl_PointSize=sz*scale;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;float a=exp(-d*d*3.0)*vA*0.10;gl_FragColor=vec4(vec3(0.7,0.78,1.0)*a,a);}'
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -5; sky.add(p); window.__milky = m;
})();

// 線（太さのある帯で描く）
function ribbon(segs, width, gapDeg, rad) {
  const pos = [], ctr = [];
  segs.forEach(([a, b]) => {
    const ang = a.angleTo(b); if (ang < 1e-4) return;
    const g = Math.min(gapDeg * D2R, ang * 0.3) / ang;
    const A = a.clone().lerp(b, g).normalize().multiplyScalar(rad), B = a.clone().lerp(b, 1 - g).normalize().multiplyScalar(rad);
    const n = new THREE.Vector3().subVectors(B, A).cross(A.clone().add(B)).normalize().multiplyScalar(width / 2);
    const p1 = A.clone().add(n), p2 = A.clone().sub(n), p3 = B.clone().add(n), p4 = B.clone().sub(n);
    pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z, p4.x, p4.y, p4.z);
    ctr.push(A.x, A.y, A.z, A.x, A.y, A.z, B.x, B.y, B.z, B.x, B.y, B.z, A.x, A.y, A.z, B.x, B.y, B.z);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('center', new THREE.Float32BufferAttribute(ctr, 3)); return g;
}
// 線の太さ：画面を寄せても太い帯にならないよう、寄せたぶん中心線へ細める（LINE_K を毎フレーム決める）
const LINE_K = { value: 1 };
const thin = m => { m.onBeforeCompile = sh => { sh.uniforms.wk = LINE_K; sh.vertexShader = 'attribute vec3 center;uniform float wk;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = center + (position - center) * wk;'); }; return m; };
const lineSegs = id => { const out = []; SKY.lines[id].forEach(l => { for (let i = 1; i < l.length; i++) out.push([eq(l[i - 1][0], l[i - 1][1]), eq(l[i][0], l[i][1])]); }); return out; };
const FEAT = new Set(CONS.map(c => c.id));
const conMesh = {};
const lineMatFeat = () => thin(new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
const minorGroup = new THREE.Group(); sky.add(minorGroup);
const minorMat = thin(new THREE.MeshBasicMaterial({ color: 0x6f86c0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
for (const id in SKY.lines) {
  if (FEAT.has(id)) { const m = new THREE.Mesh(ribbon(lineSegs(id), 4.6, 0.45, R * 0.99), lineMatFeat()); m.frustumCulled = false; sky.add(m); conMesh[id] = m; }
  else { const m = new THREE.Mesh(ribbon(lineSegs(id), 2.6, 0.4, R * 0.99), minorMat); m.frustumCulled = false; minorGroup.add(m); }
}
const astMesh = {};
ASTERISMS.forEach(a => {
  const segs = []; for (let i = 1; i < a.stars.length; i++) segs.push([eq(HIP[a.stars[i - 1]][0], HIP[a.stars[i - 1]][1]), eq(HIP[a.stars[i]][0], HIP[a.stars[i]][1])]);
  const m = new THREE.Mesh(ribbon(segs, a.id === 'hokuto' ? 5 : 4, 1.6, R * 0.985), thin(new THREE.MeshBasicMaterial({ color: 0xff8fc0, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })));
  m.frustumCulled = false; sky.add(m); astMesh[a.id] = m;
});

// 星座の絵（神話のすがた）。絵の点(px,py)を心射図法で空の球面へもどし、板を球面にそわせる
const artMesh = {};
const ARTS = typeof ART === 'undefined' ? {} : ART;
function artFor(id) {
  if (artMesh[id] !== undefined) return artMesh[id];
  const a = ARTS[id]; if (!a) return (artMesh[id] = null);
  const ra = a.ra0 * D2R, de = a.dec0 * D2R;
  const c0 = eq(a.ra0, a.dec0), eE = new THREE.Vector3(-Math.sin(ra), Math.cos(ra), 0), eN = new THREE.Vector3(-Math.sin(de) * Math.cos(ra), -Math.sin(de) * Math.sin(ra), Math.cos(de));
  const g = new THREE.PlaneGeometry(1, 1, 24, 24), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const xi = (a.N / 2 - uv.getX(i) * a.N) / a.k, et = (a.N / 2 - (1 - uv.getY(i)) * a.N) / a.k;
    const v = c0.clone().addScaledVector(eE, xi).addScaledVector(eN, et).normalize().multiplyScalar(R * 0.98);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingSphere();
  const img = new Image(), tex = new THREE.Texture(img);
  img.onload = () => { tex.needsUpdate = true; };
  img.src = a.img;
  // 黒に近い所（JPEGのにじみ）は消して、板のふちが見えないようにする
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { map: { value: tex }, opacity: { value: 0 } },
    vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform sampler2D map;uniform float opacity;varying vec2 vU;void main(){vec3 c=texture2D(map,vU).rgb;c=max(c-0.08,0.0)*1.09;vec2 e=min(vU,1.0-vU);c*=smoothstep(0.0,0.09,min(e.x,e.y));gl_FragColor=vec4(c*opacity,1.0);}'
  });
  Object.defineProperty(mat, 'opacity', { get: () => mat.uniforms.opacity.value, set: v => { if (mat.uniforms) mat.uniforms.opacity.value = v; } });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = -3; m.visible = false; sky.add(m);
  return (artMesh[id] = m);
}

// 絵のある星座をえらんだら、絵がちょうど画面に入る大きさまで寄る（小さい星座が目あての丸にかくれないように）
function artFov(id, alt) {
  const a = ARTS[id], w = 2 * Math.atan(a.N / 2 / a.k) * 0.8 * 1.25, asp = innerWidth / innerHeight;
  const v = asp < 1 ? 2 * Math.atan(Math.tan(w / 2) / asp) : w; // たて長の画面では横はばに合わせる
  const f = Math.max(0.5, (innerHeight - 190) / innerHeight); // 上の札と下のボタンの帯の分をのぞく
  return Math.max(alt > 80 ? 28 : 22, Math.min(85, // 真上近くは見上げが85°までなので少し引く
    2 * Math.atan(Math.tan(v / 2) / f) * R2D));
}

// 惑星
const planetMat = starMat.clone(); planetMat.uniforms = { scale: { value: 1 }, magLim: { value: 9 }, bright: { value: 1 } };
const plGeo = makePoints(PLANETS.length);
PLANETS.forEach((p, i) => { const c = new THREE.Color(p.color); plGeo.attributes.color.setXYZ(i, c.r, c.g, c.b); plGeo.attributes.size.setX(i, p.size); plGeo.attributes.mag.setX(i, -3); });
const plPts = new THREE.Points(plGeo, planetMat); plPts.frustumCulled = false; plPts.renderOrder = 4; sky.add(plPts);

// 太陽と月
function glowTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.25, inner); g.addColorStop(0.32, outer); g.addColorStop(1, 'rgba(255,170,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('#fffbe8', 'rgba(255,200,90,.55)'), depthWrite: false, transparent: true }));
sunSpr.scale.set(R * 0.16, R * 0.16, 1); sky.add(sunSpr);
const moonCv = document.createElement('canvas'); moonCv.width = moonCv.height = 256;
function drawPhase(cv, frac, size) {
  const x = cv.getContext('2d'), W = cv.width, r = W * 0.42 * (size || 1), c = W / 2;
  x.clearRect(0, 0, W, W);
  x.fillStyle = 'rgba(60,64,84,.85)'; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fill();
  const lit = '#fff4cf';
  x.fillStyle = lit; x.beginPath(); x.arc(c, c, r, -Math.PI / 2, Math.PI / 2); x.fill();
  const rx = r * Math.abs(1 - 2 * frac);
  x.fillStyle = frac >= 0.5 ? lit : 'rgba(60,64,84,1)';
  x.beginPath(); x.ellipse(c, c, Math.max(rx, 0.01), r, 0, 0, Math.PI * 2); x.fill();
  if (frac < 0.5) { x.fillStyle = 'rgba(60,64,84,.85)'; x.beginPath(); x.arc(c, c, r, Math.PI / 2, Math.PI * 1.5); x.fill(); }
  // もよう
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(150,140,110,.28)';
  [[-.25, -.2, .2], [.15, -.3, .14], [.05, .1, .22], [-.3, .25, .12], [.3, .25, .1]].forEach(([dx, dy, rr]) => { x.beginPath(); x.arc(c + dx * r, c + dy * r, rr * r, 0, Math.PI * 2); x.fill(); });
  x.globalCompositeOperation = 'source-over';
}
const moonTex = new THREE.CanvasTexture(moonCv);
const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, depthWrite: false, transparent: true }));
moonSpr.scale.set(R * 0.06, R * 0.06, 1); sky.add(moonSpr);
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,250,220,.0)', 'rgba(255,245,210,.18)'), depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
moonHalo.scale.set(R * 0.2, R * 0.2, 1); sky.add(moonHalo);

// 地面と地平線
const groundMat = new THREE.MeshBasicMaterial({ color: 0x0a1a14, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
const ground = new THREE.Group(); scene.add(ground);
(() => {
  const gm = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 72, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), groundMat);
  gm.renderOrder = 10; ground.add(gm);
  // 木や家のシルエット
  const pos = []; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const H = []; for (let a = 0; a <= 360; a += 1) { const tree = rnd() < 0.18 ? 1.5 + rnd() * 2.5 : 0; H.push(0.5 + Math.sin(a * D2R * 3) * 0.3 + Math.sin(a * D2R * 7 + 1) * 0.25 + tree); }
  for (let a = 0; a < 360; a++) {
    const p1 = hor(a, -0.5, R * 0.89), p2 = hor(a + 1, -0.5, R * 0.89), p3 = hor(a, H[a], R * 0.89), p4 = hor(a + 1, H[a + 1], R * 0.89);
    pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z, p4.x, p4.y, p4.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const sil = new THREE.Mesh(g, groundMat); sil.renderOrder = 10; ground.add(sil);
  const segs = []; for (let a = 0; a < 360; a += 5) segs.push([hor(a, 0), hor(a + 5, 0)]);
  const hl = new THREE.Mesh(ribbon(segs, 3, 0, R * 0.88), new THREE.MeshBasicMaterial({ color: 0x5fd39a, transparent: true, opacity: 0.6, depthTest: false, side: THREE.DoubleSide }));
  hl.renderOrder = 11; ground.add(hl);
})();

/* ---------- 名前ラベル ---------- */
const labels = [];
function addLabel(text, cls, getVec, frame, onTap) {
  const el = document.createElement(onTap ? 'button' : 'div');
  el.className = 'lbl ' + cls; el.textContent = text;
  if (onTap) el.addEventListener('click', e => { e.stopPropagation(); onTap(); });
  $('#labels').appendChild(el);
  const L = { el, getVec, frame, cls, id: null }; labels.push(L); return L;
}
DIR8.forEach((d, i) => addLabel(d, 'dir' + (i % 2 ? '' : ' main'), () => hor(i * 45, 3, R), 'hor'));
for (const id in SKY.cons) {
  if (!SKY.lines[id]) continue;
  const feat = FEAT.has(id), c = conCenter[id], v = eq(c.ra, c.dec, R);
  const L = addLabel(SKY.cons[id][0], 'con' + (feat ? ' feat' : ' minor'), () => v, 'sky', feat ? () => openInfo(id) : null);
  L.id = id; L.minor = !feat;
}
STARS.forEach(s => { const d = HIP[s.hip], v = eq(d[0], d[1], R); const L = addLabel(s.name, 'star', () => v, 'sky', () => openInfo('s' + s.hip)); L.id = 's' + s.hip; L.dy = 14; });
ASTERISMS.forEach(a => { const p = OBJ[a.id].pos(), v = eq(p.ra, p.dec, R); const L = addLabel(a.name, 'ast', () => v, 'sky', () => openInfo(a.id)); L.id = a.id; L.ast = true; });
PLANETS.forEach(p => { const L = addLabel(p.name, 'planet', () => eq(body[p.id].ra, body[p.id].dec, R), 'sky', () => openInfo(p.id)); L.id = p.id; L.dy = 16; });
{ const L = addLabel('月', 'moon', () => eq(body.moon.ra, body.moon.dec, R), 'sky', () => openInfo('moon')); L.id = 'moon'; L.dy = 30; }
{ const L = addLabel('太陽', 'sun', () => eq(body.sun.ra, body.sun.dec, R), 'sky', () => openInfo('sun')); L.id = 'sun'; L.dy = 40; }

/* ---------- 空の向きの計算 ---------- */
let sunAlt = -30;
function updateSky() {
  const L = ASTRO.lst(S.time, S.lon) * D2R, p = S.lat * D2R;
  const cL = Math.cos(L), sL = Math.sin(L), cp = Math.cos(p), sp = Math.sin(p);
  sky.matrix.set(-sL, cL, 0, 0, cp * cL, cp * sL, sp, 0, sp * cL, sp * sL, -cp, 0, 0, 0, 0, 1);
  sky.matrixWorldNeedsUpdate = true;
  updateBodies();
  PLANETS.forEach((pl, i) => { const v = eq(body[pl.id].ra, body[pl.id].dec, R * 0.98); plGeo.attributes.position.setXYZ(i, v.x, v.y, v.z); });
  plGeo.attributes.position.needsUpdate = true;
  sunSpr.position.copy(eq(body.sun.ra, body.sun.dec, R * 0.97));
  moonSpr.position.copy(eq(body.moon.ra, body.moon.dec, R * 0.96)); moonHalo.position.copy(moonSpr.position);
  const ph = body.phase.frac;
  if (Math.abs(ph - (updateSky.lastPh || -1)) > 0.004) { drawPhase(moonCv, ph); moonTex.needsUpdate = true; updateSky.lastPh = ph; }
  // 空の明るさ
  const sv = sunSpr.position.clone().applyMatrix4(sky.matrix).normalize();
  sunAlt = Math.asin(sv.y) * R2D;
  const day = smooth(-5, 6, sunAlt), tw = smooth(-18, -5, sunAlt) * (1 - day);
  const night = [new THREE.Color(0x040a1c), new THREE.Color(0x0c1a3a)], twi = [new THREE.Color(0x1a2a66), new THREE.Color(0xd9865a)], dd = [new THREE.Color(0x3d7fd8), new THREE.Color(0xb4d8f6)];
  domeMat.uniforms.zen.value.copy(night[0]).lerp(twi[0], tw).lerp(dd[0], day);
  domeMat.uniforms.hor.value.copy(night[1]).lerp(twi[1], tw).lerp(dd[1], day);
  domeMat.uniforms.glow.value.set(day > 0.5 ? 0xfff3d0 : 0xffa060); domeMat.uniforms.glowK.value = Math.max(tw, day * 0.8);
  domeMat.uniforms.sunDir.value.copy(sv);
  const k = S.cam ? 1 : 1 - 0.7 * day - 0.25 * tw;
  starMat.uniforms.bright.value = k; planetMat.uniforms.bright.value = Math.max(k, 0.6);
  window.__milky.uniforms.k.value = S.cam ? 0 : Math.max(0, 1 - day - tw * 1.2);
  groundMat.color.set(day > 0.3 ? 0x24452f : 0x0a1a14);
  const showBanner = sunAlt > -6 && !S.quiz;
  $('#dayBanner').style.display = showBanner ? 'flex' : 'none';
  if (showBanner) $('#dayText').textContent = sunAlt > 0 ? 'いまは昼。本当の空は明るくて、星はほとんど見えません。' : 'いまは夕方か明け方。明るい星から見えてきます。';
  updateTimeChip();
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- 見る向き（指・センサー） ---------- */
const cvs = renderer.domElement;
const ptrs = new Map(); let down = null, pinch = null, fly = null;
cvs.addEventListener('pointerdown', e => {
  cvs.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, moved: false };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: S.fov }; if (down) down.moved = true; }
  fly = null;
});
cvs.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId), cur = { x: e.clientX, y: e.clientY }; ptrs.set(e.pointerId, cur);
  if (ptrs.size === 1 && down) {
    if (Math.hypot(cur.x - down.x, cur.y - down.y) > 7) down.moved = true;
    if (!S.sensor) {
      const k = S.fov / innerHeight;
      S.yaw = ASTRO.norm(S.yaw - (cur.x - prev.x) * k); S.pitch = Math.max(S.quiz ? -89 : -25, Math.min(89, S.pitch + (cur.y - prev.y) * k));
    }
  } else if (ptrs.size === 2 && pinch && !S.cam) {
    const [a, b] = [...ptrs.values()]; S.fov = Math.max(15, Math.min(100, pinch.fov * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))));
  }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size === 0 && down && !down.moved && e.type === 'pointerup') handleTap(e.clientX, e.clientY);
  if (ptrs.size < 2) pinch = null; if (ptrs.size === 0) down = null;
};
cvs.addEventListener('pointerup', endPtr); cvs.addEventListener('pointercancel', endPtr);
cvs.addEventListener('wheel', e => { e.preventDefault(); if (!S.cam) S.fov = Math.max(15, Math.min(100, S.fov * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] }[e.key];
  if (k && !S.sensor) { S.yaw = ASTRO.norm(S.yaw + k[0]); S.pitch = Math.max(-25, Math.min(89, S.pitch + k[1])); }
  if (e.key === 'Escape') { closeSheet(); }
});

function flyTo(az, alt, fov) {
  if (S.sensor) return;
  let dy = ASTRO.norm(az - S.yaw); if (dy > 180) dy -= 360;
  fly = { t0: performance.now(), y0: S.yaw, dy, p0: S.pitch, p1: Math.max(S.quiz ? -89 : -20, Math.min(85, alt)), f0: S.fov, f1: fov || S.fov };
}
function stepFly(now) {
  if (!fly) return;
  const t = Math.min(1, (now - fly.t0) / 1000), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  S.yaw = ASTRO.norm(fly.y0 + fly.dy * e); S.pitch = fly.p0 + (fly.p1 - fly.p0) * e; S.fov = fly.f0 + (fly.f1 - fly.f0) * e;
  if (t >= 1) fly = null;
}

// センサー
let ori = null, iosOffset = null, absMode = false;
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), zee = new THREE.Vector3(0, 0, 1), yAx = new THREE.Vector3(0, 1, 0), eul = new THREE.Euler();
const devQ = new THREE.Quaternion(), tq = new THREE.Quaternion(), bodyQ = new THREE.Quaternion();
// 方角なおしは、たて持ちと横持ちで別々に覚える（ずれ方がちがうことがあるため）
const screenAngle = () => (screen.orientation && screen.orientation.angle) || window.orientation || 0;
const nudgeKey = () => Math.abs(screenAngle()) % 180 === 90 ? 'azNudgeL' : 'azNudge';
const showNudge = () => { const e = $('#nVal'); if (e) e.textContent = (S.azNudge > 0 ? '+' : '') + S.azNudge + '°'; };
function onOri(e) { if (e.alpha == null) return; if (e.type === 'deviceorientationabsolute' || e.absolute) absMode = true; else if (absMode) return; ori = { a: e.alpha, b: e.beta, g: e.gamma, head: e.webkitCompassHeading }; }
function sensorQuat() {
  const orient = screenAngle();
  eul.set(ori.b * D2R, ori.a * D2R, -ori.g * D2R, 'YXZ');
  devQ.setFromEuler(eul).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient * D2R));
  let corr = -DECL + S.azNudge;
  if (ori.head != null && !absMode) {
    // たて持ち：コンパスはカメラの向き（back）。横持ち：本体の上のはし（top）の向き。急な角度のときは合わせ直さない
    bodyQ.setFromEuler(eul).multiply(q1);
    const top = new THREE.Vector3(0, 1, 0).applyQuaternion(bodyQ), back = new THREE.Vector3(0, 0, -1).applyQuaternion(bodyQ);
    const land = Math.abs(screenAngle()) % 180 === 90;
    // たて持ちで地平線より上へ向けると、iPhone・iPadのコンパスは本体の上のはし（手前にかたむく）の向きに切りかわり、180°反対の値になる。
    // そこで、たて持ちは「地平線から少し下（3°〜44°）・左右にかたむけていない」間だけ合わせ直し、見上げている間は合わせた値のまま、本体の回転だけで追う
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(bodyQ); // 左右へのかたむき
    const ref = land ? (Math.abs(top.y) < 0.5 ? top : null) : (back.y > -0.7 && back.y < -0.05 && Math.abs(side.y) < 0.35 ? back : null);
    if (ref) {
      const azRaw = Math.atan2(ref.x, -ref.z) * R2D;
      let off = ASTRO.norm(ori.head - azRaw);
      if (iosOffset == null) iosOffset = off; else { let d = off - iosOffset; d = ((d + 540) % 360) - 180; iosOffset = ASTRO.norm(iosOffset + d * 0.05); }
    }
    corr += iosOffset || 0;
  }
  tq.setFromAxisAngle(yAx, -corr * D2R).multiply(devQ);
  return tq;
}
async function startSensor() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') { toast('センサーを使えませんでした。<br>指で空を動かして見てね。'); return; }
    }
  } catch (e) { toast('センサーを使えませんでした。<br>指で空を動かして見てね。'); return; }
  addEventListener('deviceorientationabsolute', onOri); addEventListener('deviceorientation', onOri);
  showLoading('センサーをしらべています…');
  setTimeout(() => {
    hideLoading();
    if (!ori) { removeEventListener('deviceorientationabsolute', onOri); removeEventListener('deviceorientation', onOri); toast('このタブレットには、向きをはかるしくみがないようです。<br>指で空を動かして見てね。'); return; }
    S.sensor = true; fly = null;
    $('#sensorBtn').classList.add('on'); $('#nudge').style.display = 'flex'; S.azNudge = store.get(nudgeKey(), 0); showNudge(); $('#sensorBar').style.display = 'flex'; $('#cross').style.display = 'block';
    toast('はじめに、タブレットを前（地平線のほう）に向けてね。<br>前に向けると方角がきまるよ。', 3600);
  }, 1200);
}
function stopSensor() {
  S.sensor = false; endAlign(); removeEventListener('deviceorientationabsolute', onOri); removeEventListener('deviceorientation', onOri);
  ori = null; iosOffset = null; absMode = false;
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  S.yaw = ASTRO.norm(Math.atan2(f.x, -f.z) * R2D); S.pitch = Math.max(-25, Math.asin(f.y) * R2D);
  if (S.cam) stopCam();
  $('#sensorBtn').classList.remove('on'); $('#nudge').style.display = 'none'; $('#sensorBar').style.display = 'none'; $('#cross').style.display = 'none';
}
const nudge = d => { S.azNudge = Math.round(((S.azNudge + d + 540) % 360) - 180); store.set(nudgeKey(), S.azNudge); showNudge(); };
// 方角あわせ：本物の星をまん中の＋に入れてから「合わせる」をおす
let alignId = null;
function startAlign(id) { alignId = id; S.target = null; S.targetActive = false; $('#targetChip').style.display = 'none'; // 矢印はアプリの中の位置を指すので、合わせる間は消す
  $('#alignText').textContent = `本物の${OBJ[id].name}を、まん中の＋に入れてね`; $('#alignBar').style.display = 'flex'; }
function endAlign() { alignId = null; $('#alignBar').style.display = 'none'; }
$('#alignNo').onclick = endAlign;
$('#alignOk').onclick = () => {
  const o = OBJ[alignId]; if (!o || !S.sensor) return endAlign();
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  let d = altAzOf(o, new Date()).az - Math.atan2(f.x, -f.z) * R2D; d = Math.round(((d % 360) + 540) % 360 - 180);
  if (d) nudge(d);
  toast(`${esc(o.name)}で方角を合わせました。<br>（${d > 0 ? '+' : ''}${d}°）`); endAlign();
};
const nudgeReset = () => { S.azNudge = 0; store.set(nudgeKey(), 0); showNudge(); };
$('#nLL').onclick = () => nudge(-30); $('#nL').onclick = () => nudge(-5); $('#nR').onclick = () => nudge(5); $('#nRR').onclick = () => nudge(30); $('#n0').onclick = nudgeReset;

// カメラ
let stream = null;
async function startCam() {
  try {
    showLoading('カメラをじゅんびしています…');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const v = $('#video'); v.srcObject = stream; v.style.display = 'block'; await v.play().catch(() => {});
    S.cam = true; document.body.classList.add('cam'); dome.visible = false; $('#camBtn').classList.add('on'); hideLoading(); camFov(); updateSky();
  } catch (e) { hideLoading(); toast('カメラを使えませんでした。<br>カメラなしでも星はさがせます。'); }
}
function stopCam() {
  if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  $('#video').style.display = 'none'; S.cam = false; document.body.classList.remove('cam'); dome.visible = true; $('#camBtn').classList.remove('on'); S.fov = 70; updateSky();
}
function camFov() { const long = 64, a = innerWidth / innerHeight; S.fov = a < 0.75 ? long : 2 * Math.atan(Math.tan(long / 2 * D2R) / a) * R2D; }
$('#camBtn').onclick = () => S.cam ? stopCam() : startCam();

/* ---------- タップでえらぶ ---------- */
const tv = new THREE.Vector3();
function screenOf(v3) {
  tv.copy(v3).applyMatrix4(camera.matrixWorldInverse);
  if (tv.z > -1) return null;
  tv.applyMatrix4(camera.projectionMatrix);
  return { x: (tv.x + 1) / 2 * innerWidth, y: (1 - tv.y) / 2 * innerHeight };
}
function handleTap(x, y) {
  if (S.quiz) return;
  let best = null, bd = 30;
  const cand = [...STARS.map(s => 's' + s.hip), ...PLANETS.map(p => p.id), 'moon', 'sun'];
  cand.forEach(id => {
    const p = OBJ[id].pos(); const s = screenOf(eq(p.ra, p.dec, R).applyMatrix4(sky.matrix)); if (!s) return;
    const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = id; }
  });
  if (best) return openInfo(best);
  let bi = -1; bd = 22;
  SKY.stars.forEach((s, i) => {
    if (s[2] > S.magLim) return; const sc = screenOf(STARV[i].clone().applyMatrix4(sky.matrix)); if (!sc) return;
    const d = Math.hypot(sc.x - x, sc.y - y); if (d < bd) { bd = d; bi = i; }
  });
  if (bi >= 0) return openStar(bi);
  closeSheet();
}

/* ---------- シート（説明・さがす・じかん…） ---------- */
const sheet = $('#sheet'), sb = $('#sheetBody');
let sheetKind = null;
function openSheet(html, kind) { sb.innerHTML = html; sheet.classList.add('open'); sheet.scrollTop = 0; sheetKind = kind; setNav(kind); }
function closeSheet() { sheet.classList.remove('open'); sheetKind = null; setNav(null); if (!S.quiz) { ringAt = null; if (!S.targetActive) S.target = null; } }
$('#sheetX').onclick = closeSheet;
function setNav(k) { document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.p === k || (b.dataset.p === 'sensor' && S.sensor))); }

const COLOR_DOT = { '赤': '#ff6b5a', 'オレンジ': '#ffad5a', '黄': '#ffe066', 'うすい黄': '#fff2b0', '白': '#ffffff', '青白': '#a9c8ff' };
function nowLine(o) {
  const a = altAzOf(o);
  if (o.kind === 'sun' && a.alt > 0) return `<div class="now">いまは<b>${dirName(a.az)}の空</b>、高さ${Math.round(a.alt)}°にあります。</div>`;
  if (a.alt > 0) {
    const day = sunAlt > -6 && o.kind !== 'moon' && o.kind !== 'sun' && !(o.id === 'venus' && sunAlt < 0);
    return `<div class="now">いまは<b>${dirName(a.az)}の空</b>、高さ${Math.round(a.alt)}°（${fist(a.alt)}）にあります。${day ? '<br>でも空が明るいので、目では見えにくい時間です。' : ''}</div>`;
  }
  const r = nextRise(o);
  return `<div class="now no">いまは地平線の下にあって、見えません。${r ? `<br><b>${r.t.getDate() !== S.time.getDate() ? '次の日の' : ''}${fmtTime(r.t)}ごろ</b>、${dirName(r.az)}の空からのぼってきます。` : ''}</div>`;
}
function canStamp(id) { const a = altAzOf(OBJ[id]); return S.live && a.alt > 0 && (sunAlt < -6 || id === 'moon'); }
function stampBtn(id) {
  if (!STAMPABLE.includes(id)) return '';
  if (!stamps[id] && !canStamp(id)) return `<button class="btn" disabled style="opacity:.6">${!S.live ? 'じかんを「いま」にもどすと、おせます' : id === 'moon' ? 'スタンプは、月が空に出ているときにおせます' : 'スタンプは、空に出ている夜におせます'}</button>`;
  return stamps[id] ? `<button class="btn pink" data-a="unstamp">スタンプずみ（${esc(stamps[id])}）</button>` : `<button class="btn pink" data-a="stamp">本物の空で見つけた！</button>`;
}
function openInfo(id) {
  const o = OBJ[id]; if (!o) return;
  if (alignId) endAlign();
  let h = `<h2>${esc(o.name)}</h2><div class="yomi">${esc(o.yomi.split(' ')[0])}</div><div class="tags">`;
  if (o.season) h += `<span class="tag">${o.season === 'all' ? '一年中見える' : SEASON_NAME[o.season] + 'の星座・星'}</span>`;
  if (o.kind === 'star') h += `<span class="tag">${o.cluster ? '星の集まり' : magName(o.mag)}</span><span class="tag"><i style="background:${COLOR_DOT[o.color]}"></i>${o.color}</span><span class="tag">${conName(o.con)}</span>`;
  if (o.kind === 'planet') h += '<span class="tag">惑星（わくせい）</span>';
  h += '</div>';
  if (o.kind === 'con') {
    h += `<p>${esc(o.story)}</p>`;
    if (o.main && OBJ['s' + o.main]) h += `<div class="tags"><span class="tag">いちばん明るい星：${esc(OBJ['s' + o.main].name)}</span></div>`;
  } else if (o.kind === 'moon') {
    const ph = body.phase; h += `<p><b>${moonName(ph)}</b>（新月から${Math.round(ph.age)}日ごろ）。月は自分では光らず、太陽の光が当たっている所が光って見えます。</p>`;
  } else if (o.kind === 'sun') {
    h += `<div class="warn">太陽は、ぜったいに直接見てはいけません。目をいためます。望遠鏡やそうがんきょうでは、とくにあぶないです。</div><p>太陽は東からのぼり、南の空を通って、西にしずみます。</p>`;
  } else if (o.kind === 'planet') {
    h += `<p>${esc(o.note)}</p><div class="tags"><span class="tag">いまは ${esc(nearCon(body[o.id]))} のあたり</span></div>`;
  } else h += `<p>${esc(o.note)}</p>`;
  if (o.kind !== 'tip') h += nowLine(o);
  h += '<div class="btns">';
  if (o.kind === 'tip') { if (o.action) h += `<button class="btn main" data-a="tip">空で見てみる</button>`; }
  else if (o.kind !== 'sun') h += `<button class="btn main" data-a="find">空でさがす</button>`;
  if (o.kind === 'moon') h += `<button class="btn" data-a="moonp">月の形と動き</button>`;
  if (S.sensor && S.live && ['star', 'planet', 'moon'].includes(o.kind) && altAzOf(o).alt > 0) h += `<button class="btn" data-a="align">この${o.kind === 'moon' ? '月' : '星'}で方角を合わせる</button>`;
  h += stampBtn(id) + '</div>' + videoHtml(id);
  openSheet(h, 'info');
  sb.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'find') { setTarget(id); closeSheet(); }
    if (a === 'stamp') doStamp(id);
    if (a === 'unstamp') ask('このスタンプを消しますか？', [['消す', () => { delete stamps[id]; store.set('stamps', stamps); openInfo(id); }], ['やめる', null]]);
    if (a === 'moonp') openMoon();
    if (a === 'tip') doTip(o);
    if (a === 'align') { closeSheet(); startAlign(id); }
  });
  if (o.kind !== 'tip') { setTarget(id, true); keepVisible(id); }
}
// 動画のリンク（名前のある星で動画が無いときは、その星座の動画）
function videoHtml(id) {
  let keys = VIDEOS[id];
  if (!keys && OBJ[id] && OBJ[id].kind === 'star') keys = VIDEOS[OBJ[id].con];
  if (!keys || !keys.length) return '';
  const yt = 'https://www.youtube.com/watch?v=';
  return `<div class="set"><div>動画で見る</div></div><div class="vids">` + keys.map(k => { const v = VIDEO_LIST[k]; return `<a class="vid" href="${yt + v[0]}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#e2577f"/><path d="M10 7.5l7 4.5-7 4.5z" fill="#fff"/></svg><span><b>${esc(v[1])}</b><small>${esc(v[2])}・${esc(v[3])}</small></span></a>`; }).join('') + `</div><p class="small">YouTube がべつの画面でひらきます。おうちの人や先生といっしょに見よう。学校の端末では見られないことがあります。</p>`;
}
function openStar(i) {
  const s = SKY.stars[i], cid = SKY.conIds[s[4]], cn = cid ? conName(cid) : '';
  const a = ASTRO.altAz(s[0], s[1], S.time, S.lat, S.lon);
  const c = bvColor(s[3]).map(x => Math.round(x * 255));
  let h = `<h2>${magName(s[2])}の星</h2><div class="tags"><span class="tag"><i style="background:rgb(${c})"></i>${s[3] > 1.3 ? '赤っぽい' : s[3] > 0.8 ? 'オレンジっぽい' : s[3] > 0.45 ? '黄色っぽい' : s[3] < -0.05 ? '青白い' : '白い'}色</span>${cn ? `<span class="tag">${cn}</span>` : ''}</div>`;
  h += `<p>${cn ? cn + 'の星の1つです。' : ''}このアプリでは名前をしょうかいしていない星です。${magName(s[2])}は${s[2] < 2.5 ? 'とても明るい' : s[2] < 3.5 ? 'よく見える' : '空が暗い所なら見える'}星です。</p>`;
  h += `<div class="now${a.alt > 0 ? '' : ' no'}">${a.alt > 0 ? `いまは<b>${dirName(a.az)}の空</b>、高さ${Math.round(a.alt)}°。` : 'いまは地平線の下です。'}</div>`;
  if (cid && FEAT.has(cid)) h += `<div class="btns"><button class="btn" id="toCon">${cn}をくわしく</button></div>`;
  openSheet(h, 'info');
  const b = $('#toCon'); if (b) b.onclick = () => openInfo(cid);
  S.target = null; S.targetActive = false; $('#targetChip').style.display = 'none'; ringAt = STARV[i];
}
function nearCon(p) {
  const v = eq(p.ra, p.dec); let best = '', bd = 9;
  for (const id in SKY.lines) SKY.lines[id].forEach(l => l.forEach(q => { const d = v.distanceToSquared(eq(q[0], q[1])); if (d < bd) { bd = d; best = id; } }));
  return conName(best);
}
function moonName(ph) {
  const a = ph.age;
  if (a < 1.5 || a > 28.5) return '新月（見えない月）';
  if (a < 5) return '三日月のような細い月';
  if (a < 6.5) return '三日月より太い月';
  if (a < 9) return '上弦（じょうげん）の月（右側が光る半月）';
  if (a < 13.5) return '半月より太い月';
  if (a < 16.5) return '満月';
  if (a < 21) return '満月から少し欠けた月';
  if (a < 23.5) return '下弦（かげん）の月（左側が光る半月）';
  return '明け方の細い月';
}
function doStamp(id) {
  const d = new Date(); stamps[id] = (d.getMonth() + 1) + '/' + d.getDate(); store.set('stamps', stamps);
  const n = Object.keys(stamps).length;
  toast(`<div style="font-size:30px">ポン！</div>${esc(OBJ[id].name)}のスタンプをおしたよ。<br>あつめたスタンプ ${n}こ`, 2600);
  if (navigator.vibrate) navigator.vibrate(60);
  openInfo(id);
}
function doTip(o) {
  closeSheet(); S.live = false;
  const t = new Date(S.time); if (sunAlt > -12) { t.setHours(20, 0, 0, 0); } S.time = t; updateSky();
  if (o.action === 'south') { flyTo(180, 35, 90); S.play = 60; }
  if (o.action === 'north') { flyTo(0, S.lat, 90); S.play = 60; }
  toast('時間を早送りしています。<br>とめるときは「じかん」から。', 2600);
}

// 目あて
let ringAt = null;
function setTarget(id, quiet) {
  if (quiet && S.targetActive && S.target === id) return;
  S.target = id; ringAt = null; S.targetActive = !quiet;
  const o = OBJ[id], a = altAzOf(o);
  $('#targetName').textContent = 'さがしている：' + o.name;
  $('#targetChip').style.display = quiet ? 'none' : 'flex';
  if (!quiet) {
    flyTo(a.az, a.alt, ARTS[id] ? artFov(id, a.alt) : o.kind === 'con' || o.kind === 'ast' ? 75 : 55);
    if (a.alt < 0) toast(`${esc(o.name)}は、いまは地平線の下です。<br>地面をすかして見せています。`, 2600);
    foundShown = false;
  }
}
$('#targetX').onclick = () => { S.target = null; S.targetActive = false; $('#targetChip').style.display = 'none'; };

/* ---------- 各画面 ---------- */
let searchTab = 'con', onlyVis = false;
function openSearch(q) {
  const tabs = [['con', '星座'], ['star', '星'], ['ast', '星のならび'], ['pl', '惑星（わくせい）と月'], ['tip', 'まめちしき']];
  let h = `<h2>さがす</h2><div class="search"><input id="q" type="search" placeholder="名前を入れてね（例：べが、さそり）" value="${esc(q || '')}" enterkeyhint="search"></div>`;
  h += `<div class="tabs">${tabs.map(t => `<button data-t="${t[0]}" class="${t[0] === searchTab && !q ? 'on' : ''}">${t[1]}</button>`).join('')}</div>`;
  h += `<label class="onlyVis"><input type="checkbox" id="ov" ${onlyVis ? 'checked' : ''}>いま空に出ているものだけ</label><div class="grid" id="res"></div>`;
  openSheet(h, 'search');
  const input = $('#q');
  input.addEventListener('input', () => { renderRes(); });
  sb.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { searchTab = b.dataset.t; input.value = ''; sb.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); renderRes(); });
  $('#ov').onchange = e => { onlyVis = e.target.checked; renderRes(); };
  renderRes();
}
function renderRes() {
  const q = hira($('#q').value.trim());
  let ids;
  if (q) ids = Object.keys(OBJ).filter(id => { const o = OBJ[id]; return hira(o.name + o.yomi).includes(q) || hira(o.name).includes(q) || (o.yomi || '').split(' ').some(y => hira(y).includes(q)); });
  else ids = { con: CONS.map(c => c.id), star: STARS.map(s => 's' + s.hip), ast: ASTERISMS.map(a => a.id), pl: [...PLANETS.map(p => p.id), 'moon', 'sun'], tip: TIPS.map(t => t.id) }[searchTab];
  let html = '';
  ids.forEach(id => {
    const o = OBJ[id]; let vis = false;
    if (o.kind !== 'tip') { const a = altAzOf(o); vis = a.alt > (o.kind === 'con' ? 5 : 0); }
    if (onlyVis && !vis && o.kind !== 'tip') return;
    const sub = o.kind === 'con' ? (o.season === 'all' ? '一年中' : SEASON_NAME[o.season] + 'の星座') : o.kind === 'star' ? conName(o.con) : o.kind === 'ast' ? SEASON_NAME[o.season] + 'の夜' : o.kind === 'planet' ? '惑星' : o.kind === 'tip' ? 'まめちしき' : '';
    html += `<button class="card" data-id="${id}">${vis ? '<span class="vis">いま空にある</span>' : ''}<b>${esc(o.name)}</b><small>${esc(sub)}</small>${stamps[id] ? '<svg class="stp" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#e2577f"/><path d="M12 5l2 4.2 4.6.6-3.3 3.2.8 4.6L12 15.4 7.9 17.6l.8-4.6L5.4 9.8 10 9.2z" fill="#fff"/></svg>' : ''}</button>`;
  });
  $('#res').innerHTML = html || '<p class="small">見つかりませんでした。ひらがなで入れてみてね。</p>';
  $('#res').querySelectorAll('.card').forEach(b => b.onclick = () => openInfo(b.dataset.id));
}

let timeBase = null;
function openTime() {
  timeBase = new Date(S.time);
  const sp = S.play;
  let h = `<h2>じかん</h2><div class="bigtime" id="bt"></div>
  <input type="range" id="tr" min="-720" max="720" step="10" value="0" aria-label="時間をずらす">
  <div class="small" style="display:flex;justify-content:space-between"><span>◀ 12時間前</span><span>12時間後 ▶</span></div>
  <div class="steps">${[['月', 'M'], ['日', 'D'], ['時', 'h'], ['10分', 'm']].map(s => `<div class="step"><div>${s[0]}</div><div class="row"><button data-s="${s[1]}" data-d="-1">−</button><button data-s="${s[1]}" data-d="1">＋</button></div></div>`).join('')}</div>
  <div class="btns"><button class="btn main" id="tNow">いまにもどす</button><button class="btn" id="tP1">${sp === 10 ? '■ とめる' : '▶ ゆっくり進める'}</button><button class="btn" id="tP2">${sp === 60 ? '■ とめる' : '▶▶ はやく進める'}</button></div>
  <div class="set"><div>季節の夜にする</div><div class="seasons"><button class="btn" data-se="4,20,21">春</button><button class="btn" data-se="8,5,20">夏</button><button class="btn" data-se="10,20,20">秋</button><button class="btn" data-se="1,20,20">冬</button></div></div>
  <p class="small">▶をおすと、星が東から南を通って西へ動くようすが見られます。北の空では、北極星のまわりをまわります。</p>`;
  openSheet(h, 'time');
  const tr = $('#tr');
  tr.oninput = () => { S.live = false; S.play = 0; S.time = new Date(timeBase.getTime() + tr.value * 60000); updateSky(); showBT(); };
  sb.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    const t = new Date(S.time), d = +b.dataset.d;
    ({ M: () => t.setMonth(t.getMonth() + d), D: () => t.setDate(t.getDate() + d), h: () => t.setHours(t.getHours() + d), m: () => t.setMinutes(t.getMinutes() + 10 * d) })[b.dataset.s]();
    setTime(t);
  });
  $('#tNow').onclick = () => { S.live = true; S.play = 0; S.time = new Date(); updateSky(); openTime(); };
  $('#tP1').onclick = () => { S.play = S.play === 10 ? 0 : 10; S.live = false; openTime(); };
  $('#tP2').onclick = () => { S.play = S.play === 60 ? 0 : 60; S.live = false; openTime(); };
  sb.querySelectorAll('[data-se]').forEach(b => b.onclick = () => {
    const [m, d, hh] = b.dataset.se.split(',').map(Number), now = new Date(); let y = now.getFullYear();
    const t = new Date(y, m - 1, d, hh, 0, 0); if (t < now - 86400000 * 30) t.setFullYear(y + 1);
    S.play = 0; setTime(t); flyTo(180, 40, 90);
  });
  showBT();
}
function setTime(t) { S.live = false; S.time = t; timeBase = new Date(t); const tr = $('#tr'); if (tr) tr.value = 0; updateSky(); showBT(); }
function showBT() { const e = $('#bt'); if (e) e.textContent = fmtDate(S.time) + ' ' + fmtTime(S.time); }
function updateTimeChip() {
  $('#timeText').textContent = innerWidth < 420 ? fmtTime(S.time) : (innerWidth < 600 ? (S.time.getMonth() + 1) + '/' + S.time.getDate() : fmtDate(S.time)) + ' ' + fmtTime(S.time); // せまい画面は時刻だけ（日付は「じかん」に出る）
  const b = $('#liveBadge'); b.textContent = S.live ? 'いま' : S.play ? '早送り' : innerWidth < 480 ? '別の時間' : 'ちがう時間'; b.classList.toggle('off', !S.live); b.classList.toggle('play', !!S.play); $('#timeChip').classList.toggle('off', !S.live);
}

function openPlace() {
  const C = [['札幌', 43.06, 141.35], ['仙台', 38.27, 140.87], ['東京', 35.68, 139.69], ['名古屋', 35.18, 136.91], ['大阪', 34.69, 135.5], ['広島', 34.39, 132.46], ['福岡', 33.59, 130.4], ['那覇', 26.21, 127.68]];
  let h = `<h2>見る場所</h2><p class="small">いる場所によって、見える星が少しずつちがいます。北にいるほど北極星が高く見えます。</p>
  <div class="btns"><button class="btn main" id="gps">いまいる場所を使う</button></div><div class="set"><div>町をえらぶ</div><div class="seg">${C.map(c => `<button data-c="${c.join(',')}" class="${S.place === c[0] ? 'on' : ''}">${c[0]}</button>`).join('')}</div></div>`;
  openSheet(h, 'place');
  $('#gps').onclick = () => getGps(true);
  sb.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const [n, la, lo] = b.dataset.c.split(','); setPlace(n, +la, +lo); openPlace(); });
}
function setPlace(name, lat, lon, aim) { S.place = name; S.lat = lat; S.lon = lon; $('#placeName').textContent = name; store.set('place', [name, lat, lon]); updateSky(); if (aim) aimStart(); }
function getGps(fromSheet) {
  if (!navigator.geolocation) { toast('このタブレットでは場所がわかりません。<br>町をえらんでね。'); return; }
  showLoading('いる場所をしらべています…');
  navigator.geolocation.getCurrentPosition(p => {
    hideLoading(); setPlace('いまいる場所', Math.round(p.coords.latitude * 100) / 100, Math.round(p.coords.longitude * 100) / 100, !fromSheet);
    toast('いる場所の空にしました。'); if (fromSheet) closeSheet();
  }, () => { hideLoading(); toast('場所がわかりませんでした。<br>町をえらんでね。'); if (!fromSheet) openPlace(); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

function openStamps() {
  const groups = [['星座', CONS.map(c => c.id)], ['星のならび', ASTERISMS.map(a => a.id)], ['名前のある星', STARS.map(s => 's' + s.hip)], ['惑星（わくせい）と月', [...PLANETS.map(p => p.id), 'moon']]];
  const n = STAMPABLE.filter(id => stamps[id]).length;
  let h = `<h2>スタンプちょう</h2><p class="small">本物の空で見つけたら、説明の画面で「本物の空で見つけた！」をおそう。このタブレットの中だけに残ります。</p>
  ${canSave ? '' : '<div class="warn">このブラウザでは保存ができないため、画面をとじるとスタンプが消えます。</div>'}<div style="font-weight:900;font-size:18px">${n} / ${STAMPABLE.length} こ</div><div class="prog"><div style="width:${n / STAMPABLE.length * 100}%"></div></div>`;
  groups.forEach(([t, ids]) => {
    h += `<div class="set"><div>${t}</div></div><div class="grid st">` + ids.map(id => `<button class="card stamp${stamps[id] ? ' got' : ''}" data-id="${id}"><div class="seal">${stamps[id] ? '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#fff"/></svg>' : ''}</div><b>${esc(OBJ[id].name)}</b><small>${stamps[id] ? esc(stamps[id]) : 'まだ'}</small></button>`).join('') + '</div>';
  });
  openSheet(h, 'stamp');
  sb.querySelectorAll('.card').forEach(b => b.onclick = () => openInfo(b.dataset.id));
}

function openSettings() {
  const seg = (key, opts) => `<div class="seg">${opts.map(o => `<button data-k="${key}" data-v='${JSON.stringify(o[0])}' class="${S[key] === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div>`;
  let h = `<h2>せってい</h2>
  <div class="set"><div>星の数</div>${seg('magLim', [[3.5, 'すくない'], [4.5, 'ふつう'], [5, 'おおい']])}</div>
  <div class="btns"><button class="btn main" id="toView">線や名前の見せ方を変える</button></div>
  <div class="set"><div>地面</div>${seg('seeThru', [[false, 'ふつう'], [true, 'すかして地平線の下も見る']])}</div>
  <div class="btns"><button class="btn" id="clrSt">スタンプをぜんぶ消す</button></div>
  <p class="small">星の位置・明るさ・色・星座の線：d3-celestial のデータ（ヒッパルコス星表をもとにしたもの）。Copyright (c) 2015, Olaf Frohn. All rights reserved. BSD 3-Clause License（全文は下）。<br>惑星：NASA JPL の軌道の数字から計算。月：Meeus の計算方法。どれも、およそ0.5°以内のずれです。月と太陽は見やすいように大きめにかいています。<br>場所の情報は、星の見え方の計算だけに使い、どこにも送りません。</p><details class="small"><summary>d3-celestial のライセンス（英語）</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(LICENSE_D3)}</pre></details>`;
  openSheet(h, 'set');
  sb.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; S[k] = JSON.parse(b.dataset.v); store.set(k, S[k]); applySettings(); openSettings(); });
  $('#toView').onclick = openView;
  $('#clrSt').onclick = () => ask('スタンプをぜんぶ消しますか？<br>もとにはもどせません。', [['消す', () => { for (const k in stamps) delete stamps[k]; store.set('stamps', stamps); toast('消しました。'); }], ['やめる', null]]);
}
function applySettings() { starMat.uniforms.magLim.value = S.magLim; minorGroup.visible = S.lines === 'all'; }
// 見え方：線や名前を、見せたいものだけにする（おすとすぐ空がかわる）
function openView() {
  const seg = (key, opts) => `<div class="seg">${opts.map(o => `<button data-k="${key}" data-v='${JSON.stringify(o[0])}' class="${S[key] === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div>`;
  const onoff = [[true, '見せる'], [false, 'かくす']];
  let h = `<h2>見え方</h2><p class="small">見せたいものだけにできます。おすと、すぐに空がかわります。</p>
  <div class="btns"><button class="btn" id="vStar">星だけにする</button><button class="btn" id="vAll">ぜんぶ見せる</button></div>
  <div class="set"><div>星座の線</div>${seg('lines', [['none', '出さない'], ['feat', '20の星座'], ['all', 'ぜんぶ（88）']])}</div>
  ${typeof ARTS !== 'undefined' ? `<div class="set"><div>星座の絵</div>${seg('showArt', [[false, 'えらんだ星座だけ'], [true, 'ぜんぶ見せる']])}</div>` : ''}
  <div class="set"><div>星座の名前</div>${seg('nameCon', onoff)}</div>
  <div class="set"><div>星の名前</div>${seg('nameStar', onoff)}</div>
  <div class="set"><div>惑星と月の名前</div>${seg('namePl', onoff)}</div>
  <div class="set"><div>星のならび（大三角など）</div>${seg('showAst', onoff)}</div>
  <div class="set"><div>方角（東・西・南・北）</div>${seg('showDir', onoff)}</div>
  <p class="small">かくしていても、さがした星や星座は光って出ます。名前をかくしている間は、星座は「さがす」から選べます。</p>`;
  openSheet(h, 'view');
  const setAll = v => { Object.entries(v).forEach(([k, x]) => { S[k] = x; store.set(k, x); }); applySettings(); openView(); };
  sb.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; S[k] = JSON.parse(b.dataset.v); store.set(k, S[k]); applySettings(); openView(); });
  $('#vStar').onclick = () => setAll({ lines: 'none', nameCon: false, nameStar: false, namePl: false, showAst: false, showArt: false });
  $('#vAll').onclick = () => setAll({ lines: 'feat', nameCon: true, nameStar: true, namePl: true, showAst: true, showDir: true });
}

/* ---------- 月の形と動き（3Dの模型） ---------- */
let moonR = null;
function openMoon() {
  const ph = ASTRO.moonPhase(S.time), a = altAzOf(OBJ.moon);
  const times = moonTimes();
  let h = `<h2>月の形と動き</h2><div class="moonRow"><canvas id="mNow" width="220" height="220"></canvas><div><div style="font-size:20px;font-weight:900">${moonName(ph)}</div><div class="small">新月から${Math.round(ph.age)}日ごろの月</div>
  <div class="small" style="margin-top:6px">${a.alt > 0 ? `いまは<b style="color:#fff">${dirName(a.az)}の空</b>` : 'いまは地平線の下'}</div>
  <div class="small">${times}</div></div></div>
  <div class="set"><div>うちゅうから見ると</div></div><div class="small">月を指でつかんで、地球のまわりを回してみよう。ほかの所を動かすと、見る向きがかわります。</div><div class="small">大きさときょりは、本当とはちがいます。うちゅうから見る見方は、中学校でくわしく学びます。</div><div id="moonHolder"></div>
  <input type="range" id="mAge" min="0" max="29.5" step="0.1" value="${ph.age.toFixed(1)}" aria-label="月齢">
  <div class="moonRow" style="margin-top:0"><canvas id="mSee" width="160" height="160" style="width:80px;height:80px"></canvas><div class="small" id="mSeeT"></div></div>
  <p class="small">月は地球のまわりをまわっています。太陽の光が当たっている半分だけが光るので、地球から見ると形がかわって見えます。形は、約30日（およそ1か月）でもとにもどります。月も、東からのぼって南を通り、西へしずみます。</p>
  <div class="set"><div>これから30日の月（タップするとその日の夜の空になります）</div></div><div class="strip" id="strip"></div>
  <div class="btns">${stampBtn('moon')}</div>${videoHtml('moon')}`;
  openSheet(h, 'moon');
  drawPhase($('#mNow'), ph.frac);
  const st = $('#strip'); const base = new Date(S.time); base.setHours(19, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const d = new Date(base.getTime() + i * 86400000), p = ASTRO.moonPhase(d);
    const b = document.createElement('button'); if (i === 0) b.className = 'today';
    const c = document.createElement('canvas'); c.width = c.height = 72; drawPhase(c, p.frac);
    if (!p.waxing) c.style.transform = 'scaleX(-1)';
    b.appendChild(c); b.appendChild(document.createTextNode((d.getMonth() + 1) + '/' + d.getDate()));
    b.onclick = () => { setTime(d); closeSheet(); const m = altAzOf(OBJ.moon); setTarget('moon'); if (m.alt < 0) { } };
    st.appendChild(b);
  }
  if (!ph.waxing) $('#mNow').style.transform = 'scaleX(-1)';
  const sbtn = sb.querySelector('[data-a]'); if (sbtn) sbtn.onclick = () => sbtn.dataset.a === 'stamp' ? doStamp('moon') : ask('このスタンプを消しますか？', [['消す', () => { delete stamps.moon; store.set('stamps', stamps); openMoon(); }], ['やめる', null]]);
  initMoonModel(ph.age);
}
function moonTimes() {
  const d0 = new Date(S.time); d0.setHours(0, 0, 0, 0);
  let prev = null, rise = null, set = null, top = null, best = -99;
  for (let m = 0; m <= 1440; m += 10) {
    const t = new Date(d0.getTime() + m * 60000), a = altAzOf(OBJ.moon, t).alt;
    if (prev != null) { if (prev < 0 && a >= 0 && !rise) rise = t; if (prev >= 0 && a < 0 && !set) set = t; }
    if (a > best) { best = a; top = t; } prev = a;
  }
  return [rise ? 'のぼる ' + fmtTime(rise) + 'ごろ' : '', best > 0 ? '南の空でいちばん高い ' + fmtTime(top) + 'ごろ' : '', set ? 'しずむ ' + fmtTime(set) + 'ごろ' : ''].filter(Boolean).join('<br>');
}
let moonCv3 = null;
function initMoonModel(age) {
  if (!moonCv3) { moonCv3 = document.createElement('canvas'); moonCv3.id = 'moonCanvas3d'; }
  $('#moonHolder').appendChild(moonCv3);
  const cv = moonCv3; const w = cv.clientWidth || 320, h = 240;
  if (!moonR) {
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    sc.add(new THREE.AmbientLight(0xffffff, 0.08));
    const L = new THREE.DirectionalLight(0xffffff, 1.4); L.position.set(10, 0, 0); sc.add(L);
    // 地球
    const ec = document.createElement('canvas'); ec.width = 256; ec.height = 128; const x = ec.getContext('2d');
    x.fillStyle = '#2a6fd6'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#3fae5a';
    [[40, 40, 30, 22], [70, 85, 18, 26], [140, 45, 40, 20], [150, 80, 16, 14], [210, 90, 22, 14]].forEach(([a, b, c, d]) => { x.beginPath(); x.ellipse(a, b, c, d, 0, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 8); x.fillRect(0, 120, 256, 8);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(ec) })); sc.add(earth);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16), new THREE.MeshLambertMaterial({ color: 0xdddccc })); sc.add(moon);
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * Math.PI * 2) * 4, 0, Math.sin(i / 64 * Math.PI * 2) * 4))), new THREE.LineBasicMaterial({ color: 0x55658f }));
    sc.add(orbit);
    // 太陽の光の矢印
    for (let i = -1; i <= 1; i++) { const ar = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(7.6, 0, i * 2.4), 1.9, 0xffd54a, 0.5, 0.35); sc.add(ar); }
    const sunB = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffd54a })); sunB.position.set(9.2, 0, 0); sc.add(sunB);
    const mk = (t, c) => { const cc = document.createElement('canvas'); cc.width = 256; cc.height = 64; const g = cc.getContext('2d'); g.font = 'bold 40px sans-serif'; g.fillStyle = c; g.textAlign = 'center'; g.fillText(t, 128, 46); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cc) })); s.scale.set(3.4, 0.85, 1); return s; };
    const lS = mk('太陽の光', '#ffd54a'); lS.position.set(7.2, 0.3, -4.0); sc.add(lS);
    const lE = mk('地球', '#9fd0ff'); lE.position.set(0, 1.8, 0); sc.add(lE);
    const lM = mk('月', '#fff4cf'); sc.add(lM);
    moonR = { r, sc, cam, earth, moon, lM, th: 1.75, ph: 0.95, age };
    const ptr = { on: false };
    const rc = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    const ndc = e => { const b = cv.getBoundingClientRect(); return new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); };
    const onMoon = e => { const b = cv.getBoundingClientRect(), p = moonR.moon.position.clone().project(moonR.cam); return Math.hypot((p.x + 1) / 2 * b.width - (e.clientX - b.left), (1 - p.y) / 2 * b.height - (e.clientY - b.top)) < 44; };
    // 月をつかんだら、指のある方向へ月を動かす（地球から見た形もいっしょにかわる）
    const moveMoon = e => {
      rc.setFromCamera(ndc(e), moonR.cam); if (!rc.ray.intersectPlane(plane, hit)) return;
      let el = Math.atan2(-hit.z, hit.x); if (el < 0) el += Math.PI * 2;
      moonR.age = el / (Math.PI * 2) * 29.530589; const sl = $('#mAge'); if (sl) sl.value = moonR.age.toFixed(1); drawMoonModel();
    };
    cv.addEventListener('pointerdown', e => { ptr.on = true; ptr.moon = onMoon(e); ptr.x = e.clientX; ptr.y = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = ptr.moon ? 'grabbing' : 'move'; if (ptr.moon) moveMoon(e); });
    cv.addEventListener('pointermove', e => {
      if (!ptr.on) { cv.style.cursor = onMoon(e) ? 'grab' : 'move'; return; }
      if (ptr.moon) { moveMoon(e); return; }
      moonR.th -= (e.clientX - ptr.x) * 0.01; moonR.ph = Math.max(0.1, Math.min(1.45, moonR.ph - (e.clientY - ptr.y) * 0.01)); ptr.x = e.clientX; ptr.y = e.clientY; drawMoonModel();
    });
    const release = () => { ptr.on = false; ptr.moon = false; cv.style.cursor = 'move'; };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => cv.addEventListener(n, release));
  } else { moonR.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); }
  moonR.r.setSize(w, h, false); moonR.cam.aspect = w / h; moonR.cam.updateProjectionMatrix();
  moonR.age = age;
  const sl = $('#mAge'); sl.oninput = () => { moonR.age = +sl.value; drawMoonModel(); };
  drawMoonModel();
}
function drawMoonModel() {
  const m = moonR; if (!m || !document.body.contains(m.r.domElement)) return;
  const el = m.age / 29.530589 * Math.PI * 2; // 0=新月（太陽の側）
  // 太陽は +x の方向。北から見て反時計まわり
  m.moon.position.set(Math.cos(el) * 4, 0, -Math.sin(el) * 4);
  m.lM.position.copy(m.moon.position).add(new THREE.Vector3(0, 1.1, 0));
  m.earth.rotation.y += 0.002;
  const hf = Math.atan(Math.tan(20 * D2R) * m.cam.aspect), dist = Math.max(12, 7.8 / Math.tan(hf) + 2);
  m.cam.position.set(2.2 + Math.cos(m.th) * dist * Math.cos(m.ph), Math.sin(m.ph) * dist, Math.sin(m.th) * dist * Math.cos(m.ph));
  m.cam.lookAt(2.2, 0, 0);
  m.r.render(m.sc, m.cam);
  const frac = (1 - Math.cos(el)) / 2, c = $('#mSee');
  if (c) { drawPhase(c, frac); c.style.transform = m.age > 14.77 ? 'scaleX(-1)' : ''; $('#mSeeT').innerHTML = '地球から見ると、こんな形<br><b style="color:#fff">' + moonName({ age: m.age }) + '</b>'; }
}

/* ---------- クイズ ---------- */
// きほん：4年「月と星」(ｱ)月の形と位置 (ｲ)星の明るさと色 (ｳ)星の集まりの並び方と位置／6年「月と太陽」月の輝いている側に太陽
// [学年, 問題, 選択肢（1つ目が正解）, 説明, 空で見せるもの, グループ（同じグループは1回に1問だけ。答えが分かってしまうのをふせぐ）]
const KIHON = [
  ['4年', '月の形は、日によってどうなる？', ['かわって見える', 'いつも満月', 'いつも半月', '1年に1回だけかわる'], '月は三日月や満月など、日によって形がかわって見えます。'],
  ['4年', '月は、1日のうちでどのように動く？', ['東から南を通って西へ', '西から南を通って東へ', '北から南へ', '動かない'], '月も太陽と同じように、東からのぼり、南の空を通って、西へしずみます。'],
  ['4年', '月や星の位置を調べるとき、目じるしにするとよいものは？', ['木や建物', '雲', '飛行機', '自分の影'], '動かない木や建物を目じるしにすると、位置のかわり方がよくわかります。'],
  ['4年', '方位を調べるときに使う道具は？', ['方位磁針', '虫めがね', '温度計', '電流計'], '方位磁針で東西南北をたしかめてから観察します。'],
  ['4年', '空の星の明るさは？', ['明るい星と暗い星がある', 'みんな同じ明るさ', '夜中だけ明るい', '冬はみんな暗い'], '空には、明るさのちがう星があります。明るい星から1等星、2等星…とよびます。'],
  ['4年', '星の色は？', ['青白い星や赤い星など、色がちがう', 'みんな白', 'みんな黄色', '日によってかわる'], '星には、青白い色や赤い色など、色のちがいがあります。'],
  ['4年', 'さそり座の赤い1等星は？', ['アンタレス', 'ベガ', 'シリウス', 'リゲル'], 'アンタレスは赤い星の代表。夏の南の低い空で光ります。', 's80763'],
  ['4年', 'オリオン座の赤い星は？', ['ベテルギウス', 'リゲル', 'デネブ', 'スピカ'], 'オリオン座では、赤いベテルギウスと青白いリゲルの色のちがいがよくわかります。', 's27989', 'ori'],
  ['4年', 'オリオン座の青白い星は？', ['リゲル', 'ベテルギウス', 'アンタレス', 'アルデバラン'], 'リゲルは青白い星。オリオンの足もとで光ります。', 's24436', 'ori'],
  ['4年', 'ベガ・デネブ・アルタイルをむすんだ形を何という？', ['夏の大三角', '冬の大三角', '北斗七星', '秋の四辺形'], '夏の夜、頭の上の高い空に見える大きな三角形です。', 'summer3', 's3'],
  ['4年', '夏の大三角に入っていない星は？', ['アンタレス', 'ベガ', 'デネブ', 'アルタイル'], '夏の大三角は、ベガ（こと座）・デネブ（はくちょう座）・アルタイル（わし座）です。', 'summer3', 's3'],
  ['4年', '七夕のおりひめ星（しょくじょ星）は？', ['ベガ', 'アルタイル', 'デネブ', 'アンタレス'], 'こと座のベガがおりひめ星、わし座のアルタイルがひこ星です。', 's91262', 's3'],
  ['4年', '時間がたつと、星の集まり（星座）の並び方はどうなる？', ['かわらない', '大きくなる', 'くずれる', '星と星の間が広がる'], '並び方はかわりませんが、位置がかわります。', 'tip-move', 'narabi'],
  ['4年', '時間がたつと、星の集まりの位置はどうなる？', ['かわる', 'かわらない', '消える', '小さくなる'], '星の集まりは、時間がたつと位置がかわります（並び方はかわりません）。', 'tip-move', 'narabi'],
  ['4年', '南の空の星は、時間がたつとどのように動く？', ['東から南を通って西へ', '西から南を通って東へ', '南から北へ', '動かない'], '南の空の星も、太陽や月と同じように、東から南の空を通って西へ動いて見えます。（北の空の星は、北極星のまわりをまわります）', 'tip-move', 'move'],
  ['4年（発展）', '北の空で、ほとんど動かない星は？', ['北極星', 'シリウス', 'ベガ', 'アンタレス'], '北極星は真北にあって、ほとんど動きません。ほかの北の星は、北極星のまわりをまわります。', 's11767', 'kita'],
  ['4年（発展）', '北極星をさがす目じるしになる星のならびは？', ['北斗七星', '夏の大三角', 'すばる', 'オリオンの三つ星'], '北斗七星のひしゃくの先の2つの星を5倍のばすと、北極星があります。カシオペヤ座も目じるしになります。', 'hokuto', 'kita'],
  ['6年', '月の光っている側には、何がある？', ['太陽', '地球', '北極星', '何もない'], '月の輝いている側に、太陽があります。', 'moon'],
  ['6年', '月の形の見え方がかわるのは、何との位置関係による？', ['太陽と月', '月と北極星', '月と雲', '月と地平線'], '月の形の見え方は、太陽と月の位置関係によってかわります。', 'moon'],
  ['6年', '夕方、太陽がしずむ西の空のそばに見える細い月は？', ['三日月', '満月', '下弦（かげん）の月', '新月'], '三日月は太陽の近くにあるので、夕方の西の空に見え、すぐにしずみます。'],
  ['6年', '夕方、東の空からのぼってくる月の形は？', ['満月', '三日月', '上弦（じょうげん）の月', '新月'], '満月は太陽と反対の方向にあるので、太陽がしずむころ東からのぼります。'],
  ['6年', '夕方、南の空に見える半月。光っているのは、どちら側？', ['右側', '左側', '上側', '下側'], '夕方、太陽は西（南を向いて右）にあります。月の光っている側に太陽があるので、右が光ります。'],
  ['6年', '昼間の月を観察するとき、ぜったいにしてはいけないことは？', ['太陽を直接見る', '方位磁針を使う', '木を目じるしにする', '時刻を記録する'], '太陽を直接見ると目をいためます。月の位置と太陽の方向をたしかめるときも、太陽は見ないようにします。']
];
const KIHON_CONS = ['Lyr', 'Aql', 'Cyg', 'Sco', 'Ori'];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, n, not) => shuffle(arr.filter(x => !not || !not.includes(x))).slice(0, n);
const CONCEPT = [
  ['南の空の星は、時間がたつとどのように動く？', ['東から南を通って西へ', '西から南を通って東へ', '北から南へ', '動かない'], '南の空の星は、太陽と同じように、東からのぼり、南の空を通って西へしずみます。'],
  ['北の空で、ほとんど動かない星は？', ['北極星', 'シリウス', 'ベガ', 'アンタレス'], '北極星は真北にあって、ほとんど動きません。ほかの北の星は、北極星のまわりをまわります。'],
  ['1等星と3等星、明るく見えるのはどっち？', ['1等星', '3等星', '同じ', '日によってちがう'], '数が小さいほど明るい星です。'],
  ['時間がたつと、星座の形はどうなる？', ['かわらない', '大きくなる', '星と星の間が広がる', 'ばらばらになる'], '位置はかわりますが、星のならび方（形）はかわりません。'],
  ['夏の大三角に入っていない星は？', ['アンタレス', 'ベガ', 'デネブ', 'アルタイル'], '夏の大三角は、ベガ・デネブ・アルタイル。アンタレスはさそり座の赤い星です。'],
  ['月が光って見えるのはなぜ？', ['太陽の光をはね返しているから', '自分で光っているから', '地球の光が当たるから', '星の光を集めているから'], '月は自分では光りません。太陽の光が当たっている所が光って見えます。'],
  ['冬の大三角に入っている星は？', ['シリウス', 'ベガ', 'スピカ', 'アンタレス'], '冬の大三角は、ベテルギウス・プロキオン・シリウスです。'],
  ['夕方、東の空からのぼってくる月の形は？', ['満月', '三日月', '上弦（じょうげん）の月', '新月'], '満月は太陽の反対側にあるので、太陽がしずむころ東からのぼります。']
];
function makeQuiz(level) {
  const qs = [];
  if (level === 'kihon') {
    pick(KIHON_CONS, 3).forEach(id => { const c = OBJ[id]; qs.push({ type: 'shape', con: id, tag: '4年', q: '光っている線の星座はどれ？', ch: shuffle([c.name, ...pick(KIHON_CONS.filter(x => x !== id), 3).map(x => OBJ[x].name)]), ans: c.name, exp: `${c.name}です。${SEASON_NAME[c.season]}の夜に見えます。` }); });
    const used = new Set();
    shuffle(KIHON.slice()).filter(k => { if (k[5] && used.has(k[5])) return false; if (k[5]) used.add(k[5]); return true; }).slice(0, 7).forEach(k => qs.push({ type: 'text', tag: k[0], q: k[1], ch: shuffle(k[2].slice()), ans: k[2][0], exp: k[3], show: k[4] && OBJ[k[4]] && OBJ[k[4]].pos ? k[4] : null }));
    return shuffle(qs);
  }
  pick(CONS, 4).forEach(c => qs.push({ type: 'shape', con: c.id, q: '光っている線の星座はどれ？', ch: shuffle([c.name, ...pick(CONS, 3, [c]).map(x => x.name)]), ans: c.name, exp: c.story }));
  const named = STARS.filter(s => !s.cluster);
  [['赤', '赤っぽく見える星はどれ？', ['白', '青白']], ['青白', '青白く見える星はどれ？', ['赤', 'オレンジ', '黄']]].forEach(([col, qq, others]) => {
    const s = pick(named.filter(x => x.color === col), 1)[0], wrong = pick(named.filter(x => others.includes(x.color)), 3);
    qs.push({ type: 'text', q: qq, ch: shuffle([s.name, ...wrong.map(x => x.name)]), ans: s.name, exp: `${s.name}は${col === '赤' ? '赤っぽい' : '青白い'}星。${s.note}`, show: 's' + s.hip });
  });
  pick(STARS.filter(s => !s.cluster), 2).forEach(s => { const cn = conName(s.con); qs.push({ type: 'text', q: `${s.name}は、何座の星？`, ch: shuffle([cn, ...pick(CONS.map(c => c.name), 3, [cn])]), ans: cn, exp: s.note, show: 's' + s.hip }); });
  pick(CONCEPT, 2).forEach(c => qs.push({ type: 'text', q: c[0], ch: shuffle(c[1].slice()), ans: c[1][0], exp: c[2] }));
  return shuffle(qs);
}
function startQuiz(level) {
  closeSheet(); stopFlyTarget();
  const saved = S.quiz && S.quiz.saved || { yaw: S.yaw, pitch: S.pitch, fov: S.fov };
  $('#quizBox').style.display = 'block'; setNav('quiz');
  if (!level) {
    S.quiz = { choosing: true, saved };
    $('#quizBox').innerHTML = `<div class="qn"><span>クイズ</span><button id="qEnd" style="color:var(--sub);font-weight:700">やめる</button></div><div class="q">どちらにする？</div>
    <div class="choices"><button id="lvK">きほん<br><small style="font-size:14px;color:var(--sub)">4年・6年の理科で習うこと</small></button><button id="lvC">チャレンジ<br><small style="font-size:14px;color:var(--sub)">いろいろな星座やお話</small></button></div>`;
    $('#lvK').onclick = () => startQuiz('kihon'); $('#lvC').onclick = () => startQuiz('challenge'); $('#qEnd').onclick = endQuiz;
    return;
  }
  S.quiz = { i: 0, score: 0, level, qs: makeQuiz(level), saved };
  showQ();
}
function stopFlyTarget() { S.target = null; S.targetActive = false; $('#targetChip').style.display = 'none'; }
function showQ() {
  const z = S.quiz, q = z.qs[z.i]; z.answered = false; S.quizCon = null;
  if (q.type === 'shape') { S.quizCon = q.con; const c = conCenter[q.con], a = ASTRO.altAz(c.ra, c.dec, S.time, S.lat, S.lon); flyTo(a.az, a.alt - (RAIL.matches ? 0 : 12), 80); }
  const box = $('#quizBox');
  box.innerHTML = `<div class="qn"><span>${z.i + 1} / ${z.qs.length} もん${q.tag ? `<b style="margin-left:8px;color:var(--gold)">${q.tag.includes('発展') ? '4年の発展' : q.tag + 'で習う'}</b>` : ''}</span><button id="qEnd" style="color:var(--sub);font-weight:700">やめる</button></div><div class="q">${esc(q.q)}</div><div class="choices">${q.ch.map(c => `<button>${esc(c)}</button>`).join('')}</div><div id="qExp"></div>`;
  box.querySelectorAll('.choices button').forEach(b => b.onclick = () => answer(b));
  $('#qEnd').onclick = endQuiz;
}
function answer(b) {
  const z = S.quiz, q = z.qs[z.i]; if (z.answered) return; z.answered = true;
  const ok = b.textContent === q.ans; if (ok) z.score++;
  $('#quizBox').querySelectorAll('.choices button').forEach(x => { if (x.textContent === q.ans) x.classList.add('ok'); else if (x === b) x.classList.add('ng'); });
  if (q.show && OBJ[q.show].kind !== 'tip') { const p = OBJ[q.show].pos(), a = ASTRO.altAz(p.ra, p.dec, S.time, S.lat, S.lon); flyTo(a.az, a.alt, 60); ringAt = eq(p.ra, p.dec, R); }
  S.quizReveal = q.type === 'shape' ? q.con : null;
  $('#qExp').innerHTML = `<p class="exp"><b style="color:${ok ? 'var(--green)' : 'var(--gold)'}">${ok ? 'せいかい！' : 'こたえは「' + esc(q.ans) + '」'}</b> ${esc(q.exp)}</p><div class="btns"><button class="btn main" id="qNext">${z.i + 1 < z.qs.length ? 'つぎへ' : 'けっかを見る'}</button></div>`;
  $('#qNext').onclick = () => { ringAt = null; S.quizReveal = null; z.i++; if (z.i < z.qs.length) showQ(); else showResult(); };
}
function showResult() {
  const z = S.quiz; S.quizCon = null;
  const msg = z.score >= 9 ? '星のはかせだね！' : z.score >= 6 ? 'よく知っているね！' : z.score >= 3 ? '星となかよくなってきたね。' : 'これから星を見るのが楽しみだね。';
  $('#quizBox').innerHTML = `<div class="q" style="text-align:center;font-size:24px">${z.qs.length}もん中 ${z.score}もん せいかい</div><p style="text-align:center;font-size:18px">${msg}</p><div class="btns"><button class="btn main" id="qAgain">もう一回</button><button class="btn" id="qOther">${z.level === 'kihon' ? 'チャレンジへ' : 'きほんへ'}</button><button class="btn" id="qEnd2">おわる</button></div>`;
  $('#qAgain').onclick = () => startQuiz(z.level);
  $('#qOther').onclick = () => startQuiz(z.level === 'kihon' ? 'challenge' : 'kihon');
  $('#qEnd2').onclick = endQuiz;
}
function endQuiz() {
  const s = S.quiz && S.quiz.saved; S.quiz = null; S.quizCon = null; S.quizReveal = null; ringAt = null;
  $('#quizBox').style.display = 'none'; setNav(null); if (s) flyTo(s.yaw, Math.max(-20, s.pitch), s.fov); updateSky();
}

/* ---------- 下のボタン ---------- */
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => {
  const p = b.dataset.p;
  if (S.quiz && p !== 'quiz') endQuiz();
  if (p === 'sensor') { closeSheet(); S.sensor ? stopSensor() : startSensor(); setNav(null); return; }
  if (sheetKind === p) { closeSheet(); return; }
  ({ search: openSearch, time: openTime, moon: openMoon, stamp: openStamps, quiz: () => S.quiz ? endQuiz() : startQuiz() })[p]();
});
$('#placeChip').onclick = openPlace;
$('#timeChip').onclick = openTime;
$('#setChip').onclick = openSettings;

/* ---------- 全画面 ---------- */
// iPad・Android・Chromebook はブラウザの全画面。iPhone は全画面のしくみが無いので「ホーム画面に追加」を案内する
// ホーム画面から開いたかは、起動したときに1回だけ見る（全画面にした後は display-mode が fullscreen になる端末があるため）
const launchedStandalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const isStandalone = () => launchedStandalone;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsAble = () => { const el = document.documentElement; return !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled); };
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
function showHomeGuide() {
  const share = '<svg viewBox="0 0 24 24"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 11v9h14v-9" fill="none" stroke="#ffd54a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  ask(`アドレスバーのない、広い画面で使うには<ol><li>ブラウザの 共有ボタン ${share} をおす</li><li>「ホーム画面に追加」をえらぶ</li><li>ホーム画面にできた「ほしぞらナビ」から ひらく</li></ol><span style="font-size:15px;color:var(--sub)">ホーム画面から ひらくと、スタンプや場所の設定は べつになります。</span>`, [['わかった', null]]);
}
function toggleFullscreen() {
  if (fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  if (fsAble()) {
    const el = document.documentElement, r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (r && r.catch) r.catch(fsFail);
  } else if (isIOS) showHomeGuide();
  else toast('このブラウザでは、全画面にできません。');
}
function updateFsChip() {
  const on = !!fsElement();
  $('#fsChip').style.display = isStandalone() ? 'none' : '';
  $('#fsIcon').setAttribute('d', on ? 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5' : 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5');
  $('#fsChip').setAttribute('aria-label', on ? '全画面をやめる' : '全画面');
}
$('#fsChip').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', () => { updateFsChip(); setTimeout(resize, 200); });
document.addEventListener('webkitfullscreenchange', () => { updateFsChip(); setTimeout(resize, 200); });
const fsFail = () => { isIOS ? showHomeGuide() : toast('このブラウザでは、全画面にできませんでした。'); };
document.addEventListener('fullscreenerror', fsFail);
document.addEventListener('webkitfullscreenerror', fsFail);
updateFsChip();
$('#viewChip').onclick = () => sheetKind === 'view' ? closeSheet() : openView();
$('#toNight').onclick = () => { const t = new Date(S.time); if (t.getHours() < 12) t.setDate(t.getDate() - 1); t.setHours(20, 0, 0, 0); setTime(t); toast('夜8時の空にしました。'); };

/* ---------- 小さなお知らせ ---------- */
let toastT = null;
function toast(html, ms) { const t = $('#toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2200); }
function ask(html, btns) {
  $('#dlgText').innerHTML = html; const w = $('#dlgBtns'); w.innerHTML = '';
  btns.forEach(([t, fn], i) => { const b = document.createElement('button'); b.className = 'btn' + (i === 0 ? ' main' : ''); b.textContent = t; b.onclick = () => { $('#dialog').style.display = 'none'; if (fn) fn(); }; w.appendChild(b); });
  $('#dialog').style.display = 'flex';
}
function showLoading(t) { const l = $('#loading'); l.innerHTML = '<div class="spin"></div><div>' + t + '</div>'; l.style.display = 'flex'; }
function hideLoading() { $('#loading').style.display = 'none'; }

/* ---------- 毎フレーム ---------- */
const fwd = new THREE.Vector3();
const RAIL = matchMedia('(orientation:landscape) and (max-height:560px)');
let cover = 0; // 右の列と右から出た説明でかくれる幅。空のまん中をその分左へずらす
function coverTarget() { if (!RAIL.matches || S.cam) return 0; let c = $('#nav').offsetWidth; if (S.quiz) c += $('#quizBox').offsetWidth; return c; }
// 横向きで説明を右から出したとき、その星が説明の下にかくれるなら、見える所まで向きを回す
function keepVisible(id) {
  if (!RAIL.matches || S.sensor || S.quiz) return;
  const o = OBJ[id]; if (!o || !o.pos) return; const p = o.pos(); if (!p) return;
  const sp = screenOf(eq(p.ra, p.dec, R).applyMatrix4(sky.matrix)); if (!sp) return;
  const left = innerWidth - $('#nav').offsetWidth - sheet.offsetWidth;
  if (sp.x > left - 50) flyTo(S.yaw + (sp.x - left / 2) * S.fov / innerHeight, S.pitch);
}
let lastT = performance.now(), lastSky = 0, foundShown = false;
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (S.cam) camFov(); }
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 300)); // iPadは回した直後の大きさが遅れて変わる
const onTurn = () => { S.azNudge = store.get(nudgeKey(), 0); showNudge(); }; // 持ちかえたら、コンパスの合わせ直しと方角なおしを切りかえる
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onTurn); else addEventListener('orientationchange', onTurn);
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S.play) { S.time = new Date(S.time.getTime() + S.play * 60000 * dt); updateSky(); if (sheetKind === 'time') showBT(); }
  else if (S.live && now - lastSky > 1000) { S.time = new Date(); updateSky(); lastSky = now; }
  stepFly(now);
  if (S.sensor && ori) camera.quaternion.slerp(sensorQuat(), 0.22);
  else camera.rotation.set(S.pitch * D2R, -S.yaw * D2R, 0);
  const ct = coverTarget(); cover = Math.abs(ct - cover) < 1 ? ct : cover + (ct - cover) * 0.2;
  camera.aspect = (innerWidth + cover) / innerHeight;
  if (cover > 0.5) camera.setViewOffset(innerWidth + cover, innerHeight, cover, 0, innerWidth, innerHeight); else camera.clearViewOffset();
  camera.fov = S.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const sc = renderer.getPixelRatio() * Math.pow(70 / S.fov, 0.45) * Math.min(1.25, Math.max(0.85, innerHeight / 800));
  starMat.uniforms.scale.value = sc; planetMat.uniforms.scale.value = sc; window.__milky.uniforms.scale.value = renderer.getPixelRatio() * 70 / S.fov;
  // 線の色
  const hl = S.quiz ? S.quizCon : S.target && OBJ[S.target] && OBJ[S.target].kind === 'con' ? S.target : null;
  for (const id in conMesh) {
    const m = conMesh[id].material, on = id === hl;
    m.color.set(on ? 0xffd54a : 0x6fa8ff); m.opacity = on ? 1 : S.quiz ? 0.35 : 0.75;
    conMesh[id].visible = on || S.lines !== 'none';
  }
  const ha = S.target && OBJ[S.target] && OBJ[S.target].kind === 'ast' ? S.target : null;
  for (const id in astMesh) { astMesh[id].visible = !S.quiz && (S.showAst || id === ha); astMesh[id].material.opacity = id === ha ? 0.95 : 0.45; astMesh[id].material.color.set(id === ha ? 0xffd54a : 0xff8fc0); }
  minorGroup.visible = S.lines === 'all' && !S.quiz;
  LINE_K.value = Math.max(0.3, Math.min(1, S.fov / 70));
  // 星座の絵：えらんだ星座は濃く、「ぜんぶ見せる」のときはほかの星座もうすく。クイズ中は答えになるので出さない
  for (const id in ARTS) {
    const want = S.quiz ? 0 : id === hl ? 0.9 : S.showArt ? 0.28 : 0;
    if (!want && !artMesh[id]) continue;
    const m = artFor(id); if (!m) continue;
    const o = m.material.opacity + (want - m.material.opacity) * Math.min(1, dt * 5);
    m.material.opacity = Math.abs(o - want) < 0.01 ? want : o; m.visible = m.material.opacity > 0.005;
  }
  const tgtBelow = S.target && OBJ[S.target] && OBJ[S.target].kind !== 'tip' && altAzOf(OBJ[S.target]).alt < 0;
  groundMat.opacity = S.quiz || S.seeThru || tgtBelow ? 0.45 : S.cam ? 0.35 : 0.9;
  // 月の光っている側を太陽へ向ける
  const ms = screenOf(moonSpr.position.clone().applyMatrix4(sky.matrix));
  if (ms) {
    const toward = moonSpr.position.clone().normalize().lerp(sunSpr.position.clone().normalize(), 0.02).multiplyScalar(R).applyMatrix4(sky.matrix);
    const ss = screenOf(toward); if (ss) moonSpr.material.rotation = Math.atan2(-(ss.y - ms.y), ss.x - ms.x);
  }
  renderer.render(scene, camera);
  updateLabels();
  updateHud();
}
function updateLabels() {
  camera.getWorldDirection(fwd);
  const unset = S.sensor && ori && ori.head != null && !absMode && iosOffset == null;
  $('#labels').style.visibility = unset ? 'hidden' : '';
  const W = innerWidth, H = innerHeight;
  labels.forEach(L => {
    let show = true;
    if (L.minor && S.lines !== 'all') show = false;
    if (L.ast && !S.showAst && L.id !== S.target) show = false;
    if (L.id !== S.target) {
      if (L.cls.startsWith('con') && !S.nameCon) show = false;
      if (L.cls === 'star' && !S.nameStar) show = false;
      if ((L.cls === 'planet' || L.cls === 'moon' || L.cls === 'sun') && !S.namePl) show = false;
    }
    if (L.cls.startsWith('dir') && !S.showDir) show = false;
    if (S.quiz && !L.cls.startsWith('dir') && !(S.quizReveal && L.id === S.quizReveal)) show = false;
    if (L.id === 'sun' && sunAlt < -2 && S.target !== 'sun') show = false;
    let p = null;
    if (show) {
      const v = L.getVec().clone(); if (L.frame === 'sky') v.applyMatrix4(sky.matrix);
      const alt = v.y / v.length();
      if (fwd.dot(v) <= 0) show = false;
      else { p = screenOf(v); if (!p || p.x < -80 || p.x > W + 80 || p.y < -40 || p.y > H + 40) show = false; }
      if (show) L.el.classList.toggle('below', alt < -0.01 && L.frame === 'sky');
    }
    if (!show) { if (L.vis !== false) { L.el.style.display = 'none'; L.vis = false; } return; }
    if (L.vis !== true) { L.el.style.display = ''; L.vis = true; }
    L.el.classList.toggle('hit', !!L.id && (L.id === S.target || L.id === S.quizReveal));
    L.el.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y + (L.dy || 0))}px) translate(-50%,-50%)`;
  });
  // 目あての丸と矢印
  const ring = $('#ring'), arrow = $('#arrow'), hint = $('#hint');
  let tv3 = null;
  if (ringAt) tv3 = ringAt.clone().applyMatrix4(sky.matrix);
  else if (S.target && OBJ[S.target] && OBJ[S.target].pos) { const p = OBJ[S.target].pos(); if (p) tv3 = eq(p.ra, p.dec, R).applyMatrix4(sky.matrix); }
  if (!tv3) { ring.style.display = arrow.style.display = hint.style.display = 'none'; $('#found').style.display = 'none'; return; }
  const sp = fwd.dot(tv3.clone().normalize()) > 0 ? screenOf(tv3) : null;
  const rail = RAIL.matches, cx = (W - cover) / 2, cy = rail ? H / 2 : H / 2 - 10;
  const inView = sp && sp.x > 30 && sp.x < W - Math.max(cover, rail ? $('#nav').offsetWidth : 0) - 30 && sp.y > (rail ? 50 : 90) && sp.y < H - (rail ? 40 : 110);
  if (inView) {
    ring.style.display = 'block'; ring.style.transform = `translate(${sp.x}px,${sp.y}px)`; arrow.style.display = 'none';
    const big = S.target && OBJ[S.target] && (OBJ[S.target].kind === 'con' || OBJ[S.target].kind === 'ast'); ring.style.width = ring.style.height = big ? '120px' : '64px'; ring.style.opacity = S.target && ARTS[S.target] && !S.quiz ? '0.3' : ''; ring.style.margin = big ? '-60px 0 0 -60px' : '-32px 0 0 -32px';
  } else ring.style.display = 'none';
  if (!inView && S.target && S.targetActive && !S.quiz) {
    const c = tv3.clone().applyMatrix4(camera.matrixWorldInverse); let ang = Math.atan2(c.y, c.x);
    if (c.z > 0 && Math.hypot(c.x, c.y) < 1) ang = Math.PI / 2;
    const rx = (W - cover) / 2 - 50, ry = H / 2 - (rail ? 110 : 130), k = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
    arrow.style.display = 'block';
    arrow.style.transform = `translate(${cx + Math.cos(ang) * k}px,${cy - Math.sin(ang) * k}px) rotate(${90 - ang * R2D}deg)`;
    hint.style.display = 'block';
    const deg = ang * R2D;
    hint.textContent = (deg > 45 && deg < 135 ? 'もっと上' : deg < -45 && deg > -135 ? 'もっと下' : Math.abs(deg) <= 45 ? 'もっと右' : 'もっと左') + 'に、' + OBJ[S.target].name;
  } else { arrow.style.display = 'none'; hint.style.display = 'none'; }
  // かざして見つけた
  if (S.sensor && S.target && S.targetActive && sp && !foundShown && tv3.y > 0 && (sunAlt < -6 || S.target === 'moon')) {
    if (Math.hypot(sp.x - cx, sp.y - H / 2) < Math.min(W, H) * 0.12) {
      foundShown = true; const f = $('#found'); f.style.display = 'block'; if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      setTimeout(() => { f.style.display = 'none'; if (S.target) openInfo(S.target); }, 1500);
    }
  }
}
function updateHud() {
  const az = ASTRO.norm(Math.atan2(fwd.x, -fwd.z) * R2D), alt = Math.asin(Math.max(-1, Math.min(1, fwd.y))) * R2D;
  const waiting = S.sensor && ori && ori.head != null && !absMode && iosOffset == null;
  const t = waiting ? '<b>前（地平線のほう）に向けてね</b>' : `<b>${dirName(az)}</b>の空 ・ 高さ${Math.round(alt)}°`;
  if (updateHud.l !== t) { $('#hud').innerHTML = t; updateHud.l = t; }
}

/* ---------- はじめる ---------- */
// はじめの向き：いま見やすい「星のならび」の方へ。なければ南
function aimStart() {
  S.yaw = 180; S.pitch = 35; S.fov = innerWidth < innerHeight ? 80 : 70;
  if (sunAlt > -6) return;
  for (const a of ASTERISMS) { const h = altAzOf(OBJ[a.id]); if (h.alt > 20 && h.alt < 72) { S.yaw = h.az; S.pitch = Math.min(50, h.alt); return; } }
}
function boot() {
  resize(); applySettings();
  const pl = store.get('place', null);
  if (pl) setPlace(pl[0], pl[1], pl[2]); else updateSky();
  hideLoading();
  requestAnimationFrame(frame);
  aimStart();
  if (!pl) {
    $('#start').style.display = 'flex';
    $('#startGps').onclick = () => { $('#start').style.display = 'none'; getGps(false); };
    $('#startTokyo').onclick = () => { $('#start').style.display = 'none'; setPlace('東京', 35.68, 139.69, true); };
  }
  window.__hzn = { S, ASTRO, sky, camera, OBJ, altAzOf, updateSky, openInfo, setTarget, labels, startQuiz };
}
boot();
})();
