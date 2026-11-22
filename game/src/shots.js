// shots.js — the four deterministic screenshot scenes.
// Each one builds a world from a fixed seed, steps it a fixed number of
// times, then places the thief, the guards and the loot by hand so the
// frame shows exactly what the shot is for. No wall clock, no randomness
// beyond the seed: the same shot always renders the same frame.

import { createWorld, stepWorld } from './world.js';

const IDLE = { mx: 0, my: 0, sneak: false, toss: false };

function stepIdle(world, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) stepWorld(world, IDLE, 1 / 60, { harmless: true });
}

function takeLoot(world, kinds, count) {
  let taken = 0;
  for (const item of world.loot) {
    if (taken >= count) break;
    if (!item.taken && kinds.includes(item.kind)) {
      item.taken = true;
      world.lootValue += item.value;
      taken += 1;
    }
  }
  return taken;
}

function placeGuard(world, index, x, y, angle, mode) {
  const guard = world.guards[index];
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  if (mode) guard.mode = mode;
}

function faceThief(world, guard) {
  guard.angle = Math.atan2(world.thief.y - guard.y, world.thief.x - guard.x);
}

// 1-title: the title screen over the gallery, guards mid-patrol.
function stageTitle() {
  const world = createWorld(0, 7);
  stepIdle(world, 6);
  return { screen: 'title', world, app: { jobIndex: 0, totalLoot: 0, ghost: true } };
}

// 2-stealth: mid-gallery, thief slipping past a patrol, $500 lifted,
// the alarm barely awake at 3%.
function stageStealth() {
  const world = createWorld(0, 7);
  stepIdle(world, 4);
  world.thief.x = 12.5;
  world.thief.y = 9.5;
  world.thief.angle = Math.PI / 2;
  takeLoot(world, ['small'], 2); // $500
  world.alarm = 3;
  world.alarmEverRose = true;
  return { screen: 'playing', world, app: { jobIndex: 0, totalLoot: 0, ghost: false } };
}

// 3-spotted: the bank, alarm at 100%, every guard converging on the thief.
function stageSpotted() {
  const world = createWorld(1, 7);
  stepIdle(world, 3);
  world.thief.x = 15.5;
  world.thief.y = 9.5;
  world.thief.angle = -Math.PI / 2;
  takeLoot(world, ['painting'], 2); // $4,000
  takeLoot(world, ['vault'], 1); // $4,000 — $8,000 total
  world.alarm = 100;
  world.alarmEverRose = true;
  world.chase = true;
  world.spotted = true;
  placeGuard(world, 0, 13.5, 8.5, 0, 'chase');
  placeGuard(world, 1, 17.5, 8.5, 0, 'chase');
  placeGuard(world, 2, 12.5, 10.5, 0, 'chase');
  placeGuard(world, 3, 18.5, 10.5, 0, 'chase');
  for (const guard of world.guards) faceThief(world, guard);
  return { screen: 'playing', world, app: { jobIndex: 1, totalLoot: 6000, ghost: false } };
}

// 4-vault: inside the bank vault room, gold in hand, one more bar being
// grabbed (ring at 70%), alarm at 33%, $12,000 already lifted.
function stageVault() {
  const world = createWorld(1, 7);
  stepIdle(world, 2);
  world.thief.x = 27.5;
  world.thief.y = 2.5;
  world.thief.angle = -Math.PI / 2;
  takeLoot(world, ['painting'], 3); // $6,000
  // Take the far vault bar (25.5, 2.5) for $4,000; the near bar at
  // (27.5, 1.5) is the one the thief is grabbing. takeLoot takes in
  // map order, which would take the near bar first, so pick by position.
  const farGold = world.loot.find((item) => item.kind === 'vault' && item.x === 25.5 && item.y === 2.5);
  if (farGold) {
    farGold.taken = true;
    world.lootValue += farGold.value;
  }
  takeLoot(world, ['small'], 8); // $2,000 — $12,000 total
  // The one vault bar left is at (27.5, 1.5); the thief is grabbing it.
  const lastGold = world.loot.find((item) => item.kind === 'vault' && !item.taken);
  if (lastGold) {
    lastGold.progress = 0.7;
    world.grabbing = lastGold;
    world.grabProgress = 0.7;
  }
  world.alarm = 33;
  world.alarmEverRose = true;
  placeGuard(world, 1, 26.5, 6.5, -Math.PI / 2, 'patrol');
  return { screen: 'playing', world, app: { jobIndex: 1, totalLoot: 6000, ghost: false } };
}

export const SHOT_STAGERS = {
  title: stageTitle,
  stealth: stageStealth,
  spotted: stageSpotted,
  vault: stageVault,
};

export function stageShot(name) {
  const stager = SHOT_STAGERS[name];
  if (!stager) throw new Error('unknown shot: ' + name);
  return stager();
}
