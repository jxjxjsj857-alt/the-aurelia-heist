// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones are painted before the walls, so a wall hides the part of a cone
// behind it. Flat shapes, canvas text for the HUD and the panels.
import { CAMERA, FIELD, FONT, GUARD, PALETTE, PLAYER, TILE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL_DONE = 'level-done';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const HUD_HEIGHT = 56;

function money(value) {
  return '$' + value.toLocaleString('en-US');
}

function clock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight ?? '');
    if (!fonts.has(key)) fonts.set(key, (weight ?? '') + ' ' + size + 'px ' + FONT);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function tileIs(level, col, row, ch) {
    if (col < 0 || row < 0 || col >= 32 || row >= 18) return ch === '#';
    return level.map[row][col] === ch;
  }

  function drawFloor(state) {
    const level = state.level;
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        const ch = level.map[row][col];
        if (ch === '#') continue;
        const x = col * TILE;
        const y = row * TILE;
        context.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(x, y, TILE, TILE);
        // A thin grout line, so the room reads as tiled stone.
        context.fillStyle = 'rgba(0,0,0,0.18)';
        context.fillRect(x, y + TILE - 1, TILE, 1);
        context.fillRect(x + TILE - 1, y, 1, TILE);
      }
    }
    // One deep-red carpet down the middle of the room, purely for the eye.
    context.fillStyle = PALETTE.rug;
    context.fillRect(FIELD.width / 2 - 130, 0, 260, FIELD.height);
    context.fillStyle = PALETTE.rugEdge;
    context.fillRect(FIELD.width / 2 - 130, 0, 4, FIELD.height);
    context.fillRect(FIELD.width / 2 + 126, 0, 4, FIELD.height);
    // Dust motes drifting in the dark.
    context.fillStyle = 'rgba(242, 201, 76, 0.16)';
    for (const mote of state.dust) {
      const mx = (mote.x + state.elapsed * 6 * mote.s) % FIELD.width;
      const my = (mote.y + Math.sin(state.elapsed * 0.4 + mote.p) * 8) % FIELD.height;
      context.beginPath();
      context.arc(mx, my, 1.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawWalls(state) {
    const level = state.level;
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        const ch = level.map[row][col];
        if (ch !== '#' && ch !== 'o') continue;
        const x = col * TILE;
        const y = row * TILE;
        if (ch === '#') {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 5);
          if (!tileIs(level, col, row + 1, '#')) {
            context.fillStyle = PALETTE.wallTrim;
            context.fillRect(x, y + TILE - 4, TILE, 4);
          }
        } else {
          // Furniture: a display case, a desk, a slot machine.
          context.fillStyle = PALETTE.obstacle;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.fillStyle = PALETTE.obstacleTop;
          context.fillRect(x + 3, y + 3, TILE - 6, 6);
          context.fillStyle = 'rgba(255,255,255,0.10)';
          context.fillRect(x + 8, y + 10, TILE - 16, 4);
        }
      }
    }
  }

  function drawCone(x, y, angle, range, halfAngle, alerted) {
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fillStyle = alerted ? PALETTE.coneAlert : PALETTE.cone;
    context.fill();
    context.strokeStyle = alerted ? PALETTE.coneAlertEdge : PALETTE.coneEdge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    context.stroke();
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      drawCone(guard.x, guard.y, guard.facing, GUARD.visionRange, GUARD.visionHalfAngle, guard.seesPlayer || guard.chasing);
    }
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.visionRange, CAMERA.visionHalfAngle, camera.seesPlayer);
    }
  }

  function drawExit(state) {
    const exit = state.exit;
    const open = state.lootValue >= state.lootTarget;
    context.save();
    context.translate(exit.x, exit.y);
    context.fillStyle = open ? PALETTE.exit : 'rgba(57, 217, 138, 0.25)';
    context.beginPath();
    context.arc(0, 0, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b1f16';
    context.font = 'bold 13px ' + FONT;
    context.textAlign = 'center';
    context.fillText('EXIT', 0, 5);
    if (open) {
      context.strokeStyle = PALETTE.exit;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, 30 + Math.sin(state.elapsed * 4) * 3, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const x = item.x;
      const y = item.y;
      const bob = Math.sin(state.elapsed * 2 + x * 0.05) * 2;
      context.save();
      context.translate(x, y + bob);
      if (item.kind === 'L') {
        context.fillStyle = PALETTE.goldDeep;
        context.fillRect(-11, -4, 22, 8);
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.moveTo(-9, -8);
        context.lineTo(9, -8);
        context.lineTo(11, -4);
        context.lineTo(-11, -4);
        context.closePath();
        context.fill();
      } else if (item.kind === 'J') {
        context.fillStyle = PALETTE.jewel;
        context.beginPath();
        context.moveTo(0, -13);
        context.lineTo(10, 0);
        context.lineTo(0, 13);
        context.lineTo(-10, 0);
        context.closePath();
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.75)';
        context.beginPath();
        context.moveTo(0, -13);
        context.lineTo(10, 0);
        context.lineTo(0, 0);
        context.closePath();
        context.fill();
      } else if (item.kind === 'A') {
        context.fillStyle = '#6b4a1f';
        context.fillRect(-16, -12, 32, 24);
        context.fillStyle = PALETTE.art;
        context.fillRect(-13, -9, 26, 18);
        context.fillStyle = '#f2efe6';
        context.beginPath();
        context.arc(-4, -2, 4, 0, Math.PI * 2);
        context.arc(6, 4, 3, 0, Math.PI * 2);
        context.fill();
      } else {
        // Vault gold: a piled heap.
        context.fillStyle = PALETTE.goldDeep;
        context.beginPath();
        context.arc(-7, 4, 8, 0, Math.PI * 2);
        context.arc(7, 4, 8, 0, Math.PI * 2);
        context.arc(0, -3, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(-7, 3, 6, 0, Math.PI * 2);
        context.arc(7, 3, 6, 0, Math.PI * 2);
        context.arc(0, -4, 6, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      if (state.grabTarget === item) {
        context.strokeStyle = PALETTE.gold;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + state.grabProgress * Math.PI * 2);
        context.stroke();
      }
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      context.save();
      context.translate(guard.x, guard.y);
      // Body: a navy uniform with a cap brim pointing where the guard looks.
      context.fillStyle = guard.chasing ? '#a33a35' : PALETTE.guardDark;
      context.beginPath();
      context.arc(0, 0, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = guard.chasing ? '#e5534b' : PALETTE.guard;
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.rotate(guard.facing);
      context.fillStyle = '#d8d3c4';
      context.fillRect(6, -3, 10, 6);
      context.restore();
      if (guard.seesPlayer) {
        text('!', guard.x, guard.y - 22, 22, '#ff6b61', 'center', 'bold');
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      context.save();
      context.translate(camera.x, camera.y);
      context.fillStyle = '#1c1e28';
      context.beginPath();
      context.arc(0, 0, 10, 0, Math.PI * 2);
      context.fill();
      context.rotate(camera.angle);
      context.fillStyle = PALETTE.camera;
      context.fillRect(0, -4, 16, 8);
      context.fillStyle = camera.seesPlayer && Math.floor(state.elapsed * 6) % 2 === 0 ? '#ff3b30' : '#7a1f1c';
      context.beginPath();
      context.arc(16, 0, 3, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    context.save();
    context.translate(player.x, player.y);
    if (player.sneak) {
      context.strokeStyle = 'rgba(232, 228, 216, 0.5)';
      context.setLineDash([4, 4]);
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(0, 0, 20, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    context.fillStyle = PALETTE.playerCoat;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'rgba(242, 201, 76, 0.25)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius + 4, 0, Math.PI * 2);
    context.stroke();
    context.rotate(player.facing);
    // The mask: a pale band across the face, pointing where the thief moves.
    context.fillStyle = PALETTE.player;
    context.fillRect(3, -7, 11, 14);
    context.fillStyle = '#11141b';
    context.fillRect(9, -4, 3, 3);
    context.fillRect(9, 2, 3, 3);
    context.restore();
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(7, 8, 13, 0.85)';
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.textBaseline = 'top';
    text('LOOT ' + money(state.lootValue) + ' / ' + money(state.lootTarget), 24, 14, 24, PALETTE.gold, 'left', 'bold');
    text(state.level.name, FIELD.width / 2, 14, 24, PALETTE.text, 'center', 'bold');
    text(clock(state.elapsed), FIELD.width - 24, 14, 24, PALETTE.text, 'right');
    // The alarm meter: a full-width bar under the HUD.
    const barY = HUD_HEIGHT - 6;
    context.fillStyle = '#10121c';
    context.fillRect(0, barY, FIELD.width, 6);
    const alarmColor = state.alarm < 40 ? PALETTE.alarmLow : state.alarm < 75 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    context.fillStyle = alarmColor;
    context.fillRect(0, barY, FIELD.width * (state.alarm / 100), 6);
    context.textBaseline = 'alphabetic';
    text('ALARM', 24, HUD_HEIGHT + 22, 15, alarmColor, 'left', 'bold');
    text(Math.round(state.alarm) + '%', 96, HUD_HEIGHT + 22, 15, alarmColor, 'left');
    if (state.lootValue < state.lootTarget) {
      text('Steal ' + money(state.lootTarget - state.lootValue) + ' more, then reach the EXIT', FIELD.width - 24, HUD_HEIGHT + 22, 15, PALETTE.muted, 'right');
    } else {
      text('Target met — get to the EXIT!', FIELD.width - 24, HUD_HEIGHT + 22, 15, PALETTE.exit, 'right', 'bold');
    }
    if (state.seenNow) {
      const blink = Math.floor(state.elapsed * 5) % 2 === 0;
      text('SPOTTED!', FIELD.width / 2, 96, 30, blink ? '#ff6b61' : '#e5534b', 'center', 'bold');
    } else if (state.alarmed) {
      text('ALARM — break line of sight!', FIELD.width / 2, 96, 26, PALETTE.alarmHigh, 'center', 'bold');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7, 8, 13, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.wallTrim;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center', 'bold');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center');
  }

  function drawVignette() {
    const gradient = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawCones(state);
    drawWalls(state);
    drawExit(state);
    drawLoot(state);
    drawGuards(state);
    drawCameras(state);
    drawPlayer(state);
    drawVignette();
    if (screen === SCREEN_TITLE) {
      drawPanel('THE AURELIA HEIST', [
        'Three rooms. Three crews of guards. One thief: you.',
        'Sneak past the vision cones, lift the loot,',
        'and reach the EXIT before the alarm catches you.',
        'Best haul so far: ' + money(best),
      ], 'Press Enter or click to plan the first job');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_BRIEF) {
      drawPanel(state.level.name, [
        state.level.brief,
        'Target: ' + money(state.level.target) + '   ·   Par time: ' + clock(state.level.parSeconds),
        'Move: WASD or arrows · Sneak: Shift · Click to walk there',
        'Guards and cameras raise the ALARM when they see you.',
      ], 'Press Enter to begin the job');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_LEVEL_DONE) {
      const last = state.levelIndex;
      drawPanel('Clean getaway!', [
        'You lifted ' + money(state.lootValue) + ' from ' + state.level.name + '.',
        'Total haul: ' + money(state.totalLoot) + '   ·   Time: ' + clock(state.totalTime),
        state.ghost ? 'Ghost: nobody ever raised the alarm. +$1,000' : 'The alarm went up — still, the loot is yours.',
      ], last >= 2 ? 'Press Enter for the final tally' : 'Press Enter for the next job');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED!', [
        'A guard laid a hand on you in ' + state.level.name + '.',
        'You kept ' + money(state.totalLoot - state.lootValue) + ' from earlier jobs.',
        'The crew will not forget this one.',
      ], 'Press Enter to try the job again');
    } else if (screen === SCREEN_WIN) {
      const ghostBonus = state.ghost ? 1000 : 0;
      drawPanel('THE PERFECT HEIST', [
        'All three rooms emptied. Total haul: ' + money(state.totalLoot + ghostBonus) + '.',
        'Time: ' + clock(state.totalTime) + (state.ghost ? '   ·   Ghost bonus: +$1,000' : ''),
        'Best haul so far: ' + money(Math.max(best, state.totalLoot + ghostBonus)),
      ], 'Press Enter to run it all again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
