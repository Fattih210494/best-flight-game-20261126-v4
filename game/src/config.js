// Star Runway — Orbital Flight. Every tuning number and colour in one place.
// Distances are metres, speeds m/s, angles radians. Y is up; the station deck
// runs along Z (z -150..+150) and the ship launches toward +Z.

export const STEP = 1 / 60; // fixed simulation step, seconds

export const SHIP = {
  maxSpeed: 120, // m/s at full throttle
  cruiseSpeed: 70,
  accel: 10, // m/s^2 toward the throttle target speed
  brakeDecel: 26,
  maxYawRate: 0.55, // rad/s
  maxPitchRate: 0.5,
  minLandingSpeed: 34, // must be at or below this to touch down
  gearHeight: 2.5, // deck clearance with gear down
};

export const STAGES = ['TAXI', 'LAUNCH', 'RING 1', 'RING 2', 'RING 3', 'LAND'];

// Ring centres, in order. The course flies out from the station, curves left
// and comes back toward it, so the station is ahead of the ship on the way home.
export const RINGS = [
  { x: 220, y: 90, z: 420, radius: 30 },
  { x: 120, y: 210, z: 900, radius: 30 },
  { x: -140, y: 140, z: 620, radius: 30 },
];

export const DECK = {
  centre: { x: 0, y: 2.5, z: 0 },
  halfWidth: 26,
  halfLength: 150,
  fix: { x: 0, y: 60, z: 300 }, // final-approach fix, on the glide path
};

export const SPAWN = { x: 0, y: 2.5, z: -120, heading: 0 }; // heading 0 = +Z

export const PAY = { job: 250, ring: 100, xp: 150 };

export const PALETTE = {
  hull: 0xe8e6e1,
  accent: 0xff7a1a,
  canopy: 0x18242e,
  engineGlow: 0x66ccff,
  ring: 0xffc233,
  ringPassed: 0x39d353,
  deck: 0x2b2f38,
  panel: 0x151a26,
  panelEdge: 0x3a4358,
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#ffc233',
  green: '#39d353',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where money and XP are kept between visits (this browser only). */
export const SAVE_KEY = 'star-runway.save';
