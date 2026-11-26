// Star Runway — Orbital Flight (Node 22, standard library only).
// The game itself lives in game/: plain static files a desktop browser loads
// offline (game/index.html plus its ES modules, three.js vendored under
// game/vendor/, no network request at runtime). This program is the entry
// the grader runs: it stages game/ and screenshots/ into the output folder
// and writes dossier.json there, the summary the judge reads, using the
// vendored make.fun library (vendor/makefun-game.ts).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file sits in; the output folder
// comes from the environment, defaulting to the grader's /output.
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Stage one directory tree into the output folder, creating parents first.
function stage(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? countFiles(full) : 1;
  }
  return total;
}

const indexPath = join(rootDir, 'game', 'index.html');
if (!existsSync(indexPath)) {
  throw new Error(`Star Runway is missing its entry page: ${indexPath}`);
}

mkdirSync(outputDir, { recursive: true });
stage(join(rootDir, 'game'), join(outputDir, 'game'));

const shotsDir = join(rootDir, 'screenshots');
if (existsSync(shotsDir)) {
  stage(shotsDir, join(outputDir, 'screenshots'));
}

const gameFiles = countFiles(join(outputDir, 'game'));
const shotFiles = existsSync(join(outputDir, 'screenshots'))
  ? readdirSync(join(outputDir, 'screenshots')).length
  : 0;
console.log(`Star Runway: staged ${gameFiles} game files and ${shotFiles} screenshots into ${outputDir}`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const dossier = buildDossier(outputDir, dossierCaps);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Star Runway: dossier.json written (${Buffer.byteLength(dossier)} bytes)`);
