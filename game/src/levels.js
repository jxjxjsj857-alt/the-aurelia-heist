// levels.js — the three jobs: their maps, patrols and cameras.
// Maps are 32x18 grids of characters, one per tile:
//   '#' wall   '.' floor   'S' thief spawn   'E' green exit
//   'g' small loot ($250, touch to lift)   'P' painting ($2,000, 1 s grab)
//   'V' vault gold ($4,000, 1 s grab)
// Guards patrol the waypoint loops; cameras sit in wall tiles and sweep.
// Every room concept here is my own layout: gallery wings, a bank vault
// room and a casino cashier cage, each with more than one route through.

import {
  COLS,
  ROWS,
  LOOT_SMALL_VALUE,
  LOOT_PAINTING_VALUE,
  LOOT_VAULT_VALUE,
} from './config.js';

const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;

export const LEVELS = [
  {
    name: 'The Aurelia Gallery',
    sub: 'Job 1 of 3 — lift the paintings, mind the patrols',
    target: 6000,
    brief:
      'The Aurelia Gallery hangs three paintings worth $2,000 each, plus loose cash. ' +
      'Three guards walk the halls and two cameras watch the north wing. ' +
      'Grab $6,000, then slip out the green exit. Sneak with Shift to halve a guard\'s sight.',
    map: [
      '################################',
      '#..P...........##...........P..#',
      '#..............##..............#',
      '#....g.........##.........g....#',
      '#..............##..............#',
      '####.############.#########.####',
      '#..............................#',
      '#...g..........##..........g...#',
      '#..............##..............#',
      '#.....####.....##.....####.....#',
      '#.....####.....##.....####.....#',
      '#..............................#',
      '#...g..........##.........P....#',
      '#..............##..............#',
      '####.############.#########.####',
      '#..............................#',
      '#.S..........................E.#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 2], [13, 2], [13, 3], [4, 3]] },
      { waypoints: [[4, 8], [12, 8], [12, 11], [4, 11]] },
      { waypoints: [[19, 8], [27, 8], [27, 11], [19, 11]] },
    ],
    cameras: [
      { x: 8, y: 0, angle: DOWN },
      { x: 23, y: 0, angle: DOWN },
    ],
  },
  {
    name: 'Meridian Bank',
    sub: 'Job 2 of 3 — crack the vault room, dodge the cameras',
    target: 16000,
    brief:
      'Meridian Bank keeps its gold in a vault room in the north-east corner — one door, ' +
      'one camera staring straight at it. Four guards, three cameras, and $16,500 on the floor. ' +
      'Take $16,000 and get out. A tossed coin (F) pulls a nearby guard off its patrol.',
    map: [
      '################################',
      '#....................#.....V..##',
      '#..P.................#...V....##',
      '#.........g.......g..#........##',
      '#..............P.....#........##',
      '#....................####.######',
      '#..............................#',
      '#.....####..g......g..####..P..#',
      '#.....####............####.....#',
      '#..............................#',
      '#....g....##........##....g....#',
      '#.........##........##.........#',
      '#.............g..g.............#',
      '####.############.#########.####',
      '#..............................#',
      '#.......g..............g.......#',
      '#.S..........................E.#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 2], [18, 2], [18, 4], [4, 4]] },
      { waypoints: [[26, 6], [29, 6], [29, 12], [26, 12]] },
      { waypoints: [[3, 9], [12, 9], [12, 12], [3, 12]] },
      { waypoints: [[19, 9], [28, 9], [28, 12], [19, 12]] },
    ],
    cameras: [
      { x: 8, y: 0, angle: DOWN },
      { x: 24, y: 0, angle: DOWN },
      { x: 15, y: 17, angle: UP },
    ],
  },
  {
    name: 'The Gilded Casino',
    sub: 'Job 3 of 3 — the cashier cage, five guards, no mistakes',
    target: 18000,
    brief:
      'The Gilded Casino never sleeps: five guards, four cameras, slot-machine rows to hide ' +
      'behind and a cashier cage full of gold. The cage has one door and a camera above it. ' +
      'Lift $18,000 and walk out the south exit — quietly, and the $1,000 ghost bonus is yours.',
    map: [
      '################################',
      '#...P................#..V.....##',
      '#.........g..........#.....V..##',
      '#................P...#........##',
      '#....................####.######',
      '#...........................P..#',
      '#...####..g..####..g..####.....#',
      '#...####.....####.....####.....#',
      '#.............g..g.............#',
      '#.....g......######......g.....#',
      '#............######............#',
      '#..............................#',
      '#...g.......................P..#',
      '####.############.#########.####',
      '#..............................#',
      '#.......g..............g.......#',
      '#.S..........................E.#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 2], [19, 2], [19, 4], [4, 4]] },
      { waypoints: [[22, 5], [29, 5]] },
      { waypoints: [[3, 8], [11, 8], [11, 11], [3, 11]] },
      { waypoints: [[20, 8], [29, 8], [29, 11], [20, 11]] },
      { waypoints: [[4, 14], [27, 14], [27, 15], [4, 15]] },
    ],
    cameras: [
      { x: 8, y: 0, angle: DOWN },
      { x: 16, y: 0, angle: DOWN },
      { x: 24, y: 0, angle: DOWN },
      { x: 15, y: 17, angle: UP },
    ],
  },
];

// Turn one level's map strings into the structures the world steps on:
// a wall grid, the spawn and exit in tile coordinates, and the loot list.
export function parseLevel(index) {
  const level = LEVELS[index];
  if (!level) throw new Error('no level ' + index);
  if (level.map.length !== ROWS) throw new Error(level.name + ': map is not ' + ROWS + ' rows');
  const walls = [];
  const loot = [];
  let spawn = null;
  let exit = null;
  let id = 0;
  for (let y = 0; y < ROWS; y++) {
    const row = level.map[y];
    if (row.length !== COLS) throw new Error(level.name + ': row ' + y + ' is ' + row.length + ' wide');
    walls.push([]);
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      walls[y].push(ch === '#');
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (ch === 'S') spawn = { x: cx, y: cy };
      else if (ch === 'E') exit = { x: cx, y: cy };
      else if (ch === 'g') loot.push({ id: id++, kind: 'small', x: cx, y: cy, value: LOOT_SMALL_VALUE, taken: false });
      else if (ch === 'P') loot.push({ id: id++, kind: 'painting', x: cx, y: cy, value: LOOT_PAINTING_VALUE, taken: false, progress: 0 });
      else if (ch === 'V') loot.push({ id: id++, kind: 'vault', x: cx, y: cy, value: LOOT_VAULT_VALUE, taken: false, progress: 0 });
    }
  }
  if (!spawn) throw new Error(level.name + ': no spawn');
  if (!exit) throw new Error(level.name + ': no exit');
  return {
    level,
    walls,
    spawn,
    exit,
    loot,
    totalValue: loot.reduce((sum, item) => sum + item.value, 0),
  };
}

// Is the tile at (x, y) a wall? Anything outside the map counts as a wall.
export function isWall(walls, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return walls[y][x];
}
