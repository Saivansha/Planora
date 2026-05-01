const plannerForm = document.getElementById("plannerForm");
const subjectsInput = document.getElementById("subjectsInput");
const daysInput = document.getElementById("daysInput");
const hoursInput = document.getElementById("hoursInput");
const moodSelect = document.getElementById("moodSelect");
const priorityContainer = document.getElementById("priorityContainer");
const planOutput = document.getElementById("planOutput");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const totalTasksStat = document.getElementById("totalTasksStat");
const completedTasksStat = document.getElementById("completedTasksStat");
const streakStat = document.getElementById("streakStat");
const timerDisplay = document.getElementById("timerDisplay");
const focusTimerDisplay = document.getElementById("focusTimerDisplay");
const todayFocusText = document.getElementById("todayFocusText");
const focusTaskText = document.getElementById("focusTaskText");
const smartSuggestion = document.getElementById("smartSuggestion");
const celebrationMessage = document.getElementById("celebrationMessage");
const quoteText = document.getElementById("quoteText");
const confettiCanvas = document.getElementById("confettiCanvas");

const navToggleBtn = document.getElementById("navToggleBtn");
const navLinks = document.getElementById("navLinks");
const getStartedBtn = document.getElementById("getStartedBtn");
const goToAboutBtn = document.getElementById("goToAboutBtn");
const backToTopBtn = document.getElementById("backToTopBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeLogoIcon = document.getElementById("themeLogoIcon");
const paletteSelect = document.getElementById("paletteSelect");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const startTimerBtn = document.getElementById("startTimerBtn");
const pauseTimerBtn = document.getElementById("pauseTimerBtn");
const resetTimerBtn = document.getElementById("resetTimerBtn");
const timerDurationSelect = document.getElementById("timerDurationSelect");
const focusModeBtn = document.getElementById("focusModeBtn");
const jumpTodayBtn = document.getElementById("jumpTodayBtn");
const focusStartBtn = document.getElementById("focusStartBtn");
const focusPauseBtn = document.getElementById("focusPauseBtn");
const focusResetBtn = document.getElementById("focusResetBtn");
const focusDurationSelect = document.getElementById("focusDurationSelect");
const markTodayDoneBtn = document.getElementById("markTodayDoneBtn");
const newQuoteBtn = document.getElementById("newQuoteBtn");

const STORAGE_KEYS = { plan: "planora_plan", streak: "planora_streak", theme: "planora_theme", palette: "planora_palette", quote: "planora_quote" };
const QUOTES = [
  "Stay consistent, success will follow.",
  "You do not have to be perfect, only persistent.",
  "Small progress every day creates big results.",
  "Discipline today creates freedom tomorrow.",
  "Study smart, not just hard."
];

let currentPlan = [];
let timerSeconds = 30 * 60;
let timerId = null;

function parseSubjects(raw) {
  return Array.from(new Set(raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean)));
}

function buildPrioritySelectors(subjects) {
  priorityContainer.innerHTML = "";
  subjects.forEach(function (subject) {
    const wrap = document.createElement("div");
    wrap.className = "priority-item";
    wrap.innerHTML = '<label>Priority for ' + subject + '</label><select data-subject="' + subject + '"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select>';
    priorityContainer.appendChild(wrap);
  });
}

function collectPriorities() {
  const map = {};
  priorityContainer.querySelectorAll("select[data-subject]").forEach(function (sel) {
    map[sel.dataset.subject] = sel.value;
  });
  return map;
}

function getMoodSortedSubjects(subjects, priorities, mood) {
  const rank = { high: 3, medium: 2, low: 1 };
  return subjects.slice().sort(function (a, b) {
    const diff = rank[priorities[b]] - rank[priorities[a]];
    return mood === "tired" ? -diff : diff;
  });
}

function distributeMinutes(subjects, priorities, totalMinutes) {
  const weightByPriority = { high: 0.5, medium: 0.3, low: 0.2 };
  const grouped = { high: [], medium: [], low: [] };
  subjects.forEach(function (subject) {
    grouped[priorities[subject]].push(subject);
  });

  const allocated = {};
  let used = 0;
  ["high", "medium", "low"].forEach(function (bucket) {
    const list = grouped[bucket];
    if (!list.length) { return; }
    const bucketMinutes = Math.round(totalMinutes * weightByPriority[bucket]);
    const perSubject = Math.max(15, Math.floor(bucketMinutes / list.length));
    list.forEach(function (subject) {
      allocated[subject] = perSubject;
      used += perSubject;
    });
  });

  const ordered = subjects.slice();
  let remainder = totalMinutes - used;
  let idx = 0;
  while (remainder > 0 && ordered.length > 0) {
    allocated[ordered[idx % ordered.length]] += 1;
    remainder -= 1;
    idx += 1;
  }
  return allocated;
}

