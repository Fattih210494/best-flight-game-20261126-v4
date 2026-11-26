// Keyboard + on-screen joystick. Keys: W/S throttle, arrows elevator,
// A/D steer/bank, Space brake, F flaps, G spoilers, R reverse thrust,
// L gear, E engine, Enter start. The joystick (bottom-left) steers with the
// mouse or touch; its deflection feeds the same ctl object as the keys.
export function createInput() {
  const keys = new Set();
  const joy = { active: false, x: 0, y: 0 }; // -1..1 deflection
  const pressed = new Set(); // edge-triggered keys, consumed by the game

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    keys, joy, pressed,
    wasPressed(code) {
      if (pressed.has(code)) { pressed.delete(code); return true; }
      return false;
    },
    // The pilot's demands for one step, from keys + joystick.
    ctl() {
      const yaw = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0) + joy.x;
      const pitch = (keys.has('ArrowUp') ? 1 : 0) + (keys.has('ArrowDown') ? -1 : 0) - joy.y;
      let throttle = null;
      if (keys.has('KeyW')) throttle = 1;
      if (keys.has('KeyS')) throttle = 0;
      return {
        yaw: Math.max(-1, Math.min(1, yaw)),
        pitch: Math.max(-1, Math.min(1, pitch)),
        throttle, // null = keep current
        brake: keys.has('Space'),
        reverse: keys.has('KeyR'),
      };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}

// Wire the on-screen joystick element to the input's joy state.
export function bindJoystick(input, el, knob) {
  let pointerId = null;
  const setFromEvent = (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    const cl = len > 1 ? 1 / len : 1;
    input.joy.x = dx * cl;
    input.joy.y = dy * cl;
    knob.style.transform = `translate(calc(-50% + ${input.joy.x * 34}px), calc(-50% + ${input.joy.y * 34}px))`;
  };
  el.addEventListener('pointerdown', (e) => {
    pointerId = e.pointerId;
    input.joy.active = true;
    el.setPointerCapture(pointerId);
    setFromEvent(e);
  });
  el.addEventListener('pointermove', (e) => { if (input.joy.active) setFromEvent(e); });
  const end = () => {
    input.joy.active = false;
    input.joy.x = 0;
    input.joy.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
