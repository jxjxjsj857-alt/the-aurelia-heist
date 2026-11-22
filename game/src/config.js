// config.js — tuning and palette for The Aurelia Heist.
// One clear job: every number the game balances on lives here, so the
// world, renderer and shots all agree on the same rules.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 720

// Movement speeds, in tiles per second.
export const THIEF_WALK_SPEED = 3.6;
export const THIEF_SNEAK_SPEED = 2.0;
export const GUARD_PATROL_SPEED = 1.7;
export const GUARD_CHASE_SPEED = 2.9;
export const GUARD_INVESTIGATE_SPEED = 2.3;

// Vision: how far a watcher can see, in tiles, and how wide the cone is.
export const GUARD_SIGHT_RANGE = 5.6;
export const GUARD_SNEAK_RANGE = 2.8; // sneaking halves the range
export const GUARD_FOV = (75 * Math.PI) / 180;
export const CAMERA_SIGHT_RANGE = 6.2;
export const CAMERA_SNEAK_RANGE = 3.1;
export const CAMERA_FOV = (55 * Math.PI) / 180;
export const CAMERA_SWEEP = (42 * Math.PI) / 180; // swing either side of base angle
export const CAMERA_SWEEP_SPEED = 0.55; // radians per second

// Alarm meter 0..100. Being watched fills it; breaking line of sight drains it.
// Cameras sweep, so they only hold the thief in their cone part of the
// time — their rate is higher so a sweeping camera still builds real
// pressure instead of being cancelled out by the decay.
export const ALARM_GUARD_RATE = 38;
export const ALARM_CAMERA_RATE = 55;
export const ALARM_DECAY_RATE = 10;
export const ALARM_MAX = 100;

// Loot.
export const LOOT_SMALL_VALUE = 250;
export const LOOT_PAINTING_VALUE = 2000;
export const LOOT_VAULT_VALUE = 4000;
export const GRAB_TIME = 1.0; // seconds standing next to big loot
export const GRAB_RADIUS = 1.35; // tiles
export const PICKUP_RADIUS = 0.65; // tiles, small loot on touch
export const BUST_RADIUS = 0.55; // tiles, a guard touching the thief

// Coin toss: a distraction tool. Three per job, each one costs $100 of haul.
export const COINS_PER_JOB = 3;
export const COIN_COST = 100;
export const COIN_THROW_DIST = 3.2; // tiles ahead of the thief
export const COIN_HEAR_RANGE = 7; // tiles; guards inside it investigate
export const COIN_INVESTIGATE_TIME = 2.5; // seconds a guard spends at the noise

// The thief and the guards are circles this big, in tiles.
export const THIEF_RADIUS = 0.32;
export const GUARD_RADIUS = 0.34;

export const GHOST_BONUS = 1000; // perfect heist: alarm never rose on any job

export const PALETTE = {
  floorA: '#1c2438',
  floorB: '#202a40',
  floorEdge: '#141a2a',
  wall: '#0d1120',
  wallTop: '#2c3a5e',
  wallTrim: '#46587f',
  carpet: '#3a2a4d',
  marble: '#2a3350',
  gold: '#f2c14e',
  goldDark: '#b98a1e',
  paintingFrame: '#8a6a2f',
  paintingArt1: '#7fb3d5',
  paintingArt2: '#c96f4a',
  paintingArt3: '#7fb069',
  vaultDoor: '#5a6b8a',
  exit: '#39d98a',
  exitDark: '#1d7a4c',
  thief: '#e8e6df',
  thiefCoat: '#232946',
  guard: '#d64545',
  guardDark: '#7a1f1f',
  camera: '#9aa7bd',
  coneGuard: 'rgba(214, 69, 69, 0.20)',
  coneCamera: 'rgba(242, 193, 78, 0.16)',
  coneSpotted: 'rgba(255, 60, 60, 0.38)',
  hudBg: 'rgba(10, 13, 24, 0.82)',
  hudText: '#e8e6df',
  hudMuted: '#9aa7bd',
  alarmLow: '#39d98a',
  alarmMid: '#f2c14e',
  alarmHigh: '#ff4d4d',
  textTitle: '#f2c14e',
  textDanger: '#ff5a5a',
  overlay: 'rgba(6, 8, 16, 0.78)',
};