function formatMinutes(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) { return hrs + " hr " + mins + " min"; }
  if (hrs > 0) { return hrs + " hr"; }
  return mins + " min";
}

function generatePlan(subjects, days, dailyHours, mood, priorities) {
  const dailyMinutes = dailyHours * 60;
  const sortedSubjects = getMoodSortedSubjects(subjects, priorities, mood);
  const minuteMap = distributeMinutes(subjects, priorities, dailyMinutes);
  const plan = [];

  for (let day = 1; day <= days; day += 1) {
    const tasks = [];
    sortedSubjects.forEach(function (subject) {
      const priority = priorities[subject];
      const minutes = minuteMap[subject];
      if (priority === "high" && minutes >= 60 && day % 2 === 0) {
        tasks.push({ subject: subject, priority: priority, minutes: minutes - 20, done: false });
        tasks.push({ subject: subject + " Revision", priority: priority, minutes: 20, done: false });
      } else {
        tasks.push({ subject: subject, priority: priority, minutes: minutes, done: false });
      }
    });
    if (mood === "exhausted") {
      tasks.forEach(function (task) { task.minutes = Math.max(15, task.minutes - 10); });
    }
    plan.push({ day: day, tasks: tasks });
  }
  return plan;
}

function flattenTasks() {
  return currentPlan.flatMap(function (d) { return d.tasks; });
}

function savePlan() { localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(currentPlan)); }

function loadPlan() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.plan);
    if (!raw) { return; }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) { currentPlan = parsed; renderPlan(); }
  } catch (error) {
    localStorage.removeItem(STORAGE_KEYS.plan);
  }
}

function firstPendingTask() {
  for (let i = 0; i < currentPlan.length; i += 1) {
    for (let j = 0; j < currentPlan[i].tasks.length; j += 1) {
      if (!currentPlan[i].tasks[j].done) {
        return { day: currentPlan[i].day, task: currentPlan[i].tasks[j], dayIndex: i, taskIndex: j };
      }
    }
  }
  return null;
}

function updateTodayFocus() {
  const pending = firstPendingTask();
  if (!pending) {
    todayFocusText.textContent = "Today: All tasks completed";
    focusTaskText.textContent = "Today's task: Completed";
    return;
  }
  todayFocusText.textContent = "Today: Day " + pending.day + " -> " + pending.task.subject + " (" + formatMinutes(pending.task.minutes) + ")";
  focusTaskText.textContent = "Today's task: " + pending.task.subject + " - " + formatMinutes(pending.task.minutes);
}

function updateStreak(allDone) {
  const today = new Date().toDateString();
  let streak = { count: 0, lastDate: "" };
  const raw = localStorage.getItem(STORAGE_KEYS.streak);
  if (raw) {
    try { streak = JSON.parse(raw); } catch (error) { streak = { count: 0, lastDate: "" }; }
  }
  if (allDone && streak.lastDate !== today) {
    streak.count += 1;
    streak.lastDate = today;
  }
  localStorage.setItem(STORAGE_KEYS.streak, JSON.stringify(streak));
  streakStat.textContent = "Streak: " + streak.count;
}

function updateProgress() {
  const allTasks = flattenTasks();
  const total = allTasks.length;
  const done = allTasks.filter(function (t) { return t.done; }).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  progressText.textContent = percent + "% Completed";
  progressBar.style.width = percent + "%";
  totalTasksStat.textContent = "Total: " + total;
  completedTasksStat.textContent = "Completed: " + done;
  if (total > 0 && done === total) {
    celebrationMessage.classList.remove("hidden");
    updateStreak(true);
    launchConfetti();
  } else {
    celebrationMessage.classList.add("hidden");
  }
}

function applyAdaptiveRule() {
  for (let i = 0; i < currentPlan.length - 1; i += 1) {
    const nextDay = currentPlan[i + 1];
    const pending = currentPlan[i].tasks.filter(function (t) { return !t.done; });
    if (pending.length > 0) {
      nextDay.tasks = pending.concat(nextDay.tasks);
      currentPlan[i].tasks = currentPlan[i].tasks.filter(function (t) { return t.done; });
    }
  }
}

function updateSuggestion(mood) {
  const tips = {
    fresh: "Tip: Fresh mood detected. Harder subjects are ordered first.",
    tired: "Tip: Tired mode active. Easier subjects are placed first.",
    exhausted: "Tip: Exhausted mode active. Workload is reduced per task."
  };
  smartSuggestion.textContent = tips[mood] || tips.fresh;
}

