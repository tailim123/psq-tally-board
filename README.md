# PSQ Tally Board

Scoring and display tool for the **30th Philippine Statistics Quiz — Provincial
Elimination**, built for PSA Marinduque.

Two screens driven from one window:

- a **tally console** for the operator — roster, per-round tick grids, tie-break, standings
- an **audience screen** in a second browser window for the projector, cued by the operator

Everything runs offline from a single HTML file. No server, no internet, no install.

---

## Quick start

### Just running it

Open `dist/psq-tally-board.html` in a browser. That file is self-contained — copy
it to a flash drive and it will run on any machine at the venue.

### Working on it in VS Code

```bash
code .                  # open this folder
python3 build.py        # rebuild dist/ after editing anything in src/
```

For live editing, install the **Live Server** extension, then right-click
`src/index.html` → *Open with Live Server*. Opening `src/index.html` directly
from disk mostly works, but browsers block `file://` font loading, so the pixel
typeface will fall back to a monospace face until you serve it.

`build.py` needs only the Python standard library.

---

## Layout

```
build.py                       bundles src/ into dist/ — run after every edit
src/
  index.html                   page shell; links the two stylesheets and the script
  app.js                       all application code, one IIFE, no dependencies
  styles/
    base.css                   design tokens + the operator console
    display.css                the audience screen (everything under .dsp)
  assets/
    press-start-2p.woff2       pixel display face, subset to Latin
    psq-logos.png              PSA / PSAI / PSQ / Bagong Pilipinas lockup
    OFL-press-start-2p.txt     font licence — keep this with the font
dist/
  psq-tally-board.html         the built single file; this is what you deploy
docs/
  scoring-rules.md             how the mechanics map onto the code
  form-1-mapping.md            how the Excel export maps onto the office template
```

### Two things the build depends on

1. The `<style>` elements keep their `id="baseStyle"` and `id="dspStyle"`. The app
   reads them by id to clone the CSS into the audience window.
2. `app.js` must not contain a literal `</script>`. The build fails loudly if it does.

---

## How the code is organised

`app.js` reads top to bottom in these sections:

| Section | What lives there |
| --- | --- |
| scoring | `rt`, `cum12`, `grand`, `qualifiers`, `sdStreak`, `standings`, `unresolved` |
| console header | `renderTop`, `renderTabs` — the Top 3 strip and tab bar |
| coaches | `coachesAt`, `coachOf`, `unassigned`, `introGroups` — who coaches whom |
| logos | `logoList`, `logoFor` — every school and organisation named, and its logo |
| judges | `judges`, `namedJudges` — the Board of Judges, in the order introduced |
| console views | `renderRoster`, `renderCoachPanel`, `renderRound`, `renderSd`, `renderStandings`, `renderDesk` |
| portraits | `shrink`, `pickPhoto`, `portrait` — photos in, and how they are drawn |
| audience screen | `sceneHTML`, `fit`, `paintDisplay`, `openDisplay` |
| events | one delegated `click` handler, one `keydown`, one `input` |
| Form 1 export | zip writer, `Sheet`, `buildForm1`, `exportForm1` |
| session | `saveSession`, restore, `exportCsv` |

State is one plain object, `state`, holding `meta`, `cut` (the announced Round 3
cut, once there is one), `coaches`, `schools` (only those a logo was added for),
`judges` and `contestants` — each of which carries its `photo` as a data URI. Display settings (`disp`, `perPage`, `introPer`, `sortBy`) are
deliberately kept out of it so the saved session file stays about the contest,
not about the projector.

Rendering is full-redraw: mutate `state`, call `render()`. There is no diffing.
At 22 contestants this is instant and it removes a whole class of stale-DOM bugs.

---

## Operating notes

- **The tally grid never reorders.** Rows are locked to contestant-number order so
  they cannot move while the operator is ticking boxes. Score ordering exists only
  on the audience screen.
- **There is no autosave.** Press **Save session** between rounds; it writes a
  `.json` you can reopen with **Open session**. A browser refresh loses the tally.
