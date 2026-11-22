// The game's rules and state, with no drawing and no browser in it: the thief, the
// guards and their vision cones, the sweeping cameras, the loot, the alarm meter and
// the exit. step() advances one fixed step and returns what happened as bit flags, so
// the caller can react without the world knowing about screens or sound. The whole
// simulation is deterministic for a fixed seed.
import { ALARM, CAMERA, FIELD, GUARD, LOOT, PLAYER, TILE } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_PICKUP = 1;
export const EVENT_BIG_LOOT = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_ALARM_ON = 8;
export const EVENT_ALARM_OFF = 16;
export const EVENT_CAUGHT = 32;
export const EVENT_LEVEL_DONE = 64;
export const EVENT_WIN = 128;

const SOLID_TILES = new Set(['#', 'o']);

function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= 32 || row >= 18) return '#';
  return level.map[row][col];
}

function isSolid(level, col, row) {
  return SOLID_TILES.has(tileAt(level, col, row));
}

/** True when the straight line from (x0, y0) to (x1, y1) crosses no solid tile. The
 * watcher's own tile never blocks its sight: a camera sits inside a wall tile. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  const homeCol = Math.floor(x0 / TILE);
  const homeRow = Math.floor(y0 / TILE);
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + (dx * i) / steps;
    const y = y0 + (dy * i) / steps;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col === homeCol && row === homeRow) continue;
    if (isSolid(level, col, row)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when a watcher at (x, y) facing `angle` can see the thief. */