function renderPlan() {
  if (!currentPlan.length) {
    planOutput.innerHTML = '<p class="placeholder">Your study plan will appear here.</p>';
    updateTodayFocus();
    updateProgress();
    return;
  }

  const pending = firstPendingTask();
  const pendingDayIndex = pending ? pending.dayIndex : -1;
  const pendingTaskIndex = pending ? pending.taskIndex : -1;

  planOutput.innerHTML = currentPlan.map(function (dayObj, dayIndex) {
    const tasksHtml = dayObj.tasks.map(function (task, taskIndex) {
      const checked = task.done ? "checked" : "";
      const isTodayTask = dayIndex === pendingDayIndex && taskIndex === pendingTaskIndex;
      const todayClass = isTodayTask ? " today-task-highlight" : "";
      const todayId = isTodayTask ? ' id="todayTaskAnchor"' : "";
      return '<div class="task-line' + todayClass + '"' + todayId + '><span class="task-text">' + task.subject + ' - ' + formatMinutes(task.minutes) + " (" + task.priority + ')</span><label><input type="checkbox" class="task-checkbox" data-day="' + dayIndex + '" data-task="' + taskIndex + '" ' + checked + "> Done</label></div>";
    }).join("");
    return '<article class="plan-day fade-in"><h3>Day ' + dayObj.day + "</h3>" + tasksHtml + "</article>";
  }).join("");

  planOutput.querySelectorAll(".task-checkbox").forEach(function (box) {
    box.addEventListener("change", function () {
      const day = Number(box.dataset.day);
      const task = Number(box.dataset.task);
      currentPlan[day].tasks[task].done = box.checked;
      if (!box.checked) { applyAdaptiveRule(); }
      savePlan();
      renderPlan();
    });
  });

  updateTodayFocus();
  updateProgress();
}

function scrollToTodayTask() {
  const target = document.getElementById("todayTaskAnchor");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("task-pulse");
    setTimeout(function () { target.classList.remove("task-pulse"); }, 1200);
  }
}

function buildTextPlan() {
  return currentPlan.map(function (dayObj) {
    const lines = dayObj.tasks.map(function (task) {
      return "  - " + task.subject + " (" + formatMinutes(task.minutes) + ", " + task.priority + ")";
    }).join("\n");
    return "Day " + dayObj.day + ":\n" + lines;
  }).join("\n\n");
}

function copyPlan() {
  if (!currentPlan.length) { alert("Generate a plan first."); return; }
  navigator.clipboard.writeText(buildTextPlan()).then(function () {
    alert("Planner copied.");
  }).catch(function () {
    alert("Clipboard blocked by browser.");
  });
}

function downloadPlan() {
  if (!currentPlan.length) { alert("Generate a plan first."); return; }
  const blob = new Blob([buildTextPlan()], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planora-study-plan.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function setTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggleBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
  themeLogoIcon.textContent = isDark ? "🌙" : "☀️";
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
}
function loadTheme() { setTheme(localStorage.getItem(STORAGE_KEYS.theme) === "dark"); }

function setPalette(name) {
  document.body.classList.remove("theme-blue", "theme-green", "theme-purple", "theme-warm", "theme-soothing");
  document.body.classList.add("theme-" + name);
  localStorage.setItem(STORAGE_KEYS.palette, name);
}
function loadPalette() {
  const palette = localStorage.getItem(STORAGE_KEYS.palette) || "blue";
  paletteSelect.value = palette;
  setPalette(palette);
}

function setQuote(text) {
  quoteText.textContent = text;
  localStorage.setItem(STORAGE_KEYS.quote, text);
}
function loadQuote() {
  const saved = localStorage.getItem(STORAGE_KEYS.quote);
  if (saved) { quoteText.textContent = saved; } else { setQuote(QUOTES[0]); }
}

function formatClock(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return min + ":" + sec;
}

function syncDurationSelects(value) {
  timerDurationSelect.value = String(value);
  focusDurationSelect.value = String(value);
}

function setTimerFromSelection(minutes) {
  timerSeconds = Number(minutes) * 60;
  updateTimerViews();
}

function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  osc.frequency.value = 880;
  osc.connect(ctx.destination);
  osc.start();
  setTimeout(function () { osc.stop(); ctx.close(); }, 300);
}

function updateTimerViews() {
  const text = formatClock(timerSeconds);
  timerDisplay.textContent = text;
  focusTimerDisplay.textContent = text;
}

