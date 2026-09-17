"use strict";
  /* ===================== audience screen markup ===================== */
  var justRevealed = false;

  function dspHead(extra){
    var s = standings();
    return '<div class="head"><div><div class="ttl">'+esc(state.meta.edition)+'</div>'+
      '<div class="whr">'+esc([state.meta.level, state.meta.place].filter(Boolean).join(" · "))+'</div></div>'+
      '<div class="now">'+esc(extra || s.stage.label)+'</div></div>';
  }

  // running total a round is judged on: R1 alone, R1&2, then all three
  function runTotal(c,k){ return k==="r1" ? rt(c,"r1") : (k==="r2" ? cum12(c) : grand(c)); }
  // the figure the audience screen leads with, per the Score shown filter
  function shownVal(c,k){ return disp.val==="round" ? rt(c,k) : runTotal(c,k); }
  function valLabel(k){
    return disp.val==="round" ? (k==="r1" ? "Round 1 score" : "this round only") : "running total";
  }
  function orderFor(k, list){
    var out = list.slice();
    if(sortBy!=="score") return out.sort(function(a,b){ return a.no-b.no; });
    return out.sort(function(a,b){
      var d = shownVal(b,k)-shownVal(a,k);
      if(d!==0) return d;
      d = rt(b,k)-rt(a,k);            // better in this round breaks a level total
      return d!==0 ? d : a.no-b.no;
    });
  }
  // val defaults to the round's running total; the display passes the filtered figure
  function posMap(k, list, val){
    var f = val || function(c){ return runTotal(c,k); };
    var sc = list.map(f).slice().sort(function(a,b){ return b-a; });
    var m = new Map();
    list.forEach(function(c){ m.set(c, sc.indexOf(f(c))+1); });
    return m;
  }

  // the mechanics cue pages one screen at a time; portraits and score tiles
  // page at their own counts, since a portrait needs far more room than a score
  // the mechanics and the introduction are both already built one screen to an
  // entry, so they page one at a time; Portraits per page shapes the
  // introduction when its screens are built, not when they are turned
  function per(){
    if(disp.cue==="mechanics" || disp.cue==="introduce" || disp.cue==="judges") return 1;
    return perPage;
  }

  function pageOf(list){
    var n = per();
    var pages = Math.max(1, Math.ceil(list.length/n));
    if(disp.page > pages-1) disp.page = pages-1;
    if(disp.page < 0) disp.page = 0;
    var start = disp.page*n;
    return {slice:list.slice(start, start+n), pages:pages, start:start, total:list.length};
  }
  function pagerHTML(pg, label){
    if(pg.pages<2) return "";
    return '<div class="pager">'+
      '<button class="pg prev" data-pg="-1"'+(disp.page===0?" disabled":"")+
        ' aria-label="Previous page"><i class="tri"></i></button>'+
      '<span class="pgl">'+(label || ((pg.start+1)+'\u2013'+(pg.start+pg.slice.length)+
        ' of '+pg.total+'  \u00b7  page '+(disp.page+1)+'/'+pg.pages))+'</span>'+
      '<button class="pg next" data-pg="1"'+(disp.page>=pg.pages-1?" disabled":"")+
        ' aria-label="Next page"><i class="tri"></i></button></div>';
  }
  // who a round is played by: everyone, until the cut takes the eliminated off Round 3
  function roundList(k){ return (k==="r3" && isCut()) ? qualifiers() : named(); }

  function pagedList(){
    var s2 = standings();
    if(disp.cue==="mechanics") return mechPages();
    if(disp.cue==="introduce") return introScreens();
    if(disp.cue==="judges") return namedJudges();
    if(disp.cue==="round") return roundList(disp.round);
    if(disp.cue==="advancing") return hasMarks("r2") ? qualifiers() : [];
    if(disp.cue==="leaderboard") return s2.rows;
    return null;
  }

  /* ---- contest mechanics, screen by screen ----------------------------------
     Text follows the 30th PSQ Provincial Elimination Contest Mechanics, section
     by section. Every number comes from the scoring constants above, so the
     screen the audience reads cannot disagree with what the app scores. */
  function mCard(title, items){
    return '<div class="mrl"><b>'+title+'</b><ul>'+
      items.map(function(t){ return '<li>'+t+'</li>'; }).join("")+'</ul></div>';
  }
  function mechPages(){
    var maxTotal = QN*PTS.r1 + QN*PTS.r2 + QN*PTS.r3;
    var rds = ["r1","r2","r3"].map(function(k){
      return '<div class="mrd"><b>'+LABEL[k]+'</b>'+
        '<span>'+QN+' questions</span>'+
        '<span>'+PTS[k]+' point'+(PTS[k]===1?"":"s")+' per correct answer</span>'+
        '<div class="max">'+(QN*PTS[k])+'<em>maximum</em></div></div>';
    }).join("");

    return [
      {t:"How the contest runs", s:"Composition", html:
        '<div class="mlead">Held simultaneously in the five provinces of MIMAROPA on '+
          esc(state.meta.date)+'.</div>'+
        mCard("The rounds", [
          "Three rounds — Round 1, Round 2 and Round 3.",
          "Each round is "+QN+" multiple-choice questions with four choices, A to D. The correct answer is the best answer among them.",
          "The questions are set by the 30th PSQ Regional Technical Committee.",
          "A trial question is given before Round 1 starts."
        ])+
        mCard("The officials", [
          "A Board of Judges, appointed by the provincial OIC or Chief Statistical Specialist, oversees the contest and resolves every issue that arises.",
          "The OIC or CSS also appoints the Quizmaster, the Official Examiners, the Proctors and the Timekeeper."
        ])},

      {t:"Answering a question", s:"Question administration", html:
        mCard("Reading the question", [
          "The Quizmaster reads each question, its four choices and its time limit twice, while the question is shown on screen.",
          "If a question refers to a graph, a statistical table or a chart, the proctors hand out a hard copy face down. Contestants may look at it only once the Quizmaster starts reading."
        ])+
        mCard("Giving the answer", [
          "Contestants answer on sheets of paper, or on flashcards printed A, B, C and D.",
          "The Timekeeper signals the end of the time allowed and the Quizmaster calls TIME IS UP. Answers are raised at once, or handed to the proctors.",
          "The correct answer is announced and shown on screen. Each contestant's answer is then read out and tallied."
        ])+
        mCard("After each round", [
          "The Official Examiners tally the scores at the end of every round, and the Quizmaster reads out each contestant's score.",
          "At the end of the quiz the Board of Judges fills out and signs PSQ Form 1, the tally sheet."
        ])},

      {t:"Scoring", s:"Points per round", html:
        '<div class="mrds">'+rds+'</div>'+
        mCard("How points are earned", [
          "A correct answer in Round 1 or Round 2 earns "+PTS.r1+" point. A correct answer in Round 3 earns "+PTS.r3+" points.",
          "A wrong answer, or no answer, scores 0.",
          maxTotal+" points are in play across the three rounds."
        ])},

      {t:"Advancing to Round 3", s:"Who moves on", html:
        mCard("From Round 1 to Round 2", [
          "Every contestant who takes Round 1 moves on to Round 2. Nobody is cut at this point."
        ])+
        mCard("From Round 2 to Round 3", [
          "At the end of Round 2 the Round 1 and Round 2 scores are added together.",
          "Everyone with a cumulative score of at least "+ADV+" points advances — however many contestants that is.",
          "If fewer than five reach "+ADV+" points, the top five advance instead, whatever their scores.",
          "If contestants are tied at the fifth place, all of them advance."
        ])},

      {t:"Declaration of winners", s:"Placing and tie-breaks", html:
        mCard("The top three", [
          "The cumulative score across all three rounds decides the placings. The highest is the 30th PSQ Provincial Champion; the next two are the 2nd and 3rd placers.",
          "The three winners represent "+esc(state.meta.place)+" at the Regional Championship."
        ])+
        '<div class="mrl"><b>If the top three are tied</b><ol class="mord">'+
          '<li>Round 1 scores break the tie first.</li>'+
          '<li>If a tie remains, Round 2 scores are used.</li>'+
          '<li>If a tie still remains, '+state.meta.sdCount+' tie-breaking questions are put to the tied contestants at the same time, under the sudden-death rule — a wrong answer eliminates that contestant immediately.</li>'+
          '<li>The Board of Judges determines how to proceed if a tie survives all of that.</li>'+
        '</ol></div>'},

      {t:"Clarifications and reminders", s:"Who may ask, and when", html:
        mCard("Raising a question", [
          "Only contestants and their registered coaches may ask questions about the proceedings, the questions, the answers or the scores.",
          "Only the Board of Judges answers — or the PSQ Technical Committee, when the Board asks it to. The Board's decision is final.",
          "No clarification about these mechanics is entertained once Round 1 has begun."
        ])+
        mCard("Questioning a contest question", [
          "A question may be queried only after the Quizmaster has announced its correct answer, and never once the next question has been started.",
          "Issues about a round's questions are settled before the next round begins; Round 3 issues are settled before the winners are declared.",
          "If the Board nullifies a question, the Technical Committee supplies a replacement, asked after the last question of that round."
        ])+
        mCard("Reminder", [
          "Personal calculators may be used, provided a PSO Technical Committee representative has checked them."
        ])}
    ];
  }

  /* The introduction's heading: the school's logo if it has one, its name a size
     up from the other cues, and the line saying what this screen is. The sub-line
     sits under the name rather than after it, so a long name and a logo both fit. */
  function schoolHead(school, sub){
    var logo = logoFor(school);
    return '<div class="sect schead">'+
      (logo ? '<img class="slogo" src="'+logo+'" alt="">' : '')+
      '<div class="stxt"><div class="sname">'+esc(school || "No school given")+'</div>'+
      '<div class="ssub">'+sub+'</div></div></div>';
  }

  /* An organisation on a card: its logo, if one has been added, then its name.
     The mark is small and sharp beside the text, where the crest behind the
     portrait is large and washed back — and a photograph hides that crest, so
     this is the one that always shows. */
  function orgLine(org){
    if(!org) return "";
    var logo = logoFor(org);
    return '<div class="orgline">'+
      (logo ? '<img class="orgmark" src="'+logo+'" alt="">' : '')+
      '<span>'+esc(org)+'</span></div>';
  }

  function sceneHTML(){
    // one rule: while the deck is on screen it owns the display, and every cue
    // below carries on working untouched for when it is not
    if(brk.on) return breakSceneHTML();
    if(runLive()) return runSceneHTML();

    var s = standings(), list = named();

    if(disp.cue==="blank") return '<div class="dsp"></div>';

    if(disp.cue==="standby"){
      return '<div class="dsp"><div class="body"><div class="hero">'+
        '<div class="logo"></div>'+
        '<div class="kick">The Search for the Country\u2019s Young Statistics Whizzes!</div>'+
        '<h1>'+esc(state.meta.edition)+'</h1>'+
        '<div class="sub">'+esc([state.meta.level, state.meta.place].filter(Boolean).join(" · "))+'</div>'+
        '<div class="std">'+esc(state.meta.date)+'</div>'+
        '<div class="opt"><button class="sbtn" data-scene="mechanics">View the contest mechanics</button>'+
        '<span class="opthint">The rounds, the scoring, who advances, and how the winners are declared</span></div>'+
        '</div></div></div>';
    }

    if(disp.cue==="mechanics"){
      var mp = pageOf(mechPages());
      var page = mp.slice[0];
      if(!page) return '<div class="dsp">'+dspHead("Contest mechanics")+'<div class="body"></div></div>';
      return '<div class="dsp">'+dspHead("Contest mechanics")+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
        '<div class="sect">'+page.t+'<small>'+page.s+'</small></div>'+
        page.html+
        '<div class="mfoot">'+
          '<button class="sbtn" data-scene="standby">Back to the title card</button>'+
          pagerHTML(mp, 'Screen '+(disp.page+1)+' of '+mp.pages)+
        '</div></div></div>';
    }

    /* Introducing the contestants: a school's own contestants, then the coach
       who brought them, then on to the next school in alphabetical order. The
       heading carries the school, so the cards do not repeat it. */
    if(disp.cue==="introduce"){
      var screens = introScreens();
      if(!screens.length) return '<div class="dsp">'+dspHead("Contestants and coaches")+
        '<div class="body"><div class="none">No contestants yet</div></div></div>';
      var pgi = pageOf(screens), sc = pgi.slice[0];
      var body, sub;
      if(sc.kind==="coach"){
        sub = "their coach";
        body = '<div class="intro solo" style="grid-template-columns:repeat(1,minmax(0,1fr))">'+
          '<div class="icard">'+portrait(sc.coach)+
          '<div class="itxt"><div class="num">Coach</div>'+
          '<div class="who">'+esc(sc.coach.name)+'</div></div></div></div>';
      } else {
        var n = sc.students.length;
        // one row: the screen is wide and short, so tall narrow cards suit portraits
        sub = sc.of > n
          ? (n===1 ? ('contestant '+(sc.from+1)+' of '+sc.of)
                   : ('contestants '+(sc.from+1)+'\u2013'+(sc.from+n)+' of '+sc.of))
          : (n+' contestant'+(n===1?"":"s"));
        // Tracks are the card's own width rather than a share of the screen, so a
        // screen of two tiles carries the same tiles as a screen of four, and
        // justify-content centres the row instead of pushing them to the edges.
        // A lone contestant keeps the full-width track the solo card centres in.
        var cols = n===1 ? 'minmax(0,1fr)'
                         : 'repeat('+n+',minmax(0,var(--cardw)))';
        body = '<div class="intro'+(n===1?" solo":"")+'" style="grid-template-columns:'+cols+'">'+
          sc.students.map(function(c){
            return '<div class="icard">'+portrait(c)+
              '<div class="itxt"><div class="num">No. '+c.no+'</div>'+
              '<div class="who">'+esc(c.name)+'</div></div></div>';
          }).join("")+'</div>';
      }
      return '<div class="dsp">'+dspHead("Contestants and coaches")+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
        schoolHead(sc.school, sub)+
        body+pagerHTML(pgi, 'Screen '+(disp.page+1)+' of '+pgi.pages)+'</div></div>';
    }

    /* The Board of Judges, one to a screen — the same card the coach gets, so
       the two introductions read as one piece of the ceremony. */
    if(disp.cue==="judges"){
      var jl = namedJudges();
      if(!jl.length) return '<div class="dsp">'+dspHead("Board of Judges")+
        '<div class="body"><div class="none">No judges encoded yet</div></div></div>';
      var pgj = pageOf(jl), jg = pgj.slice[0];
      return '<div class="dsp">'+dspHead("Board of Judges")+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
        '<div class="sect">Board of Judges'+
        (pgj.pages>1 ? '<small>'+(disp.page+1)+' of '+pgj.pages+'</small>' : '')+'</div>'+
        '<div class="intro solo" style="grid-template-columns:repeat(1,minmax(0,1fr))">'+
        '<div class="icard">'+portrait(jg)+
        '<div class="itxt"><div class="num">'+esc(jg.role || "Member")+'</div>'+
        '<div class="who">'+esc(jg.name)+'</div>'+
        (jg.office ? '<div class="sch">'+esc(jg.office)+'</div>' : '')+
        orgLine(jg.org)+
        '</div></div></div>'+
        pagerHTML(pgj, 'Judge '+(disp.page+1)+' of '+pgj.pages)+'</div></div>';
    }

    if(disp.cue==="round"){
      var k = disp.round;
      var qual = qualifiers();
      var rlist = roundList(k);
      var byScore = sortBy==="score";
      var pos = byScore ? posMap(k, rlist, function(c){ return shownVal(c,k); }) : null;
      var pg = pageOf(orderFor(k, rlist));
      var body = rlist.length ? '<div class="grid" data-total="'+pg.total+'">'+pg.slice.map(function(c){
        var advancing = qual.indexOf(c)>=0;
        var inR3 = k!=="r3" || advancing;
        var outNow = k==="r2" && isCut() && !advancing;   // announced as eliminated
        var rank = byScore ? pos.get(c) : 0;
        var em;
        if(!inR3) em = "not in round 3";
        else if(outNow) em = "not advancing";
        else if(k==="r1") em = "Round 1";
        else em = disp.val==="round" ? ("running total "+runTotal(c,k)) : ("this round "+rt(c,k));
        return '<div class="line'+((inR3 && !outNow)?"":" dead")+(outNow?" gone":"")+
            (k==="r2" && isCut() && advancing ? " qual" : "")+
            (rank && rank<=3 && !outNow ? " r"+rank : "")+'">'+
          '<div class="ix">'+(byScore ? rank : c.no)+'</div>'+
          '<div class="who"><b>'+esc(c.name)+'</b><span>'+
            (byScore ? "No. "+c.no+" \u00b7 " : "")+esc(c.school||"")+'</span></div>'+
          '<div class="val">'+shownVal(c,k)+'<em>'+em+'</em></div></div>';
      }).join("")+'</div>'+pagerHTML(pg) : '<div class="none">No contestants yet</div>';
      var sub = sortBy==="score"
        ? "in order of "+valLabel(k)
        : (disp.val==="round"
            ? PTS[k]+" point"+(PTS[k]===1?"":"s")+" per correct answer"
            : "running total after "+(k==="r1"?"Round 1":(k==="r2"?"Rounds 1 & 2":"all three rounds")));
      if(k==="r2" && isCut()) sub += " · "+qual.length+" advancing to Round 3";
      if(k==="r3" && isCut()) sub += " · only the "+rlist.length+" advancing are listed";
      return '<div class="dsp">'+dspHead(LABEL[k]+" · "+valLabel(k))+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
        '<div class="sect">'+LABEL[k]+'<small>'+sub+'</small></div>'+
        body+'</div></div>';
    }

    if(disp.cue==="advancing"){
      var q = qualifiers();
      var qs = q.slice().sort(function(a,b){ return cum12(b)-cum12(a) || a.no-b.no; });
      var pgq = pageOf(qs);
      var body = (hasMarks("r2") && q.length) ? '<div class="grid" data-total="'+pgq.total+'">'+
        pgq.slice.map(function(c,i){
        return '<div class="line qual"><div class="ix">'+(pgq.start+i+1)+'</div>'+
          '<div class="who"><b>'+esc(c.name)+'</b><span>'+esc(c.school||"")+'</span></div>'+
          '<div class="val">'+cum12(c)+'<em>rounds 1 &amp; 2</em></div></div>';
      }).join("")+'</div>'+pagerHTML(pgq) : '<div class="none">Round 2 has not been tallied yet</div>';
      return '<div class="dsp">'+dspHead("Advancing to Round 3")+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
        '<div class="sect">Advancing to Round 3<small>'+q.length+' contestants</small></div>'+
        body+'</div></div>';
    }

    if(disp.cue==="leaderboard"){
      var pgl = pageOf(s.rows);
      var body = s.rows.length ? '<div class="grid" data-total="'+pgl.total+'">'+pgl.slice.map(function(c){
        var p = s.place.get(c);
        return '<div class="line'+(p<=3?" r"+p:"")+'"><div class="ix">'+p+'</div>'+
          '<div class="who"><b>'+esc(c.name)+'</b><span>'+esc(c.school||"")+'</span></div>'+
          '<div class="val">'+s.stage.fn(c)+'</div></div>';
      }).join("")+'</div>'+pagerHTML(pgl) : '<div class="none">No scores yet</div>';
      return '<div class="dsp">'+dspHead()+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
        '<div class="sect">Standings<small>'+s.stage.label+'</small></div>'+body+'</div></div>';
    }

    if(disp.cue==="tiebreak"){
      var u = unresolved();
      if(!u) return '<div class="dsp">'+dspHead("Tie-break")+
        '<div class="body"><div class="none">No tie to break</div></div></div>';
      var blocks = u.map(function(g){
        var rows = g.members.map(function(c){
          var st = sdStreak(c), mk="";
          for(var i=0;i<state.meta.sdCount;i++){
            var v=c.sd[i];
            mk += '<div class="mk'+(v==="c"?" c":(v==="w"?" w":""))+'">'+(v==="c"?"✓":(v==="w"?"✗":""))+'</div>';
          }
          return '<div class="sdrow"><div class="who"><b style="font-size:calc(var(--u)*2.4)">'+esc(c.name)+
            '</b><span style="display:block;font-size:calc(var(--u)*1.5);color:var(--d-dim)">'+esc(c.school||"")+'</span></div>'+
            '<div class="marks">'+mk+'</div>'+
            '<div class="stat '+(st.alive?"in":"out")+'">'+(st.alive?"still in":"eliminated")+'</div></div>';
        }).join("");
        var sd = sdState(g);
        var note = grand(g.members[0])+' points each';
        if(sd.decided) note = esc(sd.alive[0].name)+' takes place '+g.place;
        else if(sd.stuck) note = 'referred to the Board of Judges';
        return '<div class="sect">Tie for place '+g.place+'<small>'+note+'</small></div>'+rows;
      }).join("");
      return '<div class="dsp">'+dspHead("Sudden death")+
        '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+blocks+'</div></div>';
    }

    // the champion is deliberately not here — that card stands on its own
    if(disp.cue==="reveal"){
      var names = ["2nd placer","3rd placer"];
      var order = [1,0];     // reveal the 3rd placer first, then the 2nd
      var cards = [0,1].map(function(i){
        var shown = order.indexOf(i) < disp.reveal;
        var c = s.rows[i+1];                      // rows[0] is the champion
        if(!shown || !c){
          return '<div class="card c'+(i+2)+' hidden"><div class="pl">'+names[i]+'</div>'+
            '<div class="who">?</div></div>';
        }
        var isNew = justRevealed && order[disp.reveal-1]===i;
        return '<div class="card c'+(i+2)+(isNew?" pop":"")+'"><div class="pl">'+names[i]+'</div>'+
          portrait(c)+
          '<div class="who">'+esc(c.name)+'</div><div class="sch">'+esc(c.school||"")+'</div>'+
          '<div class="pts">'+s.stage.fn(c)+'<em>points</em></div></div>';
      }).join("");
      return '<div class="dsp">'+dspHead("Declaration of winners")+
        '<div class="body"><div class="rev two">'+cards+'</div></div>'+
        '<div class="foot"><span>'+(disp.reveal>=2
          ? 'And now the '+esc(state.meta.place)+' Provincial Champion.'
          : 'The three winners represent '+esc(state.meta.place)+' at the Regional Championship.')+
        '</span></div></div>';
    }

    if(disp.cue==="champion"){
      var c1 = s.rows[0];
      if(!c1) return '<div class="dsp">'+dspHead()+'<div class="body"><div class="none">No scores yet</div></div></div>';
      return '<div class="dsp">'+dspHead("Provincial Champion")+
        '<div class="body"><div class="champ'+(justRevealed?" pop":"")+'">'+
        '<div class="pl">'+esc(state.meta.place)+' Provincial Champion</div>'+
        portrait(c1,"big")+
        '<div class="who">'+esc(c1.name)+'</div>'+
        '<div class="sch">'+esc(c1.school||"")+'</div>'+
        '<div class="pts">'+s.stage.fn(c1)+' points</div></div></div></div>';
    }
    return '<div class="dsp"></div>';
  }

  // size the audience screen to its own container, not the browser viewport
  function fit(host){
    if(!host) return;
    var dsp = host.querySelector(".dsp");
    if(!dsp) return;
    var w = host.clientWidth, h = host.clientHeight;
    if(!w || !h) return;
    dsp.style.setProperty("--u", (Math.min(w, h*1.35)/100)+"px");

    var grid = dsp.querySelector(".grid");
    if(!grid) return;
    var n = grid.children.length;
    if(!n) return;
    var cols = disp.cols || ((w < h*0.95 || n<=3) ? 1 : 2);
    if(cols>1 && (w < h*0.95)) cols = 1;

    var body = dsp.querySelector(".body");
    var pager = dsp.querySelector(".pager");
    var gap = Math.max(5, Math.min(w,h)*0.009);
    // measure from the grid's actual top edge so headings, padding and margins are all accounted for
    var bRect = body.getBoundingClientRect(), gRect = grid.getBoundingClientRect();
    var reserve = pager ? pager.getBoundingClientRect().height + gap*2 : 0;
    var avail = bRect.bottom - gRect.top - reserve;

    // rows come from the page size, not this page's count, so tiles stay the same
    // height on a short final page
    var rows = Math.ceil(perPage/cols);
    var rh = (avail - gap*(rows-1)) / rows;
    rh = Math.max(34, Math.min(rh, Math.min(w,h)*0.17));

    // fill top-to-bottom down each column so the numbers read 1,2,3,4 in order
    grid.style.gridTemplateColumns = "repeat("+cols+",minmax(0,1fr))";
    grid.style.gridTemplateRows = "repeat("+rows+", "+rh+"px)";
    grid.style.gridAutoFlow = "column";
    grid.style.gridAutoRows = rh+"px";
    grid.style.rowGap = gap+"px";
    grid.style.setProperty("--rh", rh+"px");
  }

  // the audience window is a separate document, so its buttons are wired by hand
  function wireScene(root){
    // in the preview the scene lives in this document, where the delegated
    // [data-pg] handler already catches the pager — wiring it again here would
    // turn two pages on one click
    var own = root.ownerDocument === document;
    var bs = own ? [] : root.querySelectorAll(".pager .pg");
    Array.prototype.forEach.call(bs, function(b){
      b.onclick = function(){ turnPage(+b.dataset.pg); };
    });
    var sc = root.querySelectorAll("[data-scene]");
    Array.prototype.forEach.call(sc, function(b){
      b.onclick = function(){ setCue(b.dataset.scene); toast("On screen: "+cueName(b.dataset.scene)); };
    });
  }
  function turnPage(d){
    var l = pagedList();
    if(!l) return;
    var pages = Math.max(1, Math.ceil(l.length/per()));
    disp.page = Math.max(0, Math.min(pages-1, disp.page + d));
    render();
  }

  function paintDisplay(){
    var html = sceneHTML();
    if(winRef && !winRef.closed){
      var r = winRef.document.getElementById("root");
      if(r){ r.innerHTML = html; fit(r); wireScene(r); }
    }
    var pv = $("preview");
    if(pv.classList.contains("show")){
      var pr = $("previewRoot");
      pr.innerHTML = html; fit(pr); wireScene(pr);
    }
    justRevealed = false;
  }

  function openDisplay(){
    winRef = window.open("", "psqDisplay", "width=1280,height=720");
    if(!winRef){ popFlag = true; toast("Pop-up blocked — allow pop-ups for this page, then try again"); render(); return; }
    // works both ways: linked stylesheets while developing, inlined ones in the built file
    var links = "", css = "";
    ["baseStyle","dspStyle"].forEach(function(id){
      var el = $(id);
      if(!el) return;
      if(el.tagName === "STYLE") css += el.textContent + "\n";
      else links += '<link rel="stylesheet" href="'+el.href+'">';
    });
    winRef.document.open();
    winRef.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'+
      '<title>PSQ — audience screen</title>'+links+
      '<style>html,body{margin:0;height:100%;overflow:hidden;'+
      'background:#5D94FB}#root{height:100%}'+css+'</style></head><body><div id="root"></div></body></html>');
    winRef.document.close();
    try{ winRef.addEventListener("resize", function(){ paintDisplay(); }); }catch(err){}
    paintDisplay();
    toast("Display opened — drag it to the second screen, then press F11 there");
    setTimeout(render, 60);
  }

