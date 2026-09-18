"use strict";

  /* ===================== running the deck =====================
     Everything else in this board happens at human speed: the operator clicks and
     the screen repaints. A clock does not. Repainting the whole audience scene ten
     times a second to move one digit would rebuild the DOM ten times a second and
     cancel every animation mid-flight, so the clock has a path of its own —
     writeClock() puts one string into one cached node, in each document, and only
     when the displayed second actually changes. Nothing else knows it exists. */

  var ask = {
    slide:  0,
    phase:  "off",     // off | armed | running | paused | timeup
    endsAt: null,      // ms timestamp, only while running
    remain: 0          // ms left, meaningful when armed, paused or timed out
  };
  var chimeOn = true;

  function runLive(){ return ask.phase !== "off" && hasDeck(); }
  function curSlide(){ return slides()[ask.slide] || null; }
  function isQuestionSlide(){
    var s = curSlide();
    return !!(s && s.role === "question");
  }

  /* The clock is a deadline, never a countdown that ticks down. A setInterval
     that decrements drifts, and a fifteen-second question that really ran
     seventeen seconds is a protest waiting to happen — with this board as the
     thing the protest is argued against. */
  function remaining(){
    if(ask.phase === "running") return Math.max(0, ask.endsAt - Date.now());
    return ask.remain;
  }
  function fullMs(){
    var s = curSlide();
    return ((s && s.seconds) || DEFAULT_SECONDS) * 1000;
  }
  function fmtClock(sec){
    if(sec < 60) return String(sec);
    var m = Math.floor(sec / 60), r = sec % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* ---- moving about ---- */

  function armSlide(){
    ask.phase = "armed";
    ask.endsAt = null;
    ask.remain = isQuestionSlide() ? fullMs() : 0;
    stopTicking();
  }
  function runEnter(i){
    if(!hasDeck()){ toast("Import the slides first"); return; }
    ask.slide = Math.max(0, Math.min(slides().length - 1, i == null ? ask.slide : i));
    armSlide();
    render();
  }
  function runLeave(){
    ask.phase = "off";
    stopTicking();
    render();
    toast("Back to the cues — the deck is off the screen");
  }
  function runStep(d){
    // While the clock runs the next slide is the answer to the question on
    // screen. Showing it early is exactly the accident that invalidates a
    // question, and the Board's decision on that is final.
    if(ask.phase === "running"){ toast("Stop the clock first — the answer is the next slide"); return; }
    var to = ask.slide + d;
    if(to < 0 || to >= slides().length) return;
    ask.slide = to;
    armSlide();
    render();
  }

  /* ---- the clock ---- */

  function runGo(){
    if(!isQuestionSlide()){ toast("This slide has no clock — tag it as a question first"); return; }
    if(ask.phase === "running") return;
    if(ask.phase === "timeup") ask.remain = fullMs();
    if(!ask.remain) ask.remain = fullMs();
    ask.endsAt = Date.now() + ask.remain;
    ask.phase = "running";
    render();
    startTicking();
  }
  function runPause(){
    if(ask.phase !== "running") return;
    ask.remain = remaining();
    ask.endsAt = null;
    ask.phase = "paused";
    stopTicking();
    render();
  }
  function runToggle(){
    if(ask.phase === "running") runPause();
    else runGo();
  }
  // the Quizmaster calls TIME before the deadline
  function runTime(){
    if(ask.phase !== "running" && ask.phase !== "paused") return;
    timeUp();
  }
  function runReset(){
    if(!isQuestionSlide()) return;
    armSlide();
    render();
    toast("Clock reset to " + Math.round(fullMs() / 1000) + " seconds");
  }
  function timeUp(){
    ask.phase = "timeup";
    ask.remain = 0;
    ask.endsAt = null;
    stopTicking();
    render();
    chime();
  }

  /* ---- the live region ---- */

  var tickHandle = null;
  var shownSec = null;          // what is currently written, so we write once a second

  function clockNodes(){
    var out = [], el = $("clockFace");
    if(el) out.push(el);
    if(winRef && !winRef.closed){
      try{
        var w = winRef.document.getElementById("clockFace");
        if(w) out.push(w);
      }catch(err){}
    }
    return out;
  }
  /* The last seconds turn the clock red. That state has to be set here rather
     than at render time: between starting the clock and the deadline there is no
     repaint at all, which is the whole point of the live region. */
  function writeClock(sec){
    var text = fmtClock(sec);
    var low = ask.phase === "running" && sec <= 5;
    clockNodes().forEach(function(el){
      el.textContent = text;
      var box = el.parentNode;
      if(box && box.classList) box.classList.toggle("low", low);
    });
  }
  /* A timer, not an animation. requestAnimationFrame would be the tidier choice
     for something that paints, but the browser throttles it hard the moment this
     window stops being the focused one — and the operator clicks the audience
     window all the time. The clock would freeze and TIME IS UP would arrive late.
     An interval keeps running; at 100ms it costs nothing, and the deadline
     arithmetic means a throttled tick loses accuracy in the display for a moment,
     never in the time actually allowed. */
  function tickOnce(){
    // a break, when there is one, is the clock on screen
    if(brk.on){
      var bms = brkRemaining(), bsec = Math.ceil(bms / 1000);
      if(bsec !== shownSec){ shownSec = bsec; writeBreakClock(bsec); }
      if(brk.running && bms <= 0) breakDone();
      return;
    }
    var ms = remaining(), sec = Math.ceil(ms / 1000);
    if(sec !== shownSec){ shownSec = sec; writeClock(sec); }
    if(ask.phase === "running" && ms <= 0) timeUp();
  }
  function startTicking(){
    if(tickHandle !== null) return;
    shownSec = null;
    tickHandle = window.setInterval(tickOnce, 100);
    tickOnce();
  }
  function stopTicking(){
    if(tickHandle !== null) window.clearInterval(tickHandle);
    tickHandle = null;
    shownSec = null;
  }

  /* The Timekeeper signals the end of the time allowed, so a sound at zero is
     faithful rather than decorative. Built from an oscillator: no asset, nothing
     to load, still one file. */
  var audio = null;
  function chime(){
    if(!chimeOn) return;
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      audio = audio || new AC();
      if(audio.state === "suspended") audio.resume();
      var t0 = audio.currentTime;
      [[880, 0], [660, 0.24]].forEach(function(p){
        var osc = audio.createOscillator(), gain = audio.createGain(), at = t0 + p[1];
        osc.type = "square";
        osc.frequency.setValueAtTime(p[0], at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.22, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.21);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(at); osc.stop(at + 0.23);
      });
    }catch(err){}                 // a venue with no audio device is not an error
  }

  /* ---- the audience scene ----
     The slide is the content, so the board's own chrome gets out of its way:
     no header, no skyline, nothing of ours over the RTC's artwork. */
  function runSceneHTML(){
    var s = curSlide();
    if(!s) return '<div class="dsp run"><div class="none">No slide</div></div>';
    var q = s.role === "question";
    var sec = Math.ceil(remaining() / 1000);
    var low = q && ask.phase === "running" && sec <= 5;
    shownSec = null;              // the markup below carries the value; start fresh
    return '<div class="dsp run">' +
      '<img class="slideimg" src="' + s.image + '" alt="">' +
      (q ? '<div class="clock' + (low ? " low" : "") + (ask.phase === "timeup" ? " done" : "") + '">' +
           '<span id="clockFace">' + fmtClock(sec) + '</span>' +
           '<em>' + (ask.phase === "running" ? "seconds left"
                   : (ask.phase === "paused" ? "paused"
                   : (ask.phase === "timeup" ? "time is up" : "seconds"))) + '</em></div>' : '') +
      (ask.phase === "timeup" ? '<div class="timeup">TIME IS UP</div>' : '') +
      '</div>';
  }

  /* ---- the operator's controls, on the display desk ---- */
  function runDeskRow(){
    if(!hasDeck()) return "";
    var s = curSlide(), n = slides().length;
    var q = isQuestionSlide();
    var where = "Slide " + (ask.slide + 1) + " of " + n + " · " + qDesc(ask.slide) +
      (q ? " · " + (s.seconds || DEFAULT_SECONDS) + "s" : "");

    var live = runLive();
    return '<div class="deskrow"><span class="lab">Deck</span>' +
      '<button class="lbtn' + (live ? " on" : " go") + '" id="btnRunEnter">' +
        (live ? "Deck is on screen" : "Put the deck on screen") + '</button>' +
      (live ? '<button class="lbtn" id="btnRunLeave">Back to the cues</button>' : '') +
      '<span class="note">' + esc(where) + '</span></div>' +
      (live
        ? '<div class="deskrow"><span class="lab">Slide</span>' +
            '<button class="lbtn" id="btnRunPrev"' + (ask.slide === 0 ? " disabled" : "") + '>◀ Previous</button>' +
            '<button class="lbtn" id="btnRunNext"' + (ask.slide >= n - 1 ? " disabled" : "") + '>Next ▶</button>' +
            '<span class="lab" style="margin-left:14px">Clock</span>' +
            '<button class="lbtn ' + (ask.phase === "running" ? "" : "go") + '" id="btnRunGo"' +
              (q ? "" : " disabled") + '>' +
              (ask.phase === "running" ? "Pause" : (ask.phase === "paused" ? "Resume" : "Start")) + '</button>' +
            '<button class="lbtn" id="btnRunTime"' +
              (ask.phase === "running" || ask.phase === "paused" ? "" : " disabled") + '>Call TIME</button>' +
            '<button class="lbtn" id="btnRunReset"' + (q ? "" : " disabled") + '>Reset</button>' +
            '<button class="lbtn' + (chimeOn ? " on" : "") + '" id="btnChime">Chime</button>' +
            '<span class="note">' +
              (ask.phase === "running" ? "The next slide is locked while the clock runs — it is the answer."
               : "Space starts and pauses the clock, ← → step the slides, Enter calls TIME, Esc leaves the deck.") +
            '</span></div>'
        : "");
  }

  /* ---- the Run tab ----
     The operator's home during the contest: the slide they are on, the clock,
     and the one column of the tally that this question needs — the same boxes
     the round grids write to, narrowed to the question on screen. */

  /* Which question the tally should show. An answer slide counts as its own
     question's, because that is when the Quizmaster reads each contestant's
     answer out and the ticking actually happens. */
  function runQuestionAt(){
    var i = ask.slide, s = slides()[i];
    if(!s) return null;
    if(s.role === "answer"){
      for(var j = i - 1; j >= 0; j--){
        var p = slides()[j];
        if(p.role === "question") return {s:p, i:j};
        if(p.role === "answer") return null;    // two answers running: ambiguous
      }
      return null;
    }
    return s.role === "question" ? {s:s, i:i} : null;
  }
  function runTallyTarget(){
    var at = runQuestionAt();
    if(!at || !at.s.round) return null;
    var q = qIndexOf(at.i);
    // the trial has no boxes, so this is where it stops short of the tally
    if(!q || q > boxesFor(at.s.round)) return null;
    return {round:at.s.round, q:q, idx:q - 1, slide:at.i};
  }
  function trialNow(){
    var at = runQuestionAt();
    return !!(at && at.s.round === "trial");
  }
  // how a slide reads in the console. The trial's one question needs no number.
  function qDesc(i){
    var s = slides()[i];
    if(!s) return "—";
    if(s.role === "answer") return "answer";
    if(s.role !== "question") return "not a question";
    return s.round === "trial" ? "Trial question"
      : (roundName(s.round || "") + " question " + qIndexOf(i));
  }

  // who is answering: everyone, the announced cut in Round 3, the tied group in
  // sudden death — the same rule the round grids follow
  function runAnswerers(round){
    if(round === "sd"){
      var out = [], p = pendingTies() || [];
      p.forEach(function(g){
        g.members.forEach(function(c){ if(out.indexOf(c) < 0) out.push(c); });
      });
      return out;
    }
    return roundList(round).slice().sort(function(a, b){ return a.no - b.no; });
  }

  function runMarkOf(c, t){
    return t.round === "sd" ? c.sd[t.idx] : !!c[t.round][t.idx];
  }
  function runToggleTick(ci){
    var t = runTallyTarget(), c = state.contestants[ci];
    if(!t || !c) return;
    if(t.round === "sd"){
      var v = c.sd[t.idx];
      var was = sigsNow();
      c.sd[t.idx] = (v === null || v === undefined) ? "c" : (v === "c" ? "w" : null);
      if(c.sd[t.idx] === "w"){
        for(var z = t.idx + 1; z < state.meta.sdCount; z++) c.sd[z] = null;
      }
      checkSdResolved(was);
    } else {
      c[t.round][t.idx] = !c[t.round][t.idx];
    }
    render();
    var el = document.querySelector('.rtick[data-rtick="' + ci + '"]');
    if(el) el.focus();
  }
  function runClearQuestion(){
    var t = runTallyTarget();
    if(!t) return;
    if(!confirm("Clear every mark for " + roundName(t.round) + " question " + t.q + "?")) return;
    runAnswerers(t.round).forEach(function(c){
      if(t.round === "sd") c.sd[t.idx] = null;
      else c[t.round][t.idx] = false;
    });
    render();
    toast("Cleared question " + t.q);
  }

  function renderRun(){
    if(!hasDeck()){
      return '<div class="panel"><div class="panel-head"><h3>Run</h3></div>' +
        '<div class="empty-state"><p>No deck loaded. This tab drives the slides and tallies ' +
        'the question on screen.</p><button class="lbtn go" data-goto="deck">Go to the deck</button>' +
        '</div></div>';
    }
    var s = curSlide(), t = runTallyTarget(), live = runLive(), n = slides().length;
    var what = qDesc(ask.slide);

    var head = '<div class="panel-head"><h3>Run</h3>' +
      '<span class="note">Slide ' + (ask.slide + 1) + ' of ' + n + ' · ' + esc(what) +
      (s && s.role === "question" ? ' · ' + (s.seconds || DEFAULT_SECONDS) + 's' : '') + '</span>' +
      '<div class="right">' +
        (live ? '<button class="lbtn" id="btnRunLeave">Back to the cues</button>'
              : '<button class="lbtn go" id="btnRunEnter">Put the deck on screen</button>') +
      '</div></div>';

    var isQ = !!(s && s.role === "question");
    var sec = live ? Math.ceil(remaining() / 1000) : Math.round(fullMs() / 1000);
    var clockCls = ask.phase === "timeup" ? " done"
      : ((sec <= 5 && ask.phase === "running") ? " low" : "");
    var stage = '<div class="runstage">' +
      '<div class="runslide">' + (s ? '<img src="' + s.image + '" alt="">' : '') + '</div>' +
      '<div class="runside">' +
        (isQ
          ? '<div class="runclock' + clockCls + '">' + fmtClock(sec) + '<em>' +
            (!live ? "not on screen"
             : (ask.phase === "running" ? "seconds left"
             : (ask.phase === "paused" ? "paused"
             : (ask.phase === "timeup" ? "time is up" : "seconds")))) + '</em></div>'
          : '<div class="runclock off">—<em>no clock</em></div>') +
        '<div class="runbtns">' +
          '<button class="lbtn" id="btnRunPrev"' + (ask.slide === 0 ? " disabled" : "") + '>◀ Previous</button>' +
          '<button class="lbtn" id="btnRunNext"' + (ask.slide >= n - 1 ? " disabled" : "") + '>Next ▶</button>' +
          '<button class="lbtn ' + (ask.phase === "running" ? "" : "go") + '" id="btnRunGo"' +
            (isQ && live ? "" : " disabled") + '>' +
            (ask.phase === "running" ? "Pause" : (ask.phase === "paused" ? "Resume" : "Start clock")) + '</button>' +
          '<button class="lbtn" id="btnRunTime"' +
            (ask.phase === "running" || ask.phase === "paused" ? "" : " disabled") + '>Call TIME</button>' +
          '<button class="lbtn" id="btnRunReset"' + (isQ ? "" : " disabled") + '>Reset</button>' +
        '</div>' +
      '</div></div>';

    // the questions of this round, as a strip you can jump about in
    var strip = "";
    if(t){
      var total = qSlides(t.round).length, who0 = runAnswerers(t.round), dots = [];
      for(var k = 1; k <= total; k++){
        var idx = k - 1;
        var anyMark = who0.some(function(c){
          return t.round === "sd" ? c.sd[idx] : c[t.round][idx];
        });
        dots.push('<button class="qdot' + (k === t.q ? " on" : "") + (anyMark ? " done" : "") +
          '" data-rjump="' + k + '">' + k + '</button>');
      }
      strip = '<div class="qstrip"><span class="lab">' + esc(roundName(t.round)) + '</span>' +
        dots.join("") + '<span class="note">Jump to any question of this round.</span></div>';
    }

    var tally;
    if(!t){
      tally = '<div class="empty-state"><p>' + (trialNow()
        ? 'The trial question is not scored. It is given before Round 1 so everyone can practise ' +
          'answering — the clock runs as usual, and nothing here reaches the tally sheet.'
        : 'This slide is not a question, so there is nothing to tally. ' +
          'Step to a question slide, or tag this one on the Deck tab.') + '</p></div>';
    } else {
      var who = runAnswerers(t.round);
      if(!who.length){
        tally = '<div class="empty-state"><p>' + (t.round === "sd"
          ? "No tie-break is open, so nobody is answering these."
          : "No contestants on the roster yet.") + '</p></div>';
      } else {
        var ticked = who.filter(function(c){ return runMarkOf(c, t); }).length;
        var rows = who.map(function(c){
          var v = runMarkOf(c, t), ci = state.contestants.indexOf(c);
          var cls = t.round === "sd" ? (v === "c" ? " on" : (v === "w" ? " wrong" : ""))
                                     : (v ? " on" : "");
          var mark = t.round === "sd" ? (v === "c" ? "✓" : (v === "w" ? "✗" : ""))
                                      : (v ? "✓" : "");
          return '<tr><td class="no pad">' + c.no + '</td>' +
            '<td class="nm pad">' + esc(c.name) + '</td>' +
            '<td class="sch pad">' + esc(c.school || "—") + '</td>' +
            '<td class="q"><button class="rtick' + cls + '" data-rtick="' + ci +
              '" aria-pressed="' + (cls ? "true" : "false") +
              '" aria-label="' + esc(c.name) + '">' + mark + '</button></td></tr>';
        }).join("");
        tally = '<div class="panel-head tallyhead">' +
          '<h3>' + esc(roundName(t.round)) + ' · question ' + t.q + '</h3>' +
          '<span class="note">' + ticked + ' of ' + who.length + ' marked' +
          (t.round === "sd" ? " · click once for correct, twice for wrong" : " correct") + '</span>' +
          '<div class="right"><button class="lbtn danger" id="btnRunClearQ">Clear this question</button>' +
          '</div></div>' +
          '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>Name</th><th>School</th>' +
          '<th class="c">Correct</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      }
    }

    return '<div class="panel">' + head + stage +
      '<div class="desk" style="padding:0 15px 4px">' + progRow() + breakRow() + '</div>' + strip + tally +
      '<div class="legend">These are the same boxes the round tabs hold — this is one column of them, ' +
      'for the question on screen. An answer slide tallies its own question, which is when the Quizmaster ' +
      'reads the answers out. While a tally button has focus the arrows and space belong to the tally, ' +
      'not to the deck.</div></div>';
  }

  /* ---- the health break ----
     Between rounds the contest stops and the audience needs telling for how long.
     It is a clock like any other here: a deadline, not a countdown that ticks
     down, sharing the same one-write-a-second live region as the question clock.

     It sits above everything on screen — above the deck, above the cues — because
     a break interrupts whatever was showing. And starting one pauses a running
     question clock, which is the part that would otherwise go wrong quietly: a
     fifteen-second question does not survive a ten-minute break running underneath
     it. */

  var brk = {on:false, running:false, endsAt:null, remain:0, minutes:10};
  var BREAK_MINUTES = [5, 10, 15, 20, 30];

  function brkRemaining(){
    if(brk.running) return Math.max(0, brk.endsAt - Date.now());
    return brk.remain;
  }
  function fmtMS(sec){
    var m = Math.floor(Math.max(0, sec) / 60), r = Math.max(0, sec) % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  function hhmm(d){
    var p = function(n){ return (n < 10 ? "0" : "") + n; };
    return p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function startBreak(mins){
    if(mins) brk.minutes = mins;
    var m = Math.max(1, Math.min(180, Math.round(brk.minutes || 10)));
    brk.minutes = m;
    // a question clock must not run on underneath the break
    if(ask.phase === "running") runPause();
    brk.on = true;
    brk.remain = m * 60000;
    brk.endsAt = Date.now() + brk.remain;
    brk.running = true;
    render();
    startTicking();
    toast("Health break — " + m + " minute" + (m === 1 ? "" : "s"));
  }
  function pauseBreak(){
    if(!brk.on || !brk.running) return;
    brk.remain = brkRemaining();
    brk.endsAt = null;
    brk.running = false;
    stopTicking();
    render();
  }
  function resumeBreak(){
    if(!brk.on || brk.running) return;
    brk.endsAt = Date.now() + Math.max(0, brk.remain);
    brk.running = true;
    render();
    startTicking();
  }
  function toggleBreak(){ if(brk.running) pauseBreak(); else resumeBreak(); }
  function addBreakTime(mins){
    if(!brk.on) return;
    var add = mins * 60000;
    if(brk.running) brk.endsAt = Math.max(Date.now(), brk.endsAt || Date.now()) + add;
    else brk.remain = Math.max(0, brk.remain) + add;
    render();
    toast((mins > 0 ? "Added " : "Took off ") + Math.abs(mins) + " minute" +
          (Math.abs(mins) === 1 ? "" : "s"));
  }
  function endBreak(){
    if(!brk.on) return;
    brk.on = false; brk.running = false; brk.endsAt = null; brk.remain = 0;
    stopTicking();
    render();
    toast("Break over — back to the screen you left");
  }
  // the time ran out; the operator still decides when to resume
  function breakDone(){
    brk.running = false; brk.remain = 0; brk.endsAt = null;
    stopTicking();
    render();
    chime();
  }

  function writeBreakClock(sec){
    var text = fmtMS(sec), soon = brk.running && sec <= 30;
    clockNodes().forEach(function(el){
      el.textContent = text;
      var box = el.parentNode;
      if(box && box.classList) box.classList.toggle("soon", soon);
    });
  }

  function breakSceneHTML(){
    var sec = Math.ceil(brkRemaining() / 1000);
    var over = sec <= 0;
    shownSec = null;                     // the markup carries the value; start fresh
    var sub = over ? "We resume in a moment"
      : (brk.running ? "We resume at " + hhmm(new Date(brk.endsAt)) : "Paused");
    return '<div class="dsp">' + dspHead("Health break") +
      '<div class="body"><div class="brk' + (over ? " over" : "") + '">' +
      '<div class="kick">Health break</div>' +
      '<div class="bclock"><span id="clockFace">' + fmtMS(sec) + '</span></div>' +
      '<div class="bsub">' + esc(sub) + '</div>' +
      '</div></div></div>';
  }

  /* The same controls on the Display desk and on the Run tab, because the
     operator may be on either when the Quizmaster calls the break. */
  function breakRow(){
    if(!brk.on){
      return '<div class="deskrow"><span class="lab">Health break</span>' +
        BREAK_MINUTES.map(function(m){
          return '<button class="lbtn' + (brk.minutes === m ? " on" : "") +
            '" data-brkmin="' + m + '">' + m + '</button>';
        }).join("") +
        '<input class="bmin" id="brkMin" type="number" min="1" max="180" step="1" value="' +
          esc(String(brk.minutes)) + '" aria-label="Minutes for the health break"><span class="unit">min</span>' +
        '<button class="lbtn go" id="btnBreakStart">Start the break</button>' +
        '<span class="note">Takes the screen while it runs, and pauses a question clock if one is going.</span>' +
        '</div>';
    }
    var sec = Math.ceil(brkRemaining() / 1000);
    return '<div class="deskrow"><span class="lab">Health break</span>' +
      '<b class="brkleft' + (sec <= 30 && brk.running ? " soon" : "") + '">' + fmtMS(sec) + '</b>' +
      '<button class="lbtn ' + (brk.running ? "" : "go") + '" id="btnBreakToggle">' +
        (brk.running ? "Pause" : "Resume") + '</button>' +
      '<button class="lbtn" data-brkadd="1">+1 min</button>' +
      '<button class="lbtn" data-brkadd="5">+5 min</button>' +
      '<button class="lbtn danger" id="btnBreakEnd">End the break</button>' +
      '<span class="note">' + (sec <= 0
        ? "The time is up — end the break when the Quizmaster is ready."
        : "The screen goes back to whatever it was showing when you end it.") + '</span></div>';
  }
