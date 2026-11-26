// The spacecraft, built from three.js primitives only — no model files.
// The ship points along +Z. Length ~9 m, wingspan ~11 m. Returns { group,
// exhaust (the glowing nozzle mesh, for the thrust pulse), paint (list of
// materials the Hangar paint swatches recolour) }.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45, ...opts });
}

export function buildShip() {
  const group = new THREE.Group();
  group.name = 'StarRunner';
  const paint = [];

  const hullMat = mat(PALETTE.hull);
  const accentMat = mat(PALETTE.accent, { metalness: 0.5, roughness: 0.35 });
  const darkMat = mat(0x2a2f38, { metalness: 0.6, roughness: 0.4 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: PALETTE.canopy, metalness: 0.9, roughness: 0.08,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x0a2a3a, emissive: PALETTE.engineGlow, emissiveIntensity: 2.2,
  });
  paint.push(hullMat, accentMat);

  // Fuselage: cylinder along Z, tapered nose cone, tail cone.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.85, 5.2, 16), hullMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0.4);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.4, 16), accentMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 4.2);
  group.add(nose);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 16), darkMat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -2.9);
  group.add(tail);

  // Canopy: a squashed sphere on top, front of the fuselage.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), canopyMat);
  canopy.scale.set(0.85, 0.62, 1.5);
  canopy.position.set(0, 0.75, 1.6);
  group.add(canopy);

  // Main wings: swept boxes, slightly dihedral. Root at the fuselage, tips back.
  const wingGeo = new THREE.BoxGeometry(4.6, 0.16, 1.7);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, hullMat);
    wing.position.set(side * 3.1, -0.15, -0.6);
    wing.rotation.y = side * -0.28; // sweep back
    wing.rotation.z = side * 0.08; // dihedral
    group.add(wing);
    // Orange wingtip.
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.5), accentMat);
    tip.position.set(side * 5.25, -0.02, -1.25);
    tip.rotation.y = side * -0.28;
    tip.rotation.z = side * 0.08;
    group.add(tip);
  }

  // Tail fins: one vertical, two horizontal stabilisers.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.4), accentMat);
  fin.position.set(0, 0.95, -2.9);
  fin.rotation.x = -0.25;
  group.add(fin);
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.0), hullMat);
    stab.position.set(side * 1.5, 0.15, -3.0);
    stab.rotation.y = side * 0.2;
    group.add(stab);
  }

  // Twin engine nacelles under the wings + glowing exhaust nozzles.
  const exhausts = [];
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 2.6, 12), darkMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 2.1, -0.55, -1.4);
    group.add(nacelle);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.34, 0.9, 12), glowMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 2.1, -0.55, -3.0);
    group.add(nozzle);
    exhausts.push(nozzle);
    // Exhaust flame: a stretched cone that pulses with throttle.
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 2.2, 10),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.0 }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(side * 2.1, -0.55, -4.4);
    flame.name = 'flame';
    group.add(flame);
  }

  // Fixed landing gear: three struts with small wheels.
  const gearMat = mat(0x3a3f48, { metalness: 0.7, roughness: 0.35 });
  const wheelMat = mat(0x14161a, { metalness: 0.2, roughness: 0.9 });
  const gearSpots = [[0, -1.05, 2.6], [-0.85, -1.05, -1.6], [0.85, -1.05, -1.6]];
  for (const [x, y, z] of gearSpots) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), gearMat);
    strut.position.set(x, y + 0.45, z);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  // Running lights: red port, green starboard, white tail.
  const light = (color, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.position.set(x, y, z);
    group.add(m);
  };
  light(0xff2222, -5.5, -0.1, -1.2);
  light(0x22ff66, 5.5, -0.1, -1.2);
  light(0xffffff, 0, 0.2, -3.7);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return { group, exhaust: exhausts, paint, flames: group.children.filter((c) => c.name === 'flame') };
}
