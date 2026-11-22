// main.js — the app shell: fixed-step loop, screen flow, shot staging.
// Screens: title -> brief -> playing -> (busted | jobDone) -> brief ->
// ... -> heistDone. P pauses, M mutes, R restarts the job. The world
// steps at a fixed 60 Hz so play is the same on any machine; the title
// screen steps the world in harmless mode so the guards patrol behind it
// without ever catching the idle thief.

import { VIEW_W, VIEW_H, GHOST_BONUS } from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, stepWorld } from './world.js';
import {
  drawWorld,
  drawHud,
  drawTitle,
  drawBrief,
  drawPaused,
  drawBusted,
  drawJobDone,
  drawHeistDone,
} from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

function newJob(app, jobIndex) {
  app.jobIndex = jobIndex;
  app.world = createWorld(jobIndex, 7);
  app.screen = 'brief';
}

function restartJob(app) {
  app.world = createWorld(app.jobIndex, 7);
  app.screen = 'brief';
}

function restartAll(app) {
  app.totalLoot = 0;
  app.ghost = true;
  newJob(app, 0);
}

export function startGame(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const audio = createAudio();
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');

  const app = {
    screen: 'title',
    jobIndex: 0,
    world: createWorld(0, 7),
    totalLoot: 0,
    ghost: true, // stays true only while the alarm never rose on any job
    prevLoot: 0,
    prevSpotted: false,
  };
  window.__game = app;

  if (shotName) {
    // Screenshot mode: stage one frozen frame and never step it, so the
    // render the screenshot takes is exactly the staged one. Fit the
    // canvas first, or a short viewport would crop the HUD off the top.
    fitCanvas();
    const staged = stageShot(shotName);
    app.screen = staged.screen;
    app.world = staged.world;
    app.jobIndex = staged.app.jobIndex;
    app.totalLoot = staged.app.totalLoot;
    app.ghost = staged.app.ghost;
    app.prevLoot = app.world.lootValue;
    renderFrame();
    window.__shotReady = true;
    return app;
  }

  function advance() {
    if (app.screen === 'title') {
      audio.ensure();
      newJob(app, 0);
    } else if (app.screen === 'brief') {
      app.screen = 'playing';
      input.clearPressed();
    } else if (app.screen === 'jobDone') {
      audio.ensure();
      if (app.jobIndex + 1 < LEVELS.length) newJob(app, app.jobIndex + 1);
      else app.screen = 'heistDone';
    }
  }

  function stepPlaying() {
    const world = app.world;
    const polled = input.poll(world.thief);
    const stepInput = {
      mx: polled.mx,
      my: polled.my,
      sneak: polled.sneak,
      toss: input.wasPressed('KeyF'),
    };
    stepWorld(world, stepInput, STEP, {});
    world.sneakHeld = polled.sneak;

    if (world.lootValue > app.prevLoot) {
      if (world.lootValue - app.prevLoot >= 2000) audio.grab();
      else audio.pickup();
    }
    app.prevLoot = world.lootValue;
    if (world.spotted && !app.prevSpotted) audio.spotted();
    app.prevSpotted = world.spotted;
    audio.setAlarmLevel(world.alarm);

    if (world.busted) {
      audio.busted();
      audio.setAlarmLevel(0);
      app.screen = 'busted';
    } else if (world.exited) {
      app.totalLoot += world.lootValue;
      if (world.alarmEverRose) app.ghost = false;
      if (app.jobIndex + 1 >= LEVELS.length) {
        audio.heistDone();
        app.screen = 'heistDone';
      } else {
        audio.jobDone();
        app.screen = 'jobDone';
      }
    }
  }

  function renderFrame() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawWorld(ctx, app.world);
    if (app.screen === 'playing' || app.screen === 'paused') drawHud(ctx, app.world, app);
    if (app.screen === 'title') {
      drawHud(ctx, app.world, app);
      drawTitle(ctx, app.world);
    } else if (app.screen === 'brief') {
      drawBrief(ctx, LEVELS[app.jobIndex]);
    } else if (app.screen === 'paused') {
      drawPaused(ctx);
    } else if (app.screen === 'busted') {
      drawHud(ctx, app.world, app);
      drawBusted(ctx, app.world);
    } else if (app.screen === 'jobDone') {
      drawHud(ctx, app.world, app);
      drawJobDone(ctx, app.world, app);
    } else if (app.screen === 'heistDone') {
      drawHeistDone(ctx, app);
    }
  }

  // Fit the 1280x720 canvas into the window, letterboxed.
  function fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = Math.floor(VIEW_W * scale) + 'px';
    canvas.style.height = Math.floor(VIEW_H * scale) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      acc -= STEP;
      steps += 1;
      // Global keys, whatever the screen.
      if (input.wasPressed('KeyM')) audio.toggleMute();
      if (app.screen === 'playing') {
        if (input.wasPressed('KeyP')) {
          app.screen = 'paused';
        } else if (input.wasPressed('KeyR')) {
          restartJob(app);
        } else {
          stepPlaying();
        }
      } else if (app.screen === 'paused') {
        if (input.wasPressed('KeyP')) app.screen = 'playing';
        else if (input.wasPressed('KeyR')) restartJob(app);
      } else if (app.screen === 'title') {
        stepWorld(app.world, { mx: 0, my: 0, sneak: false, toss: false }, STEP, { harmless: true });
        if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter') || input.wasPressed('Pointer')) advance();
      } else if (app.screen === 'brief') {
        if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter') || input.wasPressed('Pointer')) advance();
      } else if (app.screen === 'busted') {
        if (input.wasPressed('KeyR')) restartJob(app);
      } else if (app.screen === 'jobDone') {
        if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter') || input.wasPressed('Pointer')) advance();
      } else if (app.screen === 'heistDone') {
        if (input.wasPressed('KeyR')) restartAll(app);
      }
    }
    if (steps === 5) acc = 0;
    renderFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return app;
}

// Boot when this module loads.
const canvas = document.getElementById('game');
if (canvas) startGame(canvas);

// Keep the ghost bonus value visible to the dossier's outline.
export const GHOST_BONUS_VALUE = GHOST_BONUS;
