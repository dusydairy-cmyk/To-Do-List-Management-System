const STORAGE_KEY = "taskmate-student-tasks-v1";
const $ = (selector) => document.querySelector(selector);
const taskList = $("#taskList");
const emptyState = $("#emptyState");
const dialog = $("#taskDialog");
const form = $("#taskForm");
let tasks = loadTasks();
let activeFilter = "all";
let toastTimer;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function todayISO() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function formatDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function updateStats() {
  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.length - completed;
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  $("#totalStat").textContent = tasks.length;
  $("#pendingStat").textContent = pending;
  $("#completedStat").textContent = completed;
  $("#allCount").textContent = tasks.length;
  $("#pendingCount").textContent = pending;
  $("#completedCount").textContent = completed;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;
}
function getVisibleTasks() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const category = $("#categoryFilter").value;
  let result = tasks.filter(task => {
    const matchesFilter = activeFilter === "all" ||
      (activeFilter === "pending" && !task.completed) ||
      (activeFilter === "completed" && task.completed);
    const matchesQuery = `${task.title} ${task.description || ""} ${task.category}`.toLowerCase().includes(query);
    return matchesFilter && matchesQuery && (category === "all" || task.category === category);
  });
  const sort = $("#sortSelect").value;
  result.sort((a, b) => {
    if (sort === "priority") {
      const weight = { high: 0, medium: 1, low: 2 };
      return weight[a.priority] - weight[b.priority];
    }
    if (sort === "created") return b.createdAt - a.createdAt;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  });
  return result;
}
function renderTasks() {
  updateStats();
  const visible = getVisibleTasks();
  taskList.innerHTML = visible.map(task => {
    const overdue = task.dueDate && task.dueDate < todayISO() && !task.completed;
    return `<article class="task-card ${task.completed ? "is-complete" : ""}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHTML(task.title)} complete" data-action="toggle" data-id="${task.id}" ${task.completed ? "checked" : ""}>
      <div class="task-content">
        <div class="task-title-row"><span class="task-title">${escapeHTML(task.title)}</span></div>
        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ""}
        <div class="task-meta"><span class="pill">${escapeHTML(task.category)}</span><span class="pill priority-${task.priority}">${task.priority[0].toUpperCase() + task.priority.slice(1)} priority</span><span class="due-date ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : ""}${formatDate(task.dueDate)}</span></div>
      </div>
      <div class="task-actions"><button class="icon-btn" data-action="edit" data-id="${task.id}" aria-label="Edit task" title="Edit">✎</button><button class="icon-btn" data-action="delete" data-id="${task.id}" aria-label="Delete task" title="Delete">⌫</button></div>
    </article>`;
  }).join("");
  emptyState.hidden = visible.length > 0;
  taskList.hidden = visible.length === 0;
  $("#listTitle").textContent = ({ all: "All tasks", pending: "Pending tasks", completed: "Completed tasks" })[activeFilter];
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.filter === activeFilter));
}
function openDialog(task = null) {
  form.reset();
  $("#taskId").value = task ? task.id : "";
  $("#dialogTitle").textContent = task ? "Edit task" : "Add a new task";
  $("#taskTitle").value = task?.title || "";
  $("#taskDescription").value = task?.description || "";
  $("#taskCategory").value = task?.category || "Assignments";
  $("#taskPriority").value = task?.priority || "medium";
  $("#taskDueDate").value = task?.dueDate || "";
  dialog.showModal();
  $("#taskTitle").focus();
}
function closeDialog() {
  dialog.close();
}
$("#addTaskBtn").addEventListener("click", () => openDialog());
$("#emptyAddBtn").addEventListener("click", () => openDialog());
$("#closeDialog").addEventListener("click", closeDialog);
$("#cancelDialog").addEventListener("click", closeDialog);
dialog.addEventListener("click", event => {
  if (event.target === dialog) closeDialog();
});
form.addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#taskId").value;
  const title = $("#taskTitle").value.trim();
  if (!title) {
    $("#taskTitle").focus();
    return;
  }
  const existing = tasks.find(task => task.id === id);
  const taskData = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    title,
    description: $("#taskDescription").value.trim(),
    category: $("#taskCategory").value,
    priority: $("#taskPriority").value,
    dueDate: $("#taskDueDate").value,
    completed: existing ? existing.completed : false,
    createdAt: existing ? existing.createdAt : Date.now()
  };
  if (existing) {
    tasks = tasks.map(task => task.id === id ? taskData : task);
    showToast("Task updated successfully");
  } else {
    tasks.push(taskData);
    showToast("Task added successfully");
  }
  saveTasks();
  closeDialog();
  renderTasks();
});
taskList.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const { action, id } = control.dataset;
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  if (action === "edit") openDialog(task);
  if (action === "delete") {
    if (confirm(`Delete "${task.title}"?`)) {
      tasks = tasks.filter(item => item.id !== id);
      saveTasks();
      renderTasks();
      showToast("Task deleted");
    }
  }
});
taskList.addEventListener("change", event => {
  const control = event.target.closest('[data-action="toggle"]');
  if (!control) return;
  const task = tasks.find(item => item.id === control.dataset.id);
  if (!task) return;
  task.completed = control.checked;
  saveTasks();
  renderTasks();
  showToast(task.completed ? "Nice work — task completed!" : "Task moved to pending");
});
document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    renderTasks();
  });
});
$("#searchInput").addEventListener("input", renderTasks);
$("#categoryFilter").addEventListener("change", renderTasks);
$("#sortSelect").addEventListener("change", renderTasks);
$("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();

// Add sample tasks on the first run so the dashboard is easy to preview.
// Delete these examples if you want a completely empty first launch.
if (tasks.length === 0 && !localStorage.getItem(`${STORAGE_KEY}-initialized`)) {
  tasks = [
    { id: "sample-1", title: "Complete mathematics assignment", description: "Solve exercises from chapter 4", category: "Assignments", priority: "high", dueDate: todayISO(), completed: false, createdAt: Date.now() - 3000 },
    { id: "sample-2", title: "Prepare for database systems quiz", description: "Review normalization and SQL basics", category: "Exams", priority: "medium", dueDate: "", completed: false, createdAt: Date.now() - 2000 },
    { id: "sample-3", title: "Plan mini project presentation", description: "Outline the main features and demo flow", category: "Projects", priority: "low", dueDate: "", completed: true, createdAt: Date.now() - 1000 }
  ];
  localStorage.setItem(`${STORAGE_KEY}-initialized`, "yes");
  saveTasks();
}
renderTasks();
