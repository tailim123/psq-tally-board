"use strict";
  /* ===================== events ===================== */
  function refocus(sel){ render(); var el=document.querySelector(sel); if(el && !el.disabled) el.focus(); }

  document.addEventListener("click", function(e){
    var t = e.target;
    var b = t.closest ? t.closest(".qbtn") : null;
    if(b && !b.disabled){
      var c = state.contestants[+b.dataset.i];
      if(b.dataset.sd!==undefined){
        var i=+b.dataset.sd, v=c.sd[i];
        var was = sigsNow();
        c.sd[i] = v===null ? "c" : (v==="c" ? "w" : null);
        if(c.sd[i]==="w"){ for(var z=i+1;z<state.meta.sdCount;z++) c.sd[z]=null; }
        checkSdResolved(was);
        refocus('.qbtn[data-i="'+b.dataset.i+'"][data-sd="'+i+'"]');
      } else {
        c[b.dataset.k][+b.dataset.q] = !c[b.dataset.k][+b.dataset.q];
        refocus('.qbtn[data-i="'+b.dataset.i+'"][data-k="'+b.dataset.k+'"][data-q="'+b.dataset.q+'"]');
      }
      return;
    }
    var reEl = t.closest ? t.closest("[data-reopen]") : null;
    if(reEl){
      var sig = reEl.dataset.reopen;
      state.sdAck = (state.sdAck||[]).filter(function(a){ return a.sig!==sig; });
      render(); toast("Tie-break back on this tab — the marks are as they were");
      return;
    }
    var phEl = t.closest ? t.closest("[data-photo]") : null;
    if(phEl){ pickPhoto("c", +phEl.dataset.photo); return; }
    var unphEl = t.closest ? t.closest("[data-unphoto]") : null;
    if(unphEl){
      var ci = +unphEl.dataset.unphoto;
      state.contestants[ci].photo = null; render(); toast("Photo removed");
      return;
    }
    var jphEl = t.closest ? t.closest("[data-jphoto]") : null;
    if(jphEl){ pickPhoto("j", +jphEl.dataset.jphoto); return; }
    var junEl = t.closest ? t.closest("[data-junphoto]") : null;
    if(junEl){
      var ji = +junEl.dataset.junphoto;
      if(judges()[ji]){ judges()[ji].photo = null; render(); toast("Photo removed"); }
      return;
    }
    var jmvEl = t.closest ? t.closest("[data-jmove]") : null;
    if(jmvEl && !jmvEl.disabled){ moveJudge(+jmvEl.dataset.jmove, +jmvEl.dataset.dir); return; }
    var jdEl = t.closest ? t.closest("[data-jdel]") : null;
    if(jdEl){ removeJudge(+jdEl.dataset.jdel); return; }
    var rtEl = t.closest ? t.closest("[data-rtick]") : null;
    if(rtEl){ runToggleTick(+rtEl.dataset.rtick); return; }
    var rjEl = t.closest ? t.closest("[data-rjump]") : null;
    if(rjEl){
      var tgt = runTallyTarget();
      var at = tgt ? slideForQuestion(tgt.round, +rjEl.dataset.rjump) : null;
      if(at !== null && at !== undefined) runEnter(at);
      return;
    }
    var sldEl = t.closest ? t.closest("[data-slide]") : null;
    if(sldEl){ selectSlide(+sldEl.dataset.slide, e.shiftKey); return; }
    var dtagEl = t.closest ? t.closest("[data-dtag]") : null;
    if(dtagEl){ tagSelection(dtagEl.dataset.dtag); return; }
    var drnEl = t.closest ? t.closest("[data-dround]") : null;
    if(drnEl){ roundSelection(drnEl.dataset.dround || null); return; }
    var dsecEl = t.closest ? t.closest("[data-dsec]") : null;
    if(dsecEl){ deckSeconds = +dsecEl.dataset.dsec; secondsSelection(deckSeconds); return; }
    var slEl = t.closest ? t.closest("[data-slogo]") : null;
    if(slEl){ pickPhoto("s", 0, slEl.dataset.slogo); return; }
    var slDel = t.closest ? t.closest("[data-slogodel]") : null;
    if(slDel){ clearLogo(slDel.dataset.slogodel); render(); toast("Logo removed"); return; }
    var kphEl = t.closest ? t.closest("[data-kphoto]") : null;
    if(kphEl){ pickPhoto("k", +kphEl.dataset.kphoto); return; }
    var kunEl = t.closest ? t.closest("[data-kunphoto]") : null;
    if(kunEl){
      var ki = +kunEl.dataset.kunphoto;
      if(coaches()[ki]){ coaches()[ki].photo = null; render(); toast("Photo removed"); }
      return;
    }
    var kdEl = t.closest ? t.closest("[data-kdel]") : null;
    if(kdEl){ removeCoach(+kdEl.dataset.kdel); return; }
    var cdEl = t.closest ? t.closest("[data-cdel]") : null;
    if(cdEl){ removeContestant(+cdEl.dataset.cdel); return; }
    var sortEl = t.closest ? t.closest("[data-sort]") : null;
    if(sortEl){ sortBy = sortEl.dataset.sort; disp.page = 0; render(); return; }
    var valEl = t.closest ? t.closest("[data-val]") : null;
    if(valEl){
      disp.val = valEl.dataset.val; render();
      toast(disp.val==="round" ? "Screen shows this round's score" : "Screen shows the running total");
      return;
    }
    var colEl = t.closest ? t.closest("[data-cols]") : null;
    if(colEl){ disp.cols = +colEl.dataset.cols; render(); return; }
    var perEl = t.closest ? t.closest("[data-per]") : null;
    if(perEl){
      if(disp.cue==="introduce") introPer = +perEl.dataset.per;
      else perPage = +perEl.dataset.per;
      disp.page = 0; render(); return;
    }
    var pgEl = t.closest ? t.closest("[data-pg]") : null;
    if(pgEl && !pgEl.disabled){ turnPage(+pgEl.dataset.pg); return; }
    var cueEl = t.closest ? t.closest("[data-cue]") : null;
    if(cueEl){ setCue(cueEl.dataset.cue, cueEl.dataset.round); toast("On screen: "+cueName(cueEl.dataset.cue)); return; }
    var revEl = t.closest ? t.closest("[data-reveal]") : null;
    if(revEl){
      disp.cue = "reveal"; disp.reveal = Math.min(2, +revEl.dataset.reveal);
      justRevealed = disp.reveal>0; render(); return;
    }
    var tb = t.closest ? t.closest(".tab") : null;
    if(tb){ tab = tb.dataset.tab; render(); return; }
    if(t.dataset && t.dataset.goto){ tab = t.dataset.goto; render(); return; }
    if(t.dataset && t.dataset.clear){
      var k = t.dataset.clear;
      var nm = k==="sd" ? "the tie-break" : LABEL[k];
      if(confirm("Clear every mark in "+nm+"?")){
        state.contestants.forEach(function(cc){
          if(k==="sd") cc.sd = new Array(state.meta.sdCount).fill(null);
          else cc[k] = new Array(QN).fill(false);
        });
        if(k==="sd"){ state.sdAck = []; sdPop = null; }   // the tie is open again
        render(); toast("Cleared");
      }
      return;
    }
    switch(t.id){
      case "btnAdd":
        var n = state.contestants.length;
        for(var j=1;j<=5;j++) state.contestants.push(blankC(n+j));
        render(); break;
      case "btnClearAll":
        if(confirm("Clear all scores in every round? Names and schools are kept."+
                   (isCut()?"\n\nThe Round 3 cut is released too.":""))){
          state.contestants.forEach(function(cc){
            cc.r1=new Array(QN).fill(false); cc.r2=new Array(QN).fill(false);
            cc.r3=new Array(QN).fill(false); cc.sd=new Array(state.meta.sdCount).fill(null);
          });
          state.cut = null; state.sdAck = []; sdPop = null;
          render(); toast("All scores cleared");
        }
        break;
      case "btnPaste": $("pasteBox").classList.add("show"); $("pasteText").focus(); break;
      case "btnPasteCancel": $("pasteBox").classList.remove("show"); break;
      case "btnPasteGo": loadPaste(); break;
      case "btnTrim": trimEmpty(); break;
      case "btnSlides": case "btnSlides2": $("slidesIn").click(); break;
      case "btnRunEnter": runEnter(null); break;
      case "btnRunLeave": runLeave(); break;
      case "btnRunPrev": runStep(-1); break;
      case "btnRunNext": runStep(1); break;
      case "btnRunGo": runToggle(); break;
      case "btnRunTime": runTime(); break;
      case "btnRunReset": runReset(); break;
      case "btnRunClearQ": runClearQuestion(); break;
      case "btnChime": chimeOn = !chimeOn; render();
        toast(chimeOn ? "Chime on" : "Chime off"); break;
      case "btnDeckOpen": $("deckIn").click(); break;
      case "btnDeckSave": exportDeck(); break;
      case "btnDeckClear": clearDeck(); break;
      case "btnDeckAll": selectAll(true); break;
      case "btnDeckNone": selectAll(false); break;
      case "btnDeckAlt": alternateSelection(); break;
      case "btnAddCoach": case "btnAddCoach2": addCoach(); break;
      case "btnAddJudge": case "btnAddJudge2": addJudge(); break;
      case "btnKPaste": $("kPasteBox").classList.add("show"); $("kPasteText").focus(); break;
      case "btnKPasteCancel": $("kPasteBox").classList.remove("show"); break;
      case "btnKPasteGo": loadCoachPaste(); break;
      case "btnPrint": window.print(); break;
      case "btnDisplay": case "btnDisplay2": openDisplay(); break;
      case "btnCloseDisplay": if(winRef && !winRef.closed) winRef.close(); winRef=null; render(); break;
      case "btnTitle": case "btnTitle2":
        disp.reveal = 0; setCue("standby"); toast("Back to the title card"); break;
      case "btnSdClear":
        if(sdPop){
          state.sdAck = (state.sdAck||[]).concat([{sig:sdPop.sig, winner:sdPop.winner,
                                                   place:sdPop.place, name:sdPop.name}]);
          var who = sdPop.name;
          sdPop = null; render(); toast("Tie-break cleared — "+who+" keeps the place");
        }
        break;
      case "btnSdKeep": sdPop = null; render(); break;
      case "btnCut": case "btnCut2": applyCut(); break;
      case "btnUncut": case "btnUncut2": undoCut(); break;
      case "btnPreview": case "btnPreview2":
        $("preview").classList.add("show"); paintDisplay(); break;
      case "btnClosePreview": $("preview").classList.remove("show"); break;
      case "btnSave": saveSession(); break;
      case "btnRestoreYes": acceptRestore(); break;
      case "btnRestoreNo": declineRestore(); break;
      case "btnOpen": $("fileIn").click(); break;
      case "btnForm1": exportForm1(); break;
      case "btnCsv": exportCsv(); break;
    }
  });

  document.addEventListener("input", function(e){
    var t = e.target;
    markDirty();          // the light paths below deliberately skip render()
    if(t.classList && t.classList.contains("rin")){
      state.contestants[+t.dataset.i][t.dataset.f] = t.value;
      renderTop(); renderTabs(); refreshDerived(); paintDisplay();
      var note = document.querySelector(".panel-head .note");
      if(note) note.textContent = named().length+" of "+state.contestants.length+" slots filled";
      return;
    }
    if(t.classList && t.classList.contains("jin")){
      var jj = judges()[+t.dataset.ji];
      if(jj){ jj[t.dataset.jf] = t.value; refreshDerived(); paintDisplay(); }
      return;
    }
    if(t.classList && t.classList.contains("kin")){
      var kk = coaches()[+t.dataset.ki];
      if(kk){ kk[t.dataset.kf] = t.value; refreshDerived(); paintDisplay(); }
      return;
    }
    if(t.dataset && t.dataset.m){ state.meta[t.dataset.m] = t.value; renderTop(); paintDisplay(); }
  });

  // the roster's coach chooser — a full redraw, since it moves a contestant
  // from one coach to another everywhere they are listed
  document.addEventListener("change", function(e){
    var t = e.target;
    if(t.dataset && t.dataset.jrole!==undefined){
      var jr = judges()[+t.dataset.jrole];
      if(jr){ jr.role = t.value; render(); }
      return;
    }
    if(t.dataset && t.dataset.coach!==undefined){
      var c = state.contestants[+t.dataset.coach];
      c.coachId = t.value || null;
      render();
      toast(c.coachId ? (c.name||("No. "+c.no))+" is under "+coachName(c) : "Coach cleared");
    }
  });

  document.addEventListener("keydown", function(e){
    if(e.key==="Escape" && $("preview").classList.contains("show")){ $("preview").classList.remove("show"); return; }
    /* F5 and Ctrl+R are cancellable; Ctrl+W, Ctrl+N and the toolbar button are
       not, which is why the autosave exists rather than this being the defence. */
    if(e.key==="F5" || ((e.ctrlKey||e.metaKey) && (e.key==="r" || e.key==="R"))){
      if(atRisk()){
        e.preventDefault();
        toast("Reload blocked while the contest is live — the board autosaves, but reopen it deliberately");
        return;
      }
    }
    var typingNow = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||""));
    /* A tally cell owns the keyboard while it has focus. The grid has always been
       driven by the arrows and space, and the deck wants the same keys — so with
       a cell focused, space must tick the box rather than pause a running clock
       in front of an audience. Click off the grid and the deck keys return. */
    var a0 = document.activeElement;
    var onTally = !!(a0 && a0.classList &&
                     (a0.classList.contains("qbtn") || a0.classList.contains("rtick")));
    // otherwise, while the deck is on screen its keys come first — the operator
    // is running the contest from them, not navigating the console
    if(runLive() && !typingNow && !onTally && !e.ctrlKey && !e.metaKey){
      if(e.key===" " || e.key==="Spacebar"){ e.preventDefault(); runToggle(); return; }
      if(e.key==="ArrowLeft"){ e.preventDefault(); runStep(-1); return; }
      if(e.key==="ArrowRight"){ e.preventDefault(); runStep(1); return; }
      if(e.key==="Enter"){ e.preventDefault(); runTime(); return; }
      if(e.key==="Escape"){ e.preventDefault(); runLeave(); return; }
    }
    var typing = /^(INPUT|TEXTAREA)$/.test((e.target.tagName||""));
    if(!typing && !e.ctrlKey && !e.metaKey && (e.key==="t" || e.key==="T")){
      disp.reveal = 0; setCue("standby"); toast("Back to the title card"); return;
    }
    if(!typing && !e.ctrlKey && !e.metaKey && (e.key==="m" || e.key==="M")){
      setCue("mechanics"); toast("On screen: Contest mechanics"); return;
    }
    if(tab==="display" && !typing && !e.ctrlKey && !e.metaKey){
      if(e.key==="ArrowLeft"){ e.preventDefault(); turnPage(-1); return; }
      if(e.key==="ArrowRight"){ e.preventDefault(); turnPage(1); return; }
      if(/^[0-9]$/.test(e.key)){
        var hit = CUES.filter(function(x){ return x.k===e.key; })[0];
        if(hit){ setCue(hit.id); return; }
      }
      // R walks the declaration: 3rd placer, 2nd placer, then the champion's own card
      if(e.key==="r" || e.key==="R"){
        if(disp.cue==="champion") return;
        if(disp.cue!=="reveal"){ disp.cue="reveal"; disp.reveal=1; }
        else if(disp.reveal<2) disp.reveal++;
        else { disp.cue="champion"; }
        justRevealed = true; render(); return;
      }
    }
    var a = document.activeElement;
    if(!a || !a.classList || !a.classList.contains("qbtn")) return;
    var dq=0, dr=0;
    if(e.key==="ArrowRight") dq=1; else if(e.key==="ArrowLeft") dq=-1;
    else if(e.key==="ArrowDown") dr=1; else if(e.key==="ArrowUp") dr=-1;
    else return;
    e.preventDefault();
    var sel = a.dataset.sd!==undefined ? '.qbtn[data-sd]' : '.qbtn[data-k="'+a.dataset.k+'"]';
    var cells = Array.prototype.slice.call(document.querySelectorAll(sel));
    var per = a.dataset.sd!==undefined ? state.meta.sdCount : QN;
    var nx = cells.indexOf(a) + dq + dr*per;
    if(cells[nx]) cells[nx].focus();
  });

  /* ===================== roster paste ===================== */
  function loadPaste(){
    var lines = $("pasteText").value.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
    if(!lines.length){ toast("Nothing to load"); return; }
    while(state.contestants.length < lines.length) state.contestants.push(blankC(state.contestants.length+1));
    lines.forEach(function(ln,i){
      var p = ln.split(/\t|\s{2,}|,/);
      state.contestants[i].name = (p[0]||"").trim();
      state.contestants[i].school = p.slice(1).join(", ").trim();
    });
    $("pasteBox").classList.remove("show"); $("pasteText").value="";
    render(); toast(lines.length+" contestants loaded");
  }

