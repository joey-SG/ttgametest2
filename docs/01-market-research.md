# 01 · 시장 리서치 (2026-07) — 두 번째 게임

리서치 수행일: **2026-07-05**. 첫 프로젝트(ttgametest / PULSE — 원탭 정밀 타이밍 리듬 아케이드)와
**겹치지 않는 장르 축**을 찾는 것이 이번 리서치의 목적이다.
SPEC-First: 무엇을/누구를 위해 만드는지 코딩 전에 확정한다.

---

## 1. 2026년 하이퍼캐주얼 시장의 변화

- **하이브리드 캐주얼로의 이동**: 순수 하이퍼캐주얼의 초단순함에 가벼운 깊이(전략·메타)를 얹는
  방향이 2026년의 주류. "쉽게 배우고, 조금 더 생각하게" 만드는 게임이 리텐션과 수익 모두 우세.
- **머지(merge) 메커니즘 최강세**: 2026년 현재 머지 계열이 캐주얼 차트 상위를 지배.
  "드래그 & 머지"의 단순함 + 즉각적 만족(합쳐지는 순간)이 핵심 동력.
- **물리 기반 게임플레이 재부상**: 오브젝트를 떨어뜨리면 물리로 튀고 구르며,
  같은 것끼리 닿으면 합쳐지는 **드롭-머지**가 물리 장르의 대표 사례로 언급됨.
  배치 판단·바운스 예측·연쇄 계획이라는 가벼운 전략층이 생긴다.
- **경쟁 이벤트의 보편화**: 솔로 토너먼트/점수 경쟁이 캐주얼 게임의 표준 기능화 (MVP 이후 참고).

## 2. TikTok 소비 방식 (1차 프로젝트 리서치 재확인 — 유효)

- 빠른 발견 / 짧은 집중(3~5초) / 즉시 플레이 / 광고 기반 수익 — 변화 없음.
- 2026년에도 **"한 장면으로 이해되는" 서스펜스 게임**이 클립화된다.
  긴장이 눈에 보이고(쌓임·넘침), 리액션이 나오는 게임이 숏폼에서 강함.

## 3. 장르 후보 평가 (프로젝트 #2 관점)

| 후보 | 강점 | 약점 | #1(PULSE)과 차별 | 적합도 |
|---|---|---|---|---|
| **피직스 머지-드롭** (Suika-like) | 2026 최강세 메커니즘, 근접실패 긴장, 연쇄 쾌감, 클립화 용이 | 물리 구현 난도, 클론 낙인(테마로 회피) | 조작(드래그 조준)·판단(공간 배치)·장르(퍼즐) 모두 다름 | ★★★★★ |
| 볼 바운스 브레이커 (BBTAN식) | 물리 단순, 스티키 | 턴이 길어질수록 템포 하락, 차별화 어려움 | 조준-발사로 다름 | ★★★★☆ |
| 홀 이터 (hole.io식) | 성장 쾌감 | 맵/오브젝트 양산 필요, 용량·공수↑ | 조작 다름 | ★★★☆☆ |
| 스택/타이밍 계열 | 구현 쉬움 | **#1과 같은 타이밍 축** — 탈락 | 차별화 실패 | ★☆☆☆☆ |

## 4. 벤치마크 케이스: Suika Game (수박게임)

- 2021년 출시 → **2023년 9월 스트리머/숏폼발 글로벌 바이럴**. Twitch/YouTube/TikTok에서
  수백만 시청. 클립 한 장면(넘치기 직전, 수박 합체 순간)으로 이해되는 게임의 전형.
- 중독 요인 분석:
  1. **근접 실패(near-miss)**: "수박 직전에 터짐" — 다시하기의 핵심 감정.
  2. **쉬움+어려움 동시**: 조작은 낙하 위치 선택뿐, 그러나 한 수가 연쇄 붕괴를 부른다.
  3. **합쳐지는 순간의 시각적 만족** + 연쇄(chain reaction)의 쾌감.
  4. **차오르는 압박**: 상자가 채워질수록 긴장 상승 — 서스펜스가 화면에 보인다.
