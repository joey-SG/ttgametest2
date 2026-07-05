// 화면 가장자리 글로우 플래시 + 빅뱅 화이트아웃 — 트리거형 지속 상태(감쇠).
// 시간에 대한 순수 함수인 진동(오버플로우 심장박동 등)은 render.ts에서 직접 계산한다.

interface FlashState {
  intensity: number;
  color: string;
  decayPerSec: number;
}

const edgeGlow: FlashState = { intensity: 0, color: '#ffffff', decayPerSec: 3 };
let whiteout = 0;
let whiteoutDecay = 2.5;

export function triggerEdgeGlow(color: string, intensity: number, decayPerSec = 3): void {
  edgeGlow.intensity = Math.max(edgeGlow.intensity, intensity);
  edgeGlow.color = color;
  edgeGlow.decayPerSec = decayPerSec;
}

export function triggerWhiteout(intensity: number, decayPerSec = 2.5): void {
  whiteout = Math.max(whiteout, intensity);
  whiteoutDecay = decayPerSec;
}

export function updateGlow(dt: number): void {
  edgeGlow.intensity = Math.max(0, edgeGlow.intensity - edgeGlow.decayPerSec * dt);
  whiteout = Math.max(0, whiteout - whiteoutDecay * dt);
}

export function getEdgeGlow(): { intensity: number; color: string } {
  return { intensity: edgeGlow.intensity, color: edgeGlow.color };
}

export function getWhiteout(): number {
  return whiteout;
}
