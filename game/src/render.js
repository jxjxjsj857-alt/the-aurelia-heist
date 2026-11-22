// render.js — everything the player sees, drawn on one canvas.
// The playfield is drawn in layers: floor, vision cones, walls, loot,
// exit, guards, cameras, thief, then the HUD. Cones go down before the
// walls so a wall hides the part of a cone behind it. Screens (title,
// brief, paused, busted, job done, heist done) are overlays on top.

import {
  TILE,
  COLS,
  ROWS,
  VIEW_W,
  VIEW_H,
  GUARD_SIGHT_RANGE,
  GUARD_SNEAK_RANGE,
  GUARD_FOV,
  CAMERA_SIGHT_RANGE,
  CAMERA_SNEAK_RANGE,
  CAMERA_FOV,
  PALETTE,
} from './config.js';

function px(tile) {
  return tile * TILE;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(16, 20, 36, 0.95)';
  ctx.strokeStyle = PALETTE.wallTrim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, VIEW_W / 2, y);
}

// --- the playfield ---------------------------------------------------------

export function drawWorld(ctx, world) {
  drawFloor(ctx, world);
  drawCones(ctx, world);
  drawWalls(ctx, world);
  drawExit(ctx, world);
  drawLoot(ctx, world);
  drawCoinMark(ctx, world);
  drawGuards(ctx, world);
  drawCameras(ctx, world);
  drawThief(ctx, world);
  drawGrabRing(ctx, world);
}

function drawFloor(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (world.walls[y][x]) continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(px(x), px(y), TILE, TILE);
    }
  }
  // A thin runner down the middle hall of each map, for depth.
  ctx.fillStyle = 'rgba(58, 42, 77, 0.35)';
  ctx.fillRect(px(1), px(8), VIEW_W - 2 * TILE, TILE);
  ctx.fillRect(px(1), px(15), VIEW_W - 2 * TILE, TILE);
}

function drawCone(ctx, x, y, angle, rangeTiles, fov, color) {
  const range = rangeTiles * TILE;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px(x), px(y));
  ctx.arc(px(x), px(y), range, angle - fov / 2, angle + fov / 2);
  ctx.closePath();
  ctx.fill();
}

function drawCones(ctx, world) {
  const sneak = world.sneakHeld;
  for (const guard of world.guards) {
    const range = sneak ? GUARD_SNEAK_RANGE : GUARD_SIGHT_RANGE;
    drawCone(
      ctx, guard.x, guard.y, guard.angle, range, GUARD_FOV,
      guard.seesThief ? PALETTE.coneSpotted : PALETTE.coneGuard,
    );
  }
  for (const cam of world.cameras) {
    const range = sneak ? CAMERA_SNEAK_RANGE : CAMERA_SIGHT_RANGE;
    drawCone(
      ctx, cam.x, cam.y, cam.angle, range, CAMERA_FOV,
      cam.seesThief ? PALETTE.coneSpotted : PALETTE.coneCamera,
    );
  }
}

function drawWalls(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!world.walls[y][x]) continue;
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(px(x), px(y), TILE, TILE);
      // A lit top edge where the wall meets open floor below it.
      if (y + 1 < ROWS && !world.walls[y + 1][x]) {
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(px(x), px(y) + TILE - 6, TILE, 6);
        ctx.fillStyle = PALETTE.wallTrim;
        ctx.fillRect(px(x), px(y) + TILE - 6, TILE, 2);
      }
    }
  }
}

