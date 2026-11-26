// The environment, all procedural: starfield, planet, sun, space station with
// a lit runway deck, asteroid field, and the three glowing rings.
import * as THREE from 'three';
import { PALETTE, RINGS, DECK } from './config.js';

// ---- canvas texture helpers ------------------------------------------------

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size / 2;
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Earth-like planet: blue oceans, green/brown continents, white cloud streaks.
function planetTexture() {
  return canvasTexture(1024, (g, w, h) => {
    g.fillStyle = '#1a5fb4';
    g.fillRect(0, 0, w, h);
    // Oceans get a little depth.
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(10, 70, 150, ${0.15 + Math.random() * 0.25})`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 90, 12 + Math.random() * 50, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Continents: blobs of green and brown.
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * w;
      const y = h * 0.12 + Math.random() * h * 0.76;
      const r = 26 + Math.random() * 70;
      g.fillStyle = Math.random() < 0.6 ? '#3f8f3a' : '#8a6b3a';
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.5) {
        const rr = r * (0.55 + Math.random() * 0.6);
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr * 0.6;
        if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    }
    // Polar ice caps.
    g.fillStyle = '#eef4f8';
    g.fillRect(0, 0, w, h * 0.05);
    g.fillRect(0, h * 0.95, w, h * 0.05);
    // Cloud streaks.
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255, 255, 255, ${0.25 + Math.random() * 0.45})`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 110, 4 + Math.random() * 9, (Math.random() - 0.5) * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// Runway deck: dark panels, yellow centre dashes, white edge lines, markings.
function deckTexture() {
  return canvasTexture(512, (g, w, h) => {
    g.fillStyle = '#23262e';
    g.fillRect(0, 0, w, h);
    // Panel seams.
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // Centre dashes (runway direction = canvas height).
    g.fillStyle = '#ffc233';
    for (let y = 16; y < h; y += 64) g.fillRect(w / 2 - 5, y, 10, 34);
    // Edge lines.
    g.fillStyle = '#e8e6e1';
    g.fillRect(14, 0, 6, h);
    g.fillRect(w - 20, 0, 6, h);
    // Threshold bars at both ends.
    for (let i = 0; i < 5; i++) {
      g.fillRect(60 + i * 80, 10, 44, 14);
      g.fillRect(60 + i * 80, h - 24, 44, 14);
    }
    // Big "36" near the far end.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('36', w / 2, h * 0.32);
  });
}

// Cratered moon: grey base, dark maria blotches, craters with dark centres
// and light rims.
function moonTexture() {
  return canvasTexture(512, (g, w, h) => {
    g.fillStyle = '#b8b8b8';
    g.fillRect(0, 0, w, h);
    // Large-scale shading variation.
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${120 + Math.random() * 60 | 0},${120 + Math.random() * 60 | 0},0.25)`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 70, 14 + Math.random() * 50, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Maria: big dark blotches.
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(90, 92, 100, ${0.35 + Math.random() * 0.3})`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 22 + Math.random() * 44, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Craters: dark bowl + light rim on one side.
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 2 + Math.random() * 9;
      g.fillStyle = 'rgba(70, 70, 78, 0.55)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(230, 230, 235, 0.5)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  });
}
// Soft radial glow, for the sun, the rings' halos and the atmosphere.
function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(',1)', ',0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- builders --------------------------------------------------------------

function buildStars(scene) {
  const count = 3200;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // On a far shell around the play area.
    const r = 4200 + Math.random() * 1500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const b = 0.5 + Math.random() * 0.5;
    const warm = Math.random();
    col[i * 3] = b * (warm < 0.7 ? 1 : 0.75);
    col[i * 3 + 1] = b * 0.9;
    col[i * 3 + 2] = b * (warm < 0.7 ? 0.8 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false,
  }));
  scene.add(stars);

  // A few distant nebula sprites for depth.
  const nebCols = ['rgba(90,40,160,', 'rgba(20,90,140,', 'rgba(160,50,90,'];
  for (let i = 0; i < 7; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(`${nebCols[i % 3]}0.5)`, 'rgba(0,0,0,0)'),
      transparent: true, opacity: 0.55, depthWrite: false, fog: false,
    }));
    const a = Math.random() * Math.PI * 2;
    sprite.position.set(Math.cos(a) * 3800, (Math.random() - 0.3) * 2200, Math.sin(a) * 3800);
    sprite.scale.set(1800 + Math.random() * 1200, 1200 + Math.random() * 800, 1);
    scene.add(sprite);
  }
}

