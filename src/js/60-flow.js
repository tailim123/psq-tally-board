"use strict";
  /* ===================== the Round 3 cut ===================== */
  function applyCut(){
    if(!hasMarks("r2")){ toast("Tally Round 2 before applying the cut"); return; }
    var q = liveQualifiers();
    if(!q.length){ toast("Nobody to advance yet"); return; }
    var outs = named().filter(function(c){ return q.indexOf(c)<0; });
    var stray = outs.filter(function(c){ return c.r3.some(Boolean); });
    var msg = "Advance "+q.length+" contestant"+(q.length===1?"":"s")+" to Round 3 and eliminate "+
      outs.length+"?\n\n"+
      "The Round 2 screen marks the eliminated, and Round 3 — the tally grid and the audience screen — "+
      "lists only the "+q.length+" advancing.\n\n"+
      "Qualification is frozen at that point, so a later correction to a Round 1 or 2 mark cannot quietly "+
      "change who is playing. Undo the cut to re-open it.";
    if(stray.length) msg += "\n\n"+stray.length+" eliminated contestant"+(stray.length===1?" has":"s have")+
      " Round 3 marks ticked already. Those marks will be cleared.";
    if(!confirm(msg)) return;
    stray.forEach(function(c){ c.r3 = new Array(QN).fill(false); });
    state.cut = q.map(function(c){ return c.no; });
    render();
    toast(q.length+" advancing to Round 3 · "+outs.length+" eliminated");
  }
  function undoCut(){
    if(!isCut()) return;
    if(!confirm("Undo the Round 3 cut?\n\nEveryone returns to the Round 3 list and qualification follows "+
                "the live Rounds 1 and 2 scores again. Round 3 marks already ticked are kept.")) return;
    state.cut = null;
    render();
    toast("Cut undone — qualification is live again");
  }

  function setCue(id, opt){
    if(id!==disp.cue || (id==="round" && opt && opt!==disp.round)) disp.page = 0;
    if(id==="round" && opt) disp.round = opt;
    if(id!==disp.cue && (id==="reveal")) disp.reveal = 0;
    disp.cue = id;
    render();
  }

  /* ===================== tie-break resolved pop-up ===================== */
  var sdPop = null;          // the outcome being announced, or null

  function renderModal(){
    var m = $("sdModal");
    if(!sdPop){ m.className = "modal"; m.innerHTML = ""; return; }
    var beaten = sdPop.others.length
      ? esc(sdPop.others.join(", "))+(sdPop.others.length===1?" is":" are")+" eliminated."
      : "";
    m.className = "modal show";
    m.innerHTML = '<div class="sheet">'+
      '<h3>Tie-break resolved</h3>'+
      '<p class="big"><b>'+esc(sdPop.name || ("No. "+sdPop.winner))+'</b> takes place '+sdPop.place+'.</p>'+
      (beaten?'<p>'+beaten+'</p>':'')+
      '<p class="fine">The sudden-death marks stay on record — they are what orders the placings. '+
      'Clearing the section only takes the entry grid off this tab.</p>'+
      '<div class="row">'+
        '<button class="lbtn go" id="btnSdClear">Clear the tie-break section</button>'+
        '<button class="lbtn" id="btnSdKeep">Keep it open</button>'+
      '</div></div>';
  }

  // announce a tie-break the moment it comes out decided
  function checkSdResolved(before){
    var now = sdOutcomes();
    for(var i=0;i<now.length;i++){
      if(before.indexOf(now[i].sig)<0 && !sdAcked(now[i].sig)){ sdPop = now[i]; return; }
    }
  }
  function sigsNow(){ return sdOutcomes().map(function(o){ return o.sig; }); }

  /* ===================== render ===================== */
  function render(){
    markDirty();
    renderTop(); renderTabs();
    var v = $("view");
    if(tab==="roster") v.innerHTML = renderRoster();
    else if(tab==="programme") v.innerHTML = renderProgramme();
    else if(tab==="deck") v.innerHTML = renderDeck();
    else if(tab==="run") v.innerHTML = renderRun();
    else if(tab==="standings") v.innerHTML = renderStandings();
    else if(tab==="sd") v.innerHTML = renderSd();
    else if(tab==="display") v.innerHTML = renderDesk();
    else v.innerHTML = renderRound(tab);
    renderModal();
    paintDisplay();
  }

