# Running the quiz from the board — design

> **Status: proposal. None of this is built yet.** The other two documents in
> `docs/` describe code that exists; this one describes code that does not. It is
> the plan for turning the tally board into the platform the contest is run from —
> the questions and the clock on the projector, not just the scores.

## Decisions taken

| | Decision | What it means here |
| --- | --- | --- |
| 1 | The Regional Technical Committee sends the questions **as a PowerPoint deck** | The board shows the RTC's slides as pictures. It does not parse them and does not restyle them. See *The deck is pictures*. |
| 2 | **Correct/wrong ticks are enough** — no need to record each contestant's A/B/C/D | The scoring model does not change at all. `c.r1` stays ten booleans. No migration, no answer key in the app. |
| 3 | **Exhibits are handed out on paper** | No exhibit handling. A chart slide, if there is one, is just another slide. |

Decisions 2 and 3 removed about a third of the original plan. Decision 1 moved
its centre.

---

## What actually changes

Everything the board does today happens at human speed: the operator clicks, the
screen repaints. `render()` mutates `state` and hands `sceneHTML()` to
`root.innerHTML`. At one click every few seconds that is not merely adequate — it
is the reason there are no stale-DOM bugs.

A clock does not run at human speed. Repainting the whole audience scene ten times
a second to move one digit would rebuild the DOM ten times a second, cancel every
CSS animation mid-flight, and heat up a venue laptop for nothing.

So the one structural decision from which the rest follow: **the app gets a second
rendering path, and the two are kept apart on purpose.**

| | Fires on | Cost | What it touches |
| --- | --- | --- | --- |
| **Scene repaint** (exists) | slide change, phase change, any edit | full `innerHTML` | the whole `.dsp` |
| **Live region** (new) | animation frame, while the clock runs | one `textContent` write | a cached `#clock` node, in both documents |

The live region writes only when the *displayed* value changes — once a second,
not once a frame. Nothing else in the codebase needs to know a timer exists.

---

## The deck is pictures, not parsed text

A `.pptx` is a zip of XML. It contains `ppt/slides/slideN.xml` — shapes, text
runs, positions, references into layouts, masters and a theme — and
`ppt/media/*` holds only the pictures someone embedded. **There is no rendered
slide anywhere in the file.** Drawing one means implementing PowerPoint's layout
engine: inherited placeholders, autofit text, theme fonts and colours. Nothing
offline and dependency-free is going to do that.

Two weaker ideas, both rejected, recorded so nobody relitigates them at 11 p.m.
the night before:

- **Extract the text and restyle it in the board's own theme.** Fragile in exactly
  the wrong way. The correct answer usually is not on the question slide, the
  choice lettering varies by deck, and a layout change from the RTC silently
  produces a wrong screen in front of an audience. It also throws away the PSQ
  branding the RTC put there on purpose.
- **Read the zip and show `ppt/media/*`.** Those are the embedded pictures, not
  the slides. A text-only slide yields nothing.

**So: the operator exports the deck to pictures once, in preparation, and imports
the pictures.** In PowerPoint that is *File → Export → Change File Type → PNG →
Save → All Slides*, which writes `Slide1.png … SlideN.png` into a folder. The
board takes the lot in one `<input type="file" multiple>`, sorts them naturally
(so `Slide2` precedes `Slide10`), shrinks each one the way portraits are shrunk,
and that is the deck.

What this buys: the audience sees exactly what the RTC designed, pixel for pixel.
Nothing to parse, no schema to drift, no failure mode that appears only on stage.
The cost is one menu command at the office, on a day when nothing is at stake.

---

## What the board needs to know about a slide

Almost nothing. Because of decision 2 the app never needs the question text, the
choices or the correct answer — it needs to know *which slides are questions*, so
that it can arm the right clock and line the tally up with the right box.

```jsonc
{
  "deck":   "30th PSQ — Provincial Elimination",
  "issued": "2026-09-24",
  "slides": [
    { "n": 1, "image": "data:image/jpeg;base64,…", "role": "other" },
    { "n": 2, "image": "…", "role": "other" },
    { "n": 3, "image": "…", "role": "question", "round": "r1", "q": 1, "seconds": 15 },
    { "n": 4, "image": "…", "role": "answer",   "round": "r1", "q": 1 }
  ]
}
```

`role` is one of `question`, `answer` or `other`. Only `question` slides carry a
clock and a tally.

### Tagging without tedium

Tagging thirty-odd slides by hand is the sort of chore that gets skipped. The
Deck tab should show thumbnails in a grid and offer bulk helpers, because these
decks are regular:

- **Mark a range** — "slides 3–22 are Round 1" and it numbers the questions
  within the round in order.
- **Alternating** — "question, answer, question, answer…" across a range, which
  is how most quiz decks are built.
- **Default seconds** per round, overridable on any single slide.

A slide left as `other` is just a slide: it shows, it has no clock, and `←` `→`
step past it. Getting the tagging wrong is not dangerous, only inconvenient.

---

## The run is a state machine, and it must be explicit

Because the answer is a slide in the RTC's deck rather than something the app
reveals, the machine is smaller than it would otherwise have been:

```
          ┌──────── reset ────────┐
          ▼                       │
  idle → armed → running ⇄ paused → timeup → (next slide)
                    │                 ▲
                    └── deadline ─────┘
```

```js
ask = {
  slide:  17,        // index into the deck
  phase:  "armed",   // idle | armed | running | paused | timeup
  endsAt: null,      // ms timestamp — only while running
  remain: 15000      // ms — meaningful when armed, paused or timed out
}
```

