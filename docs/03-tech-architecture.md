# 03 · 기술 아키텍처

목표: **HTML5** 단일 코드베이스로 (1) 웹 데모(Netlify)와 (2) TikTok Mini Game 제출을 모두 커버.
플랫폼 종속 기능(광고·햅틱·저장)은 **어댑터 계층**으로 격리한다. (#1 프로젝트에서 검증된 구조 계승)

---

## 1. 스택 (고정)

| 영역 | 선택 | 이유 |
|---|---|---|
| 번들러 | **Vite** | 빠른 dev/build, 정적 HTML5 산출 |
| 언어 | **TypeScript** | 어댑터 인터페이스를 타입으로 고정 |
| 렌더 | **Canvas 2D** | 2D 원형 렌더에 충분, 용량↓, 60fps |
| 물리 | **자체 구현 (원형 전용)** | 외부 엔진 불필요 — 원-원 충돌만 있으면 됨. 의존성 0 유지 |
| 상태 | 순수 게임 루프 + 단순 state machine | Simplicity First |
| 에셋 | 100% 절차 드로잉/절차 사운드 | < 50MB 여유 확보 |

**외부 런타임 의존성 0** (#1과 동일). devDependencies는 typescript + vite만.

## 2. 물리 엔진 스펙 (이 프로젝트의 핵심 신규 설계)

원형(circle) 전용 2D 물리. 요구사항:

- **적분**: 고정 타임스텝 세미-임플리시트 오일러. 렌더 60fps 기준 **서브스텝 2~4회**
  (스택 안정성·터널링 방지). `accumulator` 패턴으로 프레임 변동 흡수.
- **충돌**: 원-원, 원-벽(좌/우/바닥). 겹침 해소는 **위치 보정(positional correction)** +
  임펄스 기반 속도 해소. 반발계수 낮게(0.1~0.2), 접촉 마찰(접선 감쇠) 적용.
- **안정성 게이트**: 쌓인 천체가 눈에 띄게 떨리지 않을 것(sleep 임계 또는 충분한 보정 반복),
  고속 낙하 시 벽/바닥 관통 없을 것. **M1에서 최우선 검증.**
- **머지 감지**: 충돌 해소 단계에서 같은 티어 쌍 발견 → 머지 큐에 등록, 스텝 종료 후 처리.
  한 천체는 프레임당 1회만 머지(쿨다운 플래그). 새 천체는 접점 중앙에 생성, 두 천체의
  평균 운동량 일부 승계.
- **성능 예산**: 최대 ~120 바디에서 60fps (저사양 모바일). 브로드페이즈는 단순
  공간 해시 또는 정렬 스윕이면 충분 (바디 수 적음 — 과설계 금지).
- **게임오버 감지**: 오버플로우 라인 위 중심 체류 타이머 (docs/02 §4).

## 3. 플랫폼 어댑터 계층 (#1 검증 구조 그대로 계승)

```ts
// src/platform/types.ts
export interface Platform {
  showRewardedAd(placement: 'revive' | 'double'): Promise<boolean>; // 완주 시 true
  haptic(kind: 'success' | 'fail' | 'combo' | 'select'): void;
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  saveHighScore(score: number): Promise<void>;
  loadHighScore(): Promise<number>;
  isTikTokInApp(): boolean;
}
```

- `src/platform/web.ts` — 웹 폴백. `src/platform/tiktok.ts` — `TTMinis.game` SDK 래핑.
- `src/platform/index.ts` — 런타임 감지 후 스왑.

### 3.1 보상형 광고

- TikTok 인앱: Rewarded Video Ads API, 콜백 boolean으로만 보상 지급.
- 웹 폴백: **3초 카운트다운 오버레이** (#1 `web.ts` 검증 패턴 재사용 — 스킵 버튼 = false).

### 3.2 iPhone 햅틱 (⚠️ #1에서 검증된 실전 지식 — 그대로 적용)

iOS Safari는 Vibration API 미지원. 전략:

1. **iOS Safari**: `<input type="checkbox" switch>` + `label.click()` 토글 트릭.
   - iOS 17.4~26.4 동작, **26.5에서 패치됨** → 실패해도 무해한 no-op.
   - ⚠️ **함정(#1에서 실제 발생)**: `label.click()`이 합성 click을 발생시켜 게임의 전역
     입력 리스너에 도달하면 **유령 입력**이 된다 → label에서 `stopPropagation()` 필수.
2. **Android**: `navigator.vibrate(패턴)`.
3. **TikTok 인앱**: SDK 햅틱 API 우선.
4. 미지원: 조용히 no-op. **햅틱은 향상이지 필수 의존이 아니다.**

### 3.3 저장

- 웹: `localStorage` (try/catch — 프라이빗 모드 대응). 키 네임스페이스 `nova.*`
  (`nova.highscore`, `nova.stats`, `nova.tutorialDone`).
- TikTok 인앱: SDK 스토리지. MVP는 로컬만.

### 3.4 iOS 입력·오디오 함정 (#1에서 실제 겪은 이슈 — 예방 체크)

- AudioContext는 **첫 사용자 제스처에서 resume()** 해야 소리가 남.
- 터치는 `touchstart/touchmove/touchend` + `preventDefault`로 스크롤/더블탭 줌 차단,
  `touch-action: none` 병행.
- 드래그 조준은 터치 이동 좌표를 캔버스 좌표계로 변환(DPR 배율 주의).

## 4. 성능 예산

- 목표 **60fps**, 물리 서브스텝 포함. 파티클 풀링(프레임당 할당 최소화).
- 총 패키지 **< 50MB** (실제 목표: < 500KB — 에셋 0이므로 여유).
- TikTok SDK는 인앱에서만 지연 로드.

## 5. 디렉터리 (확정)

```
/
├── index.html            # 캔버스 + 광고 오버레이 + 폰트
├── netlify.toml
├── src/
│   ├── main.ts           # 부트스트랩·루프
│   ├── config.ts         # 티어 테이블·물리 상수·밸런스 (매직넘버 금지)
│   ├── game/             # 상태머신·보드·점수·룰
│   │   └── physics.ts    # 원형 물리 (독립 모듈)
│   ├── fx/               # 파티클/셰이크/글로우 (juice)
│   ├── audio.ts          # 절차 사운드 (WebAudio)
│   ├── ui.ts             # 화면(타이틀/플레이/게임오버)·HUD
│   └── platform/         # types / web / tiktok / index
└── docs/
```

## 6. 코드 규칙

- 플랫폼 API를 게임 로직에서 **직접 호출 금지** → `Platform` 인터페이스 경유.
- 밸런스 수치는 전부 `config.ts` (티어 반지름·점수·확률, 물리 상수, 체인 윈도우, 오버플로우 시간).
- Surgical: 한 번에 한 기능. 무관한 리팩터링 금지.
- 정상 플레이 경로 `console.error` 0.

---

### 출처

- [Develop Your Mini Game — TikTok for Developers](https://developers.tiktok.com/doc/develop-your-mini-game)
- [Mini Games Monetization (Rewarded Ads) — TikTok for Developers](https://developers.tiktok.com/doc/mini-games-monetization)
- iOS Safari 햅틱 트릭·함정: #1 프로젝트 `ttgametest/src/platform/web.ts` 구현 및 `docs/03` (검증됨)
- 고정 타임스텝 물리: Glenn Fiedler, "Fix Your Timestep" (게임 물리 표준 패턴)
