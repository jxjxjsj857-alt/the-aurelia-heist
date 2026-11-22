// input.js — keyboard and mouse, turned into one movement direction.
// The game reads this every fixed step; nothing here touches the canvas.
// Click-to-move: a click on the field sets a walk target, and the keys
// always win over the mouse while they are held.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    toss: false, // edge-triggered: main.js clears it after each step
    clickTarget: null, // {x, y} in tile coordinates, or null
    pressed: new Set(), // keys pressed since the last poll, edge-triggered
  };

  const KEYMAP = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    input.pressed.add(event.code);
    if (KEYMAP[event.code] || event.code === 'Space') event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    input.clickTarget = { x: px / 40, y: py / 40 };
    input.pressed.add('Pointer');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  // Recompute the movement direction from the keys held right now.
  // Falls back to the click target when no key is held.
  input.poll = function poll(thief) {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (mx !== 0 || my !== 0) {
      input.clickTarget = null; // keys cancel a click walk
    } else if (input.clickTarget && thief) {
      const dx = input.clickTarget.x - thief.x;
      const dy = input.clickTarget.y - thief.y;
      if (Math.hypot(dx, dy) < 0.25) {
        input.clickTarget = null;
      } else {
        mx = dx;
        my = dy;
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      input.mx = mx / len;
      input.my = my / len;
    } else {
      input.mx = 0;
      input.my = 0;
    }
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    return input;
  };

  // Was this key pressed since the last call? Clears as it answers.
  input.wasPressed = function wasPressed(code) {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
    return false;
  };

  input.clearPressed = function clearPressed() {
    input.pressed.clear();
  };

  return input;
}
