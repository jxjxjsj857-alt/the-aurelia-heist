// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, pause, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A mouse click sets a walk
// target the thief steers toward until a key is pressed or the target is reached.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas, toWorld) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sneak = false;
  let actions = 0;
  /** Where a click told the thief to walk, in world coordinates, or null. */
  let clickTarget = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SNEAK.has(event.code)) sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SNEAK.has(event.code)) sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    if (toWorld) {
      const point = toWorld(event.clientX, event.clientY);
      if (point) clickTarget = point;
    }
  });

  return {
    /** The steering vector this frame: keys first, else toward the click target. */
    move(player) {
      const kx = (right ? 1 : 0) - (left ? 1 : 0);
      const ky = (down ? 1 : 0) - (up ? 1 : 0);
      if (kx !== 0 || ky !== 0) {
        clickTarget = null;
        return { x: kx, y: ky };
      }
      if (clickTarget) {
        const dx = clickTarget.x - player.x;
        const dy = clickTarget.y - player.y;
        if (Math.hypot(dx, dy) < 8) {
          clickTarget = null;
          return { x: 0, y: 0 };
        }
        return { x: dx, y: dy };
      }
      return { x: 0, y: 0 };
    },
    sneak() {
      return sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
