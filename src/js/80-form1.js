"use strict";
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

