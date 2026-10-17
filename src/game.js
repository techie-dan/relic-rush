import * as THREE from 'three';
import { buildHuman } from './character.js';
import * as platform from './platform.js';

const ISLAND = 16;
const RELIC_COUNT = 10;
const ROUND = 75;
const WALK = 5.4;
const RUN = 8.4;

const $ = (id) => document.getElementById(id);
const ui = {
  overlay: $('overlay'),
  title: $('title'),
  message: $('message'),
  play: $('play'),
  signin: $('signin'),
  save: $('save-note'),
  board: $('board'),
  hud: $('hud'),
  face: $('player-face'),
  name: $('player-name'),
  account: $('player-account'),
  signInBtn: $('player-sign-in'),
  relicCount: $('relic-count'),
  timeLeft: $('time-left'),
};

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#7ec8e3');
scene.fog = new THREE.Fog('#7ec8e3', 28, 70);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
const clock = new THREE.Clock();

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}

function addMesh(geo, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildWorld() {
  const sun = new THREE.DirectionalLight('#fff4d6', 2.1);
  sun.position.set(18, 28, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  scene.add(sun, new THREE.HemisphereLight('#cfefff', '#3d5a3a', 0.85));

  const water = addMesh(new THREE.CircleGeometry(80, 48), mat('#1b6f8a', { roughness: 0.35, metalness: 0.1 }), 0, -0.6, 0);
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = false;

  const island = addMesh(new THREE.CylinderGeometry(ISLAND, ISLAND + 0.6, 1.2, 64), mat('#5d8a3d'), 0, -0.55, 0);
  island.receiveShadow = true;

  const sand = addMesh(new THREE.CylinderGeometry(ISLAND - 0.35, ISLAND - 0.2, 0.18, 64), mat('#cbb07a'), 0, 0.08, 0);

  const grass = addMesh(new THREE.CircleGeometry(ISLAND - 1.1, 48), mat('#6ea34a'), 0, 0.18, 0);
  grass.rotation.x = -Math.PI / 2;

  const stone = mat('#8b8174');
  const gold = mat('#e8b84a', { metalness: 0.55, roughness: 0.35 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r = 6 + (i % 3) * 2.4;
    const ruin = addMesh(new THREE.BoxGeometry(1.1, 0.7 + (i % 3) * 0.35, 0.7), stone, Math.cos(a) * r, 0.5, Math.sin(a) * r);
    ruin.rotation.y = a;
  }
  addMesh(new THREE.CylinderGeometry(0.55, 0.7, 2.2, 8), stone, 0, 1.2, -4.2);
  addMesh(new THREE.ConeGeometry(0.4, 0.5, 5), gold, 0, 2.5, -4.2);

  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * (ISLAND - 4.5);
    const rock = addMesh(
      new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.28),
      mat('#7a7268'),
      Math.cos(a) * r,
      0.28,
      Math.sin(a) * r,
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
  }
}

buildWorld();

let identity = { user: null, guest: platform.DEFAULT_GUEST };
let player = platform.DEFAULT_GUEST;
let human = null;
let state = 'boot';
let relics = [];
let shades = [];
let collected = 0;
let remaining = ROUND;
let lastSaved = null;

const keys = new Set();
const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
};
const held = (name) => KEYS[name].some((k) => keys.has(k));

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let yaw = 0.7;
let pitch = 0.28;
let distance = 7.2;
let dragging = null;

canvas.addEventListener('pointerdown', (e) => {
  dragging = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - dragging.x) * 0.006;
  pitch = THREE.MathUtils.clamp(pitch + (e.clientY - dragging.y) * 0.004, 0.08, 1.1);
  dragging = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  distance = THREE.MathUtils.clamp(distance * (1 + Math.sign(e.deltaY) * 0.1), 4, 14);
}, { passive: false });

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function showOverlay(title, message, { play = false, signIn = false } = {}) {
  ui.title.textContent = title;
  ui.message.textContent = message;
  ui.play.hidden = !play;
  ui.signin.hidden = !signIn;
  ui.overlay.hidden = false;
}

