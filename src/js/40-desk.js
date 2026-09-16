"use strict";
  /* ===================== display control desk ===================== */
  /* The number key is written down rather than taken from the position, so a
     cue can be added or dropped without the whole keypad shifting under the
     operator. */
  var CUES = [
    {id:"standby",     k:"1", t:"Title card",        d:"Event name, province, date"},
    {id:"mechanics",   k:"2", t:"Contest mechanics", d:"The rounds, qualifying, and tie-breaks"},
    {id:"introduce",   k:"3", t:"Introduce contestants", d:"School by school, each followed by their coach"},
    {id:"judges",      k:"4", t:"Board of Judges",   d:"One judge to a screen, in the order you set"},
    {id:"round",       k:"5", t:"Round scores",      d:"By contestant number, for the read-out"},
    {id:"advancing",   k:"6", t:"Advancing to R3",   d:"Who made the cut after Round 2"},
    {id:"leaderboard", k:"7", t:"Leaderboard",       d:"Ranked, current standings"},
    {id:"tiebreak",    k:"8", t:"Sudden death",      d:"Live tie-break marks"},
    {id:"reveal",      k:"9", t:"2nd & 3rd placers", d:"Third, then second — champion is separate"},
    {id:"champion",    k:"",  t:"Champion card",     d:"Full-screen winner, reached by R"},
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
    var jud = disp.cue==="judges";
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
        runDeskRow()+
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
        (mech||jud
          ? '<div class="deskrow"><span class="lab">Per page</span>'+
            '<span class="note">'+(mech ? 'The mechanics run one screen at a time.'
                                        : 'The judges are introduced one to a screen \u2014 set the order on the Roster tab.')+
            '</span></div>'
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
              : (jud ? (pl.length+" judge"+(pl.length===1?"":"s")+" \u00b7 one to a screen \u00b7 showing "+
                        (disp.page+1)+" of "+pages)
              : (intro ? (pl.length+" screen"+(pl.length===1?"":"s")+" \u00b7 school by school, each followed "+
                          "by their coach \u00b7 showing "+(disp.page+1)+" of "+pages)
                       : (pl.length+" contestants \u00b7 "+per()+" per page \u00b7 showing page "+
                          (disp.page+1)+" of "+pages))))
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

