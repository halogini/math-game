# PRISM TYCOON — overnight iteration log

Agent loop: playtest → score → fix worst issues → re-verify → log → sleep → repeat.

## Goals (priority order)
1. **Educational**: walking a path teaches parallelogram ⊂ rhombus/rectangle ⊂ square without lecture text.
2. **Usability**: first 60s feel clear; orders create real route choices; no dead zones / stuck states.
3. **Polish**: readable on phone landscape; appraisal notation readable; shop/order readable at a glance.
4. **Balance**: orders sometimes make non-square optimal; square remains costly but rewarding.

## Stop conditions
- Do not invent new game modes.
- Prefer surgical edits to `games/prism-tycoon/index.html`.
- Do not commit unless the user asks.
- If a cycle finds nothing above "nice-to-have", log and skip coding.
- Stop when the user says stop.

## Cycle log

### Cycle 1 — 2026-08-25
**Playtest findings**
- Tall 10-gem tower on 냥순이 looked comical / unreadable (satchel character).
- Workshop lanes read as locked UI cards, not as a fork you walk.
- Order urgency was invisible until it flipped.
- Transform/sell lacked juice.

**Fixes**
- Satchel cluster (show last 4 + badge), draw gems after cat.
- Soft black matte strip + auto-trim sprites.
- Floor fork paths + destination pictograms; gate arches light when stepped on.
- Order urgent flash (<6s) on board + HUD.
- Sparks on transform/sell; screen shake on premium.

### Cycle 2 — 2026-08-25
**Fixes**
- Contextual once-only tips near the cat (mine → gate → fork → order → shop).
- Weighted orders: rhombus/rect favored when unlocked so path choice pays off more often.
- Crystal pillars in the mine for fantasy denseness.

### Cycle 3 — 2026-08-25
**Fixes**
- Fantasy hall backdrop under translucent zones.
- Market canopy + shop parchment strip.
- Order-matching gems glow pink in the satchel.
- First locked gate pulses when carrying raw ore (onboarding lure).
- Shorter contextual tips.

**Still open / tooling**
- Host auto-wake for overnight loop is blocked by session policy — continue polishing while this chat stays open; say "중단" to stop.
- Walk frames still AI-varied; Spriterrific bipedal variant would be better if API key available.
- Tycoon loop still exists by design — deepen decisions (orders/paths) rather than remove walking.

### Cycle 4 — 2026-08-26
**Playtest findings**
- Workshop still read as a flowchart (A→B arrows + dashed lane cards).
- Zone bands felt like UI panels layered on the hall, not rooms.
- Order→route link was implicit; full bag + no gate left new players stuck mining.

**Fixes**
- Soft radial zone washes + carved placards (no hard panel strokes).
- Portals show destination gem + property runes (∥ / = / ⌞) instead of flowchart A→B.
- Inlaid crystal fork paths; paths for the current order pulse in matching colors.
- Order board as hanging wooden tapestry with flash on roll.
- Capacity-full mine sparks; buy unlock sparks/shake; tips for full bag & first unlock.
- Shop UI: destination-only icons, parchment panel, shorter on landscape phones.
- Hall backdrop opacity ↑ for denser fantasy immersion.

**Still weakest**
- Mid-game route choice (rhombus vs rect vs square) still under-communicated until both forks unlock.
- Walk sprite variance / bipedal consistency remains an art asset issue.

### Cycle 4 follow-up — 2026-08-26
**Bug**
- 「게임 시작」 후 빈 화면: render loop가 `loadArt()` 완료 후에만 시작되어, 큰 PNG 처리 중 캔버스가 그려지지 않음.

**Fixes**
- `requestAnimationFrame(loop)` 즉시 시작; 아트는 백그라운드 병렬 로드.
- `draw`/`loop` null·error 가드.
### Cycle 5–7 — 2026-08-26 (자동 개선 루프)
**Playtest findings**
- 광산 전체 vs 광맥-only, 시장 전체 vs 판매대-only 구분 필요 (Cycle 5 redesign 후 후속).
- 보석 스택이 HUD 밖으로 튀어나감.
- `ZONES.shop` 제거 후 dead code 잔존.
- 강화해도 꺼내기 속도 체감 없음.

**Fixes**
- **판매대**(`MARKET_PAD`) — 시장 구역이 아닌 판매대에서만 판매.
- **스택 압축** — 14개 초과 시 높이 `STACK_MAX_H`로 압축, 옆으로 offset.
- **공방 슬롯 점** — 대기+가공량을 채워진 dot으로 표시 (텍스트 없음).
- **강화→꺼내기** — `collectRate()` 레벨 연동.
- **밸런스** — 사다리꼴 120💰, 원석 9💰.
- dead `drawShopSign`/`drawShopDecor` 제거; `drawPlayer`/`drawAtmosphere` 이름 충돌 수정.
- 입구 서 있을 때 잠긴 공방에 가격/🔒 plaque.

### Cycle 11 — 2026-08-26 (depth sort + cash vacuum)
**User ask**
- Walking *over* roofs feels like a floor mat; cat should pass *behind* roofs.
- Cash pile grew while collecting; vacuum should be faster.

**Changes**
- **Y-sort draw**: player vs sheds/market/bills by foot Y — roofs occlude the cat when behind.
- Cash: wait until all bills land, then vacuum fast (0.022s/bill).
- Rear shelves drawn under sheds; front shelves after.

### Cycle 12 — 2026-08-26 (cash while carrying + factory looks)
**User ask**
- Collect gold while holding gems; never grant gold *while* selling.
- Factory shape should evolve with upgrade level.

**Changes**
- Bill vacuum: allow carry; block while standing on `MARKET_PAD`.
- `machineLook(lv)` tiers: 0 hut → 1 wood → 2 lanterns/trim/brick → 3 twin chimney, banner, roof crystal, pink roof.
- Bill stack: fixed `BILL_STEP` (no compress-by-height).
- Upgrade pads: outer flanks (not center aisle), gem badge + tether to shelf; right column shifted +48px.
- Cash vacuum accelerates with combo.
- Sell: gem hop (parabola) → conveyor ride → drop into register → then bills spawn from sink.