function fillPlayerCard() {
  ui.name.textContent = player.name;
  ui.account.textContent = identity.user?.account ? `@${identity.user.account}` : 'Not signed in';
  ui.face.src = player.face || '';
  ui.face.alt = player.name;
  ui.signInBtn.hidden = !!identity.user;
  ui.signInBtn.onclick = platform.signIn;
}

function spawnHuman() {
  if (human) {
    scene.remove(human.root);
    human.dispose();
  }
  human = buildHuman(player.style ?? platform.DEFAULT_GUEST.style);
  human.root.position.set(0, 0.18, 2.4);
  human.root.rotation.y = Math.PI;
  scene.add(human.root);
}

function clearRelics() {
  for (const relic of relics) scene.remove(relic.mesh);
  relics = [];
}

function spawnRelics() {
  clearRelics();
  const gold = mat('#f4d35e', { emissive: '#b8860b', emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.25 });
  const used = [];
  while (relics.length < RELIC_COUNT) {
    const a = Math.random() * Math.PI * 2;
    const r = 3.2 + Math.random() * (ISLAND - 5.2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (used.some((p) => Math.hypot(p.x - x, p.z - z) < 2.4)) continue;
    used.push({ x, z });
    const mesh = addMesh(new THREE.OctahedronGeometry(0.38), gold, x, 1.05, z);
    mesh.castShadow = true;
    relics.push({ mesh, x, z, taken: false, phase: Math.random() * Math.PI * 2 });
  }
}

function spawnShades() {
  for (const s of shades) scene.remove(s.mesh);
  shades = [];
  const smoke = mat('#2a2433', { transparent: true, opacity: 0.72 });
  for (let i = 0; i < 3; i++) {
    const mesh = addMesh(new THREE.SphereGeometry(0.55, 16, 12), smoke, 0, 0.7, 0);
    shades.push({ mesh, radius: 5 + i * 3.2, speed: 0.35 + i * 0.12, offset: i * 2.1 });
  }
}

function startRound() {
  collected = 0;
  remaining = ROUND;
  lastSaved = null;
  ui.save.textContent = '';
  spawnHuman();
  spawnRelics();
  spawnShades();
  state = 'playing';
  ui.overlay.hidden = true;
  ui.hud.hidden = false;
  ui.relicCount.textContent = `Relics 0 / ${RELIC_COUNT}`;
  ui.timeLeft.textContent = formatTime(ROUND);
  clock.getDelta();
}

async function renderBoard() {
  const entries = await platform.getLeaderboard(10);
  ui.board.replaceChildren(...entries.map((e) => {
    const li = document.createElement('li');
    if (identity.user && e.player_id === identity.user.id) li.className = 'me';
    const left = document.createElement('span');
    left.textContent = `#${e.rank} ${e.name}`;
    const right = document.createElement('span');
    const relics = e.stats?.relics ?? e.score ?? 0;
    const time = e.stats?.time ?? 0;
    right.textContent = `${relics} relics · ${formatTime(time)}`;
    li.append(left, right);
    return li;
  }));
}

async function endRound(reason) {
  if (state !== 'playing') return;
  state = 'over';
  ui.hud.hidden = true;
  const timeLeft = Math.max(0, Math.floor(remaining));
  const signedIn = !!identity.user;
  showOverlay(
    reason,
    `You gathered ${collected} relic${collected === 1 ? '' : 's'} with ${formatTime(timeLeft)} left.`,
    { play: true, signIn: !signedIn },
  );

  if (signedIn) {
    const saved = await platform.saveScore({ relics: collected, time: timeLeft });
    if (saved?.ok) {
      lastSaved = saved.result;
      ui.save.textContent = saved.result.improved
        ? `New best! You're #${saved.result.rank}`
        : `Not your best this time (#${saved.result.rank})`;
    } else if (saved?.error) {
      ui.save.textContent = saved.error;
    }
  } else if (platform.START_NG) {
    ui.save.textContent = 'Sign in to save this run on the start.ng board.';
  } else {
    ui.save.textContent = 'Scores save once this game is live on start.ng.';
  }
  await renderBoard();
}

function applyIdentity(next) {
  identity = next;
  player = next.user ?? next.guest ?? platform.DEFAULT_GUEST;
  fillPlayerCard();
  if (state !== 'playing') spawnHuman();
}

function idleCamera(dt, t) {
  yaw += dt * 0.08;
  const focus = human?.root.position ?? new THREE.Vector3();
  camera.position.set(
    focus.x + Math.sin(yaw) * Math.cos(pitch) * 11,
    4.2 + Math.sin(t * 0.3) * 0.2,
    focus.z + Math.cos(yaw) * Math.cos(pitch) * 11,
  );
  camera.lookAt(focus.x, 1.2, focus.z);
}

function stepPlaying(dt, t) {
  remaining -= dt;
  if (remaining <= 0) {
    remaining = 0;
    endRound('Time’s up');
    return;
  }

  const pos = human.root.position;
  const f = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
  const r = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let mx = fx * f - fz * r;
  let mz = fz * f + fx * r;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const speed = held('run') ? RUN : WALK;
    pos.x += mx * speed * dt;
    pos.z += mz * speed * dt;
    const ry = human.root.rotation.y;
    const target = Math.atan2(mx, mz);
    const delta = Math.atan2(Math.sin(target - ry), Math.cos(target - ry));
    human.root.rotation.y = ry + delta * Math.min(1, dt * 12);
    human.setWalking(held('run') ? 1.8 : 1);
  } else {
    human.setWalking(0);
  }

  const radial = Math.hypot(pos.x, pos.z);
  if (radial > ISLAND - 0.8) {
    endRound('You fell in');
    return;
  }

  for (const shade of shades) {
    const a = t * shade.speed + shade.offset;
    shade.mesh.position.set(Math.cos(a) * shade.radius, 0.75 + Math.sin(t * 3 + shade.offset) * 0.12, Math.sin(a) * shade.radius);
    if (shade.mesh.position.distanceTo(pos) < 1.05) {
      remaining = Math.max(0, remaining - 1.5 * dt);
      pos.x += (pos.x - shade.mesh.position.x) * dt * 4;
      pos.z += (pos.z - shade.mesh.position.z) * dt * 4;
    }
  }

  for (const relic of relics) {
    if (relic.taken) continue;
    relic.mesh.position.y = 1.05 + Math.sin(t * 2.4 + relic.phase) * 0.18;
    relic.mesh.rotation.y = t * 1.6 + relic.phase;
    if (Math.hypot(pos.x - relic.x, pos.z - relic.z) < 1.15) {
      relic.taken = true;
      scene.remove(relic.mesh);
      collected += 1;
      ui.relicCount.textContent = `Relics ${collected} / ${RELIC_COUNT}`;
    }
  }

  if (collected >= RELIC_COUNT) {
    endRound('Island cleared');
    return;
  }

  human.update(t);
  const focus = new THREE.Vector3(pos.x, 1.45, pos.z);
  camera.position.set(
    focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    focus.y + Math.sin(pitch) * distance,
    focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  camera.lookAt(focus);
  ui.timeLeft.textContent = formatTime(remaining);
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (state === 'playing') stepPlaying(dt, t);
  else {
    human?.update(t);
    idleCamera(dt, t);
  }
  renderer.render(scene, camera);
});

ui.play.addEventListener('click', startRound);
ui.signin.addEventListener('click', platform.signIn);

async function boot() {
  platform.storeSessionFromHash();
  spawnHuman();
  showOverlay('Relic Rush', 'Finding who’s playing…');
  const next = await platform.whoami();
  applyIdentity(next);

  const signedIn = !!identity.user;
  const local = !platform.START_NG;
  showOverlay(
    'Relic Rush',
    signedIn
      ? `${player.name} is on the island. Gather every relic before the shades and the sea catch you.`
      : local
        ? 'Play as Guest. Sign-in and the leaderboard work after this game is live on start.ng.'
        : 'Play as Guest, or sign in so your start.ng look and scores come with you.',
    { play: true, signIn: !signedIn },
  );
  await renderBoard();

  platform.onUserChange((fresh) => {
    const was = identity.user?.id ?? null;
    const now = fresh.user?.id ?? null;
    if (was !== now) location.reload();
  });
}

boot();
