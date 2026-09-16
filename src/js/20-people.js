"use strict";
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
  /* Institutions are not encoded anywhere — a school is whatever was typed on the
     roster and against the coaches, an organisation whatever was typed against a
     judge. The two are the same kind of thing as far as a logo goes, so one
     registry holds both, keyed on the name the same way coaches are matched. An
     entry whose name is no longer typed anywhere is kept rather than pruned, so
     correcting a spelling and typing it back brings the logo with it.
     (The state key stays `schools` so sessions saved before judges still open.) */
  function logoStore(){ return state.schools || (state.schools = []); }
  function logoEntry(name){
    var n = normSch(name);
    if(!n) return null;
    return logoStore().filter(function(x){ return normSch(x.name)===n; })[0] || null;
  }
  function logoFor(name){
    var e = logoEntry(name);
    return e && isPhoto(e.logo) ? e.logo : null;
  }
  function setLogo(name, uri){
    var e = logoEntry(name);
    if(!e){ e = {name:String(name==null?"":name).trim(), logo:null}; logoStore().push(e); }
    e.logo = uri;
  }
  function clearLogo(name){
    var n = normSch(name);
    state.schools = logoStore().filter(function(x){ return normSch(x.name)!==n; });
  }
  // every school and organisation named anywhere, alphabetically, with who uses it
  function logoList(){
    var seen = {}, out = [];
    function add(name, field){
      var n = normSch(name);
      if(!n) return;
      var e = seen["s"+n];
      if(!e){
        e = seen["s"+n] = {key:n, name:String(name).trim(), contestants:0, coaches:0, judges:0};
        out.push(e);
      }
      e[field]++;
    }
    named().forEach(function(c){ add(c.school, "contestants"); });
    state.contestants.forEach(function(c){ if(!c.name.trim()) add(c.school, "contestants"); });
    namedCoaches().forEach(function(k){ add(k.school, "coaches"); });
    namedJudges().forEach(function(j){ add(j.org, "judges"); });
    out.sort(function(a,b){ return a.key<b.key ? -1 : 1; });
    return out;
  }

  /* The Board of Judges — Section A of the mechanics. They are introduced one to
     a screen, in the order they are listed here, so the list is the running
     order and the arrows in the panel are how it is set. */
  var JUDGE_ROLES = ["Chairman", "Member"];
  function judges(){ return state.judges || (state.judges = []); }
  function namedJudges(){ return judges().filter(function(j){ return j.name.trim()!==""; }); }
  function chairs(){ return namedJudges().filter(function(j){ return j.role==="Chairman"; }); }

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

