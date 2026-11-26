// Star Runway — Orbital Flight. Boot, render loop, chase camera, game states
// (title / play / end), ring-pass effects, and the headless sim mode (?sim=1).
import * as THREE from 'three';
import { STEP, STAGES, PALETTE, PAY, DECK } from './config.js';
import { buildShip } from './ship.js';
import { buildWorld } from './world.js';
import { createFlight, stepFlight, forwardOf, STAGE } from './physics.js';
import { createInput, bindJoystick } from './input.js';
import { createUI, loadSave } from './ui.js';
import { stageShot, createSimDriver } from './shots.js';
import * as audio from './audio.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const simMode = params.get('sim') === '1';

// ---- renderer / scene ------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
scene.fog = new THREE.Fog(0x02030a, 900, 4200);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 12000);
camera.position.set(0, 12, -150);

const world = buildWorld(scene);
const ship = buildShip();
ship.group.rotation.order = 'YXZ';
scene.add(ship.group);

// ---- state -----------------------------------------------------------------
const save = loadSave();
const flight = createFlight();
flight.speedMul = 1 + (save.engine || 0) * 0.1;
let screen = 'title'; // 'title' | 'play' | 'end'
let endShown = false;

if (shotName) {
  const staged = stageShot(shotName, flight);
  screen = staged.screen;
  if (screen === 'end') endShown = true; // end screen filled in below, after UI
} else if (simMode) {
  screen = 'play';
  flight.engineOn = true;
}

// ---- HUD -------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const els = {
  btnHangar: $('btn-hangar'), btnShop: $('btn-shop'), btnJobs: $('btn-jobs'), btnMissions: $('btn-missions'),
  panelHangar: $('panel-hangar'), panelShop: $('panel-shop'), panelJobs: $('panel-jobs'), panelMissions: $('panel-missions'),
  hangarNote: $('hangar-note'), shopCost: $('shop-cost'), shopBuy: $('shop-buy'), shopNote: $('shop-note'),
  jobAccept: $('job-accept'), jobNote: $('job-note'),
  money: $('money'), xp: $('xp'),
  progressItems: [...document.querySelectorAll('#progress li')],
  stageLabel: $('stage-label'),
  alt: $('hud-alt'), speed: $('hud-speed'), heading: $('hud-heading'),
  vert: $('hud-vert'), flaps: $('hud-flaps'), spoilers: $('hud-spoilers'),
  popup: $('popup'), minimap: $('minimap'),
  titleOverlay: $('title-overlay'), endOverlay: $('end-overlay'),
  endRings: $('end-rings'), endJob: $('end-job'), endBonus: $('end-bonus'), endTotal: $('end-total'),
  btnExit: $('btn-exit'), btnFlaps: $('btn-flaps'), btnSpoilers: $('btn-spoilers'),
  joystick: $('joystick'), joyKnob: $('joy-knob'),
  status: $('status'),
};
const ui = createUI(els, ship, save, {
  onEngineLevel: (level) => { flight.speedMul = 1 + level * 0.1; },
});
if (screen === 'title') els.titleOverlay.classList.add('open');
else els.titleOverlay.classList.remove('open'); // staged play/end shots start past the title
if (screen === 'end') {
  // The staged flight already landed; fill the end screen now.
  ui.showEnd(flight);
  endShown = true;
}

const input = createInput();
bindJoystick(input, els.joystick, els.joyKnob);

els.btnExit.addEventListener('click', () => {
  audio.click();
  resetToTitle();
});
els.btnFlaps.addEventListener('click', () => { audio.click(); cycleFlaps(); });
els.btnSpoilers.addEventListener('click', () => { audio.click(); cycleSpoilers(); });
$('btn-fly').addEventListener('click', () => startGame());
$('btn-again').addEventListener('click', () => {
  audio.click();
  resetToTitle();
  startGame();
});