function canSee(level, x, y, angle, range, halfAngle, player, sneak) {
  const dx = player.x - x;
  const dy = player.y - y;
  const dist = Math.hypot(dx, dy);
  const effectiveRange = sneak ? range * 0.55 : range;
  if (dist > effectiveRange) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  return hasLineOfSight(level, x, y, player.x, player.y);
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, facing: 0, sneak: false, moving: false },
    guards: [],
    cameras: [],
    loot: [],
    exit: { x: 0, y: 0 },
    alarm: 0,
    alarmed: false,
    seenNow: false,
    seenBy: null,
    lootValue: 0,
    lootTarget: 0,
    elapsed: 0,
    totalLoot: 0,
    totalTime: 0,
    ghost: true,
    grabProgress: 0,
    grabTarget: null,
    levelDone: false,
    busted: false,
    won: false,
    dust: [],
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.lootTarget = level.target;
    state.lootValue = 0;
    state.alarm = 0;
    state.alarmed = false;
    state.seenNow = false;
    state.seenBy = null;
    state.elapsed = 0;
    state.grabProgress = 0;
    state.grabTarget = null;
    state.levelDone = false;
    state.busted = false;
    state.dust = [];
    for (let i = 0; i < 70; i += 1) {
      state.dust.push({ x: random() * FIELD.width, y: random() * FIELD.height, s: 0.4 + random() * 0.9, p: random() * Math.PI * 2 });
    }
    state.guards = level.guards.map((g) => {
      const [cx, cy] = g.waypoints[0];
      return {
        waypoints: g.waypoints.map(([wx, wy]) => ({ x: (wx + 0.5) * TILE, y: (wy + 0.5) * TILE })),
        pause: g.pause,
        x: (cx + 0.5) * TILE,
        y: (cy + 0.5) * TILE,
        target: 1,
        waiting: 0,
        facing: 0,
        chasing: false,
        loseSight: 0,
        seesPlayer: false,
      };
    });
    state.cameras = level.cameras.map((c) => ({
      x: (c.tile[0] + 0.5) * TILE,
      y: (c.tile[1] + 0.5) * TILE,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      angle: c.baseAngle,
      seesPlayer: false,
    }));
    state.loot = [];
    level.map.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === 'P') {
          state.player.x = (c + 0.5) * TILE;
          state.player.y = (r + 0.5) * TILE;
          state.player.facing = 0;
        } else if (ch === 'E') {
          state.exit.x = (c + 0.5) * TILE;
          state.exit.y = (r + 0.5) * TILE;
        } else if (ch === 'L' || ch === 'J' || ch === 'A' || ch === 'V') {
          state.loot.push({
            kind: ch,
            value: LOOT.values[ch],
            big: ch === 'A' || ch === 'V',
            x: (c + 0.5) * TILE,
            y: (r + 0.5) * TILE,
            taken: false,
          });
        }
      });
    });
  }

  function reset() {
    state.totalLoot = 0;
    state.totalTime = 0;
    state.ghost = true;
    state.won = false;
    loadLevel(0);
  }

  function moveCircle(entity, dx, dy) {
    // Move one axis at a time so the circle slides along walls instead of sticking.
    const r = PLAYER.radius;
    let nx = entity.x + dx;
    const top = Math.floor((entity.y - r) / TILE);
    const bottom = Math.floor((entity.y + r) / TILE);
    for (const row of [top, bottom]) {
      for (const col of [Math.floor((nx - r) / TILE), Math.floor((nx + r) / TILE)]) {
        if (!isSolid(state.level, col, row)) continue;
        if (dx > 0) nx = Math.min(nx, col * TILE - r - 0.01);
        else if (dx < 0) nx = Math.max(nx, (col + 1) * TILE + r + 0.01);
      }
    }
    entity.x = nx;
    let ny = entity.y + dy;
    const left = Math.floor((entity.x - r) / TILE);
    const right = Math.floor((entity.x + r) / TILE);
    for (const col of [left, right]) {
      for (const row of [Math.floor((ny - r) / TILE), Math.floor((ny + r) / TILE)]) {
        if (!isSolid(state.level, col, row)) continue;
        if (dy > 0) ny = Math.min(ny, row * TILE - r - 0.01);
        else if (dy < 0) ny = Math.max(ny, (row + 1) * TILE + r + 0.01);
      }
    }
    entity.y = ny;
  }

  function stepGuard(guard, dt) {
    const player = state.player;
    if (guard.chasing) {
      const dx = player.x - guard.x;
      const dy = player.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        guard.facing = Math.atan2(dy, dx);
        const step = Math.min(dist, GUARD.chaseSpeed * dt);
        // Chase steering moves straight at the thief and lets the walls slide it.
        moveCircle(guard, (dx / dist) * step, (dy / dist) * step);
      }
      if (!guard.seesPlayer) {
        guard.loseSight += dt;
        if (guard.loseSight >= GUARD.loseSightAfter) {
          guard.chasing = false;
          guard.loseSight = 0;
          // Walk back to the nearest waypoint.
          let best = 0;
          let bestDist = Infinity;
          guard.waypoints.forEach((w, i) => {
            const d = Math.hypot(w.x - guard.x, w.y - guard.y);
            if (d < bestDist) { bestDist = d; best = i; }
          });
          guard.target = best;
        }
      } else {
        guard.loseSight = 0;
      }
      return;
    }
    if (guard.waiting > 0) {
      guard.waiting -= dt;
      return;
    }
    const target = guard.waypoints[guard.target];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      guard.target = (guard.target + 1) % guard.waypoints.length;
      guard.waiting = guard.pause;
      const next = guard.waypoints[guard.target];
      guard.facing = Math.atan2(next.y - guard.y, next.x - guard.x);
      return;
    }
    guard.facing = Math.atan2(dy, dx);
    const step = Math.min(dist, GUARD.patrolSpeed * dt);
    moveCircle(guard, (dx / dist) * step, (dy / dist) * step);
  }

  /**
   * One fixed step. `move` is {x, y} in [-1, 1] (keyboard or click-to-move steering),
   * `sneak` halves the speed and shrinks the guards' sight. With `harmless` set (the
   * title screen's backdrop) the guards patrol and the cameras sweep, but nothing is
   * seen, no alarm rises and nothing is caught or collected. Returns event flags.
   */
  function step(dt, move, sneak, harmless) {
    let events = 0;
    if (state.levelDone || state.busted || state.won) return events;
    state.elapsed += dt;
    state.totalTime += dt;

    const player = state.player;
    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    player.sneak = sneak;
    player.moving = len > 0.1;
    if (len > 0.1) {
      const nx = (move.x / Math.max(1, len)) * speed * dt;
      const ny = (move.y / Math.max(1, len)) * speed * dt;
      moveCircle(player, nx, ny);
      player.facing = Math.atan2(move.y, move.x);
    }

    // The cameras sweep whatever the screen: their angle is the clock, not the alarm.
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed) * camera.sweep;
    }
    if (harmless) {
      for (const guard of state.guards) stepGuard(guard, dt);
      return events;
    }

    // Vision: guards and cameras watch the thief; being seen feeds the alarm.
    let seen = false;
    let seenBy = null;
    for (const guard of state.guards) {
      guard.seesPlayer = canSee(state.level, guard.x, guard.y, guard.facing, GUARD.visionRange, GUARD.visionHalfAngle, player, sneak);
      if (guard.seesPlayer) { seen = true; seenBy = 'guard'; }
    }
    for (const camera of state.cameras) {
      camera.seesPlayer = canSee(state.level, camera.x, camera.y, camera.angle, CAMERA.visionRange, CAMERA.visionHalfAngle, player, sneak);
      if (camera.seesPlayer) { seen = true; seenBy = seenBy ?? 'camera'; }
    }
    const wasSeen = state.seenNow;
    state.seenNow = seen;
    state.seenBy = seen ? seenBy : null;
    if (seen && !wasSeen) events |= EVENT_SPOTTED;

    if (seen) {
      state.alarm += (seenBy === 'guard' ? ALARM.guardSeen : ALARM.cameraSeen) * dt;
      for (const guard of state.guards) {
        if (guard.seesPlayer) { guard.chasing = true; guard.loseSight = 0; }
      }
    } else if (state.alarmed) {
      state.alarm -= ALARM.decayAlarmed * dt;
    } else {
      state.alarm -= ALARM.decay * dt;
    }
    state.alarm = Math.max(0, Math.min(100, state.alarm));
    if (state.alarm >= 100 && !state.alarmed) {
      state.alarmed = true;
      state.ghost = false;
      for (const guard of state.guards) { guard.chasing = true; guard.loseSight = 0; }
      events |= EVENT_ALARM_ON;
    } else if (state.alarmed && state.alarm < ALARM.offBelow) {
      state.alarmed = false;
      events |= EVENT_ALARM_OFF;
    }

    for (const guard of state.guards) stepGuard(guard, dt);

    // Caught: a guard close enough to lay a hand on the thief ends the heist.
    for (const guard of state.guards) {
      if (Math.hypot(guard.x - player.x, guard.y - player.y) < PLAYER.catchDistance) {
        state.busted = true;
        events |= EVENT_CAUGHT;
        return events;
      }
    }

    // Loot: small pieces lift on touch; the big ones take a second of steady hands.
    let grabbing = null;
    for (const item of state.loot) {
      if (item.taken) continue;
      const dist = Math.hypot(item.x - player.x, item.y - player.y);
      if (item.big) {
        if (dist < 46) grabbing = item;
      } else if (dist < 26) {
        item.taken = true;
        state.lootValue += item.value;
        state.totalLoot += item.value;
        events |= EVENT_PICKUP;
      }
    }
    if (grabbing !== null) {
      if (state.grabTarget !== grabbing) {
        state.grabTarget = grabbing;
        state.grabProgress = 0;
      }
      state.grabProgress += dt / LOOT.bigGrabSeconds;
      if (state.grabProgress >= 1) {
        grabbing.taken = true;
        state.lootValue += grabbing.value;
        state.totalLoot += grabbing.value;
        state.grabTarget = null;
        state.grabProgress = 0;
        events |= EVENT_BIG_LOOT;
      }
    } else {
      state.grabTarget = null;
      state.grabProgress = 0;
    }

    // The exit only opens once the level's target is met.
    const exitDist = Math.hypot(state.exit.x - player.x, state.exit.y - player.y);
    if (exitDist < 34 && state.lootValue >= state.lootTarget) {
      state.levelDone = true;
      events |= EVENT_LEVEL_DONE;
      if (state.levelIndex >= LEVELS.length - 1) {
        state.won = true;
        events |= EVENT_WIN;
      }
    }
    return events;
  }

  function nextLevel() {
    loadLevel(state.levelIndex + 1);
  }

  reset();
  return { state, reset, loadLevel, nextLevel, step, hasLineOfSight: (x0, y0, x1, y1) => hasLineOfSight(state.level, x0, y0, x1, y1) };
}
