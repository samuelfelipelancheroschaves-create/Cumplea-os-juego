let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  context();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const audio = context();
  if (!audio) return;
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  jump: () => tone(520, 0.09, "sine", 0.05),
  djump: () => {
    tone(640, 0.08, "sine", 0.045);
    tone(880, 0.1, "triangle", 0.03, 0.04);
  },
  coin: () => {
    tone(880, 0.07, "sine", 0.04);
    tone(1320, 0.1, "triangle", 0.03, 0.05);
  },
  card: () => {
    tone(523, 0.16, "sine", 0.04);
    tone(659, 0.18, "sine", 0.035, 0.08);
    tone(784, 0.28, "triangle", 0.03, 0.16);
  },
  check: () => tone(660, 0.12, "triangle", 0.04),
  hurt: () => tone(160, 0.18, "sawtooth", 0.03),
  win: () => {
    [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, "sine", 0.04, i * 0.09));
  },
};

let finale: HTMLAudioElement | null = null;

export function playFinale() {
  if (typeof window === "undefined") return;
  unlockAudio();
  if (!finale) {
    finale = new Audio("/audio/final.m4a");
    finale.preload = "auto";
  }
  finale.currentTime = 0;
  return finale.play();
}

export function stopFinale() {
  if (!finale) return;
  finale.pause();
  finale.currentTime = 0;
}
