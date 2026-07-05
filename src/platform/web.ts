import { STORAGE_KEYS } from '../config';
import type { HapticKind, Platform } from './types';

// 웹 폴백 어댑터. 저장은 localStorage(프라이빗 모드 대비 try/catch), 햅틱은 뼈대만.
// 보상형 광고 카운트다운 오버레이는 M3에서 구현 — 지금은 완주 실패(false) 스텁.

function vibratePattern(kind: HapticKind): number | number[] {
  switch (kind) {
    case 'select':
      return 10;
    case 'success':
      return 20;
    case 'combo':
      return [20, 30, 20];
    case 'fail':
      return 40;
  }
}

// iOS Safari는 Vibration API가 없다. <input type="checkbox" switch>를 연결된
// <label>의 click()으로 토글하면 시스템 햅틱이 울리는 트릭을 쓴다 (docs/03 §3.2,
// iOS 17.4~26.4 확인, 26.5에서 패치돼도 실패 시 무해한 no-op).
// ⚠️ label.click()은 진짜 클릭처럼 버블되는 합성 이벤트를 만든다 — 게임의 전역 탭
// 리스너까지 도달하면 유령 입력이 되므로 캡처 단계에서 반드시 stopPropagation한다.
let iosHapticLabel: HTMLLabelElement | null = null;
let iosHapticSetupAttempted = false;

function setupIOSHapticElement(): HTMLLabelElement | null {
  if (iosHapticSetupAttempted) return iosHapticLabel;
  iosHapticSetupAttempted = true;
  if (typeof document === 'undefined') return null;
  try {
    const label = document.createElement('label');
    label.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;';
    label.ariaHidden = 'true';
    label.addEventListener('click', (e) => e.stopPropagation(), true);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);

    document.body.appendChild(label);
    iosHapticLabel = label;
  } catch {
    iosHapticLabel = null;
  }
  return iosHapticLabel;
}

function triggerIOSHaptic(kind: HapticKind): void {
  const label = setupIOSHapticElement();
  if (!label) return;
  label.click();
  // 강한 이벤트는 짧은 간격을 두고 한 번 더 토글해 세기를 흉내낸다.
  if (kind === 'combo' || kind === 'fail') {
    setTimeout(() => label.click(), 70);
  }
}

export function createWebPlatform(): Platform {
  return {
    async showRewardedAd(_placement) {
      // M3: 3초 카운트다운 오버레이 + TikTok SDK 연동. M1은 항상 미완주 처리.
      return false;
    },

    haptic(kind) {
      try {
        // Android/일부 브라우저: Vibration API.
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(vibratePattern(kind));
          return;
        }
        // iOS Safari 폴백. 둘 다 미지원이면 triggerIOSHaptic 내부에서 조용히 no-op.
        triggerIOSHaptic(kind);
      } catch {
        // 향상 기능이므로 실패는 무시한다.
      }
    },

    async setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // 프라이빗 모드 등에서 저장 실패는 무해하게 무시.
      }
    },

    async getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },

    async saveHighScore(score) {
      try {
        localStorage.setItem(STORAGE_KEYS.highScore, String(score));
      } catch {
        // 무시
      }
    },

    async loadHighScore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.highScore);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
      } catch {
        return 0;
      }
    },

    isTikTokInApp() {
      return false;
    },
  };
}
