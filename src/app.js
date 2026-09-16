(function(){
  "use strict";

  var QN = 10;
  var PTS = {r1:1, r2:1, r3:2};
  var ADV = 8;   // Rounds 1&2 cumulative that qualifies for Round 3 — Section C.3
  var LABEL = {r1:"Round 1", r2:"Round 2", r3:"Round 3"};

  function blankC(no){
    return {no:no, name:"", school:"", photo:null, coachId:null,
            r1:new Array(QN).fill(false),
            r2:new Array(QN).fill(false),
            r3:new Array(QN).fill(false),
            sd:new Array(5).fill(null)};
  }

  var state = {
    meta:{edition:"30th Philippine Statistics Quiz",
          level:"Provincial Elimination",
          place:"Marinduque",
          date:"24 September 2026",
          sdCount:5},
    cut:null,          // once the Round 3 cut is announced, the frozen list of contestant numbers
    sdAck:[],          // tie-breaks the operator has seen resolved and cleared away
    coaches:[],        // {id, name, school, photo} — one entry per registered coach
    schools:[],        // {name, logo} — only the schools a logo has been added for
    contestants:[]
  };
  for(var i=1;i<=22;i++) state.contestants.push(blankC(i));

  var tab = "roster";
  // val: "total" = running total across the rounds, "round" = this round's score alone
  var disp = {cue:"standby", round:"r1", reveal:0, page:0, cols:0, val:"total"};
  var sortBy = "no";   // "no" = contestant number, "score" = running total
  var perPage = 8;
  var introPer = 6;    // portraits per page on the Introduce contestants screen
  var winRef = null, popFlag = false;

  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(m){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m];}); }

  /* ===================== scoring ===================== */
  function named(){ return state.contestants.filter(function(c){ return c.name.trim()!==""; }); }
  function rt(c,k){ var n=0; for(var i=0;i<QN;i++){ if(c[k][i]) n++; } return n*PTS[k]; }
  function cum12(c){ return rt(c,"r1")+rt(c,"r2"); }
  function grand(c){ return cum12(c)+rt(c,"r3"); }
  function hasMarks(k){ return state.contestants.some(function(c){ return c[k].some(Boolean); }); }
  function hasSd(){ return state.contestants.some(function(c){ return c.sd.some(function(v){return v;}); }); }

  // what the Section C.3 rule says about the scores as they stand right now
  function liveQualifiers(){
    var list = named();
    if(!list.length) return [];
    var ge8 = list.filter(function(c){ return cum12(c)>=ADV; });
    if(ge8.length>=5) return ge8;
    var sorted = list.slice().sort(function(a,b){ return cum12(b)-cum12(a); });
    if(sorted.length<=5) return sorted;
    var cut = cum12(sorted[4]);
    return sorted.filter(function(c){ return cum12(c)>=cut; });
  }
  // once the Quizmaster has announced the cut it is frozen, so a later correction
  // to a Round 1 or 2 mark cannot quietly change who is playing Round 3
  function qualifiers(){
    if(!state.cut) return liveQualifiers();
    return named().filter(function(c){ return state.cut.indexOf(c.no)>=0; });
  }
  function isCut(){ return !!state.cut; }
  // an announced cut that no longer matches the rule — the operator corrected a mark
  function cutDrift(){
    if(!state.cut) return null;
    var now = liveQualifiers().map(function(c){ return c.no; });
    var added = now.filter(function(n){ return state.cut.indexOf(n)<0; });
    var dropped = state.cut.filter(function(n){ return now.indexOf(n)<0; });
    return (added.length || dropped.length) ? {added:added, dropped:dropped} : null;
  }
  function nameOf(no){
    var c = state.contestants.filter(function(x){ return x.no===no; })[0];
    return c && c.name ? c.name : ("No. "+no);
  }

  function sdStreak(c){
    var n=0;
    for(var i=0;i<state.meta.sdCount;i++){
      if(c.sd[i]==="c") n++;
      else if(c.sd[i]==="w") return {n:n, alive:false, out:i+1};
      else break;
    }
    return {n:n, alive:true, out:0};
  }
  function sdKey(c){ var s=sdStreak(c); return s.n*2 + (s.alive?1:0); }
  function key(c){ return [grand(c), rt(c,"r1"), rt(c,"r2"), sdKey(c)]; }
  function cmpKey(a,b){
    var ka=key(a), kb=key(b);
    for(var i=0;i<ka.length;i++){ if(kb[i]!==ka[i]) return kb[i]-ka[i]; }
    return 0;
  }

  function stage(){
    if(hasMarks("r3")) return {fn:grand, label:"Cumulative, Rounds 1–3", short:"Rounds 1–3", s:"r3"};
    if(hasMarks("r2")) return {fn:cum12, label:"Cumulative, Rounds 1 & 2", short:"Rounds 1 & 2", s:"r2"};
    if(hasMarks("r1")) return {fn:function(c){return rt(c,"r1");}, label:"Round 1 scores", short:"Round 1", s:"r1"};
    return {fn:function(){return 0;}, label:"No scores tallied yet", short:"—", s:"none"};
  }
  function sameSpot(a,b,st){ return st.s==="r3" ? cmpKey(a,b)===0 : st.fn(a)===st.fn(b); }

  function standings(){
    var st = stage(), list = named().slice();
    if(st.s==="r3") list.sort(function(a,b){ var d=cmpKey(a,b); return d!==0?d:a.no-b.no; });
    else list.sort(function(a,b){ var d=st.fn(b)-st.fn(a); return d!==0?d:a.no-b.no; });
    var place=new Map(), same=new Map(), i=0;
    while(i<list.length){
      var j=i;
      while(j+1<list.length && sameSpot(list[j],list[j+1],st)) j++;
      for(var k=i;k<=j;k++){ place.set(list[k], i+1); same.set(list[k], j-i+1); }
      i=j+1;
    }
    return {rows:list, place:place, shared:same, stage:st};
  }

  // A tie-break group is defined by what was level *before* sudden death — the
  // three rounds and then Round 1 and Round 2. Grouping on the full key would
  // dissolve the group on the first tick, since that mark changes sdKey.
  function samePre(a,b){
    return grand(a)===grand(b) && rt(a,"r1")===rt(b,"r1") && rt(a,"r2")===rt(b,"r2");
  }
  function unresolved(){
    var s = standings();
    if(s.stage.s!=="r3") return null;
    var groups=[], seen=new Set();
    s.rows.forEach(function(c){
      if(seen.has(c)) return;
      var g = s.rows.filter(function(x){ return samePre(x,c); });
      if(g.length<2) return;
      var place = Math.min.apply(null, g.map(function(x){ return s.place.get(x); }));
      if(place>3) return;                       // only the top three need breaking
      g.forEach(function(x){ seen.add(x); });
      groups.push({place:place, members:g});
    });
    return groups.length ? groups : null;
  }

  // where a group stands: not started, in progress, settled, or one for the Board
  function sdState(g){
    var alive = g.members.filter(function(c){ return sdStreak(c).alive; });
    var started = g.members.some(function(c){ return c.sd.some(function(v){ return v; }); });
    var done = g.members.every(function(c){
      return c.sd.slice(0,state.meta.sdCount).every(function(v){ return v; });
    });
    return {alive:alive, started:started, done:done,
            decided: started && alive.length===1,
            stuck: started && (alive.length===0 || (done && alive.length>1))};
  }
  // the ties still wanting the operator's attention — drives the alert and the tab dot
  function pendingTies(){
    var u = unresolved();
    if(!u) return null;
    var p = u.filter(function(g){ return !sdState(g).decided; });
    return p.length ? p : null;
  }

  /* A settled tie-break is signed by who was in it and who came through. The
     operator clears the section away once, and it stays away — but correcting a
     mark changes the signature, so the grid comes back rather than hiding a
     result nobody has looked at. The marks themselves are never cleared: the
     placings are ordered by sdKey, so wiping them would put the tie back. */
  function sdSig(g, winner){
    return g.members.map(function(c){ return c.no; }).sort(function(a,b){ return a-b; }).join("-")+
      ">"+winner.no;
  }
  function sdOutcome(g){
    var st = sdState(g);
    if(!st.decided) return null;
    var w = st.alive[0];
    return {sig:sdSig(g,w), winner:w.no, place:g.place, name:w.name,
            others:g.members.filter(function(c){ return c!==w; })
                            .map(function(c){ return c.name || ("No. "+c.no); })};
  }
  function sdOutcomes(){
    return (unresolved()||[]).map(sdOutcome).filter(Boolean);
  }
  function sdAcked(sig){
    return (state.sdAck||[]).some(function(a){ return a.sig===sig; });
  }
  // what the tie-break tab shows: everything except the results already cleared away
  function consoleTies(){
    var u = unresolved();
    if(!u) return null;
    var open = u.filter(function(g){
      var o = sdOutcome(g);
      return !(o && sdAcked(o.sig));
    });
    return open.length ? open : null;
  }

  function decidedBy(c){
    var peers = named().filter(function(x){ return x!==c && grand(x)===grand(c); });
    if(!peers.length) return "";
    if(peers.every(function(x){ return rt(x,"r1")!==rt(c,"r1"); })) return "settled on Round 1";
    if(peers.every(function(x){ return rt(x,"r2")!==rt(c,"r2"); })) return "settled on Round 2";
    if(hasSd() && peers.every(function(x){ return sdKey(x)!==sdKey(c); })) return "settled on sudden death";
    return "tied — needs a tie-break";
  }

  /* ===================== coaches =====================
     A coach is encoded once, with the school they bring. Which coach a
     contestant is under then follows from the school rather than from a second
     piece of data entry: one coach there and every contestant of that school is
     theirs. Two or more at the same school is the only case nobody can infer,
     so that — and only that — is what the roster asks about. */
  function normSch(s){ return String(s==null?"":s).trim().toLowerCase().replace(/\s+/g," "); }
  function coaches(){ return state.coaches || (state.coaches = []); }
  function namedCoaches(){ return coaches().filter(function(k){ return k.name.trim()!==""; }); }
  function coachesAt(school){
    var n = normSch(school);
    if(!n) return [];
    return namedCoaches().filter(function(k){ return normSch(k.school)===n; });
  }
  function newCoachId(){
    var used = coaches().map(function(k){ return k.id; }), n = 1;
    while(used.indexOf("k"+n)>=0) n++;
    return "k"+n;
  }
  /* The coach a contestant is under, or null when the school has nobody encoded
     — or has several and none has been picked. A chosen coach is only honoured
     while they are still at the contestant's school, so editing either school
     re-derives rather than leaving a contestant under someone else's school. */
  function coachOf(c){
    var at = coachesAt(c.school);
    if(!at.length) return null;
    if(c.coachId){
      var pick = at.filter(function(k){ return k.id===c.coachId; })[0];
      if(pick) return pick;
    }
    return at.length===1 ? at[0] : null;
  }
  function coachName(c){ var k = coachOf(c); return k ? k.name : ""; }
  function needsCoach(c){ return coachesAt(c.school).length>1 && !coachOf(c); }
  function unassigned(){ return named().filter(needsCoach); }
  // schools on the roster that no coach has been encoded for
  function coachlessSchools(){
    var out = [], seen = {};
    named().forEach(function(c){
      var n = normSch(c.school);
      if(!n || seen["s"+n] || coachesAt(c.school).length) return;
      seen["s"+n] = 1; out.push(c.school);
    });
    return out;
  }
  /* Schools are not encoded anywhere — they are whatever was typed on the roster
     and against the coaches. Only a logo needs somewhere to live, so state.schools
     holds just the schools that have one, matched the same way coaches are. An
     entry whose school is no longer typed anywhere is kept rather than pruned, so
     correcting a spelling and typing it back brings the logo with it. */
  function schools(){ return state.schools || (state.schools = []); }
  function schoolEntry(name){
    var n = normSch(name);
    if(!n) return null;
    return schools().filter(function(x){ return normSch(x.name)===n; })[0] || null;
  }
  function schoolLogo(name){
    var e = schoolEntry(name);
    return e && isPhoto(e.logo) ? e.logo : null;
  }
  function setSchoolLogo(name, uri){
    var e = schoolEntry(name);
    if(!e){ e = {name:String(name==null?"":name).trim(), logo:null}; schools().push(e); }
    e.logo = uri;
  }
  function clearSchoolLogo(name){
    var n = normSch(name);
    state.schools = schools().filter(function(x){ return normSch(x.name)!==n; });
  }
  // every school typed on the roster or against a coach, alphabetically
  function schoolList(){
    var seen = {}, out = [];
    state.contestants.concat(coaches()).forEach(function(x){
      var n = normSch(x.school);
      if(!n || seen["s"+n]) return;
      seen["s"+n] = 1;
      out.push({key:n, name:String(x.school).trim()});
    });
    out.sort(function(a,b){ return a.key<b.key ? -1 : 1; });
    return out;
  }

  function initials(s){
    var p = String(s==null?"":s).trim().split(/\s+/).filter(Boolean);
    if(!p.length) return "?";
    return (p[0].charAt(0) + (p.length>1 ? p[p.length-1].charAt(0) : "")).toUpperCase();
  }

  /* The introduction runs school by school, alphabetically. A school with one
     coach is one group; a school with several is split a group per coach, so the
     pairing the audience sees is the one the operator encoded and never a
     guess. Contestants at such a school with no coach picked come last, in a
     group of their own — the console has been asking for them all along. */
  function introGroups(){
    var buckets = [], index = {};
    named().slice().sort(function(a,b){ return a.no-b.no; }).forEach(function(c){
      var key = normSch(c.school);
      var b = index["s"+key];                        // prefixed, so a school named "constructor" is just a school
      if(!b){ b = index["s"+key] = {key:key, school:c.school||"", students:[]}; buckets.push(b); }
      b.students.push(c);
    });
    // alphabetical by school, with any contestant who has no school given last
    buckets.sort(function(a,b){
      if(!a.key !== !b.key) return a.key ? -1 : 1;
      return a.key<b.key ? -1 : (a.key>b.key ? 1 : 0);
    });

    var out = [];
    buckets.forEach(function(b){
      var at = coachesAt(b.school);
      if(at.length<2){
        out.push({school:b.school, coach:at[0]||null, students:b.students});
        return;
      }
      var placed = [];
      at.slice().sort(function(x,y){ return normSch(x.name)<normSch(y.name) ? -1 : 1; }).forEach(function(k){
        var mine = b.students.filter(function(c){ return coachOf(c)===k; });
        if(!mine.length) return;
        out.push({school:b.school, coach:k, students:mine});
        placed = placed.concat(mine);
      });
      var rest = b.students.filter(function(c){ return placed.indexOf(c)<0; });
      if(rest.length) out.push({school:b.school, coach:null, students:rest});
    });
    return out;
  }

  /* The screens that introduction actually turns into: a school's contestants
     first — at Portraits per page, so a big school takes more than one screen —
     and then the coach who brought them. A group with no coach encoded simply
     has no coach screen after it. */
  function introScreens(){
    var out = [], n = Math.max(1, introPer);
    introGroups().forEach(function(g){
      for(var i=0;i<g.students.length;i+=n){
        out.push({kind:"students", school:g.school, coach:g.coach,
                  students:g.students.slice(i, i+n), from:i, of:g.students.length});
      }
      if(g.coach) out.push({kind:"coach", school:g.school, coach:g.coach});
    });
    return out;
  }

  /* ===================== console header ===================== */
  function renderTop(){
    $("markTitle").textContent = state.meta.edition;
    $("markSub").textContent = [state.meta.level, state.meta.place, state.meta.date].filter(Boolean).join(" · ");
    var s = standings();
    $("basisLabel").textContent = s.stage.label;

    var pod=$("podium"); pod.innerHTML="";
    var ord=["Champion","2nd placer","3rd placer"];
    for(var i=0;i<3;i++){
      var c = s.rows[i], d = document.createElement("div");
      d.className = "slot p"+(i+1)+(c?"":" empty");
      if(!c){
        d.innerHTML = '<div class="place">'+(i+1)+'</div><div class="who"><div class="nm">Waiting for scores</div></div>';
      } else {
        var note = s.stage.s==="r3" ? decidedBy(c) : (s.shared.get(c)>1 ? "tied on score" : "");
        d.innerHTML = '<div class="place">'+s.place.get(c)+'</div>'+
          '<div class="who"><div class="nm">'+esc(c.name)+'</div>'+
          '<div class="sch">'+esc(c.school||"—")+'</div>'+
          (note?'<div class="decided">'+note+'</div>':'')+'</div>'+
          '<div class="pts">'+s.stage.fn(c)+'<small>'+(s.stage.s==="r3"?ord[i]:s.stage.short)+'</small></div>';
      }
      pod.appendChild(d);
    }

    var u = pendingTies(), flag = $("alertFlag");
    if(u){
      var stuck = u.some(function(g){ return sdState(g).stuck; });
      var live = u.some(function(g){ return sdState(g).started; });
      flag.style.display="";
      flag.textContent = u.map(function(g){ return g.members.length+" tied for place "+g.place; }).join(" · ")+
        (stuck ? " — refer to the Board of Judges"
               : (live ? " — sudden death in progress" : " — run the sudden-death questions"));
    } else { flag.style.display="none"; }

    var open = !!(winRef && !winRef.closed);
    $("liveDot").className = "livedot"+(open?" on":"");
    $("liveTxt").textContent = open ? "Display live · "+cueName(disp.cue) : "Display closed";
  }

  function renderTabs(){
    var u = pendingTies();
    var defs = [["roster","Roster"],["r1","Round 1"],["r2","Round 2"],["r3","Round 3"],
                ["sd","Tie-break"],["standings","Standings"],["display","Display"]];
    $("tabs").innerHTML = defs.map(function(d){
      return '<button class="tab'+(tab===d[0]?" on":"")+'" data-tab="'+d[0]+'">'+d[1]+
        (d[0]==="sd"&&u?'<span class="dot"></span>':'')+'</button>';
    }).join("");
  }

  /* ===================== console views ===================== */
  function qHead(n){ var h=""; for(var i=1;i<=n;i++) h+='<th class="c">Q'+i+'</th>'; return h; }

  function qCells(c,k,dis){
    var h="", idx=state.contestants.indexOf(c);
    for(var i=0;i<QN;i++){
      h+='<td class="q"><button class="qbtn'+(c[k][i]?" on":"")+'" data-i="'+idx+'" data-k="'+k+'" data-q="'+i+'"'+
         (dis?" disabled":"")+' aria-pressed="'+(c[k][i]?"true":"false")+
         '" aria-label="'+LABEL[k]+' question '+(i+1)+', '+esc(c.name||("slot "+c.no))+'">'+
         (c[k][i]?"✓":"")+'</button></td>';
    }
    return h;
  }

  function renderRoster(){
    var rows = state.contestants.map(function(c,i){
      var has = isPhoto(c.photo);
      return '<tr><td class="no pad">'+c.no+'</td>'+
        '<td class="pad"><input class="rin" data-f="name" data-i="'+i+'" value="'+esc(c.name)+'" placeholder="Contestant name"></td>'+
        '<td class="pad"><input class="rin" data-f="school" data-i="'+i+'" value="'+esc(c.school)+'" placeholder="School" list="schoolList"></td>'+
        '<td class="pad coachcell" data-ci="'+i+'">'+coachCell(c,i)+'</td>'+
        '<td class="pad photocell">'+
          (has ? '<img class="thumb" src="'+c.photo+'" alt="'+esc(c.name)+'">'
               : '<span class="thumb none">'+c.no+'</span>')+
          '<button class="lbtn tiny" data-photo="'+i+'">'+(has?"Replace":"Add photo")+'</button>'+
          (has ? '<button class="lbtn tiny danger" data-unphoto="'+i+'">Remove</button>' : '')+
        '</td>'+
        '<td class="pad actions"><button class="lbtn tiny danger" data-cdel="'+i+
          '" aria-label="Delete '+esc(c.name||("slot "+c.no))+'">Delete row</button></td></tr>';
    }).join("");
    var withPhotos = state.contestants.filter(function(c){ return isPhoto(c.photo); }).length;
    var emptyN = emptyRows().length;
    return '<div class="panel">'+
      '<div class="setup">'+
        '<div class="field"><label for="mEd">Event</label><input id="mEd" data-m="edition" value="'+esc(state.meta.edition)+'"></div>'+
        '<div class="field"><label for="mLv">Stage</label><input id="mLv" data-m="level" value="'+esc(state.meta.level)+'"></div>'+
        '<div class="field"><label for="mPl">Province</label><input id="mPl" data-m="place" value="'+esc(state.meta.place)+'"></div>'+
        '<div class="field"><label for="mDt">Date</label><input id="mDt" data-m="date" value="'+esc(state.meta.date)+'"></div>'+
      '</div>'+
      '<div class="panel-head"><h3>Roster</h3><span class="note">'+named().length+' of '+state.contestants.length+
        ' slots filled · '+withPhotos+' with a photo</span>'+
        '<div class="right"><button class="lbtn" id="btnPaste">Paste from Excel</button>'+
        '<button class="lbtn" id="btnAdd">Add 5 slots</button>'+
        (emptyN ? '<button class="lbtn" id="btnTrim">Delete '+emptyN+' empty row'+
                  (emptyN===1?"":"s")+'</button>' : '')+
        '<button class="lbtn danger" id="btnClearAll">Clear all scores</button></div></div>'+
      coachWarnHTML()+
      '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>Name</th><th>School</th>'+
      '<th>Coach</th><th class="c">Photo</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="paste" id="pasteBox"><p>Paste the name and school columns from the registration sheet — one contestant per line, tab or comma between the two.</p>'+
        '<textarea id="pasteText" placeholder="Juan dela Cruz&#9;Marinduque National High School"></textarea>'+
        '<div class="row"><button class="lbtn go" id="btnPasteGo">Load roster</button><button class="lbtn" id="btnPasteCancel">Cancel</button></div></div>'+
      '<div class="legend">Scores stay attached to the slot number, so correcting a spelling never disturbs a tally. '+
      'Photos are shrunk before they are stored and travel inside the saved session, so one .json file still carries the whole contest. '+
      'They appear on the Introduce contestants screen and on the winners’ cards. '+
      'The Coach column fills itself from the school — it only asks when a school has sent more than one coach. '+
      'Delete row takes a contestant off altogether; the rows below move up a number, since the number is the slot.</div></div>'+
      renderCoachPanel()+
      '<div id="schoolPanel">'+renderSchoolPanel()+'</div>'+
      '<datalist id="schoolList">'+schoolOptions()+'</datalist>';
  }

  /* ---- school logos ----
     The rows are derived from what has been typed, never entered by hand: the
     only thing this table stores is the logo. */
  function renderSchoolPanel(){
    var list = schoolList();
    if(!list.length){
      return '<div class="panel"><div class="panel-head"><h3>School logos</h3>'+
        '<span class="note">a logo shows beside the school name when the contestants are introduced</span></div>'+
        '<div class="empty-state"><p>No schools yet. Type a school against a contestant or a coach '+
        'and it appears here for a logo.</p></div></div>';
    }
    var rows = list.map(function(x,i){
      var logo = schoolLogo(x.name);
      var cn = named().filter(function(c){ return normSch(c.school)===x.key; }).length;
      var kn = namedCoaches().filter(function(k){ return normSch(k.school)===x.key; }).length;
      return '<tr><td class="no pad">'+(i+1)+'</td>'+
        '<td class="pad nm">'+esc(x.name)+'</td>'+
        '<td class="pad photocell">'+
          (logo ? '<img class="thumb logo" src="'+logo+'" alt="">'
                : '<span class="thumb logo none">—</span>')+
          '<button class="lbtn tiny" data-slogo="'+esc(x.name)+'">'+(logo?"Replace":"Add logo")+'</button>'+
          (logo ? '<button class="lbtn tiny danger" data-slogodel="'+esc(x.name)+'">Remove</button>' : '')+
        '</td>'+
        '<td class="cum">'+cn+'</td><td class="cum">'+kn+'</td></tr>';
    }).join("");
    var withLogo = list.filter(function(x){ return schoolLogo(x.name); }).length;
    return '<div class="panel">'+
      '<div class="panel-head"><h3>School logos</h3><span class="note">'+
      withLogo+' of '+list.length+' school'+(list.length===1?"":"s")+
      ' with a logo · it shows beside the school name when the contestants are introduced</span></div>'+
      '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>School</th>'+
      '<th class="c">Logo</th><th class="c">Contestants</th><th class="c">Coaches</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="legend">The list follows the schools typed above — there is nothing to add here by hand. '+
      'Logos keep their transparency, are shrunk before they are stored and travel inside the saved session. '+
      'Correcting a school’s spelling parks its logo rather than losing it; type the spelling back and it returns.</div></div>';
  }

  /* The list of schools already typed, offered to both the roster and the
     coaches table, so the two spellings match and a coach finds their school. */
  function schoolOptions(){
    return schoolList().map(function(x){ return '<option value="'+esc(x.name)+'">'; }).join("");
  }

  // what the roster shows in the Coach column — a name when the rule settles it,
  // a chooser only when the school has sent more than one coach
  function coachCell(c, i){
    if(!normSch(c.school)) return '<span class="cmute">Enter a school first</span>';
    var at = coachesAt(c.school);
    if(!at.length) return '<span class="cmute">No coach encoded for this school</span>';
    if(at.length===1) return '<span class="conly">'+esc(at[0].name)+
      '<em>the only coach for this school</em></span>';
    var k = coachOf(c);
    return '<select class="csel'+(k?"":" need")+'" data-coach="'+i+'" aria-label="Coach for '+
      esc(c.name||("slot "+c.no))+'">'+
      '<option value=""'+(k?"":" selected")+'>Choose one of '+at.length+'…</option>'+
      at.map(function(x){
        return '<option value="'+esc(x.id)+'"'+(k&&k.id===x.id?" selected":"")+'>'+esc(x.name)+'</option>';
      }).join("")+'</select>';
  }

  function coachWarnHTML(){
    var need = unassigned(), none = coachlessSchools(), h = "";
    if(need.length){
      h += '<div class="banner warn">'+need.length+' contestant'+(need.length===1?"":"s")+
        ' come'+(need.length===1?"s":"")+' from a school that has sent more than one coach, so the coach has to be '+
        'chosen: '+esc(need.map(function(c){ return c.name || ("No. "+c.no); }).join(", "))+
        '. Until then the introduction screen shows them without one.</div>';
    }
    if(none.length){
      h += '<div class="banner info">No coach encoded yet for '+esc(none.join(", "))+
        '. Add them below and every contestant of that school follows automatically.</div>';
    }
    return '<div id="coachWarn">'+h+'</div>';
  }

  /* ---- adding and deleting roster rows ----
     A contestant's number is their slot: c.no is the row's own position, and
     the announced cut and the cleared tie-breaks are both recorded as numbers.
     So deleting a row closes the gap and renumbers from 1, and everything that
     was written down in numbers is carried across that renumbering rather than
     left pointing at a number nobody has any more. */
  function renumber(keep){
    var map = {};
    keep.forEach(function(c, ix){ map[c.no] = ix+1; });   // old number -> new
    keep.forEach(function(c, ix){ c.no = ix+1; });
    state.contestants = keep;
    photoFor = null;                    // a file picker mid-flight no longer knows its row

    if(state.cut){
      state.cut = state.cut.map(function(n){ return map[n]; }).filter(Boolean);
      if(!state.cut.length) state.cut = null;
    }
    // a cleared tie-break is signed by the numbers of everyone in it, so the
    // signature moves too — and is dropped outright if one of them is gone,
    // because that is no longer the tie the operator cleared away
    state.sdAck = (state.sdAck||[]).map(function(a){
      var half = String(a.sig).split(">");
      var mem = half[0].split("-").map(Number).map(function(n){ return map[n]; });
      var win = map[a.winner];
      if(!win || mem.some(function(n){ return !n; })) return null;
      mem.sort(function(x,y){ return x-y; });
      return {sig:mem.join("-")+">"+win, winner:win, place:a.place, name:a.name};
    }).filter(Boolean);
  }

  // a row nothing has been entered against — safe to take away in bulk
  function emptyRows(){
    return state.contestants.filter(function(c){
      return !c.name.trim() && !c.school.trim() && !isPhoto(c.photo) &&
             !c.r1.some(Boolean) && !c.r2.some(Boolean) && !c.r3.some(Boolean) &&
             !c.sd.some(function(v){ return v; });
    });
  }

  function removeContestant(i){
    var c = state.contestants[i];
    if(!c) return;
    if(state.contestants.length<=1){ toast("The roster needs one row at least"); return; }
    var marks = ["r1","r2","r3"].reduce(function(n,k){
      return n + c[k].filter(Boolean).length;
    }, 0);
    var sdMarks = c.sd.filter(function(v){ return v; }).length;
    var who = c.name.trim() || ("slot "+c.no);
    var touched = c.name.trim() || c.school.trim() || isPhoto(c.photo) || marks || sdMarks;

    if(touched){
      var msg = "Delete "+who+" from the roster?";
      if(marks || sdMarks){
        msg += "\n\n"+
          (marks ? marks+" ticked answer"+(marks===1?"":"s") : "")+
          (marks && sdMarks ? " and " : "")+
          (sdMarks ? sdMarks+" sudden-death mark"+(sdMarks===1?"":"s") : "")+
          " go with them.";
      }
      if(isPhoto(c.photo)) msg += "\n\nTheir photo goes too.";
      if(i < state.contestants.length-1){
        msg += "\n\nThe rows below move up a number: No. "+(c.no+1)+" becomes No. "+c.no+
               ", and so on. Scores stay with their contestant.";
      }
      if(!confirm(msg)) return;
    }
    renumber(state.contestants.filter(function(x){ return x!==c; }));
    render();
    toast(who+" deleted");
  }

  function trimEmpty(){
    var empty = emptyRows();
    if(!empty.length){ toast("No empty rows to delete"); return; }
    if(empty.length===state.contestants.length){ toast("Every row is empty — nothing to keep"); return; }
    if(!confirm("Delete "+empty.length+" empty row"+(empty.length===1?"":"s")+"?\n\n"+
                "Nothing has been entered against them. The "+
                (state.contestants.length-empty.length)+" rows that remain are renumbered from 1.")) return;
    renumber(state.contestants.filter(function(c){ return empty.indexOf(c)<0; }));
    render();
    toast(empty.length+" empty row"+(empty.length===1?"":"s")+" deleted");
  }

  /* ---- the coaches table ---- */
  function renderCoachPanel(){
    var ks = coaches();
    var rows = ks.map(function(k,i){
      var has = isPhoto(k.photo);
      return '<tr><td class="no pad">'+(i+1)+'</td>'+
        '<td class="pad"><input class="kin" data-kf="name" data-ki="'+i+'" value="'+esc(k.name)+'" placeholder="Coach name"></td>'+
        '<td class="pad"><input class="kin" data-kf="school" data-ki="'+i+'" value="'+esc(k.school)+'" placeholder="School" list="schoolList"></td>'+
        '<td class="pad photocell">'+
          (has ? '<img class="thumb" src="'+k.photo+'" alt="'+esc(k.name)+'">'
               : '<span class="thumb none">'+esc(initials(k.name))+'</span>')+
          '<button class="lbtn tiny" data-kphoto="'+i+'">'+(has?"Replace":"Add photo")+'</button>'+
          (has ? '<button class="lbtn tiny danger" data-kunphoto="'+i+'">Remove</button>' : '')+
        '</td>'+
        '<td class="cum" data-kc="'+i+'">'+coachLoad(k)+'</td>'+
        '<td class="pad knote" data-kn="'+i+'">'+coachNote(k)+'</td>'+
        '<td class="pad actions"><button class="lbtn tiny danger" data-kdel="'+i+
          '" aria-label="Delete '+esc(k.name||("coach "+(i+1)))+'">Delete row</button></td></tr>';
    }).join("");

    var body = ks.length
      ? '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>Coach</th><th>School</th>'+
        '<th class="c">Photo</th><th class="c">Contestants</th><th>Status</th><th></th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table></div>'
      : '<div class="empty-state"><p>No coaches encoded yet. The introduction screen names a contestant’s coach once there is one for their school.</p>'+
        '<button class="lbtn go" id="btnAddCoach">Add a coach</button></div>';

    return '<div class="panel">'+
      '<div class="panel-head"><h3>Coaches</h3><span class="note">'+namedCoaches().length+
      ' encoded · one coach at a school claims all of its contestants</span>'+
      '<div class="right"><button class="lbtn" id="btnKPaste">Paste from Excel</button>'+
      '<button class="lbtn" id="btnAddCoach2">Add a coach</button></div></div>'+
      body+
      '<div class="paste" id="kPasteBox"><p>Paste the coaches from the registration sheet — one per line, name then school, tab or comma between the two.</p>'+
        '<textarea id="kPasteText" placeholder="Maria Santos&#9;Marinduque National High School"></textarea>'+
        '<div class="row"><button class="lbtn go" id="btnKPasteGo">Add these coaches</button>'+
        '<button class="lbtn" id="btnKPasteCancel">Cancel</button></div></div>'+
      '<div class="legend">A school with one coach needs nothing else — every contestant of that school is listed under them. '+
      'A school that has sent two or more puts a chooser in the roster’s Coach column instead, because only you know who coached whom. '+
      'Spell the school the same way in both tables; the box offers the ones already typed.</div></div>';
  }

  function coachLoad(k){
    return named().filter(function(c){ return coachOf(c)===k; }).length;
  }
  function coachNote(k){
    if(!k.name.trim()) return '<span class="cmute">Give the coach a name</span>';
    if(!normSch(k.school)) return '<span class="cmute">Give the school</span>';
    var at = coachesAt(k.school);
    if(at.length>1) return '<span class="cwarn">'+at.length+' coaches at this school — pick per contestant above</span>';
    return coachLoad(k)
      ? '<span class="cmute">every contestant of this school</span>'
      : '<span class="cwarn">no contestant from this school on the roster</span>';
  }

  /* Editing a name or a school moves contestants between coaches, so the cells
     that depend on it are refreshed in place rather than by a full redraw —
     a redraw would take the operator's cursor out of the box they are typing in. */
  function refreshCoachUI(){
    // the schools panel and the school suggestions are both derived from the
    // boxes being typed in, so they are rebuilt here rather than waiting for a
    // full redraw that would take the cursor out of the box
    var sp = $("schoolPanel");
    if(sp) sp.innerHTML = renderSchoolPanel();
    var dl = $("schoolList");
    if(dl) dl.innerHTML = schoolOptions();
    Array.prototype.forEach.call(document.querySelectorAll("td.coachcell"), function(td){
      var i = +td.dataset.ci;
      td.innerHTML = coachCell(state.contestants[i], i);
    });
    Array.prototype.forEach.call(document.querySelectorAll("td[data-kc]"), function(td){
      var k = coaches()[+td.dataset.kc];
      if(k) td.textContent = coachLoad(k);
    });
    Array.prototype.forEach.call(document.querySelectorAll("td[data-kn]"), function(td){
      var k = coaches()[+td.dataset.kn];
      if(k) td.innerHTML = coachNote(k);
    });
    var w = $("coachWarn"), fresh = document.createElement("div");
    if(w){ fresh.innerHTML = coachWarnHTML(); w.innerHTML = fresh.firstChild.innerHTML; }
  }

  function addCoach(){
    coaches().push({id:newCoachId(), name:"", school:"", photo:null});
    render();
    var el = document.querySelector('.kin[data-kf="name"][data-ki="'+(coaches().length-1)+'"]');
    if(el) el.focus();
  }
  function removeCoach(i){
    var k = coaches()[i];
    if(!k) return;
    var load = coachLoad(k);
    if(k.name.trim() && !confirm("Delete "+k.name+" from the coaches?"+
        (load ? "\n\n"+load+" contestant"+(load===1?"":"s")+" listed under them will be left without a coach "+
                "until another is encoded for the school." : ""))) return;
    coaches().splice(i,1);
    photoFor = null;                    // a file picker mid-flight no longer knows its row
    state.contestants.forEach(function(c){ if(c.coachId===k.id) c.coachId = null; });
    render(); toast((k.name.trim()||"The coach")+" deleted");
  }
  function loadCoachPaste(){
    var lines = $("kPasteText").value.split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean);
    if(!lines.length){ toast("Nothing to load"); return; }
    var added = 0;
    lines.forEach(function(ln){
      var parts = ln.split(/\t|\s{2,}|,/);
      var nm = (parts[0]||"").trim(), sc = parts.slice(1).join(", ").trim();
      if(!nm) return;
      var dupe = coaches().some(function(k){
        return k.name.trim().toLowerCase()===nm.toLowerCase() && normSch(k.school)===normSch(sc);
      });
      if(dupe) return;
      coaches().push({id:newCoachId(), name:nm, school:sc, photo:null});
      added++;
    });
    $("kPasteBox").classList.remove("show"); $("kPasteText").value="";
    render();
    toast(added ? added+" coach"+(added===1?"":"es")+" added" : "Those coaches were already on the list");
  }

  function leadersLine(k, list){
    if(!list.some(function(c){ return c[k].some(Boolean) || (k!=="r1" && runTotal(c,k)>0); })) return "";
    var pos = posMap(k, list);
    var top = list.slice().sort(function(a,b){
      var d = runTotal(b,k)-runTotal(a,k);
      return d!==0 ? d : a.no-b.no;
    }).filter(function(c){ return pos.get(c)<=3; }).slice(0,6);
    if(!top.length) return "";
    var label = k==="r1" ? "Round 1" : (k==="r2" ? "Rounds 1 &amp; 2" : "all three rounds");
    return '<div class="banner ok">Leading on '+label+': '+
      top.map(function(c){ return '<b>'+pos.get(c)+'.</b> '+esc(c.name)+' ('+runTotal(c,k)+')'; }).join(' \u00b7 ')+
      '</div>';
  }

  function renderRound(k){
    var list = named();
    if(!list.length){
      return '<div class="panel"><div class="panel-head"><h3>'+LABEL[k]+'</h3></div>'+
        '<div class="empty-state"><p>Add contestants in the Roster tab to start tallying.</p>'+
        '<button class="lbtn go" data-goto="roster">Go to roster</button></div></div>';
    }
    var qual = k==="r3" ? qualifiers() : null;
    // once the cut is announced the eliminated leave the Round 3 grid altogether
    var rowList = (k==="r3" && isCut()) ? qual : list;
    var basisFn = k==="r1" ? function(c){return rt(c,"r1");} : (k==="r2" ? cum12 : grand);
    var pool = k==="r3" ? qual : list;
    var sc = pool.map(basisFn).slice().sort(function(a,b){ return b-a; });
    var rk = new Map();
    pool.forEach(function(c){ rk.set(c, sc.indexOf(basisFn(c))+1); });

    var head;
    if(k==="r1") head='<th class="c">Rank</th>';
    else if(k==="r2") head='<th class="c sep">Round 1</th><th class="c">Rounds 1 &amp; 2</th><th class="c">Rank</th>';
    else head='<th class="c sep">Rounds 1 &amp; 2</th><th class="c">All rounds</th><th class="c">Rank</th>';

    // the entry grid is always in contestant-number order — rows must never move
    // under the operator's cursor while they are ticking boxes
    var rows = rowList.slice().sort(function(a,b){ return a.no-b.no; }).map(function(c){
      var inR3 = k!=="r3" || qual.indexOf(c)>=0;
      var cls="";
      if(inR3){ var r=rk.get(c); if(r===1) cls="top top1"; else if(r<=3) cls="top"; }
      else cls="out";
      var extra;
      if(k==="r1") extra='<td class="rank"><span class="r">'+rk.get(c)+'</span></td>';
      else if(k==="r2") extra='<td class="cum sep">'+rt(c,"r1")+'</td><td class="cum">'+cum12(c)+'</td><td class="rank"><span class="r">'+rk.get(c)+'</span></td>';
      else extra='<td class="cum sep">'+cum12(c)+'</td><td class="cum">'+grand(c)+'</td><td class="rank"><span class="r">'+(inR3?rk.get(c):"—")+'</span></td>';
      return '<tr class="'+cls+'"><td class="no pad">'+c.no+'</td><td class="nm pad">'+esc(c.name)+'</td>'+
        '<td class="sch pad">'+esc(c.school||"—")+'</td>'+qCells(c,k,!inR3)+
        '<td class="tot">'+rt(c,k)+'</td>'+extra+'</tr>';
    }).join("");

    var banner="";
    if(k==="r2" && (hasMarks("r2") || isCut())){
      var q = qualifiers();
      var outs = named().filter(function(c){ return q.indexOf(c)<0; });
      var byRule = named().filter(function(c){ return cum12(c)>=ADV; }).length>=5;
      if(isCut()){
        var drift = cutDrift();
        banner = '<div class="banner ok">Round 3 cut applied: <b>'+q.length+' advancing</b>, '+outs.length+
          ' eliminated. Round 3 now lists only the advancing contestants. '+
          esc(q.map(function(c){ return c.name+" ("+cum12(c)+")"; }).join(", "))+
          ' <button class="lbtn" id="btnUncut">Undo the cut</button></div>'+
          (drift ? '<div class="banner warn">A mark has changed since the cut was announced. The rule would now advance '+
            (drift.added.length ? esc(drift.added.map(nameOf).join(", "))+' as well' : '')+
            (drift.added.length && drift.dropped.length ? ', and drop ' : '')+
            (drift.dropped.length ? esc(drift.dropped.map(nameOf).join(", ")) : '')+
            '. The announced cut stands until you undo and re-apply it.</div>' : '');
      } else {
        banner = '<div class="banner info">Advancing to Round 3: <b>'+q.length+'</b> — '+
          (byRule ? 'everyone with a cumulative score of at least '+ADV+'.'
                  : 'fewer than five reached '+ADV+' points, so the top five carry over, including everyone tied at the fifth spot.')+
          ' '+esc(q.map(function(c){ return c.name+" ("+cum12(c)+")"; }).join(", "))+
          ' <button class="lbtn go" id="btnCut">Apply the cut — eliminate '+outs.length+'</button></div>';
      }
    }
    if(k==="r3"){
      banner = isCut()
        ? '<div class="banner ok">The cut is applied — these <b>'+qual.length+' contestants</b> are Round 3. '+
          'The eliminated are off the list. <button class="lbtn" id="btnUncut">Undo the cut</button></div>'
        : (hasMarks("r2")
          ? '<div class="banner info"><b>'+qual.length+' contestants</b> qualified for this round. The rest are locked out of the tally below. '+
            'Apply the cut on the Round 2 tab to take them off the list entirely.</div>'
          : '<div class="banner warn">Round 2 has no marks yet, so qualification is provisional. Tally Round 2 first.</div>');
    }

    return '<div class="panel">'+
      '<div class="panel-head"><h3>'+LABEL[k]+'</h3><span class="note">'+PTS[k]+' point'+(PTS[k]===1?"":"s")+
      ' per correct answer · 10 questions</span><div class="right">'+
      '<button class="lbtn" data-cue="round" data-round="'+k+'">Put this round on screen</button>'+
      '<button class="lbtn danger" data-clear="'+k+'">Clear this round</button></div></div>'+
      leadersLine(k, list)+banner+
      '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>Name</th><th>School</th>'+
      qHead(QN)+'<th class="c sep">Total</th>'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="legend">Click a box for a correct answer. Blank counts as wrong or no answer. Arrow keys move, space toggles. Rows stay in contestant-number order while you tally \u2014 nothing reorders under your cursor. The leader line above and the Top 3 strip update as you click.</div></div>';
  }

  function renderSd(){
    var u = consoleTies();
    var settled = (state.sdAck||[]);
    var head = '<div class="panel-head"><h3>Tie-break</h3><span class="note">Sudden death · '+
      state.meta.sdCount+' questions · a wrong answer eliminates</span>'+
      '<div class="right"><button class="lbtn" data-cue="tiebreak">Put on screen</button>'+
      '<button class="lbtn danger" data-clear="sd">Clear tie-break</button></div></div>';

    if(!u){
      var done = settled.map(function(a){
        return '<div class="banner ok"><b>'+esc(a.name)+'</b> took place '+a.place+
          ' on sudden death. The marks are on record and the standings reflect them. '+
          '<button class="lbtn" data-reopen="'+esc(a.sig)+'">Show the marks again</button></div>';
      }).join("");
      var msg = settled.length
        ? "Nothing left to break."
        : (hasMarks("r3")
          ? "No tie among the top three. Round 1 and Round 2 scores already separated everyone."
          : "Nothing to break yet. Ties are detected automatically once Round 3 is tallied.");
      return '<div class="panel">'+head+done+'<div class="empty-state"><p>'+msg+'</p></div></div>';
    }

    var blocks = u.map(function(g){
      var rows = g.members.map(function(c){
        var idx = state.contestants.indexOf(c), s = sdStreak(c), cells="";
        for(var i=0;i<state.meta.sdCount;i++){
          var v = c.sd[i];
          var locked = !s.alive && i>=s.out;
          cells += '<td class="q"><button class="qbtn'+(v==="c"?" on":(v==="w"?" wrong":""))+'" data-i="'+idx+
            '" data-sd="'+i+'"'+(locked?" disabled":"")+' aria-label="Sudden death question '+(i+1)+', '+
            esc(c.name)+'">'+(v==="c"?"✓":(v==="w"?"✗":""))+'</button></td>';
        }
        return '<tr><td class="no pad">'+c.no+'</td><td class="nm pad">'+esc(c.name)+'</td>'+
          '<td class="sch pad">'+esc(c.school||"—")+'</td>'+cells+
          '<td class="st">'+(s.alive
            ? '<span class="pill alive">'+(s.n?"in play · "+s.n+" correct":"in play")+'</span>'
            : '<span class="pill dead">out at Q'+s.out+'</span>')+'</td></tr>';
      }).join("");

      var sd = sdState(g), alive = sd.alive;
      var status;
      if(!sd.started) status = '<div class="banner info">Ask the '+state.meta.sdCount+
        ' tie-break questions to these '+g.members.length+' contestants at the same time.</div>';
      else if(sd.decided) status = '<div class="banner ok"><b>'+esc(alive[0].name)+'</b> takes place '+g.place+
        ' — the rest are eliminated. The placings above already reflect this.</div>';
      else if(alive.length===0) status = '<div class="banner warn">Everyone was eliminated on the same question. Refer to the Board of Judges.</div>';
      else if(sd.done) status = '<div class="banner warn">'+alive.length+' contestants survived all '+
        state.meta.sdCount+' questions. The Board of Judges decides how to proceed.</div>';
      else status = '<div class="banner info">'+alive.length+' still in play — keep going.</div>';

      return '<div class="panel"><div class="panel-head"><h3>Tie for place '+g.place+'</h3>'+
        '<span class="note">'+g.members.length+' contestants · '+grand(g.members[0])+' points each</span></div>'+
        status+'<div class="scroll"><table><thead><tr><th class="c">No.</th><th>Name</th><th>School</th>'+
        qHead(state.meta.sdCount)+'<th class="c sep">Status</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
    }).join("");

    return '<div class="panel">'+head+
      '<div class="banner info">Round 1 and Round 2 scores are applied first and did not separate these contestants. '+
      'Click once for a correct answer, twice for a wrong one — an eliminated contestant\u2019s remaining boxes lock.</div></div>'+
      blocks;
  }

  function renderStandings(){
    var s = standings();
    if(!s.rows.length){
      return '<div class="panel"><div class="empty-state"><p>No contestants yet.</p>'+
        '<button class="lbtn go" data-goto="roster">Go to roster</button></div></div>';
    }
    var q = hasMarks("r2") ? qualifiers() : [];
    var rows = s.rows.map(function(c){
      var p = s.place.get(c);
      var cls = p===1?"top top1":(p<=3?"top":"");
      return '<tr class="'+cls+'"><td class="rank"><span class="r">'+p+'</span></td>'+
        '<td class="nm pad">'+esc(c.name)+'</td><td class="sch pad">'+esc(c.school||"—")+'</td>'+
        '<td class="cum">'+rt(c,"r1")+'</td><td class="cum">'+rt(c,"r2")+'</td>'+
        '<td class="cum sep">'+cum12(c)+'</td><td class="cum">'+rt(c,"r3")+'</td>'+
        '<td class="tot">'+grand(c)+'</td>'+
        '<td class="st">'+(q.indexOf(c)>=0?'<span class="pill qual">Round 3</span>':'—')+'</td></tr>';
    }).join("");
    var u = pendingTies();
    return '<div class="panel"><div class="panel-head"><h3>Standings</h3>'+
      '<span class="note">'+s.stage.label+'</span>'+
      '<div class="right"><button class="lbtn" data-cue="leaderboard">Put on screen</button>'+
      '<button class="lbtn" id="btnCsv">Plain CSV</button>'+
      '<button class="lbtn" id="btnPrint">Print</button></div></div>'+
      (u?'<div class="banner warn">A tie in the top three is still open. Go to the Tie-break tab.</div>'
        :(s.stage.s==="r3"?'<div class="banner ok">Top three settled. These three represent '+esc(state.meta.place)+' at the Regional Championship.</div>':''))+
      '<div class="scroll"><table><thead><tr><th class="c">Place</th><th>Name</th><th>School</th>'+
      '<th class="c">R1</th><th class="c">R2</th><th class="c sep">R1 &amp; 2</th><th class="c">R3</th>'+
      '<th class="c sep">Total</th><th class="c">Qualified</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="legend">Places follow Section D.2: cumulative score, then Round 1, then Round 2, then sudden death.</div></div>';
  }

  /* ===================== display control desk ===================== */
  /* The number key is written down rather than taken from the position, so a
     cue can be added or dropped without the whole keypad shifting under the
     operator. */
  var CUES = [
    {id:"standby",     k:"1", t:"Title card",        d:"Event name, province, date"},
    {id:"mechanics",   k:"2", t:"Contest mechanics", d:"The rounds, qualifying, and tie-breaks"},
    {id:"introduce",   k:"3", t:"Introduce contestants", d:"School by school, each followed by their coach"},
    {id:"round",       k:"4", t:"Round scores",      d:"By contestant number, for the read-out"},
    {id:"advancing",   k:"5", t:"Advancing to R3",   d:"Who made the cut after Round 2"},
    {id:"leaderboard", k:"6", t:"Leaderboard",       d:"Ranked, current standings"},
    {id:"tiebreak",    k:"7", t:"Sudden death",      d:"Live tie-break marks"},
    {id:"reveal",      k:"8", t:"2nd & 3rd placers", d:"Third, then second — champion is separate"},
    {id:"champion",    k:"9", t:"Champion card",     d:"Full-screen winner, on its own"},
    {id:"blank",       k:"0", t:"Blank the screen",  d:"Holding slate between segments"}
  ];
  function cueName(id){ var c=CUES.filter(function(x){return x.id===id;})[0]; return c?c.t:id; }

  function renderDesk(){
    var open = !!(winRef && !winRef.closed);
    var cues = CUES.map(function(c){
      return '<button class="cue'+(disp.cue===c.id?" on":"")+'" data-cue="'+c.id+'">'+
        '<b>'+(c.k?'<i class="k">'+c.k+'</i>':'')+c.t+'</b><span>'+c.d+'</span></button>';
    }).join("");
    var rounds = ["r1","r2","r3"].map(function(k){
      return '<button class="lbtn'+(disp.round===k?" on":"")+'" data-cue="round" data-round="'+k+'">'+LABEL[k]+'</button>';
    }).join("");
    var pl = pagedList();
    var pages = pl ? Math.max(1, Math.ceil(pl.length/per())) : 1;
    var mech = disp.cue==="mechanics";
    var intro = disp.cue==="introduce";
    var photos = named().filter(function(c){ return isPhoto(c.photo); }).length;
    var rev = [["Reveal 3rd placer",1],["Reveal 2nd placer",2]].map(function(r){
      return '<button class="lbtn'+(disp.cue==="reveal" && disp.reveal===r[1]?" on":"")+'" data-reveal="'+r[1]+'">'+r[0]+'</button>';
    }).join("");

    var need = unassigned();
    var coachRow = need.length
      ? '<div class="deskrow"><span class="lab">Coaches</span>'+
        '<button class="lbtn" data-goto="roster">Choose the missing coaches</button>'+
        '<span class="note">'+need.length+' contestant'+(need.length===1?"":"s")+
        ' come'+(need.length===1?"s":"")+' from a school with more than one coach and none picked \u2014 '+
        'the introduction runs them without a coach screen.</span></div>'
      : "";

    // the Round 3 cut, offered here because the operator is on this tab while the
    // Round 2 scores are on screen and the Quizmaster reads out who advances
    var cutRow = "";
    if(isCut()){
      cutRow = '<div class="deskrow"><span class="lab">Round 3 cut</span>'+
        '<button class="lbtn" id="btnUncut2">Undo the cut</button>'+
        '<span class="note">Applied · '+qualifiers().length+' advancing, '+
        (named().length-qualifiers().length)+' eliminated · Round 2 marks them on screen and Round 3 lists only those advancing.</span></div>';
    } else if(hasMarks("r2")){
      cutRow = '<div class="deskrow"><span class="lab">Round 3 cut</span>'+
        '<button class="lbtn go" id="btnCut2">Apply the cut</button>'+
        '<span class="note">Freezes who advances: '+liveQualifiers().length+' through, '+
        (named().length-liveQualifiers().length)+' eliminated on the Round 2 screen.</span></div>';
    }

    return '<div class="panel"><div class="panel-head"><h3>Display screen</h3>'+
      '<span class="note">'+(open?"Live — showing "+cueName(disp.cue):"Not open yet")+'</span>'+
      '<div class="right">'+
        '<button class="lbtn go" id="btnDisplay2">'+(open?"Re-open display screen":"Open display screen")+'</button>'+
        '<button class="lbtn" id="btnPreview2">Preview here</button>'+
        (open?'<button class="lbtn danger" id="btnCloseDisplay">Close display</button>':'')+
      '</div></div>'+
      (open?'':'<div class="banner info">Open the display screen, drag that window to the projector or second monitor, then press F11 there for full screen. It follows this console from then on.</div>')+
      '<div class="desk">'+
        '<h4>What the audience sees</h4>'+
        '<p class="hint">The screen only changes when you choose a cue, so you can tally quietly while a title card is up. '+
        'The title card carries a <b>View the contest mechanics</b> button — click it on the audience screen itself, or press M here.</p>'+
        '<div class="cues">'+cues+'</div>'+
        '<div class="deskrow"><span class="lab">Round on screen</span>'+rounds+'</div>'+
        '<div class="deskrow"><span class="lab">Score shown</span>'+
          [["Running total","total"],["This round only","round"]].map(function(v){
            return '<button class="lbtn'+(disp.val===v[1]?" on":"")+'" data-val="'+v[1]+'">'+v[0]+'</button>';
          }).join("")+
          '<span class="note">The big figure on each tile. The other number stays under it in small type'+
          (sortBy==="score" ? ", and the on-screen order follows whichever you pick" : "")+'.</span></div>'+
        coachRow+
        cutRow+
        '<div class="deskrow"><span class="lab">Round order on screen</span>'+
          [["By contestant number","no"],["By score \u2014 leader first","score"]].map(function(v){
            return '<button class="lbtn'+(sortBy===v[1]?" on":"")+'" data-sort="'+v[1]+'">'+v[0]+'</button>';
          }).join("")+
          '<span class="note">Affects the audience screen only \u2014 the tally grid never reorders.</span></div>'+
        '<div class="deskrow"><span class="lab">Columns</span>'+
          [["Auto",0],["One",1],["Two",2]].map(function(v){
            return '<button class="lbtn'+(disp.cols===v[1]?" on":"")+'" data-cols="'+v[1]+'">'+v[0]+'</button>';
          }).join("")+
          '<span class="note">Tiles read downwards, then across.</span></div>'+
        (mech
          ? '<div class="deskrow"><span class="lab">Per page</span>'+
            '<span class="note">The mechanics run one screen at a time.</span></div>'
          : '<div class="deskrow"><span class="lab">'+(intro?"Portraits per page":"Tiles per page")+'</span>'+
            (intro?[1,4,6,8]:[6,8,10,12]).map(function(v){
              return '<button class="lbtn'+((intro?introPer:perPage)===v?" on":"")+'" data-per="'+v+'">'+v+'</button>';
            }).join("")+
            (intro?'<span class="note">How many of a school\u2019s contestants share a screen before their '+
                   'coach follows. One introduces them individually.</span>':'')+'</div>')+
        '<div class="deskrow"><span class="lab">Page</span>'+
          '<button class="lbtn" data-pg="-1"'+(!pl||disp.page===0?" disabled":"")+'>\u25c0 Previous</button>'+
          '<button class="lbtn" data-pg="1"'+(!pl||disp.page>=pages-1?" disabled":"")+'>Next \u25b6</button>'+
          '<span class="note">'+(pl
            ? (mech ? (pl.length+" mechanics screens \u00b7 showing screen "+(disp.page+1)+" of "+pages)
              : (intro ? (pl.length+" screen"+(pl.length===1?"":"s")+" \u00b7 school by school, each followed "+
                          "by their coach \u00b7 showing "+(disp.page+1)+" of "+pages)
                       : (pl.length+" contestants \u00b7 "+per()+" per page \u00b7 showing page "+
                          (disp.page+1)+" of "+pages)))
            : "This cue is a single screen")+'</span></div>'+
        '<div class="deskrow"><span class="lab">Reveal</span>'+rev+
          '<button class="lbtn" data-reveal="0">Hide both</button>'+
          '<button class="lbtn'+(disp.cue==="champion"?" on":"")+'" data-cue="champion">Then the champion</button>'+
          '<span class="note">The champion has a card of their own — R walks the three in order.</span></div>'+
      '</div>'+
      '<div class="legend">Shortcuts: T returns to the title card and M shows the contest mechanics, from anywhere. '+
      'On this tab, the number badge on each cue picks it, left and right arrows turn the page, and R walks the declaration — '+
      '3rd placer, 2nd placer, then the champion’s card.'+
      (photos<named().length ? ' <b>'+(named().length-photos)+' contestants have no photo yet</b> — add them on the Roster tab; the introduction screen shows their number instead.' : '')+
      (namedCoaches().filter(function(k){ return !isPhoto(k.photo); }).length
        ? ' Coaches without a photo show their initials on their screen.' : '')+
      '</div></div>';
  }

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
    if(disp.cue==="mechanics" || disp.cue==="introduce") return 1;
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
    var logo = schoolLogo(school);
    return '<div class="sect schead">'+
      (logo ? '<img class="slogo" src="'+logo+'" alt="">' : '')+
      '<div class="stxt"><div class="sname">'+esc(school || "No school given")+'</div>'+
      '<div class="ssub">'+sub+'</div></div></div>';
  }

  function sceneHTML(){
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

  /* ===================== contestant portraits =====================
     Photos live in the session file as data URIs, so a saved session is still
     one self-contained .json you can carry to the venue. That only works if
     they are small: every picture is redrawn through a canvas at no more than
     PHOTO_MAX on its long side before it is stored. A 4 MB phone photo comes
     out around 80 KB, so a full roster adds a couple of megabytes, not sixty. */
  var PHOTO_MAX = 720;
  var LOGO_MAX = 360;             // a school seal is line art, not a photograph
  var photoFor = null;            // {kind:"c"|"k", i:index} — who the file picker is filling

  function isPhoto(v){ return typeof v==="string" && /^data:image\//.test(v); }

  /* opts.max caps the long side, opts.alpha keeps transparency — a school seal
     is usually cut out, and flattening it onto white would box it in. A logo is
     line art, so PNG at 360px costs less than the photographs do. */
  function shrink(file, done, opts){
    opts = opts || {};
    var max = opts.max || PHOTO_MAX;
    var fr = new FileReader();
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){
        var w = img.naturalWidth, h = img.naturalHeight;
        if(!w || !h){ done(null); return; }
        var sc = Math.min(1, max/Math.max(w,h));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(w*sc));
        cv.height = Math.max(1, Math.round(h*sc));
        var cx = cv.getContext("2d");
        if(!opts.alpha){
          cx.fillStyle = "#fff";                     // flatten transparency
          cx.fillRect(0,0,cv.width,cv.height);
        }
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        try{
          done(opts.alpha ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.85));
        }catch(err){ done(null); }
      };
      img.onerror = function(){ done(null); };
      img.src = fr.result;
    };
    fr.onerror = function(){ done(null); };
    fr.readAsDataURL(file);
  }

  // schools are addressed by name, not by row: the derived list can reshuffle
  // while the file dialog is open
  function pickPhoto(kind, i, school){
    photoFor = {kind:kind, i:i, school:school};
    $("photoIn").click();
  }

  $("photoIn").addEventListener("change", function(e){
    var f = e.target.files[0], tgt = photoFor;
    e.target.value = ""; photoFor = null;
    if(!f || !tgt) return;
    if(!/^image\//.test(f.type)){ toast("That file isn't a picture"); return; }
    if(tgt.kind==="s"){
      shrink(f, function(uri){
        if(!uri){ toast("Could not read that picture"); return; }
        setSchoolLogo(tgt.school, uri);
        render();
        toast("Logo added for "+tgt.school);
      }, {max:LOGO_MAX, alpha:true});
      return;
    }
    shrink(f, function(uri){
      if(!uri){ toast("Could not read that picture"); return; }
      var who = tgt.kind==="k" ? coaches()[tgt.i] : state.contestants[tgt.i];
      if(!who) return;
      who.photo = uri;
      render();
      toast("Photo added for "+(who.name || (tgt.kind==="k" ? "the coach" : "slot "+who.no)));
    });
  });

  /* Portrait for the audience screen. With no photo it falls back to the
     contestant's number, or — for a coach, who has no number — their initials. */
  function portrait(c, extra){
    // the school's crest sits behind whatever the frame holds. A photograph is
    // cropped to fill, so it covers the crest; the numbered placeholder does not,
    // which is where the crest earns its keep
    var logo = schoolLogo(c.school);
    return '<div class="por'+(extra?" "+extra:"")+'">'+
      (logo ? '<i class="crest" style="background-image:url(&#39;'+logo+'&#39;)"></i>' : '')+
      (isPhoto(c.photo)
        ? '<img src="'+c.photo+'" alt="'+esc(c.name)+'">'
        : '<div class="noimg">'+esc(c.no==null ? initials(c.name) : String(c.no))+'</div>')+'</div>';
  }

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
    renderTop(); renderTabs();
    var v = $("view");
    if(tab==="roster") v.innerHTML = renderRoster();
    else if(tab==="standings") v.innerHTML = renderStandings();
    else if(tab==="sd") v.innerHTML = renderSd();
    else if(tab==="display") v.innerHTML = renderDesk();
    else v.innerHTML = renderRound(tab);
    renderModal();
    paintDisplay();
  }

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
    var slEl = t.closest ? t.closest("[data-slogo]") : null;
    if(slEl){ pickPhoto("s", 0, slEl.dataset.slogo); return; }
    var slDel = t.closest ? t.closest("[data-slogodel]") : null;
    if(slDel){ clearSchoolLogo(slDel.dataset.slogodel); render(); toast("Logo removed"); return; }
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
      case "btnAddCoach": case "btnAddCoach2": addCoach(); break;
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
      case "btnOpen": $("fileIn").click(); break;
      case "btnForm1": exportForm1(); break;
      case "btnCsv": exportCsv(); break;
    }
  });

  document.addEventListener("input", function(e){
    var t = e.target;
    if(t.classList && t.classList.contains("rin")){
      state.contestants[+t.dataset.i][t.dataset.f] = t.value;
      renderTop(); renderTabs(); refreshCoachUI(); paintDisplay();
      var note = document.querySelector(".panel-head .note");
      if(note) note.textContent = named().length+" of "+state.contestants.length+" slots filled";
      return;
    }
    if(t.classList && t.classList.contains("kin")){
      var kk = coaches()[+t.dataset.ki];
      if(kk){ kk[t.dataset.kf] = t.value; refreshCoachUI(); paintDisplay(); }
      return;
    }
    if(t.dataset && t.dataset.m){ state.meta[t.dataset.m] = t.value; renderTop(); paintDisplay(); }
  });

  // the roster's coach chooser — a full redraw, since it moves a contestant
  // from one coach to another everywhere they are listed
  document.addEventListener("change", function(e){
    var t = e.target;
    if(t.dataset && t.dataset.coach!==undefined){
      var c = state.contestants[+t.dataset.coach];
      c.coachId = t.value || null;
      render();
      toast(c.coachId ? (c.name||("No. "+c.no))+" is under "+coachName(c) : "Coach cleared");
    }
  });

  document.addEventListener("keydown", function(e){
    if(e.key==="Escape" && $("preview").classList.contains("show")){ $("preview").classList.remove("show"); return; }
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

  /* ===================== save / open / export ===================== */
  function dl(name,text,type){
    var b=new Blob([text],{type:type||"text/plain;charset=utf-8"}), u=URL.createObjectURL(b),
        a=document.createElement("a");
    a.href=u; a.download=name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function(){ URL.revokeObjectURL(u); },1000);
  }
  function stamp(){ var d=new Date(), p=function(n){ return (n<10?"0":"")+n; };
    return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"-"+p(d.getHours())+p(d.getMinutes()); }
  function saveSession(){
    dl("psq-"+(state.meta.place||"tally").toLowerCase().replace(/\s+/g,"-")+"-"+stamp()+".json",
       JSON.stringify(state,null,2),"application/json");
    toast("Session saved to your downloads");
  }
  $("fileIn").addEventListener("change", function(e){
    var f = e.target.files[0]; if(!f) return;
    var r = new FileReader();
    r.onload = function(){
      try{
        var d = JSON.parse(r.result);
        if(!d.contestants) throw new Error("bad");
        d.meta = d.meta || {};
        if(!d.meta.sdCount) d.meta.sdCount = 5;
        if(!Array.isArray(d.cut) || !d.cut.length) d.cut = null;   // sessions saved before the cut existed
        if(!Array.isArray(d.sdAck)) d.sdAck = [];
        if(!Array.isArray(d.coaches)) d.coaches = [];              // sessions saved before coaches existed
        if(!Array.isArray(d.schools)) d.schools = [];              // sessions saved before logos existed
        d.schools = d.schools.filter(function(x){
          return x && typeof x.name==="string" && isPhoto(x.logo);
        });
        sdPop = null;
        var kids = [];
        d.coaches.forEach(function(k,ix){
          if(!k.id || kids.indexOf(k.id)>=0) k.id = "k"+(ix+1)+"-"+ix;
          if(typeof k.name!=="string") k.name = "";
          if(typeof k.school!=="string") k.school = "";
          if(!isPhoto(k.photo)) k.photo = null;
          kids.push(k.id);
        });
        d.contestants.forEach(function(c){
          if(!c.sd || typeof c.sd[0]==="boolean") c.sd = new Array(d.meta.sdCount).fill(null);
          if(!isPhoto(c.photo)) c.photo = null;   // only ever put a data: image in an <img src>
          // a chosen coach who is no longer in the file goes back to following the school
          if(typeof c.coachId!=="string" || kids.indexOf(c.coachId)<0) c.coachId = null;
        });
        state = d; render(); toast("Session restored");
      }catch(err){ toast("That file isn't a saved PSQ session"); }
    };
    r.readAsText(f); e.target.value="";
  });
  /* ===== PSQ Form 1 workbook writer (mirrors the office Excel template) ===== */
  var CRC = (function(){
    var t = new Int32Array(256);
    for(var n=0;n<256;n++){
      var c=n;
      for(var k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      t[n]=c;
    }
    return t;
  })();
  function crc32(buf){
    var c = -1;
    for(var i=0;i<buf.length;i++) c = (c>>>8) ^ CRC[(c ^ buf[i]) & 0xFF];
    return (c ^ -1) >>> 0;
  }
  function enc(str){ return new TextEncoder().encode(str); }
  function push16(a,v){ a.push(v&0xFF,(v>>>8)&0xFF); }
  function push32(a,v){ a.push(v&0xFF,(v>>>8)&0xFF,(v>>>16)&0xFF,(v>>>24)&0xFF); }

  function zip(files){
    var out=[], central=[], offset=0;
    files.forEach(function(f){
      var name = enc(f.name), data = enc(f.data), crc = crc32(data);
      var h=[];
      push32(h,0x04034b50); push16(h,20); push16(h,0x0800); push16(h,0);
      push16(h,0); push16(h,0x21); push32(h,crc); push32(h,data.length); push32(h,data.length);
      push16(h,name.length); push16(h,0);
      out = out.concat(h, Array.from(name), Array.from(data));
      var c=[];
      push32(c,0x02014b50); push16(c,20); push16(c,20); push16(c,0x0800); push16(c,0);
      push16(c,0); push16(c,0x21); push32(c,crc); push32(c,data.length); push32(c,data.length);
      push16(c,name.length); push16(c,0); push16(c,0); push16(c,0); push16(c,0);
      push32(c,0); push32(c,offset);
      central = central.concat(c, Array.from(name));
      offset += h.length + name.length + data.length;
    });
    var e=[];
    push32(e,0x06054b50); push16(e,0); push16(e,0);
    push16(e,files.length); push16(e,files.length);
    push32(e,central.length); push32(e,offset); push16(e,0);
    return Uint8Array.from(out.concat(central, e));
  }

  function xesc(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                    .replace(/"/g,"&quot;");
  }
  function colName(n){
    var s="";
    while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=(n-m-1)/26; }
    return s;
  }

  /* ---- sheet builder ---- */
  function Sheet(){
    this.cells = {};      // "r,c" -> {v, s, f, t}
    this.merges = [];
    this.maxRow = 1; this.maxCol = 1;
  }
  Sheet.prototype.set = function(r,c,v,s,isFormula){
    if(v===null || v===undefined || v==="") { if(s===undefined) return; }
    var cell = {s:s||0};
    if(isFormula) cell.f = v;
    else if(typeof v === "number") cell.n = v;
    else if(v!=="" && v!==null && v!==undefined) cell.t = v;
    this.cells[r+","+c] = cell;
    if(r>this.maxRow) this.maxRow=r;
    if(c>this.maxCol) this.maxCol=c;
  };
  Sheet.prototype.merge = function(r1,c1,r2,c2){
    this.merges.push(colName(c1)+r1+":"+colName(c2)+r2);
    if(r2>this.maxRow) this.maxRow=r2;
    if(c2>this.maxCol) this.maxCol=c2;
  };
  Sheet.prototype.xml = function(cols){
    var rows = {}, self=this;
    Object.keys(this.cells).forEach(function(k){
      var p=k.split(","), r=+p[0], c=+p[1];
      (rows[r] = rows[r] || []).push({c:c, cell:self.cells[k]});
    });
    var body = Object.keys(rows).map(Number).sort(function(a,b){return a-b;}).map(function(r){
      var cs = rows[r].sort(function(a,b){ return a.c-b.c; }).map(function(o){
        var ref = colName(o.c)+r, cl = o.cell, s=' s="'+cl.s+'"';
        if(cl.f!==undefined) return '<c r="'+ref+'"'+s+'><f>'+xesc(cl.f)+'</f></c>';
        if(cl.n!==undefined) return '<c r="'+ref+'"'+s+'><v>'+cl.n+'</v></c>';
        if(cl.t!==undefined) return '<c r="'+ref+'"'+s+' t="inlineStr"><is><t xml:space="preserve">'+xesc(cl.t)+'</t></is></c>';
        return '<c r="'+ref+'"'+s+'/>';
      }).join("");
      return '<row r="'+r+'">'+cs+'</row>';
    }).join("");
    var colXml = cols.map(function(c){
      return '<col min="'+c[0]+'" max="'+c[1]+'" width="'+c[2]+'" customWidth="1"/>';
    }).join("");
    var mg = this.merges.length
      ? '<mergeCells count="'+this.merges.length+'">'+
        this.merges.map(function(m){ return '<mergeCell ref="'+m+'"/>'; }).join("")+'</mergeCells>'
      : "";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'+
      '<dimension ref="A1:'+colName(this.maxCol)+this.maxRow+'"/>'+
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>'+
      '<sheetFormatPr defaultRowHeight="14"/>'+
      '<cols>'+colXml+'</cols>'+
      '<sheetData>'+body+'</sheetData>'+
      mg+
      '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'+
      '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>'+
      '</worksheet>';
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<fonts count="5">'+
   '<font><sz val="10"/><name val="Arial"/></font>'+
   '<font><b/><sz val="10"/><name val="Arial"/></font>'+
   '<font><b/><sz val="14"/><name val="Arial"/></font>'+
   '<font><i/><sz val="9"/><name val="Arial"/></font>'+
   '<font><b/><sz val="11"/><name val="Arial"/></font>'+
  '</fonts>'+
  '<fills count="3">'+
   '<fill><patternFill patternType="none"/></fill>'+
   '<fill><patternFill patternType="gray125"/></fill>'+
   '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill>'+
  '</fills>'+
  '<borders count="3">'+
   '<border><left/><right/><top/><bottom/><diagonal/></border>'+
   '<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>'+
   '<border><left/><right/><top/><bottom style="thin"/><diagonal/></border>'+
  '</borders>'+
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
  '<cellXfs count="11">'+
   '<xf xfId="0" numFmtId="0" fontId="0" fillId="0" borderId="0"/>'+                                                   /*0 plain*/
   '<xf xfId="0" numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>'+ /*1 title*/
   '<xf xfId="0" numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'+ /*2 header*/
   '<xf xfId="0" numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>'+ /*3 data centered*/
   '<xf xfId="0" numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>'+  /*4 data left*/
   '<xf xfId="0" numFmtId="0" fontId="1" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>'+ /*5 total*/
   '<xf xfId="0" numFmtId="0" fontId="0" fillId="0" borderId="2" applyBorder="1"/>'+                                    /*6 signature rule*/
   '<xf xfId="0" numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/>'+                                      /*7 note*/
   '<xf xfId="0" numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>'+ /*8 bold centered*/
   '<xf xfId="0" numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>'+ /*9 italic centered*/
   '<xf xfId="0" numFmtId="0" fontId="4" fillId="0" borderId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left"/></xf>'+   /*10 block label*/
  '</cellXfs>'+
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'+
  '</styleSheet>';

  function workbook(sheetXml){
    return zip([
      {name:"[Content_Types].xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
        '<Default Extension="xml" ContentType="application/xml"/>'+
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
        '</Types>'},
      {name:"_rels/.rels", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
        '</Relationships>'},
      {name:"xl/workbook.xml", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
        '<sheets><sheet name="PSQ Form 1" sheetId="1" r:id="rId1"/></sheets>'+
        '<calcPr fullCalcOnLoad="1"/></workbook>'},
      {name:"xl/_rels/workbook.xml.rels", data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
        '</Relationships>'},
      {name:"xl/styles.xml", data:STYLES},
      {name:"xl/worksheets/sheet1.xml", data:sheetXml}
    ]);
  }

  /* ---- the PSQ Form 1 grid, column-for-column with the office template ---- */
  function buildForm1(meta, rows, opts){
    // rows: [{no,name,school,r1:[10 pts],r2:[],r3:[] or null,tb:[] or null}]
    var S = new Sheet();
    var n = Math.max(rows.length, 22);
    var R0 = 9, R1 = R0 + n - 1;

    var B = [
      {t:"ROUND 1 ",            no:1,  name:2,  nameEnd:4,  school:5, schoolEnd:11, q:12, tot:22, form:"PSQ Form 1", formCol:22, extra:[["Rank",23]]},
      {t:"ROUND 2 ",            no:25, name:26, nameEnd:29,                          q:30, tot:40, form:"PSQ Form 1", formCol:41,
       extra:[["Total Score Round 1",41],["Cumulative Score (Rounds 1 & 2)",42],["Rank\n(Rounds 1&2)",43]]},
      {t:"ROUND 3 ",            no:45, name:46, nameEnd:49,                          q:50, tot:60, form:"PSQ Form 1", formCol:63,
       extra:[["Cumulative Score (Rounds 1 & 2)",61],["Total Score (Rounds 1,2,3)",62],["Final Rank",63]]},
      {t:"TIE-BREAKING ROUND",  no:65, name:66, nameEnd:69,                          q:70, tot:80, form:"PSQ Form 1", formCol:80, extra:[]}
    ];
    var qTitle = ["Round 1","Round 2","Round 3","Tie-Breaking Round"];

    B.forEach(function(b,bi){
      var last = b.extra.length ? b.extra[b.extra.length-1][1] : b.tot;
      S.set(1, b.no, b.t, 10);
      S.set(1, b.formCol, "PSQ Form 1", 8);
      [[2, meta.edition],[3, meta.level],[4, meta.place]].forEach(function(p){
        S.set(p[0], b.no, p[1], 1);
        S.merge(p[0], b.no, p[0], last);
      });

      S.set(7, b.no, "No.", 2);  S.merge(7, b.no, 8, b.no);
      S.set(7, b.name, "Name", 2); S.merge(7, b.name, 8, b.nameEnd);
      if(b.school){ S.set(7, b.school, "School", 2); S.merge(7, b.school, 8, b.schoolEnd); }
      S.set(7, b.q, qTitle[bi], 2); S.merge(7, b.q, 7, b.tot);
      for(var i=0;i<10;i++) S.set(8, b.q+i, "Q"+(i+1), 2);
      S.set(8, b.tot, "TOTAL", 2);
      b.extra.forEach(function(x){ S.set(7, x[1], x[0], 2); S.merge(7, x[1], 8, x[1]); });
    });

    for(var i=0;i<n;i++){
      var r = R0+i, c = rows[i] || null;
      B.forEach(function(b,bi){
        S.set(r, b.no, i+1, 3);
        for(var j=b.name;j<=b.nameEnd;j++) S.set(r, j, null, 4);
        if(b.school) for(var j2=b.school;j2<=b.schoolEnd;j2++) S.set(r, j2, null, 4);
        S.merge(r, b.name, r, b.nameEnd);
        if(b.school) S.merge(r, b.school, r, b.schoolEnd);
        for(var q=0;q<10;q++) S.set(r, b.q+q, null, 3);
        S.set(r, b.tot, null, 5);
        b.extra.forEach(function(x){ S.set(r, x[1], null, 5); });
      });
      if(!c) continue;

      S.set(r, 2, c.name, 4);
      S.set(r, 5, c.school||"", 4);
      for(var q1=0;q1<10;q1++) S.set(r, 12+q1, c.r1[q1], 3);
      S.set(r, 22, "SUM(L"+r+":U"+r+")", 5, true);
      S.set(r, 23, "RANK(V"+r+",V$"+R0+":V$"+R1+")", 5, true);

      S.set(r, 26, 'IF(B'+r+'<>"",B'+r+',"")', 4, true);
      for(var q2=0;q2<10;q2++) S.set(r, 30+q2, c.r2[q2], 3);
      S.set(r, 40, "SUM(AD"+r+":AM"+r+")", 5, true);
      S.set(r, 41, "V"+r, 5, true);
      S.set(r, 42, "AN"+r+"+AO"+r, 5, true);
      S.set(r, 43, "RANK(AP"+r+",AP$"+R0+":AP$"+R1+")", 5, true);

      S.set(r, 46, 'IF(B'+r+'<>"",B'+r+',"")', 4, true);
      if(c.r3) for(var q3=0;q3<10;q3++) S.set(r, 50+q3, c.r3[q3], 3);
      S.set(r, 60, "SUM(AX"+r+":BG"+r+")", 5, true);
      S.set(r, 61, "AP"+r, 5, true);
      S.set(r, 62, "BH"+r+"+BI"+r, 5, true);
      S.set(r, 63, "RANK(BJ"+r+",$BJ$"+R0+":$BJ$"+R1+")", 5, true);

      S.set(r, 66, 'IF(B'+r+'<>"",B'+r+',"")', 4, true);
      if(c.tb) for(var q4=0;q4<10;q4++) S.set(r, 70+q4, c.tb[q4], 3);
      S.set(r, 80, "SUM(BR"+r+":CA"+r+")", 5, true);
    }

    // Board of Judges blocks
    var SR = R1 + 4;
    var judges = [
      [[1,4],[6,10],[12,17],[19,22]],
      [[25,27],[29,32],[34,38],[40,42]],
      [[45,48],[50,55],[57,60],[62,63]],
      [[65,70],[73,76],[78,79]]
    ];
    var roles = ["Member","Chairman","Member"];
    judges.forEach(function(blk, bi){
      var cols = blk.length===4 ? blk.slice(1) : blk;   // block 1 has a spare rule at the left
      blk.forEach(function(sp){
        for(var c=sp[0]; c<=sp[1]; c++) S.set(SR, c, null, 6);
        S.merge(SR, sp[0], SR, sp[1]);
      });
      cols.forEach(function(sp, i){
        S.set(SR+1, sp[0], roles[i], 8);          S.merge(SR+1, sp[0], SR+1, sp[1]);
        S.set(SR+2, sp[0], "Board of Judges", 8); S.merge(SR+2, sp[0], SR+2, sp[1]);
        S.set(SR+3, sp[0], "(Signature over printed name)", 9); S.merge(SR+3, sp[0], SR+3, sp[1]);
      });
    });

    var NR = SR + 6;
    S.set(NR, 2,  "Note:  Each correct answer in this round will get one (1) point.", 7);
    S.set(NR, 26, "Note:  Each correct answer in this round will get one (1) point.", 7);
    S.set(NR, 46, "Note:  Each correct answer in this round will get two (2) points.", 7);
    S.set(NR, 66, "Note:  Sudden death. A wrong answer eliminates the contestant.", 7);

    var cols = [[1,1,5],[2,4,9],[5,11,5],[12,23,4.6],[24,24,2],[25,25,5],[26,29,8],[30,43,4.6],
                [44,44,2],[45,45,5],[46,49,8],[50,63,4.6],[64,64,2],[65,65,5],[66,69,8],[70,80,4.6]];
    return workbook(S.xml(cols));
  }


  function exportForm1(){
    var list = named();
    if(!list.length){ toast("Add contestants first"); return; }
    var qual = qualifiers(), sdOn = hasSd();
    var rows = list.map(function(c,i){
      var tb = null;
      if(sdOn){
        tb = new Array(10).fill(null);
        for(var q=0;q<state.meta.sdCount;q++){
          if(c.sd[q]==="c") tb[q]=1; else if(c.sd[q]==="w") tb[q]=0;
        }
      }
      return {no:i+1, name:c.name, school:c.school,
        r1:c.r1.map(function(v){ return v?1:0; }),
        r2:c.r2.map(function(v){ return v?1:0; }),
        r3:(qual.indexOf(c)>=0 ? c.r3.map(function(v){ return v?2:0; }) : null),
        tb:tb};
    });
    var bytes = buildForm1(state.meta, rows);
    var b = new Blob([bytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    var u = URL.createObjectURL(b), a = document.createElement("a");
    a.href = u; a.download = "PSQ-Form-1-"+(state.meta.place||"tally").replace(/\s+/g,"-")+"-"+stamp()+".xlsx";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(u); }, 1500);
    toast("PSQ Form 1 exported");
  }

  function exportCsv(){
    var s = standings(), q = qualifiers();
    var head = ["No.","Name","School","Coach"];
    ["r1","r2","r3"].forEach(function(k){
      for(var i=1;i<=QN;i++) head.push(LABEL[k]+" Q"+i);
      head.push(LABEL[k]+" total");
    });
    for(var i=1;i<=state.meta.sdCount;i++) head.push("Tie-break Q"+i);
    head.push("Rounds 1 & 2","Qualified for Round 3","Grand total","Place");
    var lines = [head];
    named().forEach(function(c){
      var row = [c.no,c.name,c.school,coachName(c)];
      ["r1","r2","r3"].forEach(function(k){
        for(var i=0;i<QN;i++) row.push(c[k][i]?PTS[k]:0);
        row.push(rt(c,k));
      });
      for(var i=0;i<state.meta.sdCount;i++) row.push(c.sd[i]==="c"?"correct":(c.sd[i]==="w"?"wrong":""));
      row.push(cum12(c), q.indexOf(c)>=0?"yes":"no", grand(c), s.place.get(c));
      lines.push(row);
    });
    var csv = lines.map(function(r){ return r.map(function(v){
      v = String(v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
    }).join(","); }).join("\n");
    dl("psq-tally-"+stamp()+".csv", csv, "text/csv;charset=utf-8");
    toast("CSV exported");
  }

  var tT;
  function toast(m){ var el=$("toast"); el.textContent=m; el.classList.add("show");
    clearTimeout(tT); tT=setTimeout(function(){ el.classList.remove("show"); },2200); }

  window.addEventListener("beforeunload", function(e){
    if(winRef && !winRef.closed) winRef.close();
    if(named().length){ e.preventDefault(); e.returnValue=""; }
  });
  window.addEventListener("resize", function(){ paintDisplay(); });
  setInterval(function(){
    if(winRef && winRef.closed){ winRef=null; render(); }
  }, 1500);

  render();
})();