- 시사점: 코어는 검증 완료. **차별화는 테마·juice·햅틱·모바일 세로 최적화**에서 만든다.
  (수박게임은 햅틱·모바일 퍼스트가 아니었고, TikTok Mini Game 포맷도 아니다)

## 5. 타겟 유저 (SPEC)

### 페르소나 — #1과 공유하되 확장

- **Primary — "피드 서퍼" (13~24세)**: 즉각적 도파민(합체 이펙트·햅틱)에 반응, 점수 경쟁·공유.
- **Secondary — "정리 힐러" (18~35세)**: 머지 장르 특유의 **정리 욕구·힐링 만족**으로 반복 플레이.
  타이밍 게임(반사신경)보다 넓은 연령대에 소구 — #1 대비 타겟 확장 효과.

### 유저 성향 → 설계 번역

| 성향 | 설계 |
|---|---|
| 참을성 낮음 | 튜토리얼 0(첫 드롭 힌트 1줄), 3초 이해, 재시작 0초 |
| 즉각 도파민 | 합체 순간에 파티클·글로우·스케일 펀치 + **iPhone 햅틱** |
| 실패 민감 | 게임오버 = "여기까지 키웠다" 성과 화면 + 최고 천체 강조 |
| 공유·경쟁 | 최종 보드 스크린샷 + 최고 티어 도달 뱃지 + 점수 |
| 광고 수용 | 보상형 광고 = 부활(보드 정리) / 2배 점수 |

### 타겟 지표 (성공 기준)

- 첫 세션 평균 **3회 이상 재시도** (one-more-try 작동 증거).
- 게임오버 시 **부활 광고 수락** 발생. 세션당 플레이 횟수·최고 티어 분포를 관찰(로컬 지표).

## 6. 결론 (개발 방향 확정)

> **피직스 머지-드롭 퍼즐 아케이드**, 원핑거 드래그 조준 + 릴리즈 드롭,
> 오리지널 **우주/천체 테마**(과일 클론 낙인 회피 + 다크 네온과 자연 결합),
> 연쇄 머지 콤보 배율, 보상형 광고 부활(런당 1회), 결과 화면 공유 유도.
> 구체 스펙은 `docs/02-game-design.md`.

**#1(PULSE)과의 차별성 요약**: 탭 타이밍/리듬/반사신경 → **드래그 조준/물리 예측/공간 배치**.
조작·핵심 판단·장르 축이 전부 다르다. 유지되는 것은 플랫폼 공통 요구사항
(무한·원핑거·juice·햅틱·광고 부활·공유)뿐이다.

---

### 출처

- [Casual Games Market in 2026: Trends, CPIs, ROAS — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/casual-games)
- [Top 10 Hyper-Casual Mobile Games of 2026 — Vexillogic](https://vexillogic.com/blog-top-10-hyper-casual-2026.html)
- [Top 8 Merge Games - January 2026 — eGamersWorld](https://egamersworld.com/blog/top-8-merge-games-january-2026-the-good-the-janky--YjTy3FhrGB)
- [Hybrid Casual Game Development: The New Trend 2026 — Galaxy4Games](https://galaxy4games.com/en/knowledgebase/blog/hybrid-casual-game-development-the-new-trend-in-mobile-gaming)
- [Analyst Bulletin: Mobile game market review May 2026 — GameRefinery](https://www.gamerefinery.com/mobile-game-market-review-may-2026/)
- [Top 15 Viral TikTok Games 2026 — Filmora](https://filmora.wondershare.com/tiktok/tiktok-games.html)
- [What Makes a Game TikTok-Friendly in 2026 — Kidobum](https://www.kidobum.com/blogs/tactical-briefing/what-makes-a-game-tiktok-friendly-in-2026-the-viral-formula-for-party-games)
- [TikTok Mini Game Market Trends 2025-2033 — Data Insights Market](https://www.datainsightsmarket.com/reports/tiktok-mini-game-1948387)
- Suika Game 사례: [suikagame.io](https://suikagame.io/), [brainplay.com/p/suika](https://brainplay.com/p/suika), [mergefellas.com](https://mergefellas.com/game/suika-game)
