// world.js — the simulation: movement, vision, alarm, loot, bust, exit.
// Pure logic, no DOM and no canvas, so the same code runs in the browser
// and in the headless sim tests. Everything here is deterministic: the
// same inputs over the same steps always give the same world.

import {
  TILE,
  THIEF_WALK_SPEED,
  THIEF_SNEAK_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_INVESTIGATE_SPEED,
  GUARD_SIGHT_RANGE,
  GUARD_SNEAK_RANGE,
  GUARD_FOV,
  CAMERA_SIGHT_RANGE,
  CAMERA_SNEAK_RANGE,
  CAMERA_FOV,
  CAMERA_SWEEP,
  CAMERA_SWEEP_SPEED,
  ALARM_GUARD_RATE,
  ALARM_CAMERA_RATE,
  ALARM_DECAY_RATE,
  ALARM_MAX,
  GRAB_TIME,
  GRAB_RADIUS,
  PICKUP_RADIUS,
  BUST_RADIUS,
  COINS_PER_JOB,
  COIN_COST,
  COIN_THROW_DIST,
  COIN_HEAR_RANGE,
  COIN_INVESTIGATE_TIME,
  THIEF_RADIUS,
  GUARD_RADIUS,
} from './config.js';
import { parseLevel, isWall } from './levels.js';
import { mulberry32 } from './random.js';

// Smallest signed turn from angle a to angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

// Line of sight on the tile grid. Steps along the line and checks each
// tile it passes through; the watcher's own tile never blocks (a camera
// sits inside a wall tile and still has to see out of it).
export function hasLineOfSight(walls, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d * 8));
  const homeX = Math.floor(x0);
  const homeY = Math.floor(y0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const tx = Math.floor(px);
    const ty = Math.floor(py);
    if (tx === homeX && ty === homeY) continue;
    if (isWall(walls, tx, ty)) return false;
  }
  return true;
}

// Does a watcher at (wx, wy), facing `facing`, see the thief?
// Sneaking halves the range. Walls block the view.
export function canSee(walls, wx, wy, facing, range, sneakRange, fov, tx, ty, sneaking) {
  const d = dist(wx, wy, tx, ty);
  const maxRange = sneaking ? sneakRange : range;
  if (d > maxRange) return false;
  if (d < 0.01) return true;
  const toThief = Math.atan2(ty - wy, tx - wx);
  if (Math.abs(angleDiff(facing, toThief)) > fov / 2) return false;
  return hasLineOfSight(walls, wx, wy, tx, ty);
}

// A circle (the thief or a guard) sliding against walls: try x, then y,
// so movement slides along a wall instead of sticking to it.
function moveCircle(walls, body, dx, dy, radius) {
  const nx = body.x + dx;
  if (!circleHitsWall(walls, nx, body.y, radius)) body.x = nx;
  const ny = body.y + dy;
  if (!circleHitsWall(walls, body.x, ny, radius)) body.y = ny;
}

function circleHitsWall(walls, x, y, radius) {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!isWall(walls, tx, ty)) continue;
      // Closest point on the wall tile to the circle centre.
      const cx = Math.max(tx, Math.min(x, tx + 1));
      const cy = Math.max(ty, Math.min(y, ty + 1));
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy < radius * radius) return true;
    }
  }
  return false;
}

export function createWorld(levelIndex, seed) {
  const parsed = parseLevel(levelIndex);
  const rng = mulberry32(seed == null ? 7 : seed);
  const guards = parsed.level.guards.map((g) => {
    const [wx, wy] = g.waypoints[0];
    return {
      x: wx + 0.5,
      y: wy + 0.5,
      angle: 0,
      waypoints: g.waypoints,
      wpIndex: 1 % g.waypoints.length,
      mode: 'patrol',
      investigateT: 0,
      targetX: 0,
      targetY: 0,
      seesThief: false,
    };
  });
  const cameras = parsed.level.cameras.map((c) => ({
    x: c.x + 0.5,
    y: c.y + 0.5,
    baseAngle: c.angle,
    angle: c.angle,
    phase: rng() * Math.PI * 2,
    seesThief: false,
  }));
  return {
    levelIndex,
    level: parsed.level,
    walls: parsed.walls,
    exit: parsed.exit,
    loot: parsed.loot,
    totalValue: parsed.totalValue,
    thief: { x: parsed.spawn.x, y: parsed.spawn.y, angle: Math.PI / 2, moving: false },
    guards,
    cameras,
    alarm: 0,
    alarmEverRose: false,
    chase: false,
    lootValue: 0,
    coins: COINS_PER_JOB,
    coinMark: null, // {x, y, age} of the last tossed coin, for the renderer
    grabbing: null,
    grabProgress: 0,
    spotted: false,
    busted: false,
    exited: false,
    time: 0,
  };
}