- **The audience window is a pop-up.** Browsers may block it the first time. Allow
  pop-ups for the file, then click again.
- **When a tie-break resolves**, a pop-up names who took the place and who is
  out. *Clear the tie-break section* takes the entry grid off the Tie-break tab
  and leaves a one-line result; *Keep it open* leaves it up. The sudden-death
  marks are never cleared — the placings are ordered by them, so wiping them
  would put the contestants back in a tie. To fix a mis-tick, use *Show the marks
  again* on the result line; to re-run the whole tie-break, *Clear tie-break*.
  The audience screen keeps showing the result either way.
- **Adding and deleting rows.** *Add 5 slots* appends blank contestants;
  *Delete row* at the end of each roster line takes one away, and the Coaches
  table has the same button. A row with a name, a photo or any mark asks first
  and says what goes with it; an untouched blank row just goes. When the roster
  starts at 22 and fewer turn up, *Delete N empty rows* clears the leftovers in
  one go — it only ever touches rows with nothing entered against them.

  Deleting a contestant **closes the gap**: a contestant's number *is* their slot,
  so the rows below move up and everyone is renumbered from 1. Scores travel with
  their contestant, and the two things recorded as numbers — the announced Round 3
  cut, and any tie-break you have cleared away — are carried across the
  renumbering. Delete someone who was in a settled tie-break and that result is
  dropped rather than left describing a tie that no longer exists. The last
  remaining row cannot be deleted. Because numbers shift, do this during setup;
  mid-contest it would disagree with the numbers on the contestants' tables.

- **Contestant photos.** The Roster tab has a Photo column — *Add photo* per
  contestant, *Replace* or *Remove* after that. Pictures are shrunk to 720px on
  the long side before they are stored, so a 10 MB phone photo becomes about
  120 KB and a full 22-contestant roster adds roughly 2 MB to the saved session.
  They ride inside the session `.json`, so one file still carries the whole
  contest to the venue. A contestant with no photo shows their number instead —
  nothing breaks if some pictures never arrive.
- **Coaches.** The Roster tab has a Coaches table under the roster — a name and
  a school each, with an optional photo, or *Paste from Excel* for the lot. Which
  coach a contestant is under is then derived, not typed twice: **one coach at a
  school and every contestant of that school is theirs**, and the roster's Coach
  column just says so. Only when a school has sent **two or more** does that
  column turn into a chooser, because that is the one case nobody can infer. A
  banner names any contestant still waiting to be assigned, and the Display tab
  repeats it, so nobody reaches the projector unpaired by accident. Match the
  spelling of the school in both tables — the box offers the ones already typed,
  and matching ignores case and extra spaces. Editing either school re-derives
  the pairing, so a coach who moves never drags a contestant with them.

- **School and organisation logos.** One panel covers both, because a school
  badge and an organisation's seal are the same kind of thing. Its rows are not
  typed — they are every school named on the roster or against a coach, and every
  organisation named against a judge — so the only thing to do there is *Add
  logo*. Columns show who each name is carrying: contestants, coaches, judges.

  A school's logo sits beside that school's name on every introduction screen, the
  coach's included. An organisation's logo sits beside its name on that judge's
  screen. **A judge from one of the competing schools shares that school's logo —
  it is one list, matched on the name the same way coaches are**, so spelling it
  the same way is all it takes. Logos keep their transparency (a cut-out seal
  stays cut out), are shrunk to 360px before they are stored, and ride inside the
  saved session like the photographs. Correcting a name's spelling parks its logo
  rather than losing it — type the spelling back and it returns.

  A logo also sits **behind the portrait** of everyone it belongs to, washed back
  to 45% — a school's behind its contestants and their coach, on the introduction
  screens, the 2nd and 3rd placer cards and the champion's; an organisation's
  behind its judge. A photograph is cropped to fill its frame,
  so it covers the crest; the numbered placeholder does not, which is where the
  crest does its work — a contestant whose photo never arrived gets their school's
  seal instead of a blank tile, with the number on a soft disc over it. The
  strength is one value, `--crest-opacity` on `.dsp .por` in `display.css`.

