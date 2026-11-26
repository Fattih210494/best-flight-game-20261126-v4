// Flight model + autopilot. Arcade physics with gentle inertia: the ship's
// velocity is always along its nose, speed chases the throttle target, and
// steering banks the ship into turns. All angles in radians; heading 0 = +Z,
// pitch positive = nose up.
import * as THREE from 'three';
import { SHIP, RINGS, DECK, SPAWN, STEP } from './config.js';

export const STAGE = { TAXI: 0, LAUNCH: 1, RING1: 2, RING2: 3, RING3: 4, LAND: 5, DONE: 6 };

export function createFlight() {
  return {
    pos: new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z),
    heading: SPAWN.heading, // yaw, 0 = +Z
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    engineOn: false,
    flaps: 0, // 0..3
    spoilers: 0, // 0..2
    gearDown: true,
    brake: false,
    reverse: false,
    onFinal: false, // latched once the ship reaches the approach fix
    stage: STAGE.TAXI,
    ringsPassed: [false, false, false],
    landed: false,
    ringFlash: 0, // seconds left on the "+100" popup
    time: 0,
  };
}

// Forward unit vector from heading/pitch.
export function forwardOf(f) {
  const cp = Math.cos(f.pitch);
  return new THREE.Vector3(
    Math.sin(f.heading) * cp,
    Math.sin(f.pitch),
    Math.cos(f.heading) * cp,
  );
}

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// One fixed step. `ctl` = { yaw: -1..1, pitch: -1..1, throttle: 0..1,
// brake, reverse } — the pilot's demands for this step.
export function stepFlight(f, ctl, dt = STEP) {
  f.time += dt;
  if (ctl.throttle !== undefined) f.throttle = ctl.throttle;
  f.brake = !!ctl.brake;
  f.reverse = !!ctl.reverse;

  // Steering: yaw/pitch rates scale down a little at high speed (heavier feel).
  const agility = 1 - Math.min(f.speed / SHIP.maxSpeed, 1) * 0.35;
  const flapBonus = 1 + f.flaps * 0.08;
  const yawRate = (ctl.yaw || 0) * SHIP.maxYawRate * agility * flapBonus;
  const pitchRate = (ctl.pitch || 0) * SHIP.maxPitchRate * agility * flapBonus;
  f.heading += yawRate * dt;
  f.pitch = THREE.MathUtils.clamp(f.pitch + pitchRate * dt, -0.7, 0.7);
  // Bank into the turn: visual roll, eases back when level.
  const targetRoll = THREE.MathUtils.clamp(-yawRate * 1.1, -0.6, 0.6);
  f.roll += (targetRoll - f.roll) * Math.min(dt * 4, 1);

  // Speed: chase the throttle target; brake and spoilers slow us down.
  // speedMul comes from the Shop engine upgrade (1.0 + 0.1 per level).
  const maxSpeed = SHIP.maxSpeed * (f.speedMul || 1);
  let target = f.engineOn ? f.throttle * maxSpeed : 0;
  if (f.reverse) target = -18;
  if (f.brake) target = Math.min(target, 0);
  target *= 1 - f.spoilers * 0.22;
  const rate = f.speed < target ? SHIP.accel : (f.brake || f.spoilers > 0 ? SHIP.brakeDecel : SHIP.accel * 0.8);
  f.speed += THREE.MathUtils.clamp(target - f.speed, -rate * dt, rate * dt);
  if (Math.abs(f.speed) < 0.05 && target === 0) f.speed = 0;

  // Move along the nose.
  const fwd = forwardOf(f);
  f.pos.addScaledVector(fwd, f.speed * dt);

  // The deck is solid: never sink below it while over it.
  const overDeck = Math.abs(f.pos.x) < DECK.halfWidth && Math.abs(f.pos.z) < DECK.halfLength;
  if (overDeck && f.pos.y < DECK.centre.y) f.pos.y = DECK.centre.y;

  // Stage transitions.
  if (f.stage === STAGE.TAXI && f.engineOn && (f.speed > 8 || f.pos.y > DECK.centre.y + 1)) {
    f.stage = STAGE.LAUNCH;
  }
  if (f.stage === STAGE.LAUNCH && f.ringsPassed[0]) f.stage = STAGE.RING1;
  if (f.stage === STAGE.RING1 && f.ringsPassed[1]) f.stage = STAGE.RING2;
  if (f.stage === STAGE.RING2 && f.ringsPassed[2]) f.stage = STAGE.RING3;
  if (f.stage === STAGE.RING3) f.stage = STAGE.LAND;

  // Ring passes: within the ring's radius of its centre.
  for (let i = 0; i < 3; i++) {
    if (f.ringsPassed[i]) continue;
    const r = RINGS[i];
    const d = Math.hypot(f.pos.x - r.x, f.pos.y - r.y, f.pos.z - r.z);
    if (d < r.radius - 2) {
      f.ringsPassed[i] = true;
      f.ringFlash = 1.6;
    }
  }
  if (f.ringFlash > 0) f.ringFlash -= dt;

  // Landing: on the deck, slow, gear down, roughly along the deck axis.
  if (f.stage === STAGE.LAND && !f.landed) {
    const dx = Math.abs(f.pos.x - DECK.centre.x);
    const dz = Math.abs(f.pos.z - DECK.centre.z);
    const aligned = Math.abs(Math.sin(f.heading)) < 0.35; // nose along ±Z
    if (overDeck && f.pos.y <= DECK.centre.y + 0.6 && f.speed <= SHIP.minLandingSpeed && f.gearDown && aligned && dx < 22 && dz < 140) {
      f.landed = true;
      f.stage = STAGE.DONE;
      f.speed = 0;
      f.pos.y = DECK.centre.y;
    }
  }
  return f;
}

