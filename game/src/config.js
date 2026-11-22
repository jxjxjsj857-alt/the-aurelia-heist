// All tuning numbers and colours for The Aurelia Heist, in one place. The playfield is a
// fixed 1280 by 720 logical area; the renderer scales it to the window, so no rule here
// depends on the size of the screen it ends up on.
export const FIELD = { width: 1280, height: 720 };

/** One map tile, in pixels. Every map is 32 tiles wide and 18 tall. */
export const TILE = 40;

/** The simulation's fixed step, in seconds: 60 updates a second, whatever the display does. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  walkSpeed: 182,
  sneakSpeed: 98,
  /** How close a guard must get before the thief is caught. */
  catchDistance: 27,
};

export const GUARD = {
  patrolSpeed: 74,
  chaseSpeed: 198,
  /** Seconds a guard waits at each patrol waypoint. */
  waypointPause: 1.1,
  /** How far a guard can see, in pixels. Halved against a sneaking thief. */
  visionRange: 240,
  /** Half of a guard's vision cone, in radians. */
  visionHalfAngle: 0.62,
  /** Seconds without seeing the thief before a chasing guard gives up and walks back. */
  loseSightAfter: 3.0,
};

export const CAMERA = {
  visionRange: 270,
  visionHalfAngle: 0.5,
  /** Radians per second of the sweep. */
  sweepSpeed: 0.55,
};

export const ALARM = {
  /** Per second while a guard has eyes on the thief. */
  guardSeen: 58,
  /** Per second while a camera has eyes on the thief. */
  cameraSeen: 38,
  /** Per second while nobody sees the thief and the alarm is off. */
  decay: 9,
  /** Per second while the alarm is on and nobody sees the thief. */
  decayAlarmed: 5,
  /** The alarm switches itself off again below this value. */
  offBelow: 35,
};

export const LOOT = {
  /** Seconds standing next to a big loot piece to lift it. */
  bigGrabSeconds: 1.0,
  /** Loot values, in dollars, keyed by the map letter. */
  values: { L: 500, J: 1500, A: 2500, V: 5000 },
};

export const PALETTE = {
  backdrop: '#07080d',
  floorA: '#242031',
  floorB: '#1d1a29',
  rug: '#3a2333',
  rugEdge: '#6b3a52',
  wall: '#12141f',
  wallTop: '#2e3249',
  wallTrim: '#8a6d2f',
  obstacle: '#2c2539',
  obstacleTop: '#473c5e',
  gold: '#f2c94c',
  goldDeep: '#b8860b',
  jewel: '#59d6ff',
  art: '#e07856',
  cash: '#7fce6e',
  player: '#e8e4d8',
  playerCoat: '#23232e',
  guard: '#4a6fa5',
  guardDark: '#2c4266',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneEdge: 'rgba(242, 201, 76, 0.45)',
  coneAlert: 'rgba(229, 83, 75, 0.28)',
  coneAlertEdge: 'rgba(229, 83, 75, 0.55)',
  camera: '#c94f4f',
  exit: '#39d98a',
  panel: '#171926',
  panelEdge: '#3a3f5c',
  text: '#f2efe6',
  muted: '#9a94ad',
  alarmLow: '#39d98a',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best total haul is kept between visits (this browser only). */
export const BEST_KEY = 'aurelia-heist.best';
export const MUTE_KEY = 'aurelia-heist.muted';
