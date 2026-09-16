"use strict";

  /* ===================== autosave =====================
     A tally sheet could be rebuilt from the Examiners' paper, which is why this
     board went so long without an autosave. Now that it owns the questions and
     the clock as well, a refreshed tab, a sleeping laptop or a kicked power strip
     is a different order of problem — and none of those fire beforeunload, so no
     amount of guarding the keyboard helps.

     Two things shape the design.

     First: this board ships as a file on a flash drive, and browsers treat a
     file:// page as an origin of its own with its own rules about storage. What
     works there differs by browser and by version, and a storage that silently
     does nothing is worse than none at all — the operator would believe they were
     covered. So nothing is assumed: at boot the board actually writes a record,
     reads it back, and only claims to be autosaving if that round trip worked.
     Whatever it finds, it says so on screen.

     Second: not everything is worth the same. Photographs, logos and the slides
     are megabytes, and every one of them still exists in the folder they were
     imported from. A half-tallied Round 2 exists nowhere else. So when the only
     storage available is a small one, the tally is what gets kept. */

  var DB_NAME = "psq-tally-board", DB_STORE = "snapshot";
  /* The probe must never write where the snapshot lives. localStorage is a single
     key, so a probe that used LS_KEY would destroy the session it is about to be
     asked to restore — at boot, before anything had read it. */
  var LS_KEY = "psq-tally-board", LS_PROBE = "psq-tally-board:probe";
  var SAVE_EVERY = 5000, PROBE_MS = 2500;

  var saveMode = "none";      // none | idb | local — decided by a real round trip
  var dbConn = null;
  var snapDirty = false, snapPending = false, deckSaved = null;
  var restoreOffer = null;

  /* ---- IndexedDB, if it will actually take a record ---- */

  function idbOpen(cb){
    if(dbConn) return cb(dbConn);
    var settled = false, rq;
    var give = function(d){ if(!settled){ settled = true; cb(d); } };
    // an open request that never settles is a real possibility on some origins,
    // so the probe is on a timer rather than trusting it to answer
    setTimeout(function(){ give(null); }, PROBE_MS);
    try{ rq = indexedDB.open(DB_NAME, 1); }catch(err){ return give(null); }
    rq.onupgradeneeded = function(){
      var d = rq.result;
      if(!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE, {keyPath:"key"});
    };
    rq.onsuccess = function(){ dbConn = rq.result; give(dbConn); };
    rq.onerror = function(){ give(null); };
    rq.onblocked = function(){ give(null); };
  }
  function idbPut(records, then){
    idbOpen(function(d){
      if(!d) return then && then(false);
      try{
        var tx = d.transaction(DB_STORE, "readwrite"), st = tx.objectStore(DB_STORE);
        records.forEach(function(r){ st.put(r); });
        tx.oncomplete = function(){ then && then(true); };
        tx.onerror = function(){ then && then(false); };
        tx.onabort = function(){ then && then(false); };
      }catch(err){ then && then(false); }
    });
  }
  function idbGet(keys, then){
    idbOpen(function(d){
      if(!d) return then(null);
      try{
        var tx = d.transaction(DB_STORE, "readonly"), st = tx.objectStore(DB_STORE), got = {};
        keys.forEach(function(k){
          var g = st.get(k);
          g.onsuccess = function(){ got[k] = g.result; };
        });
        tx.oncomplete = function(){ then(got); };
        tx.onerror = function(){ then(null); };
      }catch(err){ then(null); }
    });
  }

  /* ---- localStorage, as the small fallback ---- */

  function lsPutAt(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); return true; }
    catch(err){ return false; }        // quota, or storage refused outright
  }
  function lsGetAt(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(err){ return null; }
  }
  function lsPut(obj){ return lsPutAt(LS_KEY, obj); }
  function lsGet(){ return lsGetAt(LS_KEY); }

  /* Everything that cannot be reconstructed from a folder of files. The pictures
     are dropped: they are heavy, and the operator still has them. */
  function slimContest(){
    return {
      slim:     true,
      meta:     state.meta,
      cut:      state.cut,
      sdAck:    state.sdAck,
      schools:  [],
      coaches:  coaches().map(function(k){
                  return {id:k.id, name:k.name, school:k.school, photo:null}; }),
      judges:   judges().map(function(j){
                  return {name:j.name, role:j.role, office:j.office, org:j.org, photo:null}; }),
      deck:     {name:"", slides:[]},
      contestants: state.contestants.map(function(c){
                  return {no:c.no, name:c.name, school:c.school, coachId:c.coachId,
                          photo:null, r1:c.r1, r2:c.r2, r3:c.r3, sd:c.sd}; })
    };
  }

  /* ---- writing ---- */

  function markDirty(){ snapDirty = true; }

  function deckMark(){
    return slides().length + ":" + slides().map(function(s){
      return [s.role, s.round, s.seconds].join("|");
    }).join(",");
  }

  function snapshotNow(){
    if(saveMode === "none" || snapPending) return;
    snapPending = true;

    if(saveMode === "local"){
      lsPut({key:"contest", at:Date.now(), data:slimContest()});
      snapPending = false;
      return;
    }
    var contest = {};
    for(var k in state){
      if(k !== "deck" && Object.prototype.hasOwnProperty.call(state, k)) contest[k] = state[k];
    }
    var records = [{key:"contest", at:Date.now(), data:contest}];
    // the deck is megabytes and changes almost never; it only goes in when it has
    var mark = deckMark();
    if(mark !== deckSaved) records.push({key:"deck", at:Date.now(), data:state.deck});
    idbPut(records, function(ok){
      snapPending = false;
      if(ok) deckSaved = mark;
      else { saveMode = "none"; paintSaveDot(); }   // it worked at boot and does not now
    });
  }

  // both stores, always: which one this load chose is not which one the last
  // load wrote to (see readAnySnapshot)
  function clearSnapshot(){
    deckSaved = null;
    try{ localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_PROBE); }catch(err){}
    idbOpen(function(d){
      if(!d) return;
      try{ d.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).clear(); }catch(err){}
    });
  }

  /* Read both stores and take the newer.

     The store is picked per load by probing it, and that probe can honestly come
     out differently twice running: a cold IndexedDB open on a tired venue laptop
     can take longer than the probe waits, so the same board may write to
     IndexedDB one morning and to localStorage the next. Looking only in the
     store this load happens to have chosen would then quietly miss the snapshot —
     which is the one failure this whole feature exists to prevent. */
  function readAnySnapshot(then){
    var found = [], pending = 2;
    function finish(){ if(--pending) return;
      found.sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
      then(found[0] || null);
    }
    var rec = lsGet();
    if(rec && rec.key === "contest" && rec.data){
      found.push({contest:rec.data, at:rec.at, deck:null, from:"local"});
    }
    finish();
    idbGet(["contest", "deck"], function(got){
      if(got && got.contest && got.contest.data){
        found.push({contest:got.contest.data, at:got.contest.at,
                    deck:(got.deck && got.deck.data) || null, from:"idb"});
      }
      finish();
    });
  }

  /* ---- coming back ---- */

  function worthRestoring(c){
    if(!c || !Array.isArray(c.contestants)) return false;
    var named = c.contestants.filter(function(x){ return x && (x.name || "").trim() !== ""; }).length;
    var marks = c.contestants.some(function(x){
      return x && (["r1","r2","r3"].some(function(k){ return (x[k] || []).some(Boolean); }) ||
                   (x.sd || []).some(function(v){ return v; }));
    });
    return !!(named || marks);
  }
  function whenStr(ms){
    var d = new Date(ms), p = function(n){ return (n < 10 ? "0" : "") + n; };
    var sameDay = d.toDateString() === new Date().toDateString();
    return (sameDay ? "" : d.toDateString() + ", ") + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function showRestoreBar(offer){
    restoreOffer = offer;
    var c = offer.contest, sl = (offer.deck && offer.deck.slides || []).length;
    var n = c.contestants.filter(function(x){ return x && (x.name || "").trim() !== ""; }).length;
    var bar = $("restoreBar");
    bar.innerHTML =
      '<span><b>The board closed with work unsaved.</b> ' + n + ' contestant' + (n === 1 ? "" : "s") +
      (sl ? ', ' + sl + ' slide' + (sl === 1 ? "" : "s") : "") +
      ', last kept at ' + esc(whenStr(offer.at)) + '.' +
      (c.slim ? ' <i>Photographs and slides were not kept — re-import them.</i>' : '') + '</span>' +
      '<button class="btn primary" id="btnRestoreYes">Restore it</button>' +
      '<button class="btn" id="btnRestoreNo">Start fresh</button>';
    bar.classList.add("show");
  }
  function hideRestoreBar(){
    restoreOffer = null;
    var bar = $("restoreBar");
    bar.classList.remove("show"); bar.innerHTML = "";
  }
  function acceptRestore(){
    if(!restoreOffer) return;
    var offer = restoreOffer;
    try{
      var d = offer.contest;
      d.deck = offer.deck || {name:"", slides:[]};
      installSession(normaliseSession(d));
      hideRestoreBar();
      deckSaved = deckMark();
      toast("Restored from the autosave" + (d.slim ? " — photographs and slides need re-importing" : ""));
    }catch(err){
      hideRestoreBar();
      toast("That autosave could not be read");
    }
  }
  function declineRestore(){
    clearSnapshot();
    hideRestoreBar();
    toast("Starting fresh — the autosave has been cleared");
  }

  /* ---- what the operator is told ---- */

  function saveModeText(){
    if(saveMode === "idb") return "Autosaving";
    if(saveMode === "local") return "Autosaving the tally only";
    return "No autosave — save by hand";
  }
  function paintSaveDot(){
    var el = $("saveDot");
    if(!el) return;
    el.className = "savedot " + saveMode;
    el.innerHTML = '<i></i><span>' + saveModeText() + '</span>';
    el.title = saveMode === "idb"
      ? "The whole session, including photographs and slides, is being kept in this browser."
      : (saveMode === "local"
        ? "This browser would not take the pictures, so only the roster and the tally are being kept. Photographs and slides would need re-importing."
        : "This browser is not letting the board keep anything. Press Save session between rounds.");
  }

  /* ---- boot ---- */

  /* Prove the storage works before claiming it does: write a record, read it
     back, and only then call it autosaving. */
  function pickStore(then){
    var probe = {key:"__probe", at:Date.now(), data:{ok:1}};
    idbPut([probe], function(ok){
      if(!ok) return tryLocal();
      idbGet(["__probe"], function(got){
        if(got && got.__probe && got.__probe.data && got.__probe.data.ok === 1){
          saveMode = "idb"; return then();
        }
        tryLocal();
      });
    });
    function tryLocal(){
      if(lsPutAt(LS_PROBE, {at:Date.now(), ok:1})){
        var back = lsGetAt(LS_PROBE);
        try{ localStorage.removeItem(LS_PROBE); }catch(err){}
        if(back && back.ok === 1){ saveMode = "local"; return then(); }
      }
      saveMode = "none";
      then();
    }
  }

  function autosaveInit(){
    pickStore(function(){
      paintSaveDot();
      var offer = null;

      function afterLook(){
        if(offer && worthRestoring(offer.contest)) showRestoreBar(offer);
        else if(saveMode !== "none") deckSaved = deckMark();
        // writing starts only once the offer has been read, so a snapshot is
        // never overwritten by the empty board sitting on top of it
        setInterval(function(){
          if(restoreOffer || !snapDirty || saveMode === "none") return;
          snapDirty = false;
          snapshotNow();
        }, SAVE_EVERY);
      }

      if(saveMode === "none"){
        toast("This browser will not let the board autosave — press Save session between rounds");
      }
      readAnySnapshot(function(found){ offer = found; afterLook(); });
    });
  }

  /* ---- is there anything to lose? ---- */
  function atRisk(){
    return named().length > 0 || hasDeck() ||
           hasMarks("r1") || hasMarks("r2") || hasMarks("r3") || hasSd();
  }