// ---- autopilot -------------------------------------------------------------
// Steers toward `target` (a {x,y,z}) with proportional yaw/pitch control and
// speed chosen by distance. Returns a ctl object for stepFlight. `slowNear`
// caps speed when close to the target (for the landing approach).
export function autopilotCtl(f, target, slowNear = false) {
  const dx = target.x - f.pos.x;
  const dy = target.y - f.pos.y;
  const dz = target.z - f.pos.z;
  const dist = Math.hypot(dx, dy, dz);
  const wantHeading = Math.atan2(dx, dz);
  const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
  const yawErr = clampAngle(wantHeading - f.heading);
  const pitchErr = THREE.MathUtils.clamp(wantPitch - f.pitch, -0.7, 0.7);
  const yaw = THREE.MathUtils.clamp(yawErr * 1.6, -1, 1);
  const pitch = THREE.MathUtils.clamp(pitchErr * 2.0, -1, 1);
  let throttle = 1;
  if (slowNear === 'final') {
    // Final approach: hold ~30 m/s so the ship is under the 34 m/s landing
    // limit when it reaches the deck, and the turn radius stays small enough
    // to stay on the centreline.
    throttle = 0.25;
  } else if (slowNear === 'fix') {
    // Slow down on the way to the approach fix, like the rings: at full
    // speed the turn radius (~330 m) is wider than the distance to the fix,
    // so the ship orbits it forever instead of reaching it.
    throttle = THREE.MathUtils.clamp(dist / 400, 0.3, 1);
  } else if (slowNear) {
    throttle = THREE.MathUtils.clamp(dist / 220, 0.12, 1);
  } else if (dist < 400) {
    // Slow down as we close in: at full speed the turn radius (~330 m) is
    // wider than the distance to the target, so a fast ship orbits the ring
    // forever instead of flying through it. At ~35 m/s the turn radius is
    // ~70 m, well inside the closing distance, so the pursuit spirals in.
    throttle = THREE.MathUtils.clamp(dist / 400, 0.28, 1);
  }
  // Slow down for big turns: a fast ship's turn radius is wider than the
  // course, so it overshoots the next ring and has to circle back instead
  // of lining up on it.
  if (Math.abs(yawErr) > 0.9) throttle = Math.min(throttle, 0.35);
  return { yaw, pitch, throttle, brake: false, reverse: false };
}

// The autopilot's current waypoint: next unpassed ring, then the approach fix,
// then the deck centre. Once the ship reaches the fix, the final approach is
// LATCHED: without the latch the ship ping-pongs between the fix and the deck
// (each time it flies toward the deck it drifts >120 m from the fix, the
// target flips back, and it never commits to landing).
export function autopilotTarget(f) {
  for (let i = 0; i < 3; i++) {
    if (!f.ringsPassed[i]) return { ...RINGS[i], slow: false };
  }
  if (f.onFinal) return { ...DECK.centre, slow: 'final' };
  const dFix = Math.hypot(f.pos.x - DECK.fix.x, f.pos.y - DECK.fix.y, f.pos.z - DECK.fix.z);
  if (dFix > 120) return { ...DECK.fix, slow: 'fix' };
  return { ...DECK.centre, slow: 'final' };
}

// One autopilot step: engine on, gear down for landing, brake on the deck.
export function autopilotStep(f, dt = STEP) {
  // Latch the final approach once the ship reaches the fix.
  if (!f.onFinal && f.ringsPassed.every(Boolean)) {
    const dFix = Math.hypot(f.pos.x - DECK.fix.x, f.pos.y - DECK.fix.y, f.pos.z - DECK.fix.z);
    if (dFix <= 120) f.onFinal = true;
  }
  const target = autopilotTarget(f);
  const ctl = autopilotCtl(f, target, target.slow);
  f.engineOn = true;
  const nearDeck = Math.hypot(f.pos.x - DECK.centre.x, f.pos.z - DECK.centre.z) < 160 && f.pos.y < 40;
  f.gearDown = true;
  if (f.stage === STAGE.LAND && nearDeck && f.speed > 30) ctl.throttle = 0.1;
  if (f.landed) { ctl.throttle = 0; ctl.brake = true; }
  return stepFlight(f, ctl, dt);
}

// Vertical speed, for the HUD.
export function vertSpeed(f) {
  return Math.sin(f.pitch) * f.speed;
}
