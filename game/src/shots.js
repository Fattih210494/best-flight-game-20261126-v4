// Screenshot scenes behind ?shot=start|action|rings|end. Each one plays the
// real flight forward from a fresh state with the autopilot, so the frame is
// what a real game looks like, and the same scene always gives the same frame.
import { createFlight, autopilotStep, forwardOf, STAGE } from './physics.js';
import { RINGS } from './config.js';

const MAX_STEPS = 24000; // 400 s of flight, more than the whole course needs

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Run the autopilot until `stop(f)` is true, or the cap is hit.
function runUntil(f, stop) {
  for (let i = 0; i < MAX_STEPS; i++) {
    autopilotStep(f);
    if (stop(f)) return true;
  }
  return false;
}

// Angle (radians) between the ship's nose and the direction to `target`.
// The autopilot turns toward the target after passing a ring, so the ship
// first gets CLOSE while still mid-turn; a shot staged then has the ring
// far off-axis. Waiting for alignment as well puts the ring in frame.
function angleTo(f, target) {
  const dx = target.x - f.pos.x;
  const dy = target.y - f.pos.y;
  const dz = target.z - f.pos.z;
  const d = Math.hypot(dx, dy, dz);
  const fwd = forwardOf(f);
  const dot = (fwd.x * dx + fwd.y * dy + fwd.z * dz) / d;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Set `flight` to the named scene and return the screen to show over it.
 * - start: parked on the deck, title screen.
 * - action: mid-flight on the way home (ring 3 ahead, station ahead too).
 * - rings: approaching ring 1.
 * - end: landed, end screen.
 */
export function stageShot(name, flight) {
  const f = flight;
  Object.assign(f, createFlight());
  if (name === 'rings') {
    runUntil(f, (s) => dist3(s.pos, RINGS[0]) < 220 && angleTo(s, RINGS[0]) < 0.35);
    return { screen: 'play' };
  }
  if (name === 'action') {
    runUntil(f, (s) => s.ringsPassed[1] && dist3(s.pos, RINGS[2]) < 280 && angleTo(s, RINGS[2]) < 0.35);
    return { screen: 'play' };
  }
  if (name === 'end') {
    runUntil(f, (s) => s.landed);
    f.stage = STAGE.DONE;
    return { screen: 'end' };
  }
  // start (and any unknown name): parked on the deck, engine off.
  return { screen: 'title' };
}

// Drive the autopilot in real time for the headless sim harness (?sim=1).
// Returns a log array the harness reads through window.__simLog.
export function createSimDriver(flight) {
  const log = [];
  let lastStage = flight.stage;
  let lastRing = 0;
  return {
    log,
    step() {
      const before = flight.stage;
      autopilotStep(flight);
      const rings = flight.ringsPassed.filter(Boolean).length;
      if (rings !== lastRing) {
        lastRing = rings;
        log.push({ t: flight.time.toFixed(1), event: `ring ${rings} passed` });
      }
      if (flight.stage !== before) {
        log.push({ t: flight.time.toFixed(1), event: `stage ${before} -> ${flight.stage}` });
        lastStage = flight.stage;
      }
      if (flight.landed) log.push({ t: flight.time.toFixed(1), event: 'LANDED' });
      return flight.landed;
    },
  };
}
