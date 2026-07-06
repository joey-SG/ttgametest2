// 절차 생성 사운드 (WebAudio, docs/02 §8). 외부 오디오 에셋 0.
// iOS는 첫 사용자 제스처 안에서 resume()해야 소리가 난다 (docs/03 §3.4) —
// main.ts의 pointerdown 핸들러에서 ensureAudioResumed()를 호출한다.

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;
  if (!ctx) {
    try {
      ctx = new AudioCtxCtor();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

export function ensureAudioResumed(): void {
  const audioCtx = getContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
}

interface ToneOptions {
  freqStart: number;
  freqEnd?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  filterHz?: number;
}

function playTone(opts: ToneOptions): void {
  const audioCtx = getContext();
  // 제스처 전(suspended)이거나 미지원 환경이면 조용히 무시 — 사운드는 향상이지 필수가 아니다.
  if (!audioCtx || audioCtx.state !== 'running') return;

  const { freqStart, freqEnd, duration, type = 'sine', gain = 0.2, filterHz } = opts;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, now);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
  }

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  let outputNode: AudioNode = osc;
  if (filterHz !== undefined) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    osc.connect(filter);
    outputNode = filter;
  }
  outputNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** 드롭 순간의 가벼운 틱. */
export function playDropTick(): void {
  playTone({ freqStart: 1000, freqEnd: 700, duration: 0.05, type: 'sine', gain: 0.08 });
}

/** 머지 팝 — 티어가 높을수록 낮고 풍성하게, 체인 단계가 높을수록 피치 상승. */
export function playMergeSound(tier: number, chainStage: number): void {
  const baseFreq = 720 - tier * 42;
  const chainBoost = Math.min(Math.max(chainStage - 1, 0), 6) * 35;
  const freq = Math.max(120, baseFreq + chainBoost);
  const richer = tier >= 5;
  playTone({
    freqStart: freq * 1.15,
    freqEnd: freq * 0.85,
    duration: richer ? 0.22 : 0.12,
    type: richer ? 'triangle' : 'sine',
    gain: 0.18,
    filterHz: richer ? 1800 : undefined,
  });
}

/** 블랙홀+블랙홀 = 빅뱅 전용 큰 사운드. */
export function playBigBang(): void {
  playTone({ freqStart: 90, freqEnd: 28, duration: 0.9, type: 'sawtooth', gain: 0.28, filterHz: 500 });
}

/** 오버플로우 경고 심장박동에 맞춘 짧은 비프. */
export function playWarningBeep(): void {
  playTone({ freqStart: 520, duration: 0.07, type: 'square', gain: 0.05 });
}

/** 게임오버 저음 붐. */
export function playGameOverBoom(): void {
  playTone({ freqStart: 140, freqEnd: 40, duration: 0.5, type: 'sine', gain: 0.25 });
}

/** 노바 버스트 발동 — 딥 "웅" 사운드(저음 훔 스웰). */
export function playNovaBurst(): void {
  playTone({ freqStart: 180, freqEnd: 55, duration: 0.7, type: 'sine', gain: 0.22, filterHz: 900 });
}
