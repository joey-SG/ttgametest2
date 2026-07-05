// 화면 셰이크 — 트리거 시 크기를 누적(최댓값)하고 시간에 따라 지수 감쇠.

let magnitude = 0;

/** amount(월드 단위)만큼 셰이크를 트리거. 기존 셰이크가 더 강하면 유지. */
export function triggerShake(amount: number): void {
  magnitude = Math.max(magnitude, amount);
}

export function updateShake(dt: number): void {
  if (magnitude <= 0.01) {
    magnitude = 0;
    return;
  }
  magnitude *= Math.exp(-dt * 8);
}

export function getShakeOffset(): { x: number; y: number } {
  if (magnitude <= 0) return { x: 0, y: 0 };
  return {
    x: (Math.random() * 2 - 1) * magnitude,
    y: (Math.random() * 2 - 1) * magnitude,
  };
}
