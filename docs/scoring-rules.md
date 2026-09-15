# Scoring rules, and where they live in the code

Everything here comes from *30th PSQ Provincial Elimination Contest Mechanics*.
Section references are to that document. If the Secretariat revises the mechanics,
these are the functions to change.

## Rounds

| Round | Questions | Points each | Max |
| --- | --- | --- | --- |
| Round 1 | 10 | 1 | 10 |
| Round 2 | 10 | 1 | 10 |
| Round 3 | 10 | 2 | 20 |
| Tie-break | 5 | sudden death | — |

In code: `QN = 10` and `PTS = {r1:1, r2:1, r3:2}`. Sudden-death length is
`state.meta.sdCount`, default 5.

A blank box means wrong or unanswered. Only correct answers are ticked, so a
round total is `(ticked count) x (points per question)` — `rt(c, k)`.

## Advancing to Round 3 — Section C.3

`qualifiers()`:

1. Everyone whose Rounds 1&2 cumulative is **8 or more** advances (`ADV = 8`).
   This can be more than five, and all of them advance.
2. If **fewer than five** reach 8, the **top five** by cumulative advance instead,
   regardless of score.
3. Ties at the fifth spot all advance, so step 2 can also yield more than five.

Non-qualifiers have their Round 3 boxes disabled in the tally grid, so a stray
click cannot score someone who is not playing.

### Announcing the cut

`liveQualifiers()` is the rule above applied to the scores as they stand.
`qualifiers()` is what the rest of the app asks, and it returns the *announced*
cut once there is one: **Apply the cut**, on the Round 2 tab or the Display tab,
freezes the advancing list into `state.cut` as contestant numbers.

From that point:

- the Round 2 audience screen strikes through the eliminated and marks the
  advancing, so the cut can be read out from the screen;
- Round 3 — the tally grid and the audience screen both — lists only the
  advancing contestants, rather than showing everyone with the rest disabled;
- qualification stops following the scores, so correcting a Round 1 or 2 mark
  afterwards cannot quietly change who is playing Round 3. `cutDrift()` compares
  the frozen list against the rule and raises a warning banner when they differ;
- any Round 3 marks already ticked for an eliminated contestant are cleared when
  the cut is applied, so a stray tick cannot inflate a grand total.

**Undo the cut** clears `state.cut` and qualification goes back to live. The cut
is part of `state`, so it is written to the saved session; sessions saved before
this feature restore with no cut applied.

## Placing and ties — Section D.2

Applied in order, each step only reached if the one before it leaves a tie:

1. cumulative score across all three rounds
2. Round 1 score
3. Round 2 score
4. sudden death
5. Board of Judges

In code this is the composite sort key `key(c)` →
`[grand, r1, r2, sdKey]`, compared by `cmpKey`. Most ties never reach sudden
death, which is why the Top 3 panel says things like "settled on Round 1".

### Sudden death

Five questions asked to the tied contestants simultaneously. **A wrong answer
eliminates immediately** — it is not a points race. Each box cycles blank →
correct → wrong; marking a wrong answer locks that contestant's remaining boxes.

`sdStreak(c)` returns how many correct answers came before the first wrong one,
plus whether the contestant is still in. Ranking within the tied group is by
that streak, with a still-in contestant ahead of an eliminated one on the same
streak.

A tie-break group is identified by `samePre` — level on the cumulative score,
Round 1 and Round 2 — **not** by the full `key`. The full key includes `sdKey`,
so grouping on it made the group dissolve on the first tick: one mark changed
one contestant's key and the app concluded the tie was over, taking the entry
grid off the screen mid-question. Group on what was level *before* sudden death
and the group survives until the questions have decided it.

`sdState(g)` reports where a group stands — `started`, `done`, `decided` (one
survivor), `stuck` (the two Board of Judges cases). `unresolved()` returns every
group, so the tie-break tab and the audience screen keep showing a group after it
is settled; `pendingTies()` filters out the decided ones and is what drives the
header alert and the tab dot.

Two outcomes the app will not decide on its own, both of which display a notice
to refer to the Board of Judges:

- everyone eliminated on the same question
- more than one contestant surviving all five questions

## The mechanics screens the audience sees

The `mechanics` cue (title card → *View the contest mechanics*, or `M`) is six
screens built by `mechPages()`, one per section of the mechanics document:

| Screen | Covers | Section |
| --- | --- | --- |
| How the contest runs | rounds, question setters, trial question, the officials | A |
| Answering a question | reading, hand-outs, flashcards, TIME IS UP, tallying | B |
| Scoring | points per round, wrong or no answer, points in play | C.1 |
| Advancing to Round 3 | everyone goes to Round 2; the 8-point rule; the top five | C.2–C.4 |
| Declaration of winners | the top three, then the tie-break order | D |
| Clarifications and reminders | who may ask and when, nullified questions, calculators | E, F |

They page like the score cues — `◀` `▶` on screen, the arrow keys, or the desk's
Previous/Next — but one screen at a time, which is why `per()` exists.

The numbers in the text come from `QN`, `PTS`, `ADV` and `state.meta.sdCount`
rather than from a fixed slide, so the screen the audience reads cannot disagree
with what the app scores. If the Secretariat revises the mechanics, change those
constants and the wording in `mechPages()` together.

## What the app does *not* enforce

- Eligibility (first-year, first-time, endorsement) — Section B.
- Question content and coverage.
- The Quizmaster's and Timekeeper's procedure.
- Protests. The Board of Judges' decision is final and is entered by hand.

## One deliberate departure from the office Excel template

The template's `BK` column reads `=IF(BJ>=8, RANK(...), "")`, which hides the
final rank for anyone whose *grand total* is under 8. The mechanics apply the
8-point threshold to the Rounds 1&2 cumulative as a Round 3 qualifier, not to
the final rank. The export therefore writes a plain `RANK`. If your PSO wants
the original formula back, it is one line in `buildForm1`.
