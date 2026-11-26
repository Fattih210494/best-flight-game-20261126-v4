// WebAudio synth only — no audio files. Engine hum, ring chime, UI clicks,
// landing arpeggio. Everything guards for a missing/suspended AudioContext
// (headless browsers), so the game never crashes on sound.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;

function ac() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch { ctx = null; }
  return ctx;
}

export function ensureAudio() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  return c;
}

// Start the engine hum (called on engine-on and on first user gesture).
export function startEngine() {
  const c = ensureAudio();
  if (!c || engineOsc) return;
  try {
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = c.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(c.destination);
    engineOsc.start();
  } catch { engineOsc = null; }
}

export function setEngine(throttle, speed) {
  if (!engineOsc || !ctx) return;
  try {
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(0.02 + throttle * 0.05, t, 0.1);
    engineOsc.frequency.setTargetAtTime(48 + throttle * 40 + speed * 0.15, t, 0.1);
    engineFilter.frequency.setTargetAtTime(280 + throttle * 700, t, 0.1);
  } catch { /* ignore */ }
}

export function stopEngine() {
  if (!engineOsc || !ctx) return;
  try {
    engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    const osc = engineOsc;
    setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 600);
  } catch { /* ignore */ }
  engineOsc = null;
}

function note(freq, when, dur = 0.28, vol = 0.12) {
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g).connect(c.destination);
    o.start(when);
    o.stop(when + dur + 0.05);
  } catch { /* ignore */ }
}

// Three-note ascending chime on a ring pass.
export function ringChime() {
  const c = ensureAudio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  note(660, t);
  note(880, t + 0.12);
  note(1320, t + 0.24, 0.4, 0.14);
}

// Short click for UI buttons.
export function click() {
  const c = ensureAudio();
  if (!c) return;
  note(920, c.currentTime + 0.01, 0.06, 0.06);
}

// Little landing arpeggio.
export function landJingle() {
  const c = ensureAudio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  [523, 659, 784, 1046].forEach((f, i) => note(f, t + i * 0.13, 0.3, 0.12));
}
