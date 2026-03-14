document.addEventListener("DOMContentLoaded", function () {
  if (!document.querySelector(".day-cards")) return;

  var defaultRest = 60;
  var pageKey = location.pathname.split("/").pop() || "treino";
  var storageKey = "bellacos-state-" + pageKey;
  var state = loadState();

  if (!state.timer) {
    state.timer = { duration: defaultRest, remaining: defaultRest, running: false, label: "Selecione uma série", activeExerciseKey: null };
  }
  if (!state.days) state.days = {};
  if (!state.exercises) state.exercises = {};

  var fill = document.getElementById("progFill");
  var numEl = document.getElementById("progNum");
  var dockTime = document.getElementById("dockTime");
  var dockExercise = document.getElementById("dockExercise");
  var dockMsg = document.getElementById("dockMsg");
  var dockToggle = document.getElementById("dockToggle");
  var dockPreset = document.getElementById("dockPreset");
  var dockPlus = document.getElementById("dockPlus");
  var dockMinus = document.getElementById("dockMinus");
  var dockReset = document.getElementById("dockReset");

  var timerInt = null;

  enhanceDays();
  enhanceExercises();
  restoreUIFromState();
  bindDock();
  updateProgress();
  syncPresetControls(state.timer.duration || defaultRest);
  updateTimerUI();

  if (state.timer.running) startInterval();

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function bindDock() {
    if (dockToggle) {
      dockToggle.addEventListener("click", function () {
        if (state.timer.running) pauseTimer();
        else startTimer();
      });
    }
    if (dockPreset) {
      dockPreset.addEventListener("change", function (e) {
        setTimerDuration(parseInt(e.target.value, 10), false, "Descanso manual");
      });
    }
    if (dockPlus) dockPlus.addEventListener("click", function () { adjustTimer(15); });
    if (dockMinus) dockMinus.addEventListener("click", function () { adjustTimer(-15); });
    if (dockReset) dockReset.addEventListener("click", function () { resetTimer(); });
  }

  function enhanceDays() {
    var cards = document.querySelectorAll(".day-card");
    cards.forEach(function (card, idx) {
      var title = card.querySelector(".day-title");
      if (!title) return;
      var titleText = title.textContent.trim();
      var body = document.createElement("div");
      body.className = "day-body";
      while (title.nextSibling) body.appendChild(title.nextSibling);

      var head = document.createElement("div");
      head.className = "day-head";
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "day-toggle";
      toggle.textContent = "−";

      head.appendChild(title);
      head.appendChild(toggle);
      card.appendChild(head);
      card.appendChild(body);

      var key = slug(titleText + "-" + idx);
      if (state.days[key] && state.days[key].collapsed) setCollapsed(card, toggle, true);
      head.addEventListener("click", function () {
        var next = !card.classList.contains("collapsed");
        setCollapsed(card, toggle, next);
        state.days[key] = state.days[key] || {};
        state.days[key].collapsed = next;
        saveState();
      });
    });
  }

  function setCollapsed(card, toggle, collapsed) {
    card.classList.toggle("collapsed", collapsed);
    toggle.textContent = collapsed ? "+" : "−";
  }

  function enhanceExercises() {
    var rows = document.querySelectorAll(".exercise-row");
    rows.forEach(function (row, idx) {
      var info = row.querySelector(".ex-info");
      var nameEl = row.querySelector(".ex-name");
      var repsEl = row.querySelector(".ex-reps");
      var doneBtn = row.querySelector(".btn-done");
      if (!info || !nameEl || !repsEl || !doneBtn) return;

      var name = nameEl.textContent.trim();
      var repsText = repsEl.textContent.trim();
      var totalSets = getSeriesCount(repsText);
      var exKey = slug(name + "-" + repsText + "-" + idx);
      row.setAttribute("data-key", exKey);
      row.setAttribute("data-name", name);

      if (!state.exercises[exKey]) {
        state.exercises[exKey] = {
          doneSets: 0,
          totalSets: totalSets,
          rest: defaultRest,
          complete: false
        };
      }

      var top = document.createElement("div");
      top.className = "ex-top";
      info.parentNode.insertBefore(top, info);
      top.appendChild(info);
      top.appendChild(doneBtn);

      var meta = document.createElement("div");
      meta.className = "ex-meta";
      meta.innerHTML =
        '<div class="rest-wrap">' +
          '<span class="rest-label">Descanso</span>' +
          '<select class="rest-select-inline">' +
            '<option value="30">30s</option>' +
            '<option value="45">45s</option>' +
            '<option value="60">60s</option>' +
            '<option value="90">90s</option>' +
            '<option value="120">120s</option>' +
          '</select>' +
        '</div>' +
        '<div class="series-wrap"></div>';

      var actions = document.createElement("div");
      actions.className = "ex-actions";
      var seriesBtn = document.createElement("button");
      seriesBtn.type = "button";
      seriesBtn.className = "btn-series";
      actions.appendChild(seriesBtn);
      actions.appendChild(doneBtn);

      row.appendChild(meta);
      row.appendChild(actions);

      var restSelect = meta.querySelector(".rest-select-inline");
      restSelect.value = String(state.exercises[exKey].rest || defaultRest);
      restSelect.addEventListener("change", function (e) {
        state.exercises[exKey].rest = parseInt(e.target.value, 10);
        if (state.timer.activeExerciseKey === exKey) {
          setTimerDuration(state.exercises[exKey].rest || defaultRest, false, row.getAttribute("data-name") || "Descanso", exKey);
        }
        saveState();
      });

      var seriesWrap = meta.querySelector(".series-wrap");
      for (var s = 0; s < totalSets; s++) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "series-chip";
        chip.textContent = "S" + (s + 1);
        chip.setAttribute("data-series-index", String(s));
        chip.addEventListener("click", function (e) {
          toggleSpecificSeries(exKey, row, parseInt(e.currentTarget.getAttribute("data-series-index"), 10));
        });
        seriesWrap.appendChild(chip);
      }

      row.addEventListener("click", function (e) {
        if (e.target.closest('button, select, option')) return;
        focusExercise(exKey, row);
      });

      seriesBtn.addEventListener("click", function () {
        incrementSeries(exKey, row);
      });

      doneBtn.addEventListener("click", function () {
        toggleComplete(exKey, row);
      });
    });
    saveState();
  }

  function restoreUIFromState() {
    document.querySelectorAll(".exercise-row").forEach(function (row) {
      var key = row.getAttribute("data-key");
      if (!key || !state.exercises[key]) return;
      var restSelect = row.querySelector(".rest-select-inline");
      if (restSelect) restSelect.value = String(state.exercises[key].rest || defaultRest);
      paintRow(row, state.exercises[key]);
    });
  }

  function incrementSeries(key, row) {
    var ex = state.exercises[key];
    if (!ex) return;
    if (ex.doneSets < ex.totalSets) ex.doneSets += 1;
    ex.complete = ex.doneSets >= ex.totalSets;
    paintRow(row, ex);
    updateProgress();
    saveState();
    setTimerDuration(ex.rest || defaultRest, true, row.getAttribute("data-name") || "Descanso", key);
  }

  function toggleSpecificSeries(key, row, idx) {
    var ex = state.exercises[key];
    if (!ex) return;
    var target = idx + 1;
    ex.doneSets = ex.doneSets >= target ? target - 1 : target;
    ex.complete = ex.doneSets >= ex.totalSets;
    paintRow(row, ex);
    updateProgress();
    saveState();
  }

  function toggleComplete(key, row) {
    var ex = state.exercises[key];
    if (!ex) return;
    if (ex.complete) {
      ex.complete = false;
      ex.doneSets = 0;
    } else {
      ex.doneSets = ex.totalSets;
      ex.complete = true;
    }
    paintRow(row, ex);
    updateProgress();
    saveState();
  }

  function paintRow(row, ex) {
    row.querySelectorAll(".series-chip").forEach(function (chip, idx) {
      chip.classList.toggle("done", idx < ex.doneSets);
    });

    var seriesBtn = row.querySelector(".btn-series");
    if (seriesBtn) {
      seriesBtn.textContent = ex.complete ? "Completo" : "+ Série " + Math.min(ex.doneSets + 1, ex.totalSets);
      seriesBtn.classList.toggle("is-complete", !!ex.complete);
    }

    var doneBtn = row.querySelector(".btn-done");
    if (doneBtn) {
      doneBtn.textContent = ex.complete ? "✓ Feito" : "Feito";
      doneBtn.classList.toggle("checked", !!ex.complete);
    }
  }


  function focusExercise(key, row) {
    var ex = state.exercises[key];
    if (!ex) return;
    setTimerDuration(ex.rest || defaultRest, false, row.getAttribute("data-name") || "Descanso", key);
  }

  function updateActiveExerciseUI() {
    document.querySelectorAll('.exercise-row').forEach(function (row) {
      var rowKey = row.getAttribute('data-key');
      row.classList.toggle('is-active-rest', !!rowKey && rowKey === state.timer.activeExerciseKey);
    });
  }

  function updateProgress() {
    var totalSeries = 0;
    var doneSeries = 0;
    Object.keys(state.exercises).forEach(function (key) {
      totalSeries += Number(state.exercises[key].totalSets || 0);
      doneSeries += Number(state.exercises[key].doneSets || 0);
    });
    var pct = totalSeries ? Math.round((doneSeries / totalSeries) * 100) : 0;
    if (fill) fill.style.width = pct + "%";
    if (numEl) numEl.textContent = pct;
  }

  function setTimerDuration(seconds, autostart, label, activeExerciseKey) {
    clearTimerInterval();
    state.timer.duration = seconds;
    state.timer.remaining = seconds;
    state.timer.running = false;
    if (label) state.timer.label = label;
    if (typeof activeExerciseKey !== 'undefined') state.timer.activeExerciseKey = activeExerciseKey;
    syncPresetControls(seconds);
    updateActiveExerciseUI();
    updateTimerUI();
    saveState();
    if (autostart) startTimer();
  }

  function adjustTimer(delta) {
    var current = Number(state.timer.remaining || defaultRest);
    var next = Math.max(5, current + delta);
    state.timer.remaining = next;
    if (!state.timer.running) state.timer.duration = next;
    updateTimerUI();
    saveState();
  }

  function startTimer() {
    if (state.timer.running) return;
    if (!state.timer.remaining || state.timer.remaining <= 0) {
      state.timer.remaining = state.timer.duration || defaultRest;
    }
    state.timer.running = true;
    if (dockMsg) dockMsg.textContent = "";
    startInterval();
    updateTimerUI();
    saveState();
  }

  function pauseTimer() {
    state.timer.running = false;
    clearTimerInterval();
    updateTimerUI();
    saveState();
  }

  function resetTimer() {
    state.timer.running = false;
    clearTimerInterval();
    state.timer.remaining = state.timer.duration || defaultRest;
    if (dockMsg) dockMsg.textContent = "";
    updateTimerUI();
    saveState();
  }

  function startInterval() {
    clearTimerInterval();
    timerInt = window.setInterval(function () {
      if (!state.timer.running) return;
      state.timer.remaining -= 1;

      if (state.timer.remaining <= 0) {
        state.timer.remaining = 0;
        state.timer.running = false;
        clearTimerInterval();
        if (dockMsg) dockMsg.textContent = "Descanso acabou. Bora.";
        if (navigator.vibrate) navigator.vibrate([180, 120, 180]);
      }
      updateTimerUI();
      saveState();
    }, 1000);
  }

  function clearTimerInterval() {
    if (timerInt) {
      window.clearInterval(timerInt);
      timerInt = null;
    }
  }

  function updateTimerUI() {
    var remaining = Number(state.timer.remaining || defaultRest);
    if (dockTime) dockTime.textContent = formatTime(remaining);
    if (dockExercise) dockExercise.textContent = state.timer.label || "Selecione uma série";
    if (dockToggle) dockToggle.textContent = state.timer.running ? "Pause" : "Iniciar";
    updateActiveExerciseUI();
  }

  function syncPresetControls(seconds) {
    if (dockPreset && ["30","45","60","90","120"].indexOf(String(seconds)) > -1) {
      dockPreset.value = String(seconds);
    }
  }

  function getSeriesCount(repsText) {
    var match = repsText.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 3;
  }

  function slug(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function formatTime(totalSeconds) {
    var min = Math.floor(totalSeconds / 60);
    var sec = totalSeconds % 60;
    return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }
});
