# PSQ Form 1 export — column mapping

**Export Form 1** writes a real `.xlsx` laid out cell-for-cell like the office
template `(9) PSQ Tally Sheets for Tabulator.xlsx`, so a printed copy is the
form the Board of Judges signs.

The writer is in `app.js`: a small stored-zip packer, a `Sheet` helper, and
`buildForm1()`. No external library — the venue may be offline, and a 900 KB
spreadsheet dependency was not worth carrying.

## The four blocks

The sheet is one worksheet with four side-by-side blocks, one per round, exactly
as in the template.

| Block | Starts | No. | Name | School | Q1–Q10 | TOTAL | Extra columns |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Round 1 | A | A | B:D | E:K | L–U | V | W Rank |
| Round 2 | Y | Y | Z:AC | — | AD–AM | AN | AO Round 1, AP cumulative, AQ rank |
| Round 3 | AS | AS | AT:AW | — | AX–BG | BH | BI Rounds 1&2, BJ total, BK final rank |
| Tie-break | BM | BM | BN:BQ | — | BR–CA | CB | — |

Row layout: block titles on row 1, event/level/province on rows 2–4, headers on
rows 7–8, contestants from row 9. The Board of Judges blocks and the point notes
follow the data and shift down automatically if there are more than 22
contestants.

## Formulas, not baked numbers

The export writes the template's own formulas so the sheet stays live — a judge
who corrects a cell by hand gets updated totals.

```
V9   =SUM(L9:U9)                    Round 1 total
W9   =RANK(V9,V$9:V$30)             Round 1 rank
Z9   =IF(B9<>"",B9,"")              name carried into Round 2
AN9  =SUM(AD9:AM9)                  Round 2 total
AO9  =V9                            Round 1 carried across
AP9  =AN9+AO9                       Rounds 1 & 2 cumulative
AQ9  =RANK(AP9,AP$9:AP$30)          rank on the cumulative
BH9  =SUM(AX9:BG9)                  Round 3 total
BI9  =AP9                           cumulative carried across
BJ9  =BH9+BI9                       grand total
BK9  =RANK(BJ9,$BJ$9:$BJ$30)        final rank
CB9  =SUM(BR9:CA9)                  tie-break total
```

The `$9:$30` ranges stretch to fit the actual roster size.

## Values written

- Round 1 and 2: `1` for a correct answer, `0` otherwise.
- Round 3: `2` for correct, `0` otherwise. Contestants who did not qualify get
  **blank** cells rather than zeros.
- Tie-break: `1` correct, `0` wrong, blank if the question was never reached.

## Board of Judges

Signature rules, the Member / Chairman / Member labels, "Board of Judges" and
"(Signature over printed name)" are written into the same cells as the template
(F35, L35, S35 and their counterparts in each block, when the roster is the
standard 22).

## Also available

**Plain CSV**, in the Standings tab, dumps the raw per-question data as a flat
table. Use it for analysis; use Form 1 for the record.
