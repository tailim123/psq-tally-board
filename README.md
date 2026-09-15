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
| console views | `renderRoster`, `renderRound`, `renderSd`, `renderStandings`, `renderDesk` |
| portraits | `shrink`, `pickPhoto`, `portrait` — photos in, and how they are drawn |
| audience screen | `sceneHTML`, `fit`, `paintDisplay`, `openDisplay` |
| events | one delegated `click` handler, one `keydown`, one `input` |
| Form 1 export | zip writer, `Sheet`, `buildForm1`, `exportForm1` |
| session | `saveSession`, restore, `exportCsv` |

State is one plain object, `state`, holding `meta`, `cut` (the announced Round 3
cut, once there is one) and `contestants` — each of which carries its `photo` as
a data URI. Display settings (`disp`, `perPage`, `introPer`, `sortBy`) are
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
- **Contestant photos.** The Roster tab has a Photo column — *Add photo* per
  contestant, *Replace* or *Remove* after that. Pictures are shrunk to 720px on
  the long side before they are stored, so a 10 MB phone photo becomes about
  120 KB and a full 22-contestant roster adds roughly 2 MB to the saved session.
  They ride inside the session `.json`, so one file still carries the whole
  contest to the venue. A contestant with no photo shows their number instead —
  nothing breaks if some pictures never arrive.
- **Introduce contestants** is a cue of its own: portraits with name and school,
  paged. Set *Portraits per page* to 1 on the Display tab to introduce them one
  at a time — a single large portrait with the name and school beside it — or 4,
  6, 8 to show a row at a time.
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
  mechanics, from anywhere. On the Display tab, `1`–`9` then `0` pick a cue,
  `←` `→` turn the page, `R` walks the declaration of winners.

---

## Licences

The pixel typeface is Press Start 2P by CodeMan38, under the SIL Open Font
License 1.1 — see `src/assets/OFL-press-start-2p.txt`. The logos are PSA / PSAI
event marks, taken from the 30th PSQ IEC template for use in this event's own
materials.