- **Introduce contestants** runs **school by school, in alphabetical order**:
  a school's contestants first, then a screen for the coach who brought them,
  then on to the next school. The school's logo and name are the heading — the
  name a size larger than the other cues carry — so the cards below need only the
  number and the contestant's name. A school that has sent two or
  more coaches is split a group per coach — that coach's contestants, then that
  coach — so nobody is introduced beside the wrong one; contestants there with no
  coach picked come last within the school and get no coach screen. A school with
  no coach encoded simply has no coach screen. Contestants with no school given
  come last of all.

  *Portraits per page* on the Display tab sets how many of a school's contestants
  share a screen before their coach follows: 1 introduces them one at a time — a
  single large portrait with the name beside it, the same card the coach gets —
  or 4, 6, 8 to show a row at a time. A school with more contestants than that
  takes more than one screen before its coach. Turn the screens with `←` `→`.
- **The Board of Judges.** A panel of their own on the Roster tab: a name, a role
  (*Chairman* or *Member*, the two the mechanics and PSQ Form 1 use), an optional
  position, an optional organisation, and a photo. **Board of Judges** is then a
  cue on the Display tab that introduces them **one to a screen** — portrait,
  role, name, position, then the organisation with its logo beside it — on the
  same card the coaches get, so the two introductions read as one piece of the
  ceremony. The organisation's logo is added in the logos panel below, and a judge
  from a competing school simply shares that school's.

  The order of the rows is the order they are introduced in; the `▲` `▼` arrows
  on each row set it, which is how you put the chairman last if that is how the
  programme runs. A judge with no photo shows their initials. None of this touches
  the scoring, and Form 1 still leaves the Board's signature blocks blank to be
  signed by hand.

- **Declaring the winners.** The reveal screen carries the **2nd and 3rd placers
  only**, each with their portrait; the champion has a full-screen card of their
  own. `R` walks the whole declaration in order: 3rd placer, 2nd placer, then the
  champion's card.
- **The title card offers the mechanics.** Under the date there is a *View the
  contest mechanics* button, which opens six screens covering the whole of the
  contest mechanics — how the contest runs, answering a question, scoring,
  advancing to Round 3, declaring the winners, and clarifications. Turn them with
  `◀` `▶` on screen or the arrow keys. The button is live on the audience window
  itself, so the emcee can click it there; the operator can also cue it from the
  Display tab or press `M`. The numbers on those screens come from the scoring
  constants, so they cannot drift from what the app actually scores.
- **Round scores show one figure, your choice of two.** On the Display tab,
  *Score shown* switches the big number on each tile between the **running
  total** (Round 1, then Rounds 1 & 2, then all three) and **this round only**.
  The other number stays underneath in small type, and if the screen is ordered
  by score, the order follows whichever you picked.
- **Applying the Round 3 cut.** Once Round 2 is tallied, *Apply the cut* — on the
  Round 2 tab or the Display tab — freezes who advances. The Round 2 screen then
  strikes through the eliminated, and Round 3 lists only the advancing
  contestants, in the tally grid as well as on screen. Qualification stops
  following the scores at that point, so a later correction cannot quietly change
  who is playing; if a mark does change, a banner says so and you can *Undo the
  cut* and re-apply. Applying it clears any Round 3 marks already ticked for an
  eliminated contestant.
- **Shortcuts:** `T` returns to the title card and `M` shows the contest
  mechanics, from anywhere. On the Display tab each cue carries its own number in
  the corner — press it to pick that cue — `←` `→` turn the page, and `R` walks
  the declaration of winners. The champion card is the one cue without a number:
  `R` reaches it, and so does the button beside the reveals.

---

## Licences

The pixel typeface is Press Start 2P by CodeMan38, under the SIL Open Font
License 1.1 — see `src/assets/OFL-press-start-2p.txt`. The logos are PSA / PSAI
event marks, taken from the 30th PSQ IEC template for use in this event's own
materials.
