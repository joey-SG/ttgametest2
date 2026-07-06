// 밸런스 수치·물리 상수·확률은 전부 이 파일에 모은다 (매직넘버 금지, CLAUDE.md §2/§6).

export interface TierConfig {
  id: number;
  name: string;
  radius: number; // 월드 단위(px 아님, 렌더에서 스케일)
  score: number;
  color: string; // 절차 그라디언트의 베이스 색
}

// 11티어: 별먼지 → 블랙홀. 반지름은 docs/02 §2 "상대 반지름" × 16 스케일.
export const TIERS: TierConfig[] = [
  { id: 0, name: '별먼지', radius: 16.0, score: 1, color: '#9ca3ff' },
  { id: 1, name: '운석', radius: 22.4, score: 3, color: '#8b8b9e' },
  { id: 2, name: '달', radius: 30.4, score: 6, color: '#d8d8e0' },
  { id: 3, name: '화성', radius: 40.0, score: 10, color: '#e07a5f' },
  { id: 4, name: '지구', radius: 51.2, score: 15, color: '#4d96ff' },
  { id: 5, name: '해왕성', radius: 64.0, score: 21, color: '#3a6bd8' },
  { id: 6, name: '목성', radius: 80.0, score: 28, color: '#e0a458' },
  { id: 7, name: '토성', radius: 97.6, score: 36, color: '#e8c078' },
  { id: 8, name: '태양', radius: 116.8, score: 45, color: '#ffcf4d' },
  { id: 9, name: '적색거성', radius: 137.6, score: 55, color: '#ff6b4d' },
  { id: 10, name: '블랙홀', radius: 160.0, score: 66, color: '#1a0a2e' },
];

export const LAST_TIER_ID = TIERS.length - 1;

// 드롭 풀: 티어 0~4만 랜덤 드롭. 지구(4)는 낮은 확률(희귀).
export const DROP_POOL_IDS = [0, 1, 2, 3, 4];
export const DROP_POOL_WEIGHTS = [35, 28, 20, 12, 5]; // 합 100

export const DROP = {
  cooldownMs: 420, // 연속 드롭 방지 최소 간격
  spawnY: 44, // 드롭 스폰 y (월드 단위, overflow 라인보다 위)
};

// 월드(게임 좌표) 크기. 렌더러가 캔버스 픽셀로 비율 유지 스케일.
export const WORLD = {
  width: 360,
  height: 640,
  overflowY: 96, // 이 y보다 위(작은 값)에 중심이 머무르면 오버플로우 카운트 시작
};

export const PHYSICS = {
  fixedDt: 1 / 60, // 고정 타임스텝 (초)
  maxStepsPerFrame: 5, // 누적기 스파이럴 오브 데스 방지
  substeps: 4, // 서브스텝 2~4회 (스택 안정성)
  gravity: 1500, // 월드 단위/s^2
  restitution: 0.15, // 낮은 반발계수
  friction: 0.06, // 접선(마찰) 감쇠 계수
  positionCorrectionPercent: 0.8, // 겹침 보정 비율
  positionSlop: 0.4, // 허용 침투량 (지터 방지, 낮은 반발계수와 함께 정착 안정성 담당)
};

export const CHAIN = {
  windowMs: 1500, // 이 시간 내 연속 머지 = 체인
  multiplierByStage: [1, 2, 3, 4], // 체인 1/2/3/4+ 단계 배율 (인덱스 = stage-1, 4+는 마지막 값 고정)
};

export const OVERFLOW = {
  warnAtMs: 1200, // 이 시간부터 라인 점멸 경고
  gameOverMs: 2000, // 이 시간 연속 체류 시 게임오버
};

export const BIG_BANG_BONUS = 500;

// 고티어 판정 임계값(docs/02 §7 "고티어 머지(8+)") — 1-indexed 티어 8(토성) 이상 =
// 0-indexed 티어 7 이상. juice(셰이크·링·강한 햅틱) 트리거에 공용으로 쓴다.
export const HIGH_TIER_THRESHOLD = 7;

// juice(이펙트·사운드) 타이밍/강도 상수 (docs/02 §7~§9).
export const FX = {
  popDurationMs: 220, // 머지로 생성된 새 천체의 스케일 펀치 지속시간
  squashDurationMs: 150, // 착지 스쿼시 지속시간
  impactVyThreshold: 220, // 이 이상 속도로 낙하하다 급감하면 "착지"로 간주(스쿼시 트리거)
  particleBurstCount: 14,
  particleBurstSpeed: 140,
  particleLifeSec: 0.5,
  ringLifeSec: 0.45,
  ringRadiusScale: 2.2, // 링 최대 반지름 = 머지된 천체 반지름 × 이 값
  shakeHighTier: 10, // 고티어 머지 셰이크 강도(월드 단위)
  shakeBigBang: 22, // 빅뱅 셰이크 강도
  edgeGlowMergeIntensity: 0.3,
  edgeGlowChainIntensity: 0.5,
  edgeGlowBigBangIntensity: 1,
  warningPulseIntervalMs: 550, // 오버플로우 경고 반복 햅틱/비프 간격
};

// 체인 단계별(1/2/3/4+) 배지·글로우 색 — 단계가 오를수록 붉게 이동.
export const CHAIN_COLORS = ['#ffcf4d', '#ff9f4d', '#ff6b4d', '#ff3d5c'];

// 시그니처 메커니즘: 노바 버스트 — 충전형 중력 펄스(docs/02 §4.6). 머지로 충전, 만충 시
// 하단 게이지 UI 탭으로 발동해 바닥 중앙을 향한 추가 중력 펄스로 보드를 압축한다.
export const NOVA_BURST = {
  chargePerMerge: 1, // 머지 1회당 게이지 충전량
  full: 10, // 만충 게이지 값(발동 가능해지는 임계)
  pulseDurationMs: 700, // 발동 시 중력 펄스 지속시간
  pulseStrength: 4200, // 펄스 중 바닥 중앙(WORLD.width/2, WORLD.height)을 향한 추가 가속도(월드 단위/s^2)
  pulseExtraFriction: 0.12, // 펄스 중 접선(마찰) 감쇠 추가분 — 압축 중 튐/지터 완화
  color: '#8b5cf6', // 게이지 UI·발동 연출 공용 네온 색(보라)
  ringMaxRadius: 460, // 발동 링 웨이브 최대 반지름(월드 단위) — 보드 대부분을 덮도록
  ringLifeSec: 0.6,
  particleBurstCount: 26,
  particleBurstSpeed: 200,
  particleLifeSec: 0.7,
  shakeAmount: 7, // 소형 셰이크 — 고티어 머지(FX.shakeHighTier=10)보다 약하게
  gaugeRadius: 20, // 게이지 UI 시각 반지름(월드 단위)
  gaugeHitRadius: 26, // 탭 히트 반지름 — 지름 52 ≈ 최소 44px 상당 보장
  gaugeX: WORLD.width / 2,
  gaugeY: WORLD.height - 36,
};

export const STORAGE_KEYS = {
  highScore: 'nova.highscore',
  stats: 'nova.stats',
  tutorialDone: 'nova.tutorialDone',
};

// 웹 보상형 광고 폴백 (docs/03 §3.1) — 3초 카운트다운 오버레이.
export const AD = {
  fallbackCountdownSec: 3,
};
