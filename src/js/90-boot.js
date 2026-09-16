"use strict";
  var tT;
  function toast(m){ var el=$("toast"); el.textContent=m; el.classList.add("show");
    clearTimeout(tT); tT=setTimeout(function(){ el.classList.remove("show"); },2200); }

  window.addEventListener("beforeunload", function(e){
    if(atRisk()){ e.preventDefault(); e.returnValue=""; }
  });
  /* The audience window is torn down only once the page is genuinely going away.
     Doing it in beforeunload — as this used to — blacked out the projector before
     the operator had even answered the browser's dialog, so catching yourself and
     clicking "stay" still cost you the screen. */
  window.addEventListener("pagehide", function(){
    if(winRef && !winRef.closed) winRef.close();
  });
  window.addEventListener("resize", function(){ paintDisplay(); });
  setInterval(function(){
    if(winRef && winRef.closed){ winRef=null; render(); }
  }, 1500);

  render();
  autosaveInit();
