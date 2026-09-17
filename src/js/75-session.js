"use strict";
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

  /* Make a loaded object safe to install as the state, whatever it has been
     through — an older save, a hand-edited file, a half-written snapshot. Throws
     if it is not a session at all. One function, because it is used by both the
     Open session button and the autosave restore, and those two drifting apart
     would be a bug nobody would notice until the wrong one was used. */
  function normaliseSession(d){
    if(!d || typeof d !== "object" || !Array.isArray(d.contestants)) throw new Error("not a session");
    d.meta = d.meta || {};
    if(!d.meta.sdCount) d.meta.sdCount = 5;
    if(!Array.isArray(d.cut) || !d.cut.length) d.cut = null;   // sessions saved before the cut existed
    if(!Array.isArray(d.sdAck)) d.sdAck = [];
    if(!Array.isArray(d.coaches)) d.coaches = [];              // sessions saved before coaches existed

    // sessions saved before the deck existed, and any half-formed slide in one
    if(!d.deck || typeof d.deck !== "object" || !Array.isArray(d.deck.slides)){
      d.deck = {name:"", slides:[]};
    }
    d.deck.slides = d.deck.slides.filter(function(s){ return s && isPhoto(s.image); });
    d.deck.slides.forEach(function(s){
      if(s.role !== "question" && s.role !== "answer") s.role = "other";
      if(["r1","r2","r3","sd"].indexOf(s.round) < 0) s.round = null;
      if(typeof s.seconds !== "number" || !(s.seconds > 0)) s.seconds = null;
    });

    if(!Array.isArray(d.judges)) d.judges = [];                // sessions saved before the board existed
    d.judges = d.judges.filter(function(j){ return j && typeof j==="object"; });
    d.judges.forEach(function(j){
      if(typeof j.name!=="string") j.name = "";
      if(JUDGE_ROLES.indexOf(j.role)<0) j.role = "Member";
      if(typeof j.office!=="string") j.office = "";
      if(typeof j.org!=="string") j.org = "";
      if(!isPhoto(j.photo)) j.photo = null;
    });

    /* The programme. A session saved before it existed gets the standard one
       rather than an empty list: a board with no programme would be a board that
       had lost the day's running order, which is not what that file meant. */
    if(!Array.isArray(d.programme) || !d.programme.length) d.programme = defaultProgramme();
    var pids = [];
    d.programme = d.programme.filter(function(p){ return p && typeof p==="object"; });
    d.programme.forEach(function(p, ix){
      if(typeof p.id!=="string" || !p.id || pids.indexOf(p.id)>=0) p.id = "s"+(ix+1)+"-"+ix;
      pids.push(p.id);
      p.part = p.part===2 ? 2 : 1;
      ["title","name","office","org"].forEach(function(f){
        if(typeof p[f]!=="string") p[f] = "";
      });
      if(!Array.isArray(p.items)) p.items = [];
      p.items = p.items.filter(function(x){ return typeof x==="string" && x.trim()!==""; });
      if(!PROG_CUES.some(function(c){ return c.v===p.cue; })) p.cue = "segment";
      if(["r1","r2","r3"].indexOf(p.round)<0) p.round = p.cue==="round" ? "r1" : null;
      p.done = !!p.done;
      if(!isPhoto(p.photo)) p.photo = null;
    });
    if(typeof d.progNow!=="string" || pids.indexOf(d.progNow)<0) d.progNow = null;

    if(!Array.isArray(d.hosts)) d.hosts = defaultHosts();
    d.hosts = d.hosts.filter(function(h){ return h && typeof h==="object"; });
    d.hosts.forEach(function(h){
      ["role","name","org"].forEach(function(f){ if(typeof h[f]!=="string") h[f] = ""; });
      if(!isPhoto(h.photo)) h.photo = null;
    });
    if(typeof d.meta.venue!=="string") d.meta.venue = "";

    if(!Array.isArray(d.schools)) d.schools = [];              // sessions saved before logos existed
    d.schools = d.schools.filter(function(x){
      return x && typeof x.name==="string" && isPhoto(x.logo);
    });

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
    return d;
  }

  function installSession(d){
    sdPop = null;
    ask.phase = "off";            // never come back with the clock half-run
    stopTicking();
    deckSel = []; deckAnchor = null;
    state = d;
    render();
  }

  $("fileIn").addEventListener("change", function(e){
    var f = e.target.files[0]; if(!f) return;
    var r = new FileReader();
    r.onload = function(){
      try{
        installSession(normaliseSession(JSON.parse(r.result)));
        toast("Session restored");
      }catch(err){ toast("That file isn't a saved PSQ session"); }
    };
    r.readAsText(f); e.target.value="";
  });