// One fixed step. `input` is {mx, my, sneak, toss} with mx/my a direction
// in [-1, 1]. `opts.harmless` steps patrols only: the title screen runs
// the world behind it without any guard ever catching the idle thief.
export function stepWorld(world, input, dt, opts) {
  const harmless = opts && opts.harmless;
  const walls = world.walls;
  world.time += dt;
  // The renderer draws shorter cones while the thief sneaks.
  world.sneakHeld = !!input.sneak;

  // --- the thief ---------------------------------------------------------
  const thief = world.thief;
  const speed = input.sneak ? THIEF_SNEAK_SPEED : THIEF_WALK_SPEED;
  const len = Math.hypot(input.mx, input.my);
  thief.moving = len > 0.01;
  if (thief.moving) {
    const nx = input.mx / (len || 1);
    const ny = input.my / (len || 1);
    thief.angle = Math.atan2(ny, nx);
    moveCircle(walls, thief, nx * speed * dt, ny * speed * dt, THIEF_RADIUS);
  }

  // --- coin toss: a $100 distraction, three per job ----------------------
  if (input.toss && world.coins > 0 && !harmless) {
    world.coins -= 1;
    world.lootValue = Math.max(0, world.lootValue - COIN_COST);
    const cx = thief.x + Math.cos(thief.angle) * COIN_THROW_DIST;
    const cy = thief.y + Math.sin(thief.angle) * COIN_THROW_DIST;
    world.coinMark = { x: cx, y: cy, age: 0 };
    for (const guard of world.guards) {
      if (guard.mode === 'chase') continue;
      if (dist(guard.x, guard.y, cx, cy) <= COIN_HEAR_RANGE) {
        guard.mode = 'investigate';
        guard.targetX = cx;
        guard.targetY = cy;
        guard.investigateT = 0;
      }
    }
  }
  if (world.coinMark) {
    world.coinMark.age += dt;
    if (world.coinMark.age > 1.2) world.coinMark = null;
  }

  // --- cameras sweep ------------------------------------------------------
  for (const cam of world.cameras) {
    cam.angle = cam.baseAngle + Math.sin(world.time * CAMERA_SWEEP_SPEED + cam.phase) * CAMERA_SWEEP;
    cam.seesThief = false;
  }

  // --- guards: patrol, chase, investigate ---------------------------------
  for (const guard of world.guards) {
    guard.seesThief = false;
    if (guard.mode === 'chase' || world.chase) {
      const d = dist(guard.x, guard.y, thief.x, thief.y);
      if (d > 0.01) {
        const nx = (thief.x - guard.x) / d;
        const ny = (thief.y - guard.y) / d;
        guard.angle = Math.atan2(ny, nx);
        moveCircle(walls, guard, nx * GUARD_CHASE_SPEED * dt, ny * GUARD_CHASE_SPEED * dt, GUARD_RADIUS);
      }
    } else if (guard.mode === 'investigate') {
      const d = dist(guard.x, guard.y, guard.targetX, guard.targetY);
      if (d > 0.15) {
        const nx = (guard.targetX - guard.x) / d;
        const ny = (guard.targetY - guard.y) / d;
        guard.angle = Math.atan2(ny, nx);
        moveCircle(walls, guard, nx * GUARD_INVESTIGATE_SPEED * dt, ny * GUARD_INVESTIGATE_SPEED * dt, GUARD_RADIUS);
      } else {
        guard.investigateT += dt;
        if (guard.investigateT >= COIN_INVESTIGATE_TIME) guard.mode = 'patrol';
      }
    } else {
      const wp = guard.waypoints[guard.wpIndex];
      const tx = wp[0] + 0.5;
      const ty = wp[1] + 0.5;
      const d = dist(guard.x, guard.y, tx, ty);
      if (d < 0.12) {
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      } else {
        const nx = (tx - guard.x) / d;
        const ny = (ty - guard.y) / d;
        guard.angle = Math.atan2(ny, nx);
        moveCircle(walls, guard, nx * GUARD_PATROL_SPEED * dt, ny * GUARD_PATROL_SPEED * dt, GUARD_RADIUS);
      }
    }
  }

  // --- vision -------------------------------------------------------------
  let seenRate = 0;
  let seenByGuard = false;
  let seenByCamera = false;
  if (!harmless) {
    for (const guard of world.guards) {
      const seen = canSee(
        walls, guard.x, guard.y, guard.angle,
        GUARD_SIGHT_RANGE, GUARD_SNEAK_RANGE, GUARD_FOV,
        thief.x, thief.y, input.sneak,
      );
      guard.seesThief = seen;
      if (seen) {
        seenByGuard = true;
        seenRate = Math.max(seenRate, ALARM_GUARD_RATE);
      }
    }
    for (const cam of world.cameras) {
      const seen = canSee(
        walls, cam.x, cam.y, cam.angle,
        CAMERA_SIGHT_RANGE, CAMERA_SNEAK_RANGE, CAMERA_FOV,
        thief.x, thief.y, input.sneak,
      );
      cam.seesThief = seen;
      if (seen) {
        seenByCamera = true;
        seenRate = Math.max(seenRate, ALARM_CAMERA_RATE);
      }
    }
  }
  world.spotted = seenByGuard || seenByCamera;

  // --- alarm ---------------------------------------------------------------
  if (seenRate > 0) {
    world.alarm = Math.min(ALARM_MAX, world.alarm + seenRate * dt);
    world.alarmEverRose = true;
  } else {
    world.alarm = Math.max(0, world.alarm - ALARM_DECAY_RATE * dt);
  }
  if (world.alarm >= ALARM_MAX) world.chase = true;
  if (world.chase && world.alarm < 35) {
    world.chase = false;
    for (const guard of world.guards) if (guard.mode === 'chase') guard.mode = 'patrol';
  }
  if (world.chase) {
    for (const guard of world.guards) {
      if (guard.mode !== 'investigate') guard.mode = 'chase';
    }
  }

  // --- loot -----------------------------------------------------------------
  let nearestBig = null;
  let nearestBigDist = Infinity;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = dist(thief.x, thief.y, item.x, item.y);
    if (item.kind === 'small') {
      if (d <= PICKUP_RADIUS) {
        item.taken = true;
        world.lootValue += item.value;
      }
    } else if (d <= GRAB_RADIUS && d < nearestBigDist) {
      nearestBig = item;
      nearestBigDist = d;
    }
  }
  if (nearestBig && !harmless) {
    world.grabbing = nearestBig;
    nearestBig.progress += dt / GRAB_TIME;
    world.grabProgress = Math.min(1, nearestBig.progress);
    if (nearestBig.progress >= 1) {
      nearestBig.taken = true;
      world.lootValue += nearestBig.value;
      world.grabbing = null;
      world.grabProgress = 0;
    }
  } else {
    world.grabbing = null;
    world.grabProgress = 0;
    for (const item of world.loot) {
      if (!item.taken && item.kind !== 'small') item.progress = 0;
    }
  }

  // --- bust: a guard touches the thief ---------------------------------------
  if (!harmless) {
    for (const guard of world.guards) {
      if (dist(guard.x, guard.y, thief.x, thief.y) <= BUST_RADIUS) {
        world.busted = true;
      }
    }
  }

  // --- exit -------------------------------------------------------------------
  if (!harmless && !world.busted && world.lootValue >= world.level.target) {
    if (dist(thief.x, thief.y, world.exit.x, world.exit.y) <= 0.8) {
      world.exited = true;
    }
  }
  return world;
}

// How many tiles of open floor the thief can reach from the spawn —
// used by the level validator, not by the game itself.
export function floodFillCount(walls, sx, sy) {
  const seen = new Set();
  const queue = [[Math.floor(sx), Math.floor(sy)]];
  while (queue.length) {
    const [x, y] = queue.pop();
    const key = x + ',' + y;
    if (seen.has(key) || isWall(walls, x, y)) continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen.size;
}
