"use strict";
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
          if(opts.alpha){ done(cv.toDataURL("image/png")); return; }
          var jpg = cv.toDataURL("image/jpeg", 0.85);
          if(!opts.best){ done(jpg); return; }
          /* A slide is mostly flat colour and lettering, where PNG is both smaller
             and cleaner than JPEG — but a slide with a photograph behind it is the
             other way about. Encode both and keep whichever came out smaller. */
          var png = cv.toDataURL("image/png");
          done(png.length <= jpg.length ? png : jpg);
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
        setLogo(tgt.school, uri);
        render();
        toast("Logo added for "+tgt.school);
      }, {max:LOGO_MAX, alpha:true});
      return;
    }
    shrink(f, function(uri){
      if(!uri){ toast("Could not read that picture"); return; }
      var who = tgt.kind==="k" ? coaches()[tgt.i]
              : (tgt.kind==="j" ? judges()[tgt.i] : state.contestants[tgt.i]);
      if(!who) return;
      who.photo = uri;
      render();
      toast("Photo added for "+(who.name ||
        (tgt.kind==="k" ? "the coach" : (tgt.kind==="j" ? "the judge" : "slot "+who.no))));
    });
  });

  $("slidesIn").addEventListener("change", function(e){
    // copy before clearing the input: e.target.files is live, and resetting the
    // value empties the very list we are about to read
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = "";
    if(!files.length) return;
    if(hasDeck() && !confirm("Replace the " + slides().length + " slides already loaded?\n\n" +
                             "Their tags go with them. The tally is untouched.")) return;
    importSlides(files, takeSlides);
  });

  $("deckIn").addEventListener("change", function(e){
    var f = e.target.files[0];
    e.target.value = "";
    if(!f) return;
    if(hasDeck() && !confirm("Replace the " + slides().length + " slides already loaded?")) return;
    var r = new FileReader();
    r.onload = function(){ loadDeckFile(r.result); };
    r.onerror = function(){ toast("Could not read that file"); };
    r.readAsText(f);
  });

  /* Portrait for the audience screen. With no photo it falls back to the
     contestant's number, or — for a coach, who has no number — their initials. */
  function portrait(c, extra){
    // the school's crest sits behind whatever the frame holds. A photograph is
    // cropped to fill, so it covers the crest; the numbered placeholder does not,
    // which is where the crest earns its keep
    var logo = logoFor(c.school || c.org);
    return '<div class="por'+(extra?" "+extra:"")+'">'+
      (logo ? '<i class="crest" style="background-image:url(&#39;'+logo+'&#39;)"></i>' : '')+
      (isPhoto(c.photo)
        ? '<img src="'+c.photo+'" alt="'+esc(c.name)+'">'
        : '<div class="noimg">'+esc(c.no==null ? initials(c.name) : String(c.no))+'</div>')+'</div>';
  }

