/* global */
(function () {
'use strict';

/** 6 种独立旋律背景音乐 + 音效 */
function createBGM() {
  let ctx = null;
  let masterGain = null;
  let playing = false;
  let timerId = null;
  let step = 0;
  let currentTrack = 'meadow';

  const SCALES = {
    calm:   [261.63, 293.66, 329.63, 392.0, 440.0],
    warm:   [277.18, 311.13, 349.23, 415.30, 466.16],
    cool:   [196.00, 220.00, 246.94, 293.66, 329.63],
    mystic: [233.08, 261.63, 311.13, 349.23, 392.00],
    tense:  [220.00, 261.63, 277.18, 329.63, 369.99],
    epic:   [174.61, 207.65, 261.63, 311.13, 349.23],
  };

  /** 每首：独立 16 步旋律 /  bass / 可选和声，不同 tempo、波形、节奏 */
  const TRACKS = {
    meadow: {
      name: '绿野',
      tempo: 96,
      scale: 'calm',
      melody:  [0, 2, 4, 2, 1, 0, null, null,  2, 4, 4, 2, 4, 2, 0, null],
      bass:    [0, 0, null, null,  2, 2, 0, 0,  3, 3, null, null,  2, 2, 0, 0],
      harmony: [null, null, 0, null, null, null, null, null, null, 2, null, null, 4, null, null, null],
      leadType: 'triangle', leadLen: 0.92, leadVol: 0.30, leadOct: 1,
      bassVol: 0.16, harmVol: 0.07, harmType: 'sine',
    },
    desert: {
      name: '荒漠',
      tempo: 84,
      scale: 'warm',
      melody:  [4, null, 3, null,  2, null, 2, 1,  0, null, null, 2,  null, 4, 3, null],
      bass:    [0, null, 0, null,  2, 2, null, null,  0, 0, null, null,  4, null, 2, null],
      leadType: 'sine', leadLen: 1.15, leadVol: 0.26, leadOct: 1,
      bassVol: 0.14, bassOct: 0.48,
      accent: [0, 8], accentFreq: 73, accentVol: 0.11,
    },
    frost: {
      name: '冰雪',
      tempo: 118,
      scale: 'cool',
      melody:  [4, 3, 2, 1, 0, 1, 2, 3,  4, 2, 0, 2, 4, 3, 1, 0],
      bass:    [0, null, 2, null, 0, null, 2, null,  4, null, 2, null, 0, null, 2, null],
      harmony: [2, null, 0, null, 2, null, 0, null, 2, null, 0, null, 2, null, 0, null],
      leadType: 'sine', leadLen: 0.48, leadVol: 0.20, leadOct: 2.2,
      bassVol: 0.11, harmVol: 0.09, harmType: 'triangle',
    },
    forest: {
      name: '森林',
      tempo: 106,
      scale: 'mystic',
      melody:  [0, null, 3, 2, null, 4, 2, null,  0, 2, null, 3, 4, 3, 2, 0],
      bass:    [0, 0, null, 3, 0, null, 2, 2,  0, null, 3, 3, null, 2, 0, 0],
      harmony: [null, null, 1, null, null, 2, null, null, null, 0, null, null, 2, null, null, null],
      leadType: 'triangle', leadLen: 0.72, leadVol: 0.27, leadOct: 1,
      bassVol: 0.15, harmVol: 0.06, harmType: 'sine',
    },
    battle: {
      name: '战鼓',
      tempo: 136,
      scale: 'tense',
      melody:  [4, 4, 3, 2,  4, 4, 3, 2,  2, 2, 1, 0,  2, 4, 4, 3],
      bass:    [0, 0, 0, 0,  0, 0, 0, 0,  2, 2, 2, 2,  0, 0, 4, 4],
      leadType: 'square', leadLen: 0.32, leadVol: 0.17, leadOct: 1,
      bassVol: 0.22, bassOct: 0.5,
      accent: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      accentFreq: 98, accentVol: 0.13,
    },
    boss: {
      name: '魔王',
      tempo: 152,
      scale: 'epic',
      melody:  [0, 4, 0, 4,  2, 3, 4, 2,  0, null, 0, 4,  3, 2, 1, 0],
      bass:    [0, 0, 4, 4,  2, 2, 3, 3,  0, 0, 0, 4,  2, 2, 0, 0],
      harmony: [0, null, 2, null, 0, null, 4, null, 0, null, null, 2, null, null, 0, null],
      leadType: 'sawtooth', leadLen: 0.58, leadVol: 0.21, leadOct: 1,
      bassVol: 0.24, bassOct: 0.42, harmVol: 0.09, harmType: 'square',
      accent: [0, 4, 8, 12], accentFreq: 52, accentVol: 0.16,
    },
  };

  const LEVEL_TRACK = ['meadow', 'desert', 'frost', 'battle', 'forest', 'battle', 'frost', 'battle', 'forest', 'boss'];

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.16;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, start, dur, type, vol) {
    if (!freq || freq <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function tick() {
    if (!playing || !ctx) return;
    const tr = TRACKS[currentTrack] || TRACKS.meadow;
    const scale = SCALES[tr.scale] || SCALES.calm;
    const beatDur = 60 / tr.tempo;
    const t = ctx.currentTime + 0.05;
    const steps = tr.melody.length;
    const idx = step % steps;
    const leadLen = (tr.leadLen || 0.85) * beatDur;
    const leadOct = tr.leadOct || 1;
    const bassOct = tr.bassOct || 0.5;

    const mel = tr.melody[idx];
    if (mel !== null && mel !== undefined && scale[mel]) {
      playTone(scale[mel] * leadOct, t, leadLen, tr.leadType || 'triangle', tr.leadVol || 0.28);
    }

    const bassLine = tr.bass;
    if (bassLine) {
      const b = bassLine[idx];
      if (b !== null && b !== undefined && scale[b]) {
        playTone(scale[b] * bassOct, t, beatDur * 0.95, 'sine', tr.bassVol || 0.18);
      }
    }

    if (tr.harmony) {
      const h = tr.harmony[idx];
      if (h !== null && h !== undefined && scale[h]) {
        playTone(scale[h] * 1.6, t, leadLen * 0.75, tr.harmType || 'sine', tr.harmVol || 0.08);
      }
    }

    if (tr.accent && tr.accent.indexOf(idx) >= 0) {
      playTone(tr.accentFreq || 90, t, beatDur * 0.14, 'square', tr.accentVol || 0.1);
    }

    step++;
    timerId = setTimeout(tick, beatDur * 1000);
  }

  function startTrack(trackId) {
    if (trackId && TRACKS[trackId]) currentTrack = trackId;
    ensureContext();
    if (playing) return;
    playing = true;
    step = 0;
    tick();
  }

  return {
    TRACKS,
    setTrackForLevel(levelIndex) {
      const id = LEVEL_TRACK[Math.min(levelIndex, LEVEL_TRACK.length - 1)] || 'meadow';
      const wasPlaying = playing;
      if (playing) this.stop();
      currentTrack = id;
      step = 0;
      if (wasPlaying) this.start();
      return id;
    },
    getTrackName() { return (TRACKS[currentTrack] || TRACKS.meadow).name; },
    cycleTrack() {
      const keys = Object.keys(TRACKS);
      const i = (keys.indexOf(currentTrack) + 1) % keys.length;
      currentTrack = keys[i];
      step = 0;
      if (playing) { this.stop(); this.start(); }
      return currentTrack;
    },
    start() { startTrack(currentTrack); },
    stop() { playing = false; if (timerId) clearTimeout(timerId); },
    toggle() {
      if (playing) { this.stop(); return false; }
      this.start();
      return true;
    },
    isPlaying() { return playing; },
    playSFX(type) {
      ensureContext();
      const t = ctx.currentTime;
      if (type === 'place') {
        playTone(520, t, 0.08, 'square', 0.12);
        playTone(780, t + 0.04, 0.1, 'square', 0.08);
      } else if (type === 'kill') {
        playTone(880, t, 0.06, 'triangle', 0.1);
      } else if (type === 'level') {
        [523, 659, 784, 1047].forEach((f, i) => playTone(f, t + i * 0.12, 0.2, 'triangle', 0.15));
      } else if (type === 'win') {
        [392, 494, 587, 784, 988].forEach((f, i) => playTone(f, t + i * 0.15, 0.35, 'triangle', 0.18));
      } else if (type === 'hurt') {
        playTone(180, t, 0.25, 'sawtooth', 0.12);
      } else if (type === 'exit') {
        playTone(330, t, 0.15, 'sine', 0.1);
      } else if (type === 'cannon_fire') {
        playTone(140, t, 0.06, 'sawtooth', 0.1);
        playTone(90, t + 0.04, 0.12, 'square', 0.08);
      } else if (type === 'cannon_hit') {
        playTone(70, t, 0.08, 'square', 0.2);
        playTone(45, t, 0.4, 'sawtooth', 0.15);
        playTone(180, t + 0.06, 0.25, 'triangle', 0.1);
        playTone(120, t + 0.12, 0.2, 'sawtooth', 0.06);
      } else if (type === 'frost_fire') {
        playTone(920, t, 0.05, 'sine', 0.07);
        playTone(1380, t + 0.03, 0.07, 'triangle', 0.05);
      } else if (type === 'frost_hit') {
        [1400, 1100, 880, 660, 440].forEach((f, i) => playTone(f, t + i * 0.035, 0.09, 'sine', 0.07 - i * 0.008));
        playTone(220, t + 0.05, 0.2, 'triangle', 0.04);
      } else if (type === 'archer_fire') {
        playTone(640, t, 0.04, 'triangle', 0.05);
      }
    },
  };
}

window.GameAudio = createBGM();
})();
