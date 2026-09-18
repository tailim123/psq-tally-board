"use strict";

  /* ===================== the deck =====================
     The Regional Technical Committee sends the questions as a PowerPoint deck.
     A .pptx holds layout XML, not rendered slides, so the board does not read it:
     the operator exports the deck to pictures once, in preparation, and imports
     the pictures. What the audience sees is then exactly what the RTC designed.

     The board needs to know almost nothing about a slide — only which ones are
     questions, so it can arm the right clock and line the tally up with the right
     box. Everything else is the picture's business. */

  var SLIDE_MAX = 1600;             // long side; a projector rarely exceeds 1920
  var DEFAULT_SECONDS = 15;
  /* The trial comes first because it is asked first — Section B of the mechanics
     gives one trial question before Round 1 starts, so the contestants can
     practise raising their answers before anything counts. */
  var ROUNDS = ["trial", "r1", "r2", "r3", "sd"];

  var deckSel = [];                 // slide indices selected in the console
  var deckAnchor = null;            // where a shift-click range starts from
  var deckSeconds = DEFAULT_SECONDS;

  function deck(){ return state.deck || (state.deck = {name:"", slides:[]}); }
  function slides(){ return deck().slides || (deck().slides = []); }
  function hasDeck(){ return slides().length > 0; }
  function roundName(r){
    return r === "sd" ? "Tie-break" : (r === "trial" ? "Trial" : (LABEL[r] || "—"));
  }
  /* Two different counts, and the trial is the reason they part company. Boxes
     are what the tally has room for: the trial has none, because it is never
     scored — no contestant's sheet has a trial mark on it and PSQ Form 1 has
     nowhere to put one. Questions wanted is what the deck should hold, and the
     trial wants exactly the one. */
  function boxesFor(r){
    return r === "sd" ? state.meta.sdCount : (r === "trial" ? 0 : QN);
  }
  function qWanted(r){ return r === "trial" ? 1 : boxesFor(r); }

  /* A question slide's number is its position among the question slides of its
     round. Deriving it rather than storing it means it cannot fall out of step
     with the deck when a slide is retagged or the deck is re-imported. */
  function qIndexOf(i){
    var s = slides()[i];
    if(!s || s.role !== "question" || !s.round) return 0;
    var n = 0;
    for(var j = 0; j <= i; j++){
      var t = slides()[j];
      if(t.role === "question" && t.round === s.round) n++;
    }
    return n;
  }
  function qSlides(round){
    return slides().filter(function(s){ return s.role === "question" && s.round === round; });
  }
  // the slide that asks question q of a round, or null — this is the join
  // between the deck and the tally
  function slideForQuestion(round, q){
    var found = null;
    slides().forEach(function(s, i){
      if(!found && s.role === "question" && s.round === round && qIndexOf(i) === q) found = i;
    });
    return found;
  }

  /* What the operator still has to put right. A round with no question slides at
     all is not a problem — it just has not been tagged yet. */
  function deckProblems(){
    var out = [];
    ROUNDS.forEach(function(r){
      var n = qSlides(r).length, want = qWanted(r);
      if(!n) return;
      if(r === "trial"){
        if(n > 1){
          out.push({bad:true, msg:n + " slides are tagged as the trial question — the mechanics give " +
                    "one trial question before Round 1, and none of them are scored"});
        }
        return;
      }
      if(n > want){
        out.push({bad:true, msg:n + " slides are tagged " + roundName(r) + " questions, but that round " +
                  "only has " + want + " boxes to tally — the last " + (n - want) + " cannot be scored"});
      } else if(n < want){
        out.push({bad:false, msg:roundName(r) + ": " + n + " of " + want + " questions tagged so far"});
      }
    });
    var untagged = slides().filter(function(s){ return s.role === "question" && !s.round; }).length;
    if(untagged){
      out.push({bad:true, msg:untagged + " slide" + (untagged === 1 ? " is" : "s are") +
                " tagged as a question but belong to no round"});
    }
    return out;
  }

  /* ---- importing ---- */

  // "Slide2.png" must sort before "Slide10.png", which plain string order does not
  function natKey(name){
    return String(name).replace(/\d+/g, function(d){
      var p = "0000000000" + d;
      return p.slice(p.length - Math.max(10, d.length));
    });
  }

  var deckBusy = null;              // {done, total} while an import is running

  function importSlides(fileList, done){
    var files = Array.prototype.slice.call(fileList).filter(function(f){
      return /^image\//.test(f.type);
    });
    if(!files.length){ toast("No pictures in that selection"); return; }
    files.sort(function(a, b){
      var ka = natKey(a.name), kb = natKey(b.name);
      return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });

    var out = [], i = 0, skipped = 0;
    deckBusy = {done:0, total:files.length};
    render();
    (function next(){
      if(i >= files.length){
        deckBusy = null;
        done(out, skipped);
        return;
      }
      deckBusy = {done:i, total:files.length};
      var el = $("deckProgress");
      if(el) el.textContent = "Reading slide " + (i + 1) + " of " + files.length + "…";
      // one at a time: thirty-five canvases at once would stall the tab
      shrink(files[i], function(uri){
        if(uri) out.push({image:uri, role:"other", round:null, seconds:null});
        else skipped++;
        i++;
        setTimeout(next, 0);        // let the console repaint between slides
      }, {max:SLIDE_MAX, best:true});
    })();
  }

  function takeSlides(list, skipped){
    deck().slides = list;
    deckSel = []; deckAnchor = null;
    render();
    toast(list.length + " slide" + (list.length === 1 ? "" : "s") + " imported" +
          (skipped ? " · " + skipped + " could not be read" : ""));
  }

  function clearDeck(){
    if(!hasDeck()) return;
    if(!confirm("Remove all " + slides().length + " slides?\n\n" +
                "The tally, the roster and everything else are untouched. " +
                "With no deck loaded the board works exactly as it did before one was imported.")) return;
    deck().slides = []; deck().name = "";
    deckSel = []; deckAnchor = null;
    render(); toast("Deck cleared");
  }

  function exportDeck(){
    if(!hasDeck()){ toast("No slides to export"); return; }
    dl("psq-deck-" + stamp() + ".json", JSON.stringify(deck()), "application/json");
    toast("Deck exported — import it again to skip the picture conversion");
  }

  // a deck file is only a deck: it never carries scores, so opening one cannot
  // disturb a contest in progress
  function loadDeckFile(text){
    try{
      var d = JSON.parse(text);
      if(!d || !Array.isArray(d.slides)) throw new Error("bad");
      var clean = d.slides.filter(function(s){ return s && isPhoto(s.image); }).map(function(s){
        return {
          image:   s.image,
          role:    (s.role === "question" || s.role === "answer") ? s.role : "other",
          round:   ROUNDS.indexOf(s.round) >= 0 ? s.round : null,
          seconds: (typeof s.seconds === "number" && s.seconds > 0) ? Math.round(s.seconds) : null
        };
      });
      if(!clean.length) throw new Error("empty");
      deck().name = typeof d.name === "string" ? d.name : "";
      deck().slides = clean;
      deckSel = []; deckAnchor = null;
      render();
      toast(clean.length + " slides loaded from the deck file");
    }catch(err){ toast("That file isn't a saved deck"); }
  }

  /* ---- selecting and tagging ---- */

  function selectSlide(i, shift){
    if(shift && deckAnchor !== null){
      var a = Math.min(deckAnchor, i), b = Math.max(deckAnchor, i);
      deckSel = [];
      for(var j = a; j <= b; j++) deckSel.push(j);
    } else {
      var at = deckSel.indexOf(i);
      if(at >= 0) deckSel.splice(at, 1);
      else deckSel.push(i);
      deckAnchor = i;
    }
    render();
  }
  function selectAll(on){
    deckSel = [];
    if(on) slides().forEach(function(_s, i){ deckSel.push(i); });
    deckAnchor = null;
    render();
  }
  function selected(){
    return deckSel.slice().sort(function(a, b){ return a - b; })
      .filter(function(i){ return slides()[i]; });
  }

  function tagSelection(role){
    var sel = selected();
    if(!sel.length){ toast("Select some slides first"); return; }
    sel.forEach(function(i){
      var s = slides()[i];
      s.role = role;
      if(role === "question" && !s.seconds) s.seconds = deckSeconds;
      if(role === "other"){ s.round = null; s.seconds = null; }
    });
    render();
  }
  function roundSelection(round){
    var sel = selected();
    if(!sel.length){ toast("Select some slides first"); return; }
    sel.forEach(function(i){
      var s = slides()[i];
      s.round = round;
      if(round && s.role === "other") s.role = "question";
      if(s.role === "question" && !s.seconds) s.seconds = deckSeconds;
    });
    render();
  }
  function secondsSelection(n){
    var sel = selected();
    if(!sel.length){ toast("Select some slides first"); return; }
    sel.forEach(function(i){
      if(slides()[i].role === "question") slides()[i].seconds = n;
    });
    render(); toast("Set to " + n + " seconds");
  }
  // most quiz decks run question, answer, question, answer — say so once
  function alternateSelection(){
    var sel = selected();
    if(sel.length < 2){ toast("Select the range first"); return; }
    sel.forEach(function(i, k){
      var s = slides()[i];
      s.role = k % 2 === 0 ? "question" : "answer";
      if(s.role === "question" && !s.seconds) s.seconds = deckSeconds;
    });
    render(); toast("Alternated across " + sel.length + " slides");
  }

  /* ---- the Deck tab ---- */

  function deckChip(i){
    var s = slides()[i];
    if(s.role === "question"){
      var q = qIndexOf(i);
      return '<span class="chip cq">' + (s.round ? roundName(s.round) : "no round") +
        ((q && s.round !== "trial") ? " Q" + q : "") + ' · ' + (s.seconds || DEFAULT_SECONDS) + 's</span>';
    }
    if(s.role === "answer"){
      return '<span class="chip ca">' + (s.round ? roundName(s.round) + " " : "") + 'answer</span>';
    }
    return '<span class="chip co">—</span>';
  }

  function renderDeck(){
    var sl = slides(), sel = selected();

    if(deckBusy){
      return '<div class="panel"><div class="panel-head"><h3>Deck</h3></div>' +
        '<div class="empty-state"><p id="deckProgress">Reading slide ' + (deckBusy.done + 1) +
        ' of ' + deckBusy.total + '…</p>' +
        '<p class="fine">Each picture is shrunk as it comes in. Large decks take a moment.</p>' +
        '</div></div>';
    }

    var head = '<div class="panel-head"><h3>Deck</h3><span class="note">' +
      (sl.length ? sl.length + ' slides · ' + qSlides("trial").length + '/' + qSlides("r1").length +
                   '/' + qSlides("r2").length + '/' + qSlides("r3").length + '/' + qSlides("sd").length +
                   ' questions tagged for the trial, Rounds 1, 2, 3 and the tie-break'
                 : 'no slides yet') + '</span>' +
      '<div class="right">' +
        '<button class="lbtn" id="btnSlides">' + (sl.length ? "Replace slides" : "Import slides") + '</button>' +
        '<button class="lbtn" id="btnDeckOpen">Open deck file</button>' +
        (sl.length ? '<button class="lbtn" id="btnDeckSave">Export deck</button>' +
                     '<button class="lbtn danger" id="btnDeckClear">Clear deck</button>' : '') +
      '</div></div>';

    if(!sl.length){
      return '<div class="panel">' + head +
        '<div class="empty-state">' +
        '<p>Export the RTC’s PowerPoint to pictures, then import them here.</p>' +
        '<p class="fine">In PowerPoint: <b>File → Export → Change File Type → PNG → Save → All Slides</b>. ' +
        'Pick the whole folder in one go; <code>Slide2</code> is sorted before <code>Slide10</code>.</p>' +
        '<button class="lbtn go" id="btnSlides2">Import slides</button></div>' +
        deckLegend() + '</div>';
    }

    var problems = deckProblems().map(function(p){
      return '<div class="banner ' + (p.bad ? "warn" : "info") + '">' + esc(p.msg) + '</div>';
    }).join("");

    var tools = '<div class="desk">' +
      '<div class="deskrow" style="margin-top:0;padding-top:0;border-top:0">' +
        '<span class="lab">Selected</span>' +
        '<span class="note"><b>' + sel.length + '</b> of ' + sl.length + ' slides' +
        (sel.length ? '' : ' — click a thumbnail, shift-click for a range') + '</span>' +
        '<button class="lbtn" id="btnDeckAll">Select all</button>' +
        '<button class="lbtn" id="btnDeckNone"' + (sel.length ? '' : ' disabled') + '>Clear selection</button>' +
      '</div>' +
      '<div class="deskrow"><span class="lab">Tag as</span>' +
        ['question,Question', 'answer,Answer', 'other,Not a question'].map(function(v){
          var p = v.split(",");
          return '<button class="lbtn" data-dtag="' + p[0] + '">' + p[1] + '</button>';
        }).join("") +
        '<button class="lbtn" id="btnDeckAlt">Alternate Q / A</button>' +
        '<span class="note">A deck that runs question, answer, question, answer is one click.</span></div>' +
      '<div class="deskrow"><span class="lab">Round</span>' +
        ROUNDS.map(function(r){
          return '<button class="lbtn" data-dround="' + r + '">' + roundName(r) + '</button>';
        }).join("") +
        '<button class="lbtn" data-dround="">None</button>' +
        '<span class="note">Question numbers follow from the order — they are never typed.</span></div>' +
      '<div class="deskrow"><span class="lab">Seconds</span>' +
        [10, 15, 20, 30, 45, 60].map(function(n){
          return '<button class="lbtn' + (deckSeconds === n ? " on" : "") + '" data-dsec="' + n + '">' + n + '</button>';
        }).join("") +
        '<span class="note">Sets the limit on the selected question slides, and the default for new ones.</span></div>' +
    '</div>';

    var grid = '<div class="slides">' + sl.map(function(s, i){
      return '<button class="slide' + (deckSel.indexOf(i) >= 0 ? " on" : "") +
        (s.role === "question" ? " isq" : "") + '" data-slide="' + i + '">' +
        '<span class="inner">' +
        '<span class="sn">' + (i + 1) + '</span>' +
        '<img src="' + s.image + '" alt="Slide ' + (i + 1) + '">' +
        deckChip(i) + '</span></button>';
    }).join("") + '</div>';

    return '<div class="panel">' + head + problems + tools + grid + deckLegend() + '</div>';
  }

  function deckLegend(){
    return '<div class="legend">The board shows the RTC’s slides as pictures, so the audience sees exactly ' +
      'what was designed — nothing is re-typed and nothing can be mis-read. Only the slides tagged as ' +
      '<b>questions</b> carry a clock and a tally; everything else simply shows. ' +
      'The <b>trial</b> question is the exception: it runs with a clock like any other, but it is ' +
      'never tallied — the mechanics give it before Round 1 purely as practice. ' +
      'With no deck loaded the board works exactly as it did before one was imported.</div>';
  }
