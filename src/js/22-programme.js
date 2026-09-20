"use strict";
  /* ===================== the programme =====================
     Until now the board knew only the parts of the day that carry a score. The
     rest of the programme — the prayer, the welcome, the inspirational message,
     the two awardings, the closing remarks — happened around it while the screen
     sat on a title card.

     So the whole programme is encoded here, in the order it runs, and the board
     drives it. Every segment says what the audience should see while it is on,
     and taking the next one puts that on screen. The printed programme and the
     projector cannot drift apart, because they are the same list read twice. */

  var PART_LABEL = {1:"Part I", 2:"Part II — Contest proper"};

  /* What a segment puts on screen when it is taken. Most are the board's own
     cues; "segment" is the card built from the segment itself — its title, and
     whoever is taking it. */
  var PROG_CUES = [
    {v:"segment",     t:"This segment’s own card"},
    {v:"standby",     t:"Title card"},
    {v:"programme",   t:"The programme"},
    {v:"mechanics",   t:"Contest mechanics"},
    {v:"introduce",   t:"Introduce contestants"},
    {v:"judges",      t:"Board of Judges"},
    {v:"round",       t:"Round scores"},
    {v:"advancing",   t:"Advancing to Round 3"},
    {v:"leaderboard", t:"Leaderboard"},
    {v:"reveal",      t:"2nd & 3rd placers"},
    {v:"champion",    t:"Champion card"},
    {v:"blank",       t:"Blank the screen"}
  ];

  /* The 30th PSQ Provincial Elimination programme as printed. It is seeded
     rather than left blank for the same reason the event name and the date are:
     this board is built for one contest, and every line of it is editable. */
  function defaultProgramme(){
    function s(id, part, title, extra){
      var o = {id:id, part:part, title:title, items:[], name:"", office:"",
               org:"", photo:null, cue:"segment", round:null, done:false};
      if(extra) for(var k in extra) o[k] = extra[k];
      return o;
    }
    return [
      s("reg",     1, "Registration", {office:"Secretariat"}),
      s("prelim",  1, "Preliminaries", {items:["Prayer","National Anthem","MIMAROPA Hymn"]}),
      s("welcome", 1, "Welcome Message",
        {name:"Gemma N. Opis", office:"Chief Statistical Specialist"}),
      s("guest",   1, "Introduction of Guest Speaker",
        {name:"Abejen Shayne P. Mayores", office:"Statistical Analyst"}),
      s("inspire", 1, "Inspirational Message",
        {name:"Hon. Aurelio Leva III", office:"Provincial Board Member"}),
      s("present", 1, "Presentation of the Contestants and Coaches", {cue:"introduce"}),
      s("board",   1, "Introduction of the Members of the Board of Judges", {cue:"judges"}),
      s("mech",    2, "Presentation of the Contest Mechanics", {cue:"mechanics"}),
      s("rd1",     2, "Round 1", {cue:"round", round:"r1"}),
      s("rd2",     2, "Round 2", {cue:"round", round:"r2"}),
      s("appre",   2, "Awarding of Certificate of Appreciation",
        {items:["Judges & Sponsors"]}),
      s("rd3",     2, "Round 3", {cue:"round", round:"r3"}),
      s("partic",  2, "Awarding of Certificate of Participation",
        {items:["Contestants and Coaches"]}),
      s("winners", 2, "Announcement of Winners and Awarding of Prizes", {cue:"reveal"}),
      s("closing", 2, "Closing Remarks",
        {name:"Harvy M. Fabaleña", office:"Senior Statistical Specialist"})
    ];
  }
  /* The emcee and the Quizmaster are not segments — they are on all day. They
     sit at the foot of the printed programme, and at the foot of the screen. */
  function defaultHosts(){
    return [{role:"Emcee",      name:"Sonny Jr. R. Dela Cruz",   org:"", photo:null},
            {role:"Quiz Master", name:"Frenz Darren J. Medallon", org:"", photo:null}];
  }

  function prog(){ return state.programme || (state.programme = defaultProgramme()); }
  function hosts(){ return state.hosts || (state.hosts = defaultHosts()); }
  function namedHosts(){ return hosts().filter(function(h){ return h.name.trim()!==""; }); }
  function segById(id){
    if(!id) return null;
    return prog().filter(function(p){ return p.id===id; })[0] || null;
  }
  function nowSeg(){ return segById(state.progNow); }
  function segIndex(seg){ return seg ? prog().indexOf(seg) : -1; }
  function newSegId(){ var n = 1; while(segById("s"+n)) n++; return "s"+n; }
  function segDone(){ return prog().filter(function(p){ return p.done; }).length; }
  function segWhere(seg){ return seg ? PART_LABEL[seg.part]+" · "+seg.title : ""; }

  /* Taking a segment is the one move the run of show has: it becomes the one
     that is on, the one it replaces is marked off, and the screen follows to
     whatever that segment says it should carry. Nothing here is automatic —
     the programme advances when the emcee does, not when a score arrives. */
  function takeSegment(id){
    var seg = segById(id);
    if(!seg) return;
    var prev = nowSeg();
    if(prev && prev!==seg) prev.done = true;
    seg.done = false;
    state.progNow = seg.id;
    disp.page = 0;
    if(seg.cue==="round" && seg.round) setCue("round", seg.round);
    else setCue(seg.cue || "segment");
    toast("On now: "+seg.title);
  }
  function stepSegment(d){
    var list = prog();
    if(!list.length){ toast("No programme encoded"); return; }
    var i = segIndex(nowSeg());
    var to = i<0 ? (d>0 ? 0 : list.length-1) : i+d;
    if(to<0){ toast("That is the first segment"); return; }
    if(to>=list.length){ toast("That was the last segment"); return; }
    takeSegment(list[to].id);
  }
  function toggleSegDone(i){
    var p = prog()[i];
    if(!p) return;
    p.done = !p.done;
    if(p.done && state.progNow===p.id) state.progNow = null;
    render();
  }
  function addSegment(){
    var now = nowSeg();
    prog().push({id:newSegId(), part:(now?now.part:1), title:"", items:[], name:"",
                 office:"", org:"", photo:null, cue:"segment", round:null, done:false});
    render();
    var el = document.querySelector('.pin[data-pf="title"][data-pi="'+(prog().length-1)+'"]');
    if(el) el.focus();
  }
  function removeSegment(i){
    var p = prog()[i];
    if(!p) return;
    if(p.title.trim() && !confirm("Delete “"+p.title+"” from the programme?")) return;
    if(state.progNow===p.id) state.progNow = null;
    prog().splice(i,1);
    photoFor = null;                    // a file picker mid-flight no longer knows its row
    render(); toast((p.title.trim()||"The segment")+" deleted");
  }
  function moveSegment(i, d){
    var list = prog(), to = i+d;
    if(to<0 || to>=list.length) return;
    var tmp = list[i]; list[i] = list[to]; list[to] = tmp;
    photoFor = null;
    render();
    var el = document.querySelector('[data-pmove="'+to+'"][data-dir="'+d+'"]');
    if(el && !el.disabled) el.focus();
  }
  function resetProgramme(){
    if(!confirm("Restore the standard programme?\n\nEvery segment you have added, renamed or "+
                "reordered is replaced, and the photographs on them go too. The roster, the "+
                "judges and the tally are untouched.")) return;
    state.programme = defaultProgramme();
    state.progNow = null;
    photoFor = null;
    render(); toast("The standard programme is back");
  }
  function addHost(){
    hosts().push({role:"", name:"", org:"", photo:null});
    render();
    var el = document.querySelector('.hin[data-hf="role"][data-hi="'+(hosts().length-1)+'"]');
    if(el) el.focus();
  }
  function removeHost(i){
    var h = hosts()[i];
    if(!h) return;
    if(h.name.trim() && !confirm("Delete "+h.name+"?")) return;
    hosts().splice(i,1);
    photoFor = null;
    render(); toast((h.name.trim()||"The row")+" deleted");
  }

  /* ---- the run of show, on the operator's side ----
     The same row goes on the Display desk, on the Run tab and at the top of the
     Programme tab, because the operator may be on any of the three when the
     emcee moves on. */
  function progRow(){
    var list = prog(), now = nowSeg(), i = segIndex(now);
    var note = now
      ? esc(segWhere(now))+" · "+(i+1)+" of "+list.length+" · "+segDone()+" done"
      : (list.length ? "Nothing taken yet — Next starts at “"+esc(list[0].title)+"”"
                     : "No programme encoded — the Programme tab builds one");
    return '<div class="deskrow"><span class="lab">Programme</span>'+
      '<button class="lbtn" id="btnProgPrev"'+(i<=0?" disabled":"")+'>◀ Previous</button>'+
      '<button class="lbtn go" id="btnProgNext"'+
        (!list.length || i>=list.length-1 ? " disabled":"")+'>'+
        (now ? "Next segment ▶" : "Start the programme ▶")+'</button>'+
      '<button class="lbtn'+(disp.cue==="programme"?" on":"")+'" data-cue="programme">The programme</button>'+
      '<button class="lbtn'+(disp.cue==="segment"?" on":"")+'" data-cue="segment"'+
        (list.length?"":" disabled")+'>This segment</button>'+
      '<span class="note">'+note+'</span></div>';
  }

  /* ---- the Programme tab ---- */
  function renderProgramme(){
    var list = prog(), now = nowSeg();
    var rows = list.map(function(p,i){
      var has = isPhoto(p.photo);
      var isNow = now===p;
      return '<tr class="'+(isNow?"segnow":(p.done?"segdone":""))+'">'+
        '<td class="no pad">'+(i+1)+'</td>'+
        '<td class="pad"><select class="psel" data-ppart="'+i+'" aria-label="Part for '+
          esc(p.title||("segment "+(i+1)))+'">'+
          [1,2].map(function(n){
            return '<option value="'+n+'"'+(p.part===n?" selected":"")+'>'+
              (n===1?"I":"II")+'</option>';
          }).join("")+'</select></td>'+
        '<td class="pad segcell">'+
          '<input class="pin" data-pf="title" data-pi="'+i+'" value="'+esc(p.title)+
            '" placeholder="Segment">'+
          '<input class="pin sub" data-pf="items" data-pi="'+i+'" value="'+
            esc((p.items||[]).join(", "))+'" placeholder="Sub-items, separated by commas">'+
        '</td>'+
        '<td class="pad segcell">'+
          '<input class="pin" data-pf="name" data-pi="'+i+'" value="'+esc(p.name)+
            '" placeholder="Who takes it (optional)">'+
          '<input class="pin sub" data-pf="office" data-pi="'+i+'" value="'+esc(p.office)+
            '" placeholder="Position">'+
        '</td>'+
        '<td class="pad orgcell"><input class="pin" data-pf="org" data-pi="'+i+'" value="'+esc(p.org)+
          '" placeholder="Organisation" list="schoolList"></td>'+
        '<td class="pad photocell">'+
          (has ? '<img class="thumb" src="'+p.photo+'" alt="'+esc(p.name)+'">'
               : '<span class="thumb none">'+esc(p.name.trim()?initials(p.name):"—")+'</span>')+
          '<button class="lbtn tiny" data-pphoto="'+i+'">'+(has?"Replace":"Add photo")+'</button>'+
          (has ? '<button class="lbtn tiny danger" data-punphoto="'+i+'">Remove</button>' : '')+
        '</td>'+
        '<td class="pad">'+
          '<select class="psel" data-pcue="'+i+'" aria-label="What the screen shows during '+
            esc(p.title||("segment "+(i+1)))+'">'+
            PROG_CUES.map(function(c){
              return '<option value="'+c.v+'"'+(p.cue===c.v?" selected":"")+'>'+esc(c.t)+'</option>';
            }).join("")+'</select>'+
          (p.cue==="round"
            ? '<select class="psel sub" data-pround="'+i+'" aria-label="Which round">'+
              ["r1","r2","r3"].map(function(k){
                return '<option value="'+k+'"'+(p.round===k?" selected":"")+'>'+LABEL[k]+'</option>';
              }).join("")+'</select>'
            : '')+
        '</td>'+
        '<td class="st">'+(isNow
          ? '<span class="pill now">on now</span>'
          : (p.done ? '<span class="pill done">done</span>' : '—'))+'</td>'+
        '<td class="pad actions">'+
          '<button class="lbtn tiny'+(isNow?" on":" go")+'" data-ptake="'+p.id+'">'+
            (isNow?"On screen":"Take it")+'</button>'+
          '<button class="lbtn tiny" data-pdone="'+i+'">'+(p.done?"Not done":"Done")+'</button>'+
          '<button class="lbtn tiny" data-pmove="'+i+'" data-dir="-1"'+(i===0?" disabled":"")+
            ' aria-label="Move earlier">▲</button>'+
          '<button class="lbtn tiny" data-pmove="'+i+'" data-dir="1"'+(i===list.length-1?" disabled":"")+
            ' aria-label="Move later">▼</button>'+
          '<button class="lbtn tiny danger" data-pdel="'+i+'">Delete</button>'+
        '</td></tr>';
    }).join("");

    var body = list.length
      ? '<div class="scroll"><table><thead><tr><th class="c">No.</th><th class="c">Part</th>'+
        '<th>Segment</th><th>Who takes it</th><th>Organisation</th><th class="c">Photo</th>'+
        '<th>On screen</th><th class="c">Status</th><th></th></tr></thead><tbody>'+rows+
        '</tbody></table></div>'
      : '<div class="empty-state"><p>No programme encoded. The board can run the whole day from '+
        'this list — every segment, in order, with what the audience sees during it.</p>'+
        '<button class="lbtn go" id="btnProgReset">Load the standard programme</button></div>';

    var p1 = list.filter(function(p){ return p.part===1; }).length;

    return '<div class="panel">'+
      '<div class="panel-head"><h3>Programme</h3>'+
      '<span class="note">'+list.length+' segment'+(list.length===1?"":"s")+
        ' · '+p1+' in Part I, '+(list.length-p1)+' in Part II · '+segDone()+' done</span>'+
      '<div class="right"><button class="lbtn" id="btnAddSeg">Add a segment</button>'+
      '<button class="lbtn" id="btnProgReset">Restore the standard programme</button></div></div>'+
      '<div class="desk" style="padding:0 15px 14px">'+progRow()+'</div>'+
      body+
      '<div class="legend">Take it puts the segment on and marks the one before it done — or use '+
      'Previous and Next, here, on the Display tab or on the Run tab. The left and right arrow keys '+
      'do the same while this tab is open. <b>On screen</b> is what the audience sees when a segment '+
      'is taken: its own card by default, or one of the board’s cues, so Round 1 puts the Round 1 '+
      'scores up and the presentation of the contestants starts the introductions. '+
      'Sub-items are the lines under a heading — the prayer, the anthem and the hymn under '+
      'Preliminaries. A segment with nobody named is a heading; name someone and it becomes a card '+
      'with their portrait, position and organisation, the same card the coaches and judges get.</div>'+
      '</div>'+
      renderHostPanel()+
      '<datalist id="schoolList">'+schoolOptions()+'</datalist>';
  }

  function renderHostPanel(){
    var hs = hosts();
    var rows = hs.map(function(h,i){
      var has = isPhoto(h.photo);
      return '<tr><td class="no pad">'+(i+1)+'</td>'+
        '<td class="pad"><input class="hin" data-hf="role" data-hi="'+i+'" value="'+esc(h.role||"")+
          '" placeholder="Emcee, Quiz Master…"></td>'+
        '<td class="pad"><input class="hin" data-hf="name" data-hi="'+i+'" value="'+esc(h.name)+
          '" placeholder="Name"></td>'+
        '<td class="pad orgcell"><input class="hin" data-hf="org" data-hi="'+i+'" value="'+esc(h.org||"")+
          '" placeholder="Organisation (optional)" list="schoolList"></td>'+
        '<td class="pad photocell">'+
          (has ? '<img class="thumb" src="'+h.photo+'" alt="'+esc(h.name)+'">'
               : '<span class="thumb none">'+esc(initials(h.name))+'</span>')+
          '<button class="lbtn tiny" data-hphoto="'+i+'">'+(has?"Replace":"Add photo")+'</button>'+
          (has ? '<button class="lbtn tiny danger" data-hunphoto="'+i+'">Remove</button>' : '')+
        '</td>'+
        '<td class="pad actions"><button class="lbtn tiny danger" data-hdel="'+i+'">Delete row</button></td>'+
        '</tr>';
    }).join("");

    var body = hs.length
      ? '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>Role</th><th>Name</th>'+
        '<th>Organisation</th><th class="c">Photo</th><th></th></tr></thead><tbody>'+rows+
        '</tbody></table></div>'
      : '<div class="empty-state"><p>Nobody encoded. The emcee and the Quizmaster sit at the foot '+
        'of the printed programme — they sit at the foot of the screen too.</p>'+
        '<button class="lbtn go" id="btnAddHost">Add a name</button></div>';

    return '<div class="panel"><div class="panel-head"><h3>Emcee &amp; Quizmaster</h3>'+
      '<span class="note">'+namedHosts().length+' encoded · shown on the title card and under the programme</span>'+
      '<div class="right"><button class="lbtn" id="btnAddHost2">Add a name</button></div></div>'+
      body+
      '<div class="legend">These two are on all day rather than at one point of the programme, so they '+
      'are not segments. They appear under the programme on screen and under the date on the title card. '+
      'A photograph is optional — nothing on screen shows one yet, but it rides in the saved session '+
      'with the rest.</div></div>';
  }

  /* ---- the audience screens ---- */

  // the emcee and the Quizmaster, as the printed programme carries them
  function hostsFootHTML(){
    var hs = namedHosts();
    if(!hs.length) return "";
    return '<div class="hosts">'+hs.map(function(h){
      return '<div class="host"><b>'+esc(h.name)+'</b><span>'+esc(h.role||"")+'</span></div>';
    }).join("")+'</div>';
  }

  /* On the title card there is no room for the chips, and no need for them: one
     line under the options names the two who are on all day. */
  function hostsLineHTML(){
    var hs = namedHosts();
    if(!hs.length) return "";
    return '<div class="hostline">'+hs.map(function(h){
      return (h.role ? esc(h.role)+" " : "")+"<b>"+esc(h.name)+"</b>";
    }).join(" · ")+'</div>';
  }

  /* The programme as printed: the two parts side by side, every segment in
     order, the one that is on marked and the ones behind it ticked off. */
  function programmeSceneHTML(){
    var list = prog(), now = nowSeg();
    if(!list.length) return '<div class="dsp">'+dspHead("Programme")+
      '<div class="body"><div class="none">No programme encoded</div></div></div>';

    var parts = [1,2].map(function(n){
      var rows = list.filter(function(p){ return p.part===n; });
      if(!rows.length) return "";
      return '<div class="part"><div class="phead">'+esc(PART_LABEL[n])+'</div>'+
        rows.map(function(p){
          var who = p.name.trim();
          return '<div class="pline'+(p===now?" now":(p.done?" done":""))+'">'+
            '<div class="pt"><b>'+esc(p.title)+'</b>'+
            ((p.items||[]).length
              ? '<span class="pit">'+esc(p.items.join(" · "))+'</span>' : '')+'</div>'+
            (who || p.office
              ? '<div class="pw">'+(who?'<b>'+esc(who)+'</b>':'')+
                (p.office?'<span>'+esc(p.office)+'</span>':'')+'</div>'
              : '')+
          '</div>';
        }).join("")+'</div>';
    }).join("");

    return '<div class="dsp">'+dspHead("Programme")+
      '<div class="body" style="justify-content:flex-start;padding-top:calc(var(--u)*2)">'+
      '<div class="pgm">'+parts+'</div>'+hostsFootHTML()+'</div></div>';
  }

  /* One segment, in two screens: its title, then whoever is taking it. The
     title used to sit in small type on the portrait card, where a long one
     crowded the name; announced on its own it reads as the emcee says it. A
     segment with nobody named is the title screen alone. */
  function segScreens(seg){
    if(!seg) return [];
    return seg.name.trim() ? [{who:false},{who:true}] : [{who:false}];
  }
  function segmentSceneHTML(){
    var seg = nowSeg() || prog().filter(function(p){ return !p.done; })[0] || null;
    if(!seg) return '<div class="dsp">'+dspHead("Programme")+
      '<div class="body"><div class="none">No segment is on</div></div></div>';

    var pg = pageOf(segScreens(seg)), sc = pg.slice[0];
    var body;
    if(sc && sc.who){
      body = '<div class="intro solo" style="grid-template-columns:repeat(1,minmax(0,1fr))">'+
        '<div class="icard">'+portrait(seg)+
        '<div class="itxt"><div class="who">'+esc(seg.name)+'</div>'+
        (seg.office ? '<div class="sch">'+esc(seg.office)+'</div>' : '')+
        orgLine(seg.org)+
        '</div></div></div>';
    } else {
      body = '<div class="seg">'+
        '<div class="segt">'+esc(seg.title)+'</div>'+
        // the title alone — the name belongs on the card that follows it
        (!seg.name.trim() && seg.office ? '<div class="segby">'+esc(seg.office)+'</div>' : '')+
        ((seg.items||[]).length
          ? '<div class="segitems">'+seg.items.map(function(t){
              return '<div class="segitem">'+esc(t)+'</div>'; }).join("")+'</div>'
          : '')+
        (seg.org && !seg.name.trim() ? orgLine(seg.org) : '')+
      '</div>';
    }
    return '<div class="dsp">'+dspHead(PART_LABEL[seg.part])+
      '<div class="body">'+body+
      pagerHTML(pg, 'Screen '+(disp.page+1)+' of '+pg.pages)+'</div></div>';
  }