function drawExit(ctx, world) {
  const pulse = 0.75 + 0.25 * Math.sin(world.time * 3);
  const x = px(world.exit.x);
  const y = px(world.exit.y);
  ctx.fillStyle = PALETTE.exitDark;
  ctx.beginPath();
  ctx.arc(x, y, TILE * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.exit;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(x, y, TILE * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#062b18';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', x, y);
}

function drawLoot(ctx, world) {
  for (const item of world.loot) {
    if (item.taken) continue;
    const x = px(item.x);
    const y = px(item.y);
    if (item.kind === 'small') {
      const bob = Math.sin(world.time * 2 + item.id) * 2;
      ctx.fillStyle = PALETTE.goldDark;
      ctx.beginPath();
      ctx.arc(x, y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x, y + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.goldDark;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x, y + bob + 0.5);
    } else if (item.kind === 'painting') {
      ctx.fillStyle = PALETTE.paintingFrame;
      ctx.fillRect(x - 15, y - 11, 30, 22);
      const art = [PALETTE.paintingArt1, PALETTE.paintingArt2, PALETTE.paintingArt3][item.id % 3];
      ctx.fillStyle = art;
      ctx.fillRect(x - 12, y - 8, 24, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 8);
      ctx.lineTo(x + 2, y - 8);
      ctx.lineTo(x + 12, y - 8);
      ctx.stroke();
    } else {
      // Vault gold: a little pile of bars.
      ctx.fillStyle = PALETTE.goldDark;
      ctx.fillRect(x - 13, y + 2, 26, 9);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x - 11, y - 2, 10, 8);
      ctx.fillRect(x + 1, y - 2, 10, 8);
      ctx.fillRect(x - 5, y - 9, 10, 8);
    }
  }
}

function drawCoinMark(ctx, world) {
  if (!world.coinMark) return;
  const alpha = Math.max(0, 1 - world.coinMark.age / 1.2);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px(world.coinMark.x), px(world.coinMark.y), 10 + world.coinMark.age * 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(px(world.coinMark.x), px(world.coinMark.y), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    const x = px(guard.x);
    const y = px(guard.y);
    const r = 13;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9, r, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = guard.mode === 'chase' ? '#ff2d2d' : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(guard.angle) * (r + 5), y + Math.sin(guard.angle) * (r + 5));
    ctx.stroke();
    // Eyes.
    const ex = Math.cos(guard.angle);
    const ey = Math.sin(guard.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + ex * 4 - ey * 4, y + ey * 4 + ex * 4, 2.2, 0, Math.PI * 2);
    ctx.arc(x + ex * 4 + ey * 4, y + ey * 4 - ex * 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (guard.seesThief) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y - 24);
    } else if (guard.mode === 'investigate') {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y - 24);
    }
  }
}