function startTimer() {
  if (timerId) { return; }
  timerId = setInterval(function () {
    timerSeconds -= 1;
    updateTimerViews();
    if (timerSeconds <= 0) {
      clearInterval(timerId);
      timerId = null;
      timerSeconds = 0;
      updateTimerViews();
      beep();
      alert("Timer completed.");
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerId) { return; }
  clearInterval(timerId);
  timerId = null;
}

function resetTimer() {
  pauseTimer();
  setTimerFromSelection(Number(timerDurationSelect.value));
}

function markTodayTaskDone() {
  const pending = firstPendingTask();
  if (!pending) { alert("No pending task."); return; }
  currentPlan[pending.dayIndex].tasks[pending.taskIndex].done = true;
  savePlan();
  renderPlan();
}

function launchConfetti() {
  const ctx = confettiCanvas.getContext("2d");
  confettiCanvas.style.display = "block";
  confettiCanvas.width = confettiCanvas.clientWidth;
  confettiCanvas.height = 220;
  const pieces = Array.from({ length: 100 }).map(function () {
    return { x: Math.random() * confettiCanvas.width, y: -20 - Math.random() * 200, size: 5 + Math.random() * 5, speed: 2 + Math.random() * 3 };
  });
  let frame = 0;
  function animate() {
    frame += 1;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    pieces.forEach(function (p) {
      p.y += p.speed;
      ctx.fillStyle = ["#3b82f6", "#8b5cf6", "#10b981", "#ec4899"][Math.floor(Math.random() * 4)];
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    if (frame < 90) { requestAnimationFrame(animate); } else { confettiCanvas.style.display = "none"; }
  }
  animate();
}

function updateNavHighlight() {
  const sections = document.querySelectorAll("section[id], header[id]");
  const links = document.querySelectorAll(".nav-link");
  let activeId = "home";
  sections.forEach(function (section) {
    if (section.getBoundingClientRect().top <= 120) { activeId = section.id; }
  });
  links.forEach(function (link) {
    link.classList.toggle("active", link.getAttribute("href") === "#" + activeId);
  });
}

subjectsInput.addEventListener("input", function () { buildPrioritySelectors(parseSubjects(subjectsInput.value)); });

plannerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const subjects = parseSubjects(subjectsInput.value);
  const days = Number(daysInput.value);
  const hours = Number(hoursInput.value);
  const mood = moodSelect.value;
  if (!subjects.length || days < 1 || hours < 1) {
    alert("Please enter valid subjects, days, and hours.");
    return;
  }
  if (!priorityContainer.children.length) { buildPrioritySelectors(subjects); }
  const priorities = collectPriorities();
  currentPlan = generatePlan(subjects, days, hours, mood, priorities);
  updateSuggestion(mood);
  savePlan();
  renderPlan();
  setTimeout(scrollToTodayTask, 180);
});

themeToggleBtn.addEventListener("click", function () { setTheme(!document.body.classList.contains("dark")); });
paletteSelect.addEventListener("change", function () { setPalette(paletteSelect.value); });
copyBtn.addEventListener("click", copyPlan);
downloadBtn.addEventListener("click", downloadPlan);
clearBtn.addEventListener("click", function () { currentPlan = []; savePlan(); renderPlan(); });
startTimerBtn.addEventListener("click", startTimer);
pauseTimerBtn.addEventListener("click", pauseTimer);
resetTimerBtn.addEventListener("click", resetTimer);
focusStartBtn.addEventListener("click", startTimer);
focusPauseBtn.addEventListener("click", pauseTimer);
focusResetBtn.addEventListener("click", resetTimer);
markTodayDoneBtn.addEventListener("click", markTodayTaskDone);
focusModeBtn.addEventListener("click", function () { document.getElementById("focus").scrollIntoView({ behavior: "smooth" }); });
jumpTodayBtn.addEventListener("click", scrollToTodayTask);
newQuoteBtn.addEventListener("click", function () { setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]); });

timerDurationSelect.addEventListener("change", function () {
  syncDurationSelects(Number(timerDurationSelect.value));
  if (!timerId) { setTimerFromSelection(Number(timerDurationSelect.value)); }
});
focusDurationSelect.addEventListener("change", function () {
  syncDurationSelects(Number(focusDurationSelect.value));
  if (!timerId) { setTimerFromSelection(Number(focusDurationSelect.value)); }
});

getStartedBtn.addEventListener("click", function () { document.getElementById("planner").scrollIntoView({ behavior: "smooth" }); });
goToAboutBtn.addEventListener("click", function () { document.getElementById("about").scrollIntoView({ behavior: "smooth" }); });
backToTopBtn.addEventListener("click", function () { document.getElementById("home").scrollIntoView({ behavior: "smooth" }); });
navToggleBtn.addEventListener("click", function () { navLinks.classList.toggle("open"); });
window.addEventListener("scroll", updateNavHighlight);

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && document.activeElement.tagName !== "TEXTAREA" && document.activeElement !== document.querySelector(".task-text")) {
    if (!event.shiftKey) {
      event.preventDefault();
      plannerForm.requestSubmit();
    }
  }
});

loadTheme();
loadPalette();
loadQuote();
loadPlan();
syncDurationSelects(30);
setTimerFromSelection(30);
updateNavHighlight();