function resetToTitle() {
  Object.assign(flight, createFlight());
  flight.speedMul = 1 + (save.engine || 0) * 0.1;
  for (const r of world.rings) {
    r.torusMat.emissive.setHex(PALETTE.ring);
    r.torusMat.emissiveIntensity = 1.2;
    r.halo.material.opacity = 0.55;
  }
  screen = 'title';
  endShown = false;
  els.endOverlay.classList.remove('show');
  els.titleOverlay.classList.add('open');
  audio.stopEngine();
}

function startGame() {
  audio.ensureAudio();
  audio.startEngine();
  flight.engineOn = true;
  screen = 'play';
  els.titleOverlay.classList.remove('open');
  els.status.textContent = 'Engine on. Fly the three rings, then land back on the deck.';
}

function cycleFlaps() {
  flight.flaps = (flight.flaps + 1) % 4;
  ui.showPopup(`Flaps ${flight.flaps}/3`, 900);
}
function cycleSpoilers() {
  flight.spoilers = (flight.spoilers + 1) % 3;
  ui.showPopup(`Spoilers ${flight.spoilers}/2`, 900);
}

// ---- ring-pass burst particles ---------------------------------------------
const BURST_N = 90;
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_N * 3), 3));
const burst = new THREE.Points(burstGeo, new THREE.PointsMaterial({
  color: 0xffc233, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0,
}));
burst.frustumCulled = false;
scene.add(burst);
let burstVel = [];
let burstLife = 0;
function spawnBurst(at) {
  burstVel = [];
  const pos = burstGeo.attributes.position.array;
  for (let i = 0; i < BURST_N; i++) {
    pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    const s = 12 + Math.random() * 26;
    burstVel.push(new THREE.Vector3(
      Math.sin(b) * Math.cos(a) * s,
      Math.cos(b) * s,
      Math.sin(b) * Math.sin(a) * s,
    ));
  }
  burstGeo.attributes.position.needsUpdate = true;
  burst.material.opacity = 1;
  burstLife = 1.2;
}
function updateBurst(dt) {
  if (burstLife <= 0) return;
  burstLife -= dt;
  const pos = burstGeo.attributes.position.array;
  for (let i = 0; i < BURST_N; i++) {
    pos[i * 3] += burstVel[i].x * dt;
    pos[i * 3 + 1] += burstVel[i].y * dt;
    pos[i * 3 + 2] += burstVel[i].z * dt;
  }
  burstGeo.attributes.position.needsUpdate = true;
  burst.material.opacity = Math.max(0, burstLife / 1.2);
}

