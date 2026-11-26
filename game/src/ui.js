// HUD, panels, popups and save data. All DOM lives in index.html; this module
// wires it up and keeps it in sync with the flight state.
import { STAGES, SAVE_KEY, PAY, RINGS, DECK } from './config.js';
import { STAGE, vertSpeed } from './physics.js';
import * as audio from './audio.js';

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return { money: typeof s.money === 'number' ? s.money : 1000, xp: typeof s.xp === 'number' ? s.xp : 0, engine: s.engine || 0 };
  } catch { return { money: 1000, xp: 0, engine: 0 }; }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

const PAINTS = [
  { name: 'Pearl', hull: 0xe8e6e1, accent: 0xff7a1a },
  { name: 'Solar', hull: 0xf2c94c, accent: 0x222831 },
  { name: 'Nebula', hull: 0x7a5cff, accent: 0x39d353 },
  { name: 'Comet', hull: 0x39a0ff, accent: 0xff4d6d },
];

export function createUI(els, ship, save, callbacks) {
  const state = {
    openPanel: null,
    popupTimer: 0,
    engineLevel: save.engine || 0,
  };

  const panels = {
    hangar: els.panelHangar,
    shop: els.panelShop,
    jobs: els.panelJobs,
    missions: els.panelMissions,
  };

  function closePanels() {
    for (const p of Object.values(panels)) p.classList.remove('open');
    state.openPanel = null;
  }
  function togglePanel(name) {
    audio.click();
    if (state.openPanel === name) { closePanels(); return; }
    closePanels();
    panels[name].classList.add('open');
    state.openPanel = name;
  }

  els.btnHangar.addEventListener('click', () => togglePanel('hangar'));
  els.btnShop.addEventListener('click', () => togglePanel('shop'));
  els.btnJobs.addEventListener('click', () => togglePanel('jobs'));
  els.btnMissions.addEventListener('click', () => togglePanel('missions'));
  for (const p of Object.values(panels)) {
    p.querySelector('.panel-close').addEventListener('click', () => { audio.click(); closePanels(); });
  }

  // Hangar: paint swatches recolour the ship, visibly and immediately.
  const swatchRow = els.panelHangar.querySelector('.swatches');
  for (const p of PAINTS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.textContent = p.name;
    b.style.setProperty('--sw', `#${p.hull.toString(16).padStart(6, '0')}`);
    b.addEventListener('click', () => {
      audio.click();
      ship.paint[0].color.setHex(p.hull);
      ship.paint[1].color.setHex(p.accent);
      els.hangarNote.textContent = `Paint applied: ${p.name} — hull and accents recoloured.`;
    });
    swatchRow.appendChild(b);
  }

  // Shop: one engine upgrade, bought with money, persists.
  function renderShop() {
    const cost = 400 * (state.engineLevel + 1);
    els.shopCost.textContent = state.engineLevel >= 3
      ? 'Engine maxed out (Mk III)'
      : `Engine Mk ${state.engineLevel + 1} — $${cost}`;
    els.shopBuy.disabled = state.engineLevel >= 3 || save.money < cost;
    els.shopNote.textContent = state.engineLevel >= 3
      ? 'Top speed +30% total. No further upgrades.'
      : `+10% top speed per level. You have $${save.money}.`;
  }
  els.shopBuy.addEventListener('click', () => {
    const cost = 400 * (state.engineLevel + 1);
    if (state.engineLevel >= 3 || save.money < cost) return;
    save.money -= cost;
    state.engineLevel += 1;
    save.engine = state.engineLevel;
    storeSave(save);
    audio.ringChime();
    els.shopNote.textContent = `Engine Mk ${state.engineLevel} installed! Top speed is now ${Math.round((1 + state.engineLevel * 0.1) * 100)}%.`;
    renderShop();
    updateMoney();
    callbacks.onEngineLevel(state.engineLevel);
  });

  // Jobs: the active job, with its pay.
  els.jobAccept.addEventListener('click', () => {
    audio.click();
    els.jobNote.textContent = 'Job accepted: Orbital Delivery — fly the 3 rings and land back on the deck. Pay $250 + $100 per ring.';
  });

  // Missions: checklist that ticks as the flight progresses.
  function renderMissions(f) {
    const items = els.panelMissions.querySelectorAll('li');
    const done = [
      f.engineOn,
      f.stage >= STAGE.RING1,
      f.ringsPassed[0] && f.ringsPassed[1] && f.ringsPassed[2],
      f.landed,
    ];
    items.forEach((li, i) => li.classList.toggle('done', !!done[i]));
  }

  function updateMoney() {
    els.money.textContent = `$${save.money.toLocaleString()}`;
    els.xp.textContent = `${save.xp.toLocaleString()} XP`;
  }

  function showPopup(text, ms = 1600) {
    els.popup.textContent = text;
    els.popup.classList.add('show');
    state.popupTimer = ms;
  }

  function update(f, dt) {
    // Progress bar: highlight stages up to the current one.
    const idx = Math.min(f.stage, STAGES.length - 1);
    els.progressItems.forEach((el, i) => el.classList.toggle('active', i <= idx));
    els.stageLabel.textContent = STAGES[idx];
    // Readouts.
    els.alt.textContent = `${Math.max(0, Math.round(f.pos.y))} m`;
    els.speed.textContent = `${Math.round(Math.abs(f.speed))} kt`;
    const headingDeg = ((Math.round(THREEHeading(f.heading)) % 360) + 360) % 360;
    els.heading.textContent = `${headingDeg}°`;
    els.vert.textContent = `${vertSpeed(f).toFixed(1)} m/s`;
    els.flaps.textContent = `${f.flaps}`;
    els.spoilers.textContent = `${f.spoilers}`;
    // Popup fade.
    if (state.popupTimer > 0) {
      state.popupTimer -= dt * 1000;
      if (state.popupTimer <= 0) els.popup.classList.remove('show');
    }
    renderMissions(f);
  }

  // Heading in degrees, 0 = +Z, clockwise when seen from above.
  function THREEHeading(heading) {
    return (heading * 180) / Math.PI;
  }

  // Minimap: top-down, station deck as a bar, rings as circles, ship as a wedge.
  function drawMinimap(f) {
    const g = els.minimap.getContext('2d');
    const w = els.minimap.width;
    const h = els.minimap.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10,14,24,0.72)';
    g.fillRect(0, 0, w, h);
    const scale = w / 1900; // world x/z -950..950
    const px = (x) => w / 2 + x * scale;
    const pz = (z) => h / 2 + z * scale;
    // Deck.
    g.fillStyle = '#7a8699';
    g.fillRect(px(-26), pz(-150), 52 * scale, 300 * scale);
    // Rings.
    RINGS.forEach((r, i) => {
      g.beginPath();
      g.arc(px(r.x), pz(r.z), 7, 0, Math.PI * 2);
      g.strokeStyle = f.ringsPassed[i] ? '#39d353' : '#ffc233';
      g.lineWidth = 2;
      g.stroke();
    });
    // Ship wedge, pointing along its heading.
    const sx = px(f.pos.x);
    const sz = pz(f.pos.z);
    g.save();
    g.translate(sx, sz);
    g.rotate(Math.atan2(Math.sin(f.heading), Math.cos(f.heading)));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
  }

  // End screen: pay breakdown.
  function showEnd(f) {
    const rings = f.ringsPassed.filter(Boolean).length;
    const ringPay = rings * PAY.ring;
    const speedBonus = f.landed ? 50 : 0;
    const total = PAY.job + ringPay + speedBonus;
    save.money += total;
    save.xp += PAY.xp;
    storeSave(save);
    updateMoney();
    els.endRings.textContent = `${rings} / 3 rings — $${ringPay}`;
    els.endJob.textContent = `Orbital Delivery — $${PAY.job}`;
    els.endBonus.textContent = `Smooth landing bonus — $${speedBonus}`;
    els.endTotal.textContent = `Total earned: $${total} · +${PAY.xp} XP`;
    els.endOverlay.classList.add('show');
    els.titleOverlay.classList.remove('open');
    audio.landJingle();
  }

  updateMoney();
  renderShop();
  return { state, closePanels, update, updateMoney, showPopup, drawMinimap, showEnd, renderShop };
}
