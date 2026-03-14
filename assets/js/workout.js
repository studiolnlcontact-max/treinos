
/* ============================================================
   BELLACOS — workout.js enhanced
   Sticky timer + per-series progress + persistence
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  var accent = document.body.getAttribute("data-accent") || "tk";
  if (!document.querySelector('.day-cards')) return;

  var storageKey = "bellacos-state-" + location.pathname.split('/').pop();
  var defaultRest = 60;
  var state = loadState();

  var fill = document.getElementById("progFill");
  var numEl = document.getElementById("progNum");
  var display = document.getElementById("tDisplay");
  var msgEl = document.getElementById("tMsg");
  var dockTime = document.getElementById("dockTime");
  var dockExercise = document.getElementById("dockExercise");

  enhanceTimerCard();
  enhanceDays();
  enhanceExercises();
  restoreUIFromState();
  updateProgress();
  updateTimerUI();

  bindTimerButtons();
  bindDockButtons();

  if (!state.timer) {
    state.timer = { duration: defaultRest, remaining: defaultRest, running: false, label: "Selecione uma série" };
  }

  var timerInt = null;
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

  function enhanceTimerCard() {
    var timerCard = document.querySelector('.timer-card');
    if (!timerCard) return;

    var topBar = document.createElement('div');
    topBar.className = 'timer-topbar';
    topBar.innerHTML = '<div class="timer-label">Descanso padrão</div>' +
      '<select class="timer-select" id="timerPresetSelect">' +
      '<option value="30">30s</option>' +
      '<option value="45">45s</option>' +
      '<option value="60">60s</option>' +
      '<option value="90">90s</option>' +
      '<option value="120">120s</option>' +
      '</select>';
    timerCard.insertBefore(topBar, timerCard.firstChild);

    var presets = document.createElement('div');
    presets.className = 'timer-presets';
    presets.innerHTML = [30,45,60,90,120].map(function(v){
      return '<button class="preset-btn" data-seconds="'+v+'">'+v+'s</button>';
    }).join('');
    var controls = timerCard.querySelector('.timer-controls');
    timerCard.insertBefore(presets, controls);

    var note = document.createElement('div');
    note.className = 'workout-note glass';
    note.innerHTML = 'Toque em <strong>+ Série</strong> para iniciar o descanso automático.';
    timerCard.parentNode.insertBefore(note, timerCard.nextSibling);

    var timer = state.timer || {};
    var presetSelect = document.getElementById('timerPresetSelect');
    presetSelect.value = String(timer.duration || defaultRest);
    presetSelect.addEventListener('change', function(){
      setTimerDuration(parseInt(this.value, 10), false, 'Descanso manual');
    });

    var chips = timerCard.querySelectorAll('.preset-btn');
    for (var i=0; i<chips.length; i++) {
      chips[i].addEventListener('click', function(){
        var seconds = parseInt(this.getAttribute('data-seconds'), 10);
        setTimerDuration(seconds, false, 'Descanso manual');
      });
    }
  }

  function enhanceDays() {
    var dayCards = document.querySelectorAll('.day-card');
    for (var i = 0; i < dayCards.length; i++) {
      var card = dayCards[i];
      var title = card.querySelector('.day-title');
      if (!title) continue;
      var titleText = title.textContent;
      var body = document.createElement('div');
      body.className = 'day-body';
      while (title.nextSibling) body.appendChild(title.nextSibling);
      var head = document.createElement('div');
      head.className = 'day-head';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'day-toggle';
      toggle.setAttribute('aria-label', 'Expandir ou recolher dia');
      toggle.textContent = '−';
      head.appendChild(title);
      head.appendChild(toggle);
      card.appendChild(head);
      card.appendChild(body);
      (function(c,t,b,idx,key){
        var collapsed = state.days && state.days[key] && state.days[key].collapsed;
        if (collapsed) setCollapsed(c, t, true);
        head.addEventListener('click', function(){
          var next = !c.classList.contains('collapsed');
          setCollapsed(c, t, next);
          state.days = state.days || {};
          state.days[key] = state.days[key] || {};
          state.days[key].collapsed = next;
          saveState();
        });
      })(card, toggle, body, i, slug(titleText));
    }
  }

  function setCollapsed(card, toggle, collapsed) {
    card.classList.toggle('collapsed', collapsed);
    toggle.textContent = collapsed ? '+' : '−';
  }

  function enhanceExercises() {
    var rows = document.querySelectorAll('.exercise-row');
    state.exercises = state.exercises || {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var nameEl = row.querySelector('.ex-name');
      var repsEl = row.querySelector('.ex-reps');
      var doneBtn = row.querySelector('.btn-done');
      if (!nameEl || !repsEl || !doneBtn) continue;
      var name = nameEl.textContent.trim();
      var repsText = repsEl.textContent.trim();
      var seriesCount = getSeriesCount(repsText);
      var exKey = slug(name + '-' + repsText + '-' + i);
      row.setAttribute('data-key', exKey);
      row.setAttribute('data-name', name);
      row.setAttribute('data-series-total', String(seriesCount));
      if (!state.exercises[exKey]) {
        state.exercises[exKey] = { doneSets: 0, totalSets: seriesCount, rest: defaultRest, complete: false };
      }

      var info = row.querySelector('.ex-info');
      var meta = document.createElement('div');
      meta.className = 'ex-meta';
      var restWrap = document.createElement('div');
      restWrap.className = 'rest-wrap';
      restWrap.innerHTML = '<span class="rest-label">Descanso</span>' +
        '<select class="rest-select-inline">' +
        '<option value="30">30s</option>' +
        '<option value="45">45s</option>' +
        '<option value="60">60s</option>' +
        '<option value="90">90s</option>' +
        '<option value="120">120s</option>' +
        '</select>';
      meta.appendChild(restWrap);
      var seriesWrap = document.createElement('div');
      seriesWrap.className = 'series-wrap';
      for (var s = 0; s < seriesCount; s++) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'series-chip';
        chip.textContent = 'S' + (s + 1);
        chip.setAttribute('data-series-index', String(s));
        seriesWrap.appendChild(chip);
      }
      meta.appendChild(seriesWrap);
      info.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'ex-actions';
      var seriesBtn = document.createElement('button');
      seriesBtn.type = 'button';
      seriesBtn.className = 'btn-series';
      seriesBtn.textContent = '+ Série';
      row.replaceChild(actions, doneBtn);
      actions.appendChild(seriesBtn);
      actions.appendChild(doneBtn);

      var restSelect = restWrap.querySelector('select');
      restSelect.value = String(state.exercises[exKey].rest || defaultRest);
      restSelect.addEventListener('change', function(key){
        return function(e){
          state.exercises[key].rest = parseInt(e.target.value, 10);
          saveState();
        };
      }(exKey));

      seriesBtn.addEventListener('click', function(key, rowEl){
        return function(){
          incrementSeries(key, rowEl);
        };
      }(exKey, row));

      doneBtn.addEventListener('click', function(key, rowEl){
        return function(){
          toggleComplete(key, rowEl);
        };
      }(exKey, row));

      var chips = seriesWrap.querySelectorAll('.series-chip');
      for (var c = 0; c < chips.length; c++) {
        chips[c].addEventListener('click', function(key, rowEl){
          return function(e){
            toggleSpecificSeries(key, rowEl, parseInt(e.currentTarget.getAttribute('data-series-index'), 10));
          };
        }(exKey, row));
      }
    }
    saveState();
  }

  function restoreUIFromState() {
    var rows = document.querySelectorAll('.exercise-row');
    for (var i=0; i<rows.length; i++) {
      var row = rows[i];
      var key = row.getAttribute('data-key');
      if (!key || !state.exercises[key]) continue;
      paintRow(row, state.exercises[key]);
    }
  }

  function incrementSeries(key, row) {
    var ex = state.exercises[key];
    if (!ex) return;
    if (ex.doneSets < ex.totalSets) ex.doneSets += 1;
    if (ex.doneSets >= ex.totalSets) ex.complete = true;
    paintRow(row, ex);
    updateProgress();
    saveState();
    setTimerDuration(ex.rest || defaultRest, true, row.getAttribute('data-name') || 'Descanso');
  }

  function toggleSpecificSeries(key, row, idx) {
    var ex = state.exercises[key];
    if (!ex) return;
    var target = idx + 1;
    ex.doneSets = (ex.doneSets >= target) ? (target - 1) : target;
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
    var chips = row.querySelectorAll('.series-chip');
    for (var i=0; i<chips.length; i++) {
      chips[i].classList.toggle('done', i < ex.doneSets);
    }
    var seriesBtn = row.querySelector('.btn-series');
    if (seriesBtn) {
      var next = Math.min(ex.doneSets + 1, ex.totalSets);
      seriesBtn.textContent = ex.complete ? 'Completo' : '+ Série ' + next;
      seriesBtn.classList.toggle('is-complete', !!ex.complete);
    }
    var doneBtn = row.querySelector('.btn-done');
    if (doneBtn) {
      doneBtn.classList.toggle('checked', !!ex.complete);
      doneBtn.innerHTML = ex.complete ? '&#10003;' : 'Feito';
    }
  }

  function updateProgress() {
    var items = Object.keys(state.exercises || {});
    var totalSeries = 0;
    var doneSeries = 0;
    for (var i=0; i<items.length; i++) {
      var ex = state.exercises[items[i]];
      totalSeries += Number(ex.totalSets || 0);
      doneSeries += Number(ex.doneSets || 0);
    }
    var pct = totalSeries ? Math.round((doneSeries / totalSeries) * 100) : 0;
    if (fill) fill.style.width = pct + '%';
    if (numEl) numEl.textContent = pct;
  }

  function bindTimerButtons() {
    var btnStart = document.getElementById('btnStart');
    var btnPause = document.getElementById('btnPause');
    var btnStop = document.getElementById('btnStop');
    var btnReset = document.getElementById('btnReset');
    if (btnStart) btnStart.addEventListener('click', function(){ startTimer(); });
    if (btnPause) btnPause.addEventListener('click', function(){ pauseTimer(); });
    if (btnStop) btnStop.addEventListener('click', function(){ stopTimer(); });
    if (btnReset) btnReset.addEventListener('click', function(){ resetTimer(); });
  }

  function bindDockButtons() {
    var dockToggle = document.getElementById('dockToggle');
    var dockPlus = document.getElementById('dockPlus');
    var dockMinus = document.getElementById('dockMinus');
    if (dockToggle) dockToggle.addEventListener('click', function(){
      if (state.timer.running) pauseTimer(); else startTimer();
    });
    if (dockPlus) dockPlus.addEventListener('click', function(){ adjustTimer(15); });
    if (dockMinus) dockMinus.addEventListener('click', function(){ adjustTimer(-15); });
  }

  function setTimerDuration(seconds, autostart, label) {
    pauseTimer();
    state.timer.duration = seconds;
    state.timer.remaining = seconds;
    if (label) state.timer.label = label;
    updateTimerUI();
    saveState();
    syncPresetControls(seconds);
    if (autostart) startTimer();
  }

  function adjustTimer(delta) {
    var next = Math.max(5, Number(state.timer.remaining || defaultRest) + delta);
    state.timer.remaining = next;
    state.timer.duration = Math.max(next, Number(state.timer.duration || defaultRest));
    updateTimerUI();
    saveState();
  }

  function startTimer() {
    if (state.timer.running) return;
    if (!state.timer.remaining || state.timer.remaining <= 0) state.timer.remaining = state.timer.duration || defaultRest;
    state.timer.running = true;
    if (msgEl) msgEl.textContent = '';
    startInterval();
    updateTimerUI();
    saveState();
  }

  function pauseTimer() {
    state.timer.running = false;
    if (timerInt) {
      clearInterval(timerInt);
      timerInt = null;
    }
    updateTimerUI();
    saveState();
  }

  function stopTimer() {
    pauseTimer();
    state.timer.remaining = state.timer.duration || defaultRest;
    if (msgEl) msgEl.textContent = '';
    updateTimerUI();
    saveState();
  }

  function resetTimer() {
    stopTimer();
  }

  function startInterval() {
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(function(){
      if (!state.timer.running) return;
      state.timer.remaining -= 1;
      if (state.timer.remaining <= 0) {
        state.timer.remaining = 0;
        pauseTimer();
        if (msgEl) msgEl.textContent = 'Descanso acabou! 💪';
        if (navigator.vibrate) navigator.vibrate([200,120,200]);
      }
      updateTimerUI();
      saveState();
    }, 1000);
  }

  function updateTimerUI() {
    var formatted = formatTime(Number(state.timer.remaining || defaultRest));
    if (display) display.textContent = formatted;
    if (dockTime) dockTime.textContent = formatted;
    if (dockExercise) dockExercise.textContent = state.timer.label || 'Selecione uma série';
    var dockToggle = document.getElementById('dockToggle');
    if (dockToggle) dockToggle.textContent = state.timer.running ? 'Pause' : 'Iniciar';
  }

  function syncPresetControls(seconds) {
    var select = document.getElementById('timerPresetSelect');
    if (select && ['30','45','60','90','120'].indexOf(String(seconds)) > -1) select.value = String(seconds);
    var chips = document.querySelectorAll('.preset-btn');
    for (var i=0; i<chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].getAttribute('data-seconds') === String(seconds));
    }
  }

  function getSeriesCount(repsText) {
    var match = repsText.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 3;
  }

  function slug(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function formatTime(totalSeconds) {
    var min = Math.floor(totalSeconds / 60);
    var sec = totalSeconds % 60;
    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
});
