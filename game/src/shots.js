// The screenshot scenes behind ?shot=title|stealth|spotted|vault. Each one sets the real
// world to a chosen moment — the thief mid-room, a guard's cone sweeping past, a camera
// watching the vault, the alarm meter high — then steps the simulation a fixed number of
// times with no input, so the frame is what the game really looks like and the same seed
// always gives the same frame.
import { STEP, TILE } from './config.js';
import { EVENT_CAUGHT, EVENT_LEVEL_DONE, EVENT_WIN } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const NO_MOVE = { x: 0, y: 0 };

function placeGuard(state, index, tileX, tileY, facing, chasing) {
  const guard = state.guards[index];
  guard.x = (tileX + 0.5) * TILE;
  guard.y = (tileY + 0.5) * TILE;
  guard.facing = facing;
  guard.waiting = 0;
  guard.chasing = chasing;
  guard.loseSight = 0;
  guard.seesPlayer = false;
}

function placePlayer(state, tileX, tileY, sneak) {
  state.player.x = (tileX + 0.5) * TILE;
  state.player.y = (tileY + 0.5) * TILE;
  state.player.facing = 0;
  state.player.sneak = sneak;
}

/** Take the loot at (tileX, tileY) and add its value to the haul, as if lifted already. */
function takeLoot(state, tileX, tileY) {
  for (const item of state.loot) {
    if (!item.taken && Math.abs(item.x - (tileX + 0.5) * TILE) < 1 && Math.abs(item.y - (tileY + 0.5) * TILE) < 1) {
      item.taken = true;
      state.lootValue += item.value;
      state.totalLoot += item.value;
    }
  }
}

function settle(world, steps, harmless) {
  for (let index = 0; index < steps; index += 1) {
    const events = world.step(STEP, NO_MOVE, false, harmless);
    if (events & (EVENT_CAUGHT | EVENT_LEVEL_DONE | EVENT_WIN)) break;
  }
}

/**
 * Set `world` to the named scene (title, stealth, spotted or vault; any other name is
 * title) and return the screen to draw over it and the best haul to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'stealth') {
    world.loadLevel(0);
    placePlayer(state, 7, 10, true);
    placeGuard(state, 0, 20, 3, 0, false);
    placeGuard(state, 1, 14, 11, Math.PI / 2, false);
    placeGuard(state, 2, 27, 10, -Math.PI / 2, false);
    takeLoot(state, 3, 4);
    state.alarm = 8;
    state.elapsed = 6.2;
    settle(world, 30);
    return { screen: SCREEN_PLAY, best: 500 };
  }
  if (name === 'spotted') {
    world.loadLevel(1);
    placePlayer(state, 15, 5, false);
    placeGuard(state, 0, 20, 3, 0, true);
    placeGuard(state, 1, 10, 8, 0, false);
    placeGuard(state, 2, 21, 8, Math.PI, false);
    placeGuard(state, 3, 17, 7, Math.PI * 0.75, true);
    takeLoot(state, 2, 2);
    takeLoot(state, 5, 6);
    takeLoot(state, 24, 2);
    takeLoot(state, 15, 2);
    takeLoot(state, 16, 2);
    state.alarm = 88;
    state.alarmed = true;
    state.ghost = false;
    state.elapsed = 9.4;
    settle(world, 15);
    return { screen: SCREEN_PLAY, best: 14500 };
  }
  if (name === 'vault') {
    world.loadLevel(1);
    placePlayer(state, 16, 3, false);
    placeGuard(state, 0, 10, 3, Math.PI, false);
    placeGuard(state, 1, 10, 8, Math.PI / 2, false);
    placeGuard(state, 2, 21, 8, -Math.PI / 2, false);
    placeGuard(state, 3, 15, 9, -Math.PI / 2, false);
    takeLoot(state, 2, 2);
    takeLoot(state, 5, 6);
    takeLoot(state, 24, 2);
    takeLoot(state, 15, 2);
    takeLoot(state, 25, 6);
    takeLoot(state, 3, 10);
    state.alarm = 34;
    state.elapsed = 3.1;
    // The thief is mid-lift on the last vault pile: the progress ring is half drawn.
    for (const item of state.loot) {
      if (!item.taken && item.kind === 'V') {
        state.grabTarget = item;
        state.grabProgress = 0.6;
      }
    }
    settle(world, 10);
    return { screen: SCREEN_PLAY, best: 11500 };
  }
  world.reset();
  settle(world, 300, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