function buildPlanet(scene) {
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 48, 32),
    new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 0.9, metalness: 0, fog: false }),
  );
  // Below the course and ahead of the return leg, so its upper limb and
  // atmosphere sit in the lower half of a level chase view on the way home
  // (the action shot), instead of hiding below the frame.
  planet.position.set(0, -3200, -1200);
  scene.add(planet);
  // Atmosphere glow: a sprite hugging the planet's upper limb.
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(120,180,255,0.85)', 'rgba(120,180,255,0)'),
    transparent: true, opacity: 0.5, depthWrite: false, fog: false,
  }));
  atmo.position.copy(planet.position);
  atmo.scale.set(5600, 5600, 1);
  scene.add(atmo);
  return planet;
}

// Sun: a large bright disc with a halo and a horizontal flare streak.
// Placed high ahead-left of the action-shot flight path (measured from the
// staged chase view), so it reads clearly in the 1-action frame.
const SUN_POS = new THREE.Vector3(-5250, 760, -2190);
// Moon: a smaller cratered sphere, placed high ahead-right of the same view.
const MOON_POS = new THREE.Vector3(-600, 750, -3600);

function buildSun(scene) {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(300, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }),
  );
  sun.position.copy(SUN_POS);
  scene.add(sun);
  // Wide halo.
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,240,190,1)', 'rgba(255,240,190,0)'),
    transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  }));
  glow.position.copy(SUN_POS);
  glow.scale.set(3200, 3200, 1);
  scene.add(glow);
  // Hot core.
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    transparent: true, opacity: 1, depthWrite: false, fog: false,
  }));
  core.position.copy(SUN_POS);
  core.scale.set(900, 900, 1);
  scene.add(core);
  // Horizontal anamorphic flare streak.
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,240,190,0.85)', 'rgba(255,240,190,0)'),
    transparent: true, opacity: 0.5, depthWrite: false, fog: false,
  }));
  streak.position.copy(SUN_POS);
  streak.scale.set(2600, 320, 1);
  scene.add(streak);
  // Small flare ghost, offset from the disc.
  const ghost = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(180,220,255,0.9)', 'rgba(180,220,255,0)'),
    transparent: true, opacity: 0.65, depthWrite: false, fog: false,
  }));
  ghost.position.set(SUN_POS.x + 700, SUN_POS.y - 260, SUN_POS.z + 420);
  ghost.scale.set(520, 520, 1);
  scene.add(ghost);
  const light = new THREE.DirectionalLight(0xfff2d8, 2.4);
  light.position.copy(SUN_POS).normalize().multiplyScalar(100);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
  return sun;
}

function buildMoon(scene) {
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 24),
    new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 1, metalness: 0, fog: false }),
  );
  moon.position.copy(MOON_POS);
  scene.add(moon);
  // Faint halo so the disc reads against the starfield.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(200,205,220,0.5)', 'rgba(200,205,220,0)'),
    transparent: true, opacity: 0.4, depthWrite: false, fog: false,
  }));
  halo.position.copy(MOON_POS);
  halo.scale.set(700, 700, 1);
  scene.add(halo);
  return moon;
}

