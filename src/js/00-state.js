"use strict";

  var QN = 10;
  var PTS = {r1:1, r2:1, r3:2};
  var ADV = 8;   // Rounds 1&2 cumulative that qualifies for Round 3 — Section C.3
  var LABEL = {r1:"Round 1", r2:"Round 2", r3:"Round 3"};

  function blankC(no){
    return {no:no, name:"", school:"", photo:null, coachId:null,
            r1:new Array(QN).fill(false),
            r2:new Array(QN).fill(false),
            r3:new Array(QN).fill(false),
            sd:new Array(5).fill(null)};
  }

  var state = {
    meta:{edition:"30th Philippine Statistics Quiz",
          level:"Provincial Elimination",
          place:"Marinduque",
          date:"24 September 2026",
          sdCount:5},
    cut:null,          // once the Round 3 cut is announced, the frozen list of contestant numbers
    sdAck:[],          // tie-breaks the operator has seen resolved and cleared away
    coaches:[],        // {id, name, school, photo} — one entry per registered coach
    schools:[],        // {name, logo} — only the schools a logo has been added for
    judges:[],         // {name, role, office, org, photo} — the Board of Judges, in introduction order
    deck:{name:"", slides:[]},   // the RTC's slides as pictures, and what each one is
    contestants:[]
  };
  for(var i=1;i<=22;i++) state.contestants.push(blankC(i));

  var tab = "roster";
  // val: "total" = running total across the rounds, "round" = this round's score alone
  var disp = {cue:"standby", round:"r1", reveal:0, page:0, cols:0, val:"total"};
  var sortBy = "no";   // "no" = contestant number, "score" = running total
  var perPage = 8;
  var introPer = 6;    // portraits per page on the Introduce contestants screen
  var winRef = null, popFlag = false;

  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(m){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m];}); }