Landing on a `question` slide arms the clock at that slide's seconds. Space
starts it. It reaches `timeup` by the deadline or because the Quizmaster called
TIME. Advancing the slide then shows the RTC's own answer slide.

### Two invariants

**1. While the clock is running, the next-slide key is blocked.** In this design
the answer slide sits immediately after the question, so an early `→` is exactly
the accident that invalidates a question — and the Board's decision on that is
final. One guard, in one place.

**2. The clock is a deadline, never a countdown variable.**

```js
function remaining(){
  return ask.phase === "running" ? Math.max(0, ask.endsAt - Date.now()) : ask.remain;
}
```

A `setInterval` that decrements drifts. A fifteen-second question that really ran
seventeen seconds is a protest waiting to happen, and this app would be the thing
the protest is argued against. Pausing stores what is left; resuming sets a fresh
deadline from it.

### How the runner meets the cue system

One rule, one line in `sceneHTML()`: **when a deck is loaded and `ask.phase` is
not `idle`, the slide scene owns the screen; otherwise the cue does.** The title
card, the mechanics, the introductions, the standings and the declaration keep
working exactly as they do now, and the operator never has to remember to switch
away from the deck.

---

## The audience scene

A slide is the content, so the board's chrome gets out of its way. The picture is
letterboxed to fill the screen at its own aspect ratio, with:

- a **clock chip** pinned in a corner, always legible against any slide
- a **TIME IS UP** band on `timeup`
- nothing else — no header, no skyline, no logos over the RTC's artwork

The mechanics give the Timekeeper the job of signalling the end of the time
allowed, so a chime at zero is faithful rather than decorative. Generate it from a
WebAudio oscillator: no asset, nothing to load, still one file. Make it
switchable — some venues bring their own bell.

---

## Scoring does not change

Decision 2 means this section is short, which is the point. `c.r1` stays ten
booleans. `rt()`, `cum12()`, `grand()`, `qualifiers()`, `standings()`, the
tie-break, Form 1 and the CSV are all untouched. There is no answer key in the
app, no migration and no new way for a score to be wrong.

The only change is *where* the operator ticks. On a `question` slide the Run tab
shows that one question's column — contestant by contestant, which is the order
the Quizmaster reads the answers out in — writing into the same `c.r1[2]` the
grid writes into. The round tabs stay exactly as they are for corrections, and
the two views are the same data.

---

## Splitting `src/app.js`

2,518 lines in one IIFE today, and this adds perhaps 600 more. Split it and let
`build.py` concatenate the pieces inside a single wrapper, so closure scope is
preserved and it is mechanical with no behaviour change:

```
src/js/00-state.js      state, constants, session load/save
       10-scoring.js    rt, cum12, grand, qualifiers, standings, tie-break
       20-people.js     coaches, judges, logos
       30-deck.js       slides, tagging, the run state machine, the timer
       40-console.js    tabs and views
       50-display.js    scenes, fit, the live region
       60-export.js     Form 1, CSV
       70-events.js     the delegated handlers
       80-boot.js       first render
```

`build.py` changes from reading one file to globbing `src/js/*.js` in name order
and emitting `(function(){ "use strict"; … })();` around the lot. The guard
against a literal `</script>` stays and now runs over every file.

Do this **first**, as its own step, and prove the browser suites still pass before
any feature code lands.

---

## Storage

A deck of thirty-five slides at 1280px wide is roughly 100 KB each — about 4 MB,
and half again as much as base64. That is too much to carry inside every session
save, and too much to re-import by hand after an accidental refresh.

- **The deck is its own file**, imported once. It is the same for all five
  provinces and can be prepared days ahead.
- **Cache it in IndexedDB** so a reload does not mean re-importing. Not
  `localStorage` — a full roster of portraits plus logos already approaches its
  5 MB quota.
- **Autosave the session to IndexedDB** every few seconds, with a restore prompt
  on load. "There is no autosave" was defensible for a tally sheet that could be
  rebuilt from the Examiners' paper. For a three-hour contest where this app owns
  the clock, a crashed tab is a different order of problem.

The console stays the source of truth for the clock, so closing or reopening the
projector window mid-question neither loses nor restarts the time. That falls out
of the deadline model as long as `endsAt` lives in the console and the popup only
ever reads it.

---

## What does not change

Single self-contained file. Offline, no dependencies, no server. The cue system
for the title card, mechanics, introductions, standings and declaration. The
scoring in `scoring-rules.md`. PSQ Form 1, column for column.

**And the fallback matters:** with no deck loaded the app behaves exactly as it
does today. The deck is additive. If the pictures never arrive, or the import
fails on the morning, the contest still runs off the tally grid and the cues, the
way it does now. This should be tested for, not merely intended.

---

## Order of work

Each step is shippable on its own.

| # | Step | Why here |
| --- | --- | --- |
| 1 | Split `src/app.js`, change `build.py`, prove the suites pass | Mechanical, no behaviour change. Do it while the diff is still readable. |
| 2 | Import slides, Deck tab, thumbnails and tagging | Nothing on the projector yet — get the content in and correct first. |
| 3 | Run state machine, slide scene, clock chip, live region, chime | The structural half. |
| 4 | Run tab: the per-question tally column | Ergonomics on top of a working runner. |
| 5 | IndexedDB for the deck and session autosave | Valuable, but the contest can run without it. |

Steps 1 and 3 are the ones that are hard to retrofit. If only two things get built
before the contest, build those.
