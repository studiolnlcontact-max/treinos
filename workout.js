/* ============================================================
   BELLACOS — workout.js
   Timer + Progress logic — iPhone Safari compatible
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {

  /* ── Progress ─────────────────────────────────────────── */
  var TOTAL   = document.querySelectorAll(".btn-done").length;
  var feitos  = 0;
  var fill    = document.getElementById("progFill");
  var numEl   = document.getElementById("progNum");

  var btns = document.querySelectorAll(".btn-done");
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function () {
      if (this.className.indexOf("checked") === -1) {
        this.className = "btn-done checked";
        this.innerHTML = "&#10003;";
        feitos++;
        var pct = Math.round((feitos / TOTAL) * 100);
        if (fill)  fill.style.width = pct + "%";
        if (numEl) numEl.innerHTML  = pct;
      }
    });
  }

  /* ── Timer ────────────────────────────────────────────── */
  var tVal    = 60;
  var tInt    = null;
  var running = false;

  var display = document.getElementById("tDisplay");
  var msgEl   = document.getElementById("tMsg");

  function tShow() {
    if (display) display.innerHTML = tVal;
  }

  function tClear() {
    if (tInt) { clearInterval(tInt); tInt = null; }
    running = false;
  }

  var btnStart  = document.getElementById("btnStart");
  var btnPause  = document.getElementById("btnPause");
  var btnStop   = document.getElementById("btnStop");
  var btnReset  = document.getElementById("btnReset");

  if (btnStart) {
    btnStart.addEventListener("click", function () {
      if (running) return;
      if (tVal <= 0) { tVal = 60; tShow(); }
      if (msgEl) msgEl.innerHTML = "";
      running = true;
      tInt = setInterval(function () {
        tVal = tVal - 1;
        tShow();
        if (tVal <= 0) {
          tClear();
          if (msgEl) msgEl.innerHTML = "Descanso acabou! 💪 Bora!";
        }
      }, 1000);
    });
  }

  if (btnPause) {
    btnPause.addEventListener("click", function () { tClear(); });
  }

  if (btnStop) {
    btnStop.addEventListener("click", function () {
      tClear();
      tVal = 60; tShow();
      if (msgEl) msgEl.innerHTML = "";
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", function () {
      tClear();
      tVal = 60; tShow();
      if (msgEl) msgEl.innerHTML = "";
    });
  }

  tShow();

});