function buildStation(scene) {
  const station = new THREE.Group();
  station.name = 'Aurora Station';
  const hull = new THREE.MeshStandardMaterial({ color: 0xc9cdd6, metalness: 0.7, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.7, roughness: 0.4 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d3f8f, metalness: 0.6, roughness: 0.3, emissive: 0x0a1a44, emissiveIntensity: 0.4 });

  // Central torus ring (the rotating habitat ring).
  const torus = new THREE.Mesh(new THREE.TorusGeometry(120, 11, 14, 48), hull);
  torus.rotation.x = Math.PI / 2;
  torus.position.set(0, 26, -190);
  station.add(torus);
  // Spokes from the hub to the ring.
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 120, 8), dark);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = (i * Math.PI) / 4;
    spoke.position.set(0, 26, -190);
    station.add(spoke);
  }
  // Hub cylinder.
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 34, 16), hull);
  hub.position.set(0, 26, -190);
  station.add(hub);
  // Docked modules along the spine.
  for (let i = 0; i < 3; i++) {
    const mod = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 26, 12), i % 2 ? dark : hull);
    mod.rotation.x = Math.PI / 2;
    mod.position.set(0, 26, -240 - i * 34);
    station.add(mod);
  }
  // Solar panel wings.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(120, 1.2, 34), panelMat);
    wing.position.set(side * 92, 26, -190);
    station.add(wing);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 8), dark);
    mast.rotation.z = Math.PI / 2;
    mast.position.set(side * 30, 26, -190);
    station.add(mast);
  }
  // Dish.
  const dish = new THREE.Mesh(new THREE.ConeGeometry(12, 8, 16, 1, true), hull);
  dish.position.set(0, 52, -260);
  dish.rotation.x = Math.PI / 3;
  station.add(dish);

  // Runway deck: long lit platform the ship lands on.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(DECK.halfWidth * 2, 2.5, DECK.halfLength * 2),
    new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.7, metalness: 0.4 }),
  );
  deck.position.set(0, 0, 0);
  deck.receiveShadow = false;
  station.add(deck);
  // Deck support truss underneath.
  const truss = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 280), dark);
  truss.position.set(0, -14, 0);
  station.add(truss);
  // Edge lights along both sides of the deck.
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x39d353 });
  const lightMatAmber = new THREE.MeshBasicMaterial({ color: 0xffc233 });
  for (let z = -140; z <= 140; z += 20) {
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(lightGeo, (z / 20) % 2 === 0 ? lightMat : lightMatAmber);
      l.position.set(side * (DECK.halfWidth + 1.5), 2.2, z);
      station.add(l);
    }
  }
  // Approach lights at the far end.
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    l.position.set(-12 + i * 8, 2.2, DECK.halfLength + 8 + i * 6);
    station.add(l);
  }

  scene.add(station);
  return { station, torus };
}

function buildAsteroids(scene) {
  const group = new THREE.Group();
  group.name = 'AsteroidField';
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e6a63, roughness: 1, metalness: 0.05, flatShading: true });
  const rocks = [];
  for (let i = 0; i < 42; i++) {
    const s = 3 + Math.random() * 13;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
    // Keep the flight corridor clear: scatter to the sides and above/below.
    const side = Math.random() < 0.5 ? -1 : 1;
    rock.position.set(
      side * (180 + Math.random() * 700),
      20 + Math.random() * 420,
      -100 + Math.random() * 1600,
    );
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.userData.spin = (Math.random() - 0.5) * 0.15;
    group.add(rock);
    rocks.push(rock);
  }
  scene.add(group);
  return rocks;
}

// One ring: gold torus + halo sprite + faint inner disc. Returns the group
// plus handles the caller uses to light it up on a pass.
function buildRing(def) {
  const group = new THREE.Group();
  group.position.set(def.x, def.y, def.z);
  const torusMat = new THREE.MeshStandardMaterial({
    color: PALETTE.ring, emissive: PALETTE.ring, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(def.radius, 2.2, 14, 48), torusMat);
  group.add(torus);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,194,51,0.9)', 'rgba(255,194,51,0)'),
    transparent: true, opacity: 0.55, depthWrite: false,
  }));
  halo.scale.set(def.radius * 3.4, def.radius * 3.4, 1);
  group.add(halo);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(def.radius - 2, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }),
  );
  group.add(disc);
  return { group, torusMat, halo, disc };
}

export function buildWorld(scene) {
  buildStars(scene);
  buildPlanet(scene);
  buildSun(scene);
  buildMoon(scene);
  const { station, torus } = buildStation(scene);
  const rocks = buildAsteroids(scene);
  const rings = RINGS.map((def) => buildRing(def));
  for (const r of rings) scene.add(r.group);
  return { station, torus, rocks, rings };
}
