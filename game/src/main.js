// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between seven screens: title, briefing, play, paused, level done,
// busted and the final tally.
//
// ?seed=N fixes the dust and the level layouts' random touches. ?shot=title|stealth|
// spotted|vault (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM_OFF, EVENT_ALARM_ON, EVENT_BIG_LOOT, EVENT_CAUGHT, EVENT_LEVEL_DONE, EVENT_PICKUP, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_BUSTED, SCREEN_LEVEL_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** Turn a pointer position on the page into a point in the 1280x720 playfield. */
function toWorld(clientX, clientY) {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  const offsetX = (window.innerWidth - FIELD.width * scale) / 2;
  const offsetY = (window.innerHeight - FIELD.height * scale) / 2;
  return { x: (clientX - offsetX) / scale, y: (clientY - offsetY) / scale };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, toWorld);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Storage can be off (private windows): the best haul then lasts this visit only.
    }
  }

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function finalHaul() {
    return world.state.totalLoot + (world.state.ghost ? 1000 : 0);
  }

  function startLevel() {
    screen = SCREEN_BRIEF;
    announce(world.state.level.name + '. Target ' + world.state.lootTarget + ' dollars.');
  }

  function beginPlay() {
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Stay out of the vision cones.');
  }

  function endLevel() {
    if (world.state.won) {
      screen = SCREEN_WIN;
      const haul = finalHaul();
      if (haul > best) {
        best = haul;
        saveBest(best);
      }
      announce('The perfect heist. Total haul ' + haul + ' dollars.');
    } else {
      screen = SCREEN_LEVEL_DONE;
      announce('Clean getaway. ' + world.state.lootValue + ' dollars from this room.');
    }
  }

  function endBusted() {
    screen = SCREEN_BUSTED;
    announce('Busted. A guard caught you.');
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_BIG_LOOT) audio.bigLoot();
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! Break line of sight.');
    }
    if (events & EVENT_ALARM_ON) audio.alarmStart();
    if (events & EVENT_ALARM_OFF) audio.alarmStop();
    if (events & EVENT_CAUGHT) {
      audio.alarmStop();
      audio.caught();
      endBusted();
    } else if (events & (EVENT_LEVEL_DONE | EVENT_WIN)) {
      audio.alarmStop();
      audio.win();
      endLevel();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      audio.click();
      if (screen === SCREEN_TITLE) startLevel();
      else if (screen === SCREEN_BRIEF) beginPlay();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_LEVEL_DONE) {
        world.nextLevel();
        startLevel();
      } else if (screen === SCREEN_BUSTED) {
        world.loadLevel(world.state.levelIndex);
        startLevel();
      } else if (screen === SCREEN_WIN) {
        world.reset();
        screen = SCREEN_TITLE;
        announce('The Aurelia Heist. Press Enter or click to plan the first job.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_RESTART && screen === SCREEN_PLAY) {
      world.loadLevel(world.state.levelIndex);
      startLevel();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: guards patrol, nothing is at stake.
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.move(world.state.player), input.sneak());
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Aurelia Heist. Press Enter or click to plan the first job.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
