"use strict";
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

