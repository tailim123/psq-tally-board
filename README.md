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
  index.html                   page shell; links the stylesheets and lists the script parts in load order
  js/                          the application, in twelve parts — fragments of one closure, not modules
    00-state.js                constants, the state object, the two tiny helpers
    10-scoring.js              rounds, the cut, placings, sudden death
    20-people.js               coaches, school and organisation logos, judges
    25-deck.js                 the RTC's slides as pictures, and what each one is
    78-autosave.js             keeping a copy, and being honest about whether it worked
    35-run.js                  the run state machine, the clocks, the live region, the Run tab
    30-console.js              the operator's header, tabs and tab views
    40-desk.js                 the display control desk
    50-display.js              the audience screen: scenes, fit, the pop-up window
    55-portraits.js            photographs in, and how a portrait is drawn
    60-flow.js                 the Round 3 cut, the tie-break pop-up, render()
    70-events.js               the delegated handlers, and the roster paste
    75-session.js              save, open, and the download helper
    80-form1.js                the Form 1 workbook writer, and the plain CSV
    90-boot.js                 the toast, the window hooks, and the first render
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
  question-runner.md           design for running the quiz itself — proposal, not built
```

### Four things the build depends on

1. The `<style>` elements keep their `id="baseStyle"` and `id="dspStyle"`. The app
   reads them by id to clone the CSS into the audience window.
2. No part may contain a literal `</script>`. The build fails loudly if one does.
3. **`index.html` is the only place the load order lives.** `build.py` reads the
   `<script src>` tags between the `<!-- app: -->` markers and concatenates those
   files, in that order, inside one `(function(){ "use strict"; … })()`. Add a part
   by creating the file *and* listing it; a file in `src/js/` that nothing lists
   fails the build rather than being silently dropped.
4. **Every part opens with `"use strict";`.** Live Server loads the parts as twelve
   separate scripts, so each needs its own directive to be as strict as the bundle;
   `build.py` strips the duplicates and fails if one is missing. Without this,
   development would be the more forgiving of the two environments and a mistake
   would surface first in the file that goes to the venue.

The parts are **fragments of one closure, not modules.** They share scope and call
each other freely; none of them is meaningful on its own.

---

## How the code is organised

The parts read top to bottom in these sections:

| Section | What lives there |
| --- | --- |
| scoring | `rt`, `cum12`, `grand`, `qualifiers`, `sdStreak`, `standings`, `unresolved` |
| console header | `renderTop`, `renderTabs` — the Top 3 strip and tab bar |
| coaches | `coachesAt`, `coachOf`, `unassigned`, `introGroups` — who coaches whom |
| logos | `logoList`, `logoFor` — every school and organisation named, and its logo |
| judges | `judges`, `namedJudges` — the Board of Judges, in the order introduced |
| deck | `slides`, `qIndexOf`, `deckProblems` — the RTC's slides and their tags |
| run | `ask`, `remaining`, `startTicking` — the state machine and the clock |
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
- **Autosave, and what it is worth.** The board keeps a copy of the contest in the
  browser every few seconds and offers it back if the page is reopened with work
  unsaved. It never restores silently — a bar across the top says what it found
  and when, and you choose *Restore it* or *Start fresh*.

  **Check the indicator in the top bar**, beside the display light. *Autosaving*
  means the whole session including photographs and slides is being kept.
  *Autosaving the tally only* means this browser would not take the pictures, so
  the roster and the tally are kept and photographs and slides would need
  re-importing — everything that cannot be reconstructed from a folder of files.
  *No autosave* means nothing is being kept and you are on your own. The board
  proves the storage works at startup by writing a record and reading it back, so
  the indicator reflects what actually happened, not what was hoped for.

  **None of that replaces Save session.** Press it between rounds; it writes a
  `.json` you can reopen with **Open session**, carry to another machine, and
  hand over as the record. The autosave protects against an accident on this
  machine, not against the machine.

- **Refreshing the page.** The board refuses `F5` and `Ctrl+R` while there is
  anything to lose, and the browser's own "leave site?" warning covers closing the
  tab. Neither is absolute — `Ctrl+W` and the toolbar's reload button cannot be
  intercepted by a page — which is why the autosave exists rather than being a
  nicety. Running the console full-screen (`F11`) takes the reload button off the
  screen entirely, and is worth doing for the same reason you do it on the
  audience window.
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
- **The deck.** The RTC sends the questions as a PowerPoint deck. The board does
  not read the `.pptx`: a `.pptx` holds layout XML, not rendered slides, so
  reproducing one faithfully would mean implementing PowerPoint. Instead **export
  the deck to pictures once, in preparation** — *File → Export → Change File Type
  → PNG → Save → All Slides* — and import the folder on the **Deck** tab. The
  audience then sees exactly what the RTC designed, pixel for pixel, with nothing
  re-typed and nothing to mis-read. `Slide2` sorts before `Slide10`, and each
  picture is shrunk on the way in, whichever of PNG or JPEG comes out smaller.

  Tag the slides on the same tab: click a thumbnail, shift-click for a range, then
  say what they are. Most decks run question, answer, question, answer, so
  *Alternate Q / A* across a range does nearly all of it in one click. **Question
  numbers are never typed** — a question slide's number is its position among the
  question slides of its round, so it cannot fall out of step. A banner says when a
  round has more question slides than it has boxes to tally. *Export deck* writes
  a `.json` you can re-import next time without converting the pictures again.

- **The Run tab** appears once a deck is loaded, and is where the contest is
  actually run from: the slide you are on, its clock and its controls, a strip of
  that round's questions you can jump about in, and **the one column of the tally
  this question needs** — the same boxes the round grids hold, narrowed to what is
  on screen. An **answer slide tallies its own question**, which is when the
  Quizmaster reads each contestant's answer out and the ticking really happens, so
  you are not switching tabs mid-round. Round 3 lists only the contestants who
  made the cut; sudden death lists only the tied group, clicked once for correct
  and twice for wrong, exactly as the Tie-break tab does.

- **Health break.** On the Display tab and on the Run tab there is a **Health
  break** row: pick 5, 10, 15, 20 or 30 minutes, or type any number up to 180, and
  *Start the break*. The audience gets a full screen with the minutes counting
  down and the clock time you will resume at; the last thirty seconds turn red,
  and a chime sounds when the time is up. It does not end itself — the Quizmaster
  decides that — so the screen sits at 0:00 until you press *End the break*, and
  the display then goes back to whatever it was showing.

  While it runs you can *Pause* it, or add **+1** or **+5 minutes** without
  restarting. **Starting a break pauses a running question clock**, which is the
  thing that would otherwise go wrong quietly: a fifteen-second question does not
  survive a ten-minute break ticking away underneath it. The question comes back
  paused, with its time intact, for you to resume.

- **Running a question.** On the Display tab, *Put the deck on screen*. From then
  on the slide owns the display — no header, no skyline, nothing of the board's
  over the RTC's artwork — and the cues carry on working for when it does not.
  `←` `→` step the slides, **Space** starts and pauses the clock, **Enter** calls
  TIME, **Esc** leaves the deck. The clock rides in a corner and turns red for the
  last five seconds; at zero a chime sounds and a TIME IS UP band crosses the foot
  of the screen, leaving the question and its choices readable while the answers
  are collected.

  **A tally button owns the keyboard while it has focus.** The grid has always
  been driven by the arrows and space, and the deck wants the same keys — so with
  a tally box focused, space ticks the box rather than pausing a running clock in
  front of an audience. Click off the tally and the deck keys come back.

  **While the clock runs the next slide is locked.** In a deck that runs question
  then answer, an early `→` is exactly the accident that invalidates a question.
  The clock itself is a deadline, not a countdown that ticks down: pausing stores
  what is left and resuming sets a fresh deadline, so the time allowed is exact
  even if the board is busy.

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
