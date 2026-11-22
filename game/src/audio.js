// audio.js — all sound is synthesised with WebAudio: no audio files,
// no network, nothing to load. A tiny helper builds short blips and
// sweeps; the game calls the named effects at the right moments.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    alarmOsc: null,
    alarmGain: null,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.alarmGain) audio.alarmGain.gain.value = 0;
    return audio.muted;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  audio.pickup = function pickup() {
    tone(880, 0.09, 'sine', 0.1);
    setTimeout(() => tone(1318, 0.12, 'sine', 0.08), 60);
  };

  audio.grab = function grab() {
    tone(523, 0.1, 'triangle', 0.12);
    setTimeout(() => tone(659, 0.1, 'triangle', 0.12), 90);
    setTimeout(() => tone(784, 0.18, 'triangle', 0.12), 180);
  };

  audio.coin = function coin() {
    tone(1568, 0.07, 'square', 0.05, 2093);
  };

  audio.spotted = function spotted() {
    tone(220, 0.25, 'sawtooth', 0.1, 110);
  };

  audio.busted = function busted() {
    tone(392, 0.18, 'sawtooth', 0.14, 196);
    setTimeout(() => tone(311, 0.3, 'sawtooth', 0.14, 155), 170);
  };

  audio.jobDone = function jobDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => setTimeout(() => tone(note, 0.22, 'triangle', 0.12), i * 110));
  };

  audio.heistDone = function heistDone() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((note, i) => setTimeout(() => tone(note, 0.3, 'triangle', 0.12), i * 130));
  };

  // A soft two-note pulse while the alarm is high; silent otherwise.
  audio.setAlarmLevel = function setAlarmLevel(level) {
    if (!audio.ctx || audio.muted) {
      if (audio.alarmGain) audio.alarmGain.gain.value = 0;
      return;
    }
    if (level < 55) {
      if (audio.alarmGain) audio.alarmGain.gain.value = 0;
      return;
    }
    if (!audio.alarmOsc) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.value = 0;
      const lfo = audio.ctx.createOscillator();
      const lfoGain = audio.ctx.createGain();
      lfo.frequency.value = 2.2;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(audio.ctx.destination);
      osc.start();
      lfo.start();
      audio.alarmOsc = osc;
      audio.alarmGain = gain;
    }
    audio.alarmGain.gain.value = 0.015 + (level / 100) * 0.03;
  };

  return audio;
}
