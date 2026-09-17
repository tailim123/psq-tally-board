"use strict";
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
    var defs = [["roster","Roster"],["programme","Programme"],["deck","Deck"]];
    if(hasDeck()) defs.push(["run","Run"]);
    defs = defs.concat([["r1","Round 1"],["r2","Round 2"],["r3","Round 3"],
                ["sd","Tie-break"],["standings","Standings"],["display","Display"]]);
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
        '<div class="field wide"><label for="mVn">Venue</label><input id="mVn" data-m="venue" value="'+
          esc(state.meta.venue||"")+'" placeholder="Hall, compound, town"></div>'+
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
      renderCoachPanel()+renderJudgePanel()+
      '<div id="schoolPanel">'+renderSchoolPanel()+'</div>'+
      '<datalist id="schoolList">'+schoolOptions()+'</datalist>';
  }

  /* ---- the Board of Judges ---- */
  function renderJudgePanel(){
    var js = judges();
    var rows = js.map(function(j,i){
      var has = isPhoto(j.photo);
      return '<tr><td class="no pad">'+(i+1)+'</td>'+
        '<td class="pad"><input class="jin" data-jf="name" data-ji="'+i+'" value="'+esc(j.name)+'" placeholder="Judge’s name"></td>'+
        '<td class="pad"><select class="jsel" data-jrole="'+i+'" aria-label="Role of '+esc(j.name||("judge "+(i+1)))+'">'+
          JUDGE_ROLES.map(function(r){
            return '<option'+(j.role===r?" selected":"")+'>'+r+'</option>';
          }).join("")+'</select></td>'+
        '<td class="pad"><input class="jin" data-jf="office" data-ji="'+i+'" value="'+esc(j.office||"")+'" placeholder="Position (optional)"></td>'+
        '<td class="pad"><input class="jin" data-jf="org" data-ji="'+i+'" value="'+esc(j.org||"")+'" placeholder="Organisation (optional)" list="schoolList"></td>'+
        '<td class="pad photocell">'+
          (has ? '<img class="thumb" src="'+j.photo+'" alt="'+esc(j.name)+'">'
               : '<span class="thumb none">'+esc(initials(j.name))+'</span>')+
          '<button class="lbtn tiny" data-jphoto="'+i+'">'+(has?"Replace":"Add photo")+'</button>'+
          (has ? '<button class="lbtn tiny danger" data-junphoto="'+i+'">Remove</button>' : '')+
        '</td>'+
        '<td class="pad actions">'+
          '<button class="lbtn tiny" data-jmove="'+i+'" data-dir="-1"'+(i===0?" disabled":"")+
            ' aria-label="Introduce '+esc(j.name||("judge "+(i+1)))+' earlier">\u25b2</button>'+
          '<button class="lbtn tiny" data-jmove="'+i+'" data-dir="1"'+(i===js.length-1?" disabled":"")+
            ' aria-label="Introduce '+esc(j.name||("judge "+(i+1)))+' later">\u25bc</button>'+
          '<button class="lbtn tiny danger" data-jdel="'+i+'">Delete row</button>'+
        '</td></tr>';
    }).join("");

    var body = js.length
      ? '<div class="scroll"><table><thead><tr><th class="c">Order</th><th>Name</th><th>Role</th>'+
        '<th>Position</th><th>Organisation</th><th class="c">Photo</th><th></th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table></div>'
      : '<div class="empty-state"><p>No judges encoded yet. The Board of Judges oversees the contest '+
        'and its decision is final — encode them here to introduce them on screen.</p>'+
        '<button class="lbtn go" id="btnAddJudge">Add a judge</button></div>';

    return '<div class="panel">'+
      '<div class="panel-head"><h3>Board of Judges</h3>'+
      '<span class="note" id="judgeNote">'+esc(judgeHeadNote())+'</span>'+
      '<div class="right"><button class="lbtn" id="btnAddJudge2">Add a judge</button></div></div>'+
      body+
      '<div class="legend">The order here is the order they are introduced in — use the arrows to change it. '+
      'The role, the position and the organisation all show on their screen, under a portrait, and the organisation '+
      'carries its logo if one has been added below. A judge with no photo shows their initials. '+
      'None of this touches the scoring, and PSQ Form 1 still leaves the Board’s signature blocks blank to be signed by hand.</div></div>';
  }

  function judgeHeadNote(){
    var ch = chairs(), n = namedJudges().length, note;
    if(!n) note = "none encoded";
    else if(!ch.length) note = n+" encoded · no chairman marked yet";
    else if(ch.length>1) note = n+" encoded · "+ch.length+" are marked chairman";
    else note = n+" encoded · chaired by "+ch[0].name;
    return note+" · introduced one to a screen, in this order";
  }

  function addJudge(){
    judges().push({name:"", role:"Member", office:"", org:"", photo:null});
    render();
    var el = document.querySelector('.jin[data-jf="name"][data-ji="'+(judges().length-1)+'"]');
    if(el) el.focus();
  }
  function removeJudge(i){
    var j = judges()[i];
    if(!j) return;
    if(j.name.trim() && !confirm("Delete "+j.name+" from the Board of Judges?")) return;
    judges().splice(i,1);
    photoFor = null;                    // a file picker mid-flight no longer knows its row
    render(); toast((j.name.trim()||"The judge")+" deleted");
  }
  function moveJudge(i, d){
    var js = judges(), to = i+d;
    if(to<0 || to>=js.length) return;
    var tmp = js[i]; js[i] = js[to]; js[to] = tmp;
    photoFor = null;
    render();
    var el = document.querySelector('[data-jmove="'+to+'"][data-dir="'+d+'"]');
    if(el && !el.disabled) el.focus();
  }

  /* ---- school logos ----
     The rows are derived from what has been typed, never entered by hand: the
     only thing this table stores is the logo. */
  function renderSchoolPanel(){
    var list = logoList();
    if(!list.length){
      return '<div class="panel"><div class="panel-head"><h3>School &amp; organisation logos</h3>'+
        '<span class="note">a logo shows beside the name it belongs to when its people are introduced</span></div>'+
        '<div class="empty-state"><p>Nothing to badge yet. Type a school against a contestant or a coach, '+
        'or an organisation against a judge, and it appears here for a logo.</p></div></div>';
    }
    var rows = list.map(function(x,i){
      var logo = logoFor(x.name);
      return '<tr><td class="no pad">'+(i+1)+'</td>'+
        '<td class="pad nm">'+esc(x.name)+'</td>'+
        '<td class="pad photocell">'+
          (logo ? '<img class="thumb logo" src="'+logo+'" alt="">'
                : '<span class="thumb logo none">—</span>')+
          '<button class="lbtn tiny" data-slogo="'+esc(x.name)+'">'+(logo?"Replace":"Add logo")+'</button>'+
          (logo ? '<button class="lbtn tiny danger" data-slogodel="'+esc(x.name)+'">Remove</button>' : '')+
        '</td>'+
        '<td class="cum">'+(x.contestants||"—")+'</td>'+
        '<td class="cum">'+(x.coaches||"—")+'</td>'+
        '<td class="cum">'+(x.judges||"—")+'</td>'+
        '<td class="cum">'+(x.speakers||"—")+'</td></tr>';
    }).join("");
    var withLogo = list.filter(function(x){ return logoFor(x.name); }).length;
    return '<div class="panel">'+
      '<div class="panel-head"><h3>School &amp; organisation logos</h3><span class="note">'+
      withLogo+' of '+list.length+' with a logo · schools badge the contestants who are introduced under them, '+
      'organisations badge their judge or speaker</span></div>'+
      '<div class="scroll"><table><thead><tr><th class="c">No.</th><th>School or organisation</th>'+
      '<th class="c">Logo</th><th class="c">Contestants</th><th class="c">Coaches</th><th class="c">Judges</th>'+
      '<th class="c">Speakers</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="legend">The list follows the names typed above — there is nothing to add here by hand. '+
      'Logos keep their transparency, are shrunk before they are stored and travel inside the saved session. '+
      'Correcting a name’s spelling parks its logo rather than losing it; type the spelling back and it returns. '+
      'A judge from one of the competing schools shares that school’s logo — it is one list.</div></div>';
  }

  /* The list of schools already typed, offered to both the roster and the
     coaches table, so the two spellings match and a coach finds their school. */
  function schoolOptions(){
    return logoList().map(function(x){ return '<option value="'+esc(x.name)+'">'; }).join("");
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
      '<div class="panel-head"><h3>Coaches</h3>'+
      '<span class="note" id="coachNote">'+esc(coachHeadNote())+'</span>'+
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

  function coachHeadNote(){
    return namedCoaches().length+" encoded · one coach at a school claims all of its contestants";
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

  /* Almost everything on this tab is derived from the boxes being typed into:
     which coach a contestant falls under, the logo registry, the suggestions, the
     counts in the panel headings. A full redraw would take the operator's cursor
     out of the box mid-word, so the derived parts are refreshed in place instead.
     Only panels with no inputs of their own are rebuilt wholesale. */
  function refreshDerived(){
    var sp = $("schoolPanel");
    if(sp) sp.innerHTML = renderSchoolPanel();
    var dl = $("schoolList");
    if(dl) dl.innerHTML = schoolOptions();
    var cn = $("coachNote");
    if(cn) cn.textContent = coachHeadNote();
    var jn = $("judgeNote");
    if(jn) jn.textContent = judgeHeadNote();
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

