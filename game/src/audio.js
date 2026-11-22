// Sound, synthesised with WebAudio: no audio files, no network. The context is created
// on the first user gesture, so a page that only stages a screenshot stays silent.
import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let context = null;
  let master = null;
  let muted = readMuted();
  let siren = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.22;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, when, slideTo) {
    if (!ensure() || muted) return;
    const start = context.currentTime + (when ?? 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.9, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function setMuted(value) {
    muted = value;
    try {
      window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      // Storage can be off: the mute then lasts this visit only.
    }
    if (master) master.gain.value = value ? 0 : 0.22;
  }

  return {
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      setMuted(!muted);
      return muted;
    },
    click() {
      tone(660, 0.07, 'triangle');
    },
    pickup() {
      tone(880, 0.09, 'sine');
      tone(1318, 0.12, 'sine', 0.06);
    },
    bigLoot() {
      tone(523, 0.12, 'triangle');
      tone(659, 0.12, 'triangle', 0.09);
      tone(784, 0.2, 'triangle', 0.18);
    },
    spotted() {
      tone(220, 0.16, 'sawtooth', 0, 180);
      tone(180, 0.2, 'sawtooth', 0.14, 140);
    },
    alarmStart() {
      if (!ensure() || muted || siren) return;
      siren = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      siren.type = 'sine';
      siren.frequency.value = 620;
      lfo.type = 'sine';
      lfo.frequency.value = 1.6;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(siren.frequency);
      gain.gain.value = 0.05;
      siren.connect(gain);
      gain.connect(master);
      siren.start();
      lfo.start();
      siren._lfo = lfo;
      siren._gain = gain;
    },
    alarmStop() {
      if (!siren) return;
      try {
        siren._gain.gain.setTargetAtTime(0, context.currentTime, 0.05);
        const old = siren;
        window.setTimeout(() => {
          try { old.stop(); old._lfo.stop(); } catch { /* already stopped */ }
        }, 300);
      } catch {
        // The context went away with the page.
      }
      siren = null;
    },
    caught() {
      tone(160, 0.4, 'sawtooth', 0, 60);
      tone(110, 0.5, 'square', 0.1, 55);
    },
    win() {
      tone(523, 0.14, 'triangle');
      tone(659, 0.14, 'triangle', 0.12);
      tone(784, 0.14, 'triangle', 0.24);
      tone(1046, 0.3, 'triangle', 0.36);
    },
  };
}
