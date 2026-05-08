const STORAGE_KEY = "daily-study-planner";
const form = document.querySelector("#planner-form");
const daysLeftInput = document.querySelector("#days-left");
const subjectsList = document.querySelector("#subjects-list");
const addSubjectButton = document.querySelector("#add-subject");
const resetButton = document.querySelector("#reset-button");
const rowTemplate = document.querySelector("#subject-row-template");
const todayTitle = document.querySelector("#today-title");
const todayProgress = document.querySelector("#today-progress");
const todayTasks = document.querySelector("#today-tasks");
const scheduleContainer = document.querySelector("#schedule");

let plannerState = loadState();

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { completed: {} };
  } catch {
    return { completed: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plannerState));
}

function createSubjectRow(subject = { name: "", units: 10 }) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".subject-name").value = subject.name;
  row.querySelector(".subject-units").value = subject.units;
  row.querySelector(".remove-subject").addEventListener("click", () => {
    row.remove();
    if (!subjectsList.children.length) {
      createSubjectRow({ name: "", units: 10 });
    }
  });
  subjectsList.append(row);
}

function readSubjectsFromForm() {
  return [...subjectsList.querySelectorAll(".subject-row")]
    .map((row) => ({
      name: row.querySelector(".subject-name").value.trim(),
      units: Number(row.querySelector(".subject-units").value),
    }))
    .filter((subject) => subject.name && subject.units > 0);
}

function splitUnits(totalUnits, daysLeft) {
  const base = Math.floor(totalUnits / daysLeft);
  const remainder = totalUnits % daysLeft;
  return Array.from({ length: daysLeft }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildSchedule(subjects, daysLeft) {
  const today = new Date();
  const schedule = Array.from({ length: daysLeft }, (_, index) => ({
    date: toDateKey(addDays(today, index)),
    tasks: [],
  }));

  subjects.forEach((subject, subjectIndex) => {
    splitUnits(subject.units, daysLeft).forEach((units, dayIndex) => {
      if (units > 0) {
        schedule[dayIndex].tasks.push({
          id: `subject-${subjectIndex}-day-${dayIndex}`,
          subject: subject.name,
          units,
        });
      }
    });
  });

  return schedule;
}

function makePlan(event) {
  event.preventDefault();
  const daysLeft = Number(daysLeftInput.value);
  const subjects = readSubjectsFromForm();

  if (!subjects.length) {
    alert("최소 1개 이상의 시험 과목을 입력해 주세요.");
    return;
  }

  plannerState = {
    daysLeft,
    subjects,
    schedule: buildSchedule(subjects, daysLeft),
    completed: {},
    createdAt: toDateKey(new Date()),
  };

  saveState();
  render();
}

function setTaskCompleted(taskKey, checked) {
  plannerState.completed = { ...plannerState.completed, [taskKey]: checked };
  saveState();
  render();
}

function renderSetup() {
  subjectsList.innerHTML = "";
  daysLeftInput.value = plannerState.daysLeft ?? 7;
  const subjects = plannerState.subjects?.length
    ? plannerState.subjects
    : [
        { name: "국어", units: 12 },
        { name: "수학", units: 16 },
        { name: "영어", units: 10 },
      ];
  subjects.forEach(createSubjectRow);
}

function renderToday() {
  const todayKey = toDateKey(new Date());
  const todayPlan = plannerState.schedule?.find((day) => day.date === todayKey);
  todayTitle.textContent = formatDate(todayKey);

  if (!todayPlan || !todayPlan.tasks.length) {
    todayProgress.textContent = "0%";
    todayTasks.className = "task-list empty-state";
    todayTasks.textContent = plannerState.schedule
      ? "오늘 배정된 공부가 없어요. 남은 일정을 확인해 보세요."
      : "아직 계획이 없어요. 시험 정보를 입력해 주세요.";
    return;
  }

  const completedCount = todayPlan.tasks.filter((task) => plannerState.completed[`${todayPlan.date}-${task.id}`]).length;
  todayProgress.textContent = `${Math.round((completedCount / todayPlan.tasks.length) * 100)}%`;
  todayTasks.className = "task-list";
  todayTasks.innerHTML = "";

  todayPlan.tasks.forEach((task) => {
    const taskKey = `${todayPlan.date}-${task.id}`;
    const isCompleted = Boolean(plannerState.completed[taskKey]);
    const taskCard = document.createElement("label");
    const checkbox = document.createElement("input");
    const content = document.createElement("span");
    const title = document.createElement("span");
    const meta = document.createElement("span");

    taskCard.className = `task-card${isCompleted ? " completed" : ""}`;
    checkbox.type = "checkbox";
    checkbox.checked = isCompleted;
    title.className = "task-title";
    title.textContent = task.subject;
    meta.className = "task-meta";
    meta.textContent = `${task.units}개 분량 공부하기`;

    content.append(title, meta);
    taskCard.append(checkbox, content);
    checkbox.addEventListener("change", (event) => {
      setTaskCompleted(taskKey, event.target.checked);
    });
    todayTasks.append(taskCard);
  });
}

function renderSchedule() {
  if (!plannerState.schedule?.length) {
    scheduleContainer.className = "schedule empty-state";
    scheduleContainer.textContent = "계획을 만들면 이곳에 날짜별 공부량이 표시됩니다.";
    return;
  }

  const todayKey = toDateKey(new Date());
  scheduleContainer.className = "schedule";
  scheduleContainer.innerHTML = "";

  plannerState.schedule.forEach((day, index) => {
    const dayCard = document.createElement("article");
    const heading = document.createElement("h3");
    const title = document.createElement("span");
    const list = document.createElement("ul");

    dayCard.className = "day-card";
    title.textContent = `${index + 1}일차 · ${formatDate(day.date)}`;
    heading.append(title);

    if (day.date === todayKey) {
      const todayLabel = document.createElement("span");
      todayLabel.className = "today-label";
      todayLabel.textContent = "오늘";
      heading.append(todayLabel);
    }

    const tasks = day.tasks.length ? day.tasks : [{ subject: "복습 또는 휴식", units: null }];
    tasks.forEach((task) => {
      const item = document.createElement("li");
      item.textContent = task.units ? `${task.subject}: ${task.units}개 분량` : task.subject;
      list.append(item);
    });

    dayCard.append(heading, list);
    scheduleContainer.append(dayCard);
  });
}

function render() {
  renderToday();
  renderSchedule();
}

addSubjectButton.addEventListener("click", () => createSubjectRow());
form.addEventListener("submit", makePlan);
resetButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  plannerState = { completed: {} };
  renderSetup();
  render();
});

renderSetup();
render();