// ---- camera ----------------------------------------------------------------
const camPos = new THREE.Vector3(0, 12, -150);
const camTarget = new THREE.Vector3(0, 4, -100);
if (shotName) {
  // Snap the chase camera to the staged ship: the camera lerps toward its
  // target over several frames, and a headless screenshot fires after only a
  // frame or two — without this the camera is still at the spawn point and
  // the ship (and the ring ahead) reads tiny and off-centre.
  const fwd0 = forwardOf(flight);
  camPos.copy(flight.pos).addScaledVector(fwd0, -17).add(new THREE.Vector3(0, 5, 0));
  camTarget.copy(flight.pos).addScaledVector(fwd0, 26);
}
function updateCamera(dt) {
  const fwd = forwardOf(flight);
  const wantPos = flight.pos.clone()
    .addScaledVector(fwd, -17)
    .add(new THREE.Vector3(0, 5, 0));
  const wantTarget = flight.pos.clone().addScaledVector(fwd, 26);
  if (shotName) {
    // Staged shots: snap every frame. The lerped camera lags badly at the
    // ~1 fps a headless SwiftShader render manages, and the screenshot fires
    // after only a frame or two — the ship read small and off-centre.
    camPos.copy(wantPos);
    camTarget.copy(wantTarget);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    return;
  }
  const k = 1 - Math.exp(-dt * 5);
  camPos.lerp(wantPos, k);
  camTarget.lerp(wantTarget, 1 - Math.exp(-dt * 7));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ---- sim driver (headless verification) ------------------------------------
const simDriver = simMode ? createSimDriver(flight) : null;
window.__simLog = [];
window.__simDone = false;
// Debug hook (verification only): scene/camera/world for projection checks.
window.__debug = { scene, camera, world, ship };
// Advance the simulation synchronously by `seconds` of sim time, without
// waiting on the render loop (headless SwiftShader renders slowly). The
// harness drives the flight with this and polls window.__simDone.
window.__simAdvance = (seconds) => {
  const n = Math.max(0, Math.round(seconds / STEP));
  for (let i = 0; i < n; i++) stepOnce(STEP);
  return flight.landed;
};

// ---- main loop -------------------------------------------------------------
let last = performance.now();
let acc = 0;
let ringsLit = 0;
let minimapTimer = 0;
let firstFrame = true;

function stepOnce(dt) {
  // Keys that act on press.
  if (input.wasPressed('KeyE')) {
    if (screen === 'play') {
      flight.engineOn = !flight.engineOn;
      if (flight.engineOn) { audio.startEngine(); ui.showPopup('Engine on', 900); }
      else { audio.stopEngine(); ui.showPopup('Engine off', 900); }
    }
  }
  if (input.wasPressed('KeyF') && screen === 'play') cycleFlaps();
  if (input.wasPressed('KeyG') && screen === 'play') cycleSpoilers();
  if (input.wasPressed('KeyL') && screen === 'play') {
    flight.gearDown = !flight.gearDown;
    ui.showPopup(flight.gearDown ? 'Gear down' : 'Gear up — land with gear down!', 1200);
  }
  if (input.wasPressed('Enter') && screen === 'title') startGame();

  if (screen === 'play') {
    if (simMode) {
      simDriver.step();
    } else {
      const ctl = input.ctl();
      if (ctl.throttle !== null) flight.throttle = ctl.throttle;
      stepFlight(flight, ctl, dt);
    }
    // Ring-pass effects.
    const passed = flight.ringsPassed.filter(Boolean).length;
    if (passed > ringsLit) {
      const i = passed - 1;
      const r = world.rings[i];
      r.torusMat.emissive.setHex(PALETTE.ringPassed);
      r.torusMat.emissiveIntensity = 2.0;
      r.halo.material.opacity = 0.25;
      spawnBurst(r.group.position);
      ui.showPopup('+100', 1600);
      audio.ringChime();
      ringsLit = passed;
    }
    if (flight.landed && !endShown) {
      endShown = true;
      screen = 'end';
      audio.stopEngine();
      ui.showEnd(flight);
    }
    if (simMode && flight.landed) {
      window.__simDone = true;
    }
    if (simMode) window.__simLog = simDriver.log;
  }

  // Ship mesh follows the flight state.
  ship.group.position.copy(flight.pos);
  ship.group.rotation.y = flight.heading;
  ship.group.rotation.x = -flight.pitch;
  ship.group.rotation.z = flight.roll;
  // Exhaust flames pulse with throttle while the engine runs.
  const flameOn = flight.engineOn && flight.throttle > 0.05 ? 0.25 + flight.throttle * 0.6 : 0;
  for (const fl of ship.flames) {
    fl.material.opacity = flameOn * (0.85 + Math.random() * 0.15);
    fl.scale.set(1, 1, 0.8 + flight.throttle * 0.7);
  }
  // Next ring pulses.
  const next = flight.ringsPassed.findIndex((p) => !p);
  world.rings.forEach((r, i) => {
    const s = i === next ? 1 + Math.sin(performance.now() / 260) * 0.05 : 1;
    r.group.scale.setScalar(s);
  });
  // Asteroids drift slowly.
  for (const rock of world.rocks) rock.rotation.y += rock.userData.spin * dt;

  updateBurst(dt);
  audio.setEngine(flight.engineOn ? flight.throttle : 0, Math.abs(flight.speed));
  ui.update(flight, dt);
  minimapTimer += dt;
  if (minimapTimer > 0.12) { minimapTimer = 0; ui.drawMinimap(flight); }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 8) {
    stepOnce(STEP);
    acc -= STEP;
    n++;
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    window.__gameReady = true;
    window.__flight = flight;
    window.__screen = () => screen;
    if (shotName) window.__shotReady = true;
  }
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