function drawCameras(ctx, world) {
  for (const cam of world.cameras) {
    const x = px(cam.x);
    const y = px(cam.y);
    ctx.fillStyle = PALETTE.camera;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a4356';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = cam.seesThief ? '#ff2d2d' : '#20242e';
    ctx.beginPath();
    ctx.arc(x + Math.cos(cam.angle) * 4, y + Math.sin(cam.angle) * 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawThief(ctx, world) {
  const thief = world.thief;
  const x = px(thief.x);
  const y = px(thief.y);
  const r = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 9, r, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.thiefCoat;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thief;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Hooded head and facing tick.
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(x + Math.cos(thief.angle) * 3, y + Math.sin(thief.angle) * 3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thief;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(thief.angle) * (r + 4), y + Math.sin(thief.angle) * (r + 4));
  ctx.stroke();
}

function drawGrabRing(ctx, world) {
  if (!world.grabbing) return;
  const item = world.grabbing;
  const x = px(item.x);
  const y = px(item.y);
  ctx.strokeStyle = 'rgba(232, 230, 223, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + world.grabProgress * Math.PI * 2);
  ctx.stroke();
  // The label goes below the loot: above it would sit under the HUD bar
  // when the loot is on the top row, as the vault gold is.
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GRABBING…', x, y + 38);
}

// --- the HUD -----------------------------------------------------------------

export function drawHud(ctx, world, app) {
  const barH = 46;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, barH);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(world.level.name, 16, barH / 2 - 1);

  // Loot target, centre.
  const target = world.level.target;
  const lootText = '$' + world.lootValue.toLocaleString('en-US') + ' / $' + target.toLocaleString('en-US');
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const lootColor = world.lootValue >= target ? PALETTE.exit : PALETTE.gold;
  ctx.fillStyle = lootColor;
  ctx.fillText('LOOT  ' + lootText, VIEW_W / 2, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(VIEW_W / 2 - 110, 30, 220, 6);
  ctx.fillStyle = lootColor;
  ctx.fillRect(VIEW_W / 2 - 110, 30, 220 * Math.min(1, world.lootValue / target), 6);

  // Alarm meter, right. The percentage sits right-aligned at the edge
  // so it can never run off the canvas.
  const alarmW = 170;
  const ax = VIEW_W - alarmW - 46;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.fillText('ALARM', ax, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(ax, 24, alarmW, 10);
  const alarmColor = world.alarm < 40 ? PALETTE.alarmLow : world.alarm < 75 ? PALETTE.alarmMid : PALETTE.alarmHigh;
  ctx.fillStyle = alarmColor;
  ctx.fillRect(ax, 24, alarmW * (world.alarm / 100), 10);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(world.alarm) + '%', VIEW_W - 16, 29);

  // Bottom strip: coins, job dots, controls.
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, VIEW_H - 30, VIEW_W, 30);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    'WASD / arrows move · click to walk · Shift sneak · F toss a coin ($100) · P pause · M mute · R restart',
    14, VIEW_H - 15,
  );
  ctx.textAlign = 'right';
  let coinText = '';
  for (let i = 0; i < world.coins; i++) coinText += '● ';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText('coins ' + (coinText || '—'), VIEW_W - 120, VIEW_H - 15);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('JOB ' + (app.jobIndex + 1) + ' / 3', VIEW_W - 16, VIEW_H - 15);

  if (world.spotted) {
    ctx.fillStyle = PALETTE.textDanger;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED!', VIEW_W / 2, 86);
  }
  if (world.chase) {
    ctx.fillStyle = PALETTE.textDanger;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALARM AT 100% — EVERY GUARD IS CHASING YOU', VIEW_W / 2, 116);
  }
}

// --- screens -----------------------------------------------------------------

export function drawTitle(ctx, world) {
  panel(ctx, 240, 110, 800, 500);
  centerText(ctx, 'THE AURELIA HEIST', 180, 'bold 54px Georgia, serif', PALETTE.textTitle);
  centerText(ctx, 'A top-down stealth heist in three jobs', 232, '20px system-ui, sans-serif', PALETTE.hudText);
  const jobs = [
    '1 · The Aurelia Gallery — $6,000 — 3 guards, 2 cameras',
    '2 · Meridian Bank — $16,000 — 4 guards, 3 cameras, a vault',
    '3 · The Gilded Casino — $18,000 — 5 guards, 4 cameras',
  ];
  ctx.font = '17px system-ui, sans-serif';
  jobs.forEach((job, i) => centerText(ctx, job, 292 + i * 32, '17px system-ui, sans-serif', PALETTE.hudMuted));
  centerText(ctx, 'Stay out of the red cones. Cameras sweep. At 100% alarm, every guard chases.', 420, '16px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'Small loot lifts on touch. Paintings and vault gold take 1 second beside them.', 448, '16px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'Reach the green EXIT once the target is met. Finish all three jobs —', 476, '16px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'and a $1,000 ghost bonus if the alarm never rose.', 504, '16px system-ui, sans-serif', PALETTE.gold);
  centerText(ctx, 'CLICK or press ENTER to begin', 556, 'bold 22px system-ui, sans-serif', PALETTE.exit);
  centerText(ctx, 'WASD / arrows or click to move · Shift sneak · F toss a coin · P pause · M mute', 592, '14px system-ui, sans-serif', PALETTE.hudMuted);
}

export function drawBrief(ctx, level) {
  panel(ctx, 240, 140, 800, 440);
  centerText(ctx, level.name.toUpperCase(), 210, 'bold 40px Georgia, serif', PALETTE.textTitle);
  centerText(ctx, level.sub, 258, '18px system-ui, sans-serif', PALETTE.hudMuted);
  ctx.font = '18px system-ui, sans-serif';
  const lines = wrapText(ctx, level.brief, 700);
  lines.forEach((line, i) => centerText(ctx, line, 312 + i * 28, '18px system-ui, sans-serif', PALETTE.hudText));
  const y = 312 + lines.length * 28 + 22;
  centerText(ctx, 'TARGET  $' + level.target.toLocaleString('en-US'), y, 'bold 24px system-ui, sans-serif', PALETTE.gold);
  centerText(
    ctx,
    level.guards.length + ' guards · ' + level.cameras.length + ' cameras · ' + level.map.join('').split('').filter((c) => c === 'g').length + ' stashes',
    y + 38, '16px system-ui, sans-serif', PALETTE.hudMuted,
  );
  centerText(ctx, 'Press ENTER to start the job', y + 92, 'bold 22px system-ui, sans-serif', PALETTE.exit);
}

export function drawPaused(ctx) {
  panel(ctx, 440, 250, 400, 180);
  centerText(ctx, 'PAUSED', 320, 'bold 40px Georgia, serif', PALETTE.textTitle);
  centerText(ctx, 'Press P to resume · R to restart the job', 372, '16px system-ui, sans-serif', PALETTE.hudText);
}

export function drawBusted(ctx, world) {
  panel(ctx, 340, 220, 600, 260);
  centerText(ctx, 'BUSTED!', 290, 'bold 52px Georgia, serif', PALETTE.textDanger);
  centerText(ctx, 'A guard got a hand on you in ' + world.level.name + '.', 348, '18px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'You kept $' + world.lootValue.toLocaleString('en-US') + ' of the haul before the cuffs came out.', 380, '18px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'Press R to retry the job', 436, 'bold 22px system-ui, sans-serif', PALETTE.exit);
}

export function drawJobDone(ctx, world, app) {
  panel(ctx, 340, 200, 600, 300);
  centerText(ctx, 'JOB COMPLETE', 270, 'bold 44px Georgia, serif', PALETTE.exit);
  centerText(ctx, world.level.name + ' — clean getaway.', 322, '19px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'Haul: $' + world.lootValue.toLocaleString('en-US'), 362, 'bold 22px system-ui, sans-serif', PALETTE.gold);
  centerText(ctx, 'Total so far: $' + app.totalLoot.toLocaleString('en-US'), 396, '19px system-ui, sans-serif', PALETTE.hudText);
  centerText(
    ctx,
    app.jobIndex + 1 < 3 ? 'Press ENTER for the next job' : 'Press ENTER for the final tally',
    460, 'bold 22px system-ui, sans-serif', PALETTE.exit,
  );
}

export function drawHeistDone(ctx, app) {
  panel(ctx, 290, 170, 700, 380);
  centerText(ctx, app.ghost ? 'THE PERFECT HEIST' : 'HEIST COMPLETE', 240, 'bold 46px Georgia, serif', PALETTE.textTitle);
  centerText(ctx, 'All three jobs, one night, no alarms left ringing.', 296, '19px system-ui, sans-serif', PALETTE.hudText);
  centerText(ctx, 'Total haul: $' + app.totalLoot.toLocaleString('en-US'), 352, 'bold 26px system-ui, sans-serif', PALETTE.gold);
  if (app.ghost) {
    centerText(ctx, 'Ghost bonus: +$1,000 — the alarm never rose once.', 392, '19px system-ui, sans-serif', PALETTE.exit);
    centerText(ctx, 'Grand total: $' + (app.totalLoot + 1000).toLocaleString('en-US'), 428, 'bold 24px system-ui, sans-serif', PALETTE.gold);
  } else {
    centerText(ctx, 'The alarm went up somewhere along the way — no ghost bonus this time.', 392, '17px system-ui, sans-serif', PALETTE.hudMuted);
  }
  centerText(ctx, 'Press R to run it all again', 492, 'bold 22px system-ui, sans-serif', PALETTE.exit);
}
