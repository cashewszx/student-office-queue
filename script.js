"use strict";

const userRole = sessionStorage.getItem("userRole");

if (
    sessionStorage.getItem("loggedIn") !== "true" ||
    !["admin", "student"].includes(userRole)
) {
    window.location.replace("index.html");
    throw new Error("Login required.");
}

const QUEUE_KEY = "studentOfficeQueueData";
const COUNTER_KEY = "studentOfficeQueueNextNumber";

const currentUsername = sessionStorage.getItem("username") || "";
const currentFullName = sessionStorage.getItem("fullName") || "User";
const isAdmin = userRole === "admin";

let queues = loadQueues();

function loadQueues() {
    try {
        const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
        if (!Array.isArray(saved)) return [];

        // Migrate older records that used Student ID.
        return saved.map(queue => ({
            ...queue,
            yearLevel: queue.yearLevel || "Not specified",
            section: queue.section || "Not specified"
        }));
    } catch {
        return [];
    }
}

function saveQueues() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queues));
}

function getNextNumber() {
    const stored = Number(localStorage.getItem(COUNTER_KEY)) || 1;
    const largestExisting = queues.reduce(
        (largest, queue) => Math.max(largest, Number(queue.number) || 0),
        0
    );

    return Math.max(stored, largestExisting + 1);
}

const welcomeUser = document.getElementById("welcomeUser");
const roleBadge = document.getElementById("roleBadge");
const currentDate = document.getElementById("currentDate");
const queueForm = document.getElementById("queueForm");
const queueTableBody = document.getElementById("queueTableBody");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const newQueueResult = document.getElementById("newQueueResult");
const adminPanel = document.getElementById("adminPanel");

welcomeUser.textContent = "Welcome, " + currentFullName;
roleBadge.textContent = isAdmin ? "ADMIN" : "STUDENT";
adminPanel.hidden = !isAdmin;

document.getElementById("logoutBtn").addEventListener("click", function () {
    sessionStorage.clear();
    window.location.replace("index.html");
});

function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(remainder).padStart(2, "0")
    ].join(":");
}

function elapsedTime(queue) {
    const start = queue.status === "serving"
        ? queue.servingAt
        : queue.createdAt;

    if (!start) return "00:00:00";

    const end = ["completed", "cancelled"].includes(queue.status)
        ? (queue.finishedAt || Date.now())
        : Date.now();

    return formatDuration(end - start);
}

function updateDate() {
    currentDate.textContent = new Date().toLocaleString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function updateStats() {
    document.getElementById("totalCount").textContent =
        queues.filter(q => q.status !== "cancelled").length;

    document.getElementById("waitingCount").textContent =
        queues.filter(q => q.status === "waiting").length;

    document.getElementById("servingCount").textContent =
        queues.filter(q => q.status === "serving").length;

    document.getElementById("completedCount").textContent =
        queues.filter(q => q.status === "completed").length;
}

function makeButton(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-btn";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
}

function renderQueues() {
    const search = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;

    const filtered = queues
        .filter(queue => {
            const searchable = [
                queue.queueNumber,
                queue.fullName,
                queue.yearLevel,
                queue.section,
                queue.office
            ].join(" ").toLowerCase();

            return searchable.includes(search) &&
                (filter === "all" || queue.status === filter);
        })
        .sort((a, b) => a.number - b.number);

    queueTableBody.replaceChildren();
    emptyMessage.hidden = filtered.length > 0;

    filtered.forEach(queue => {
        const row = document.createElement("tr");

        [
            queue.queueNumber,
            queue.fullName,
            queue.yearLevel + " - " + queue.section,
            queue.office
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const statusLabel = document.createElement("span");
        statusLabel.className = "status status-" + queue.status;
        statusLabel.textContent = queue.status;
        statusCell.appendChild(statusLabel);
        row.appendChild(statusCell);

        const timeCell = document.createElement("td");
        timeCell.textContent = elapsedTime(queue);
        timeCell.dataset.timerId = queue.id;
        row.appendChild(timeCell);

        const actionsCell = document.createElement("td");
        const group = document.createElement("div");
        group.className = "action-group";

        if (isAdmin && queue.status === "waiting") {
            group.appendChild(makeButton("Call Next", () => callQueue(queue.id)));
        }

        if (isAdmin && queue.status === "serving") {
            group.appendChild(makeButton("Complete", () => completeQueue(queue.id)));
        }

        if (
            queue.status === "waiting" &&
            (isAdmin || queue.createdBy === currentUsername)
        ) {
            group.appendChild(makeButton("Cancel", () => cancelQueue(queue.id)));
        }

        if (group.children.length === 0) {
            group.textContent = "—";
        }

        actionsCell.appendChild(group);
        row.appendChild(actionsCell);
        queueTableBody.appendChild(row);
    });

    updateStats();
}

function refreshTimers() {
    document.querySelectorAll("[data-timer-id]").forEach(cell => {
        const queue = queues.find(q => q.id === cell.dataset.timerId);
        if (queue) cell.textContent = elapsedTime(queue);
    });

    updateDate();
}

// REGISTER QUEUE
queueForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const fullName = document.getElementById("studentName").value.trim();
    const yearLevel = document.getElementById("yearLevel").value;
    const section = document.getElementById("section").value.trim();
    const office = document.getElementById("officeSelect").value;
    const purpose = document.getElementById("purpose").value.trim();

    if (!fullName || !yearLevel || !section || !office || !purpose) {
        alert("Please complete all fields.");
        return;
    }

    const duplicate = queues.some(queue =>
        queue.fullName.toLowerCase() === fullName.toLowerCase() &&
        queue.yearLevel.toLowerCase() === yearLevel.toLowerCase() &&
        queue.section.toLowerCase() === section.toLowerCase() &&
        queue.status !== "completed" &&
        queue.status !== "cancelled"
    );

    if (duplicate) {
        alert("This student already has an active queue.");
        return;
    }

    const number = getNextNumber();
    localStorage.setItem(COUNTER_KEY, String(number + 1));

    const queue = {
        id: (crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString() + Math.random().toString(16).slice(2)),
        number,
        queueNumber: "Q-" + String(number).padStart(3, "0"),
        fullName,
        yearLevel,
        section,
        office,
        purpose,
        status: "waiting",
        createdAt: Date.now(),
        servingAt: null,
        finishedAt: null,
        createdBy: currentUsername
    };

    queues.push(queue);
    saveQueues();
    renderQueues();

    document.getElementById("newQueueNumber").textContent = queue.queueNumber;
    newQueueResult.hidden = false;
    queueForm.reset();
    newQueueResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

// ADMIN: CALL NEXT QUEUE
function callQueue(id) {
    if (sessionStorage.getItem("userRole") !== "admin") {
        alert("Only the administrator can call the next queue.");
        return;
    }

    if (queues.some(queue => queue.status === "serving")) {
        alert("Complete the currently serving queue first.");
        return;
    }

    const queue = queues.find(item => item.id === id);
    if (!queue || queue.status !== "waiting") return;

    queue.status = "serving";
    queue.servingAt = Date.now();

    saveQueues();
    renderQueues();
}

// ADMIN: COMPLETE QUEUE
function completeQueue(id) {
    if (sessionStorage.getItem("userRole") !== "admin") {
        alert("Only the administrator can complete a queue.");
        return;
    }

    const queue = queues.find(item => item.id === id);
    if (!queue || queue.status !== "serving") return;

    queue.status = "completed";
    queue.finishedAt = Date.now();

    saveQueues();
    renderQueues();
}

// CANCEL WAITING QUEUE
function cancelQueue(id) {
    const queue = queues.find(item => item.id === id);
    if (!queue || queue.status !== "waiting") return;

    if (!isAdmin && queue.createdBy !== currentUsername) {
        alert("You can only cancel your own waiting queue.");
        return;
    }

    if (!confirm("Are you sure you want to cancel this queue?")) return;

    queue.status = "cancelled";
    queue.finishedAt = Date.now();

    saveQueues();
    renderQueues();
}

searchInput.addEventListener("input", renderQueues);
statusFilter.addEventListener("change", renderQueues);

// EXPORT CSV
document.getElementById("exportBtn").addEventListener("click", function () {
    if (!queues.length) {
        alert("There are no queue records to export.");
        return;
    }

    const headers = [
        "Queue Number",
        "Full Name",
        "Year Level",
        "Section",
        "Office",
        "Purpose",
        "Status",
        "Created At"
    ];

    function escapeCSV(value) {
        let text = String(value ?? "");
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    }

    const rows = queues.map(queue => [
        queue.queueNumber,
        queue.fullName,
        queue.yearLevel,
        queue.section,
        queue.office,
        queue.purpose,
        queue.status,
        new Date(queue.createdAt).toLocaleString()
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-queue-records.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

// ADMIN-ONLY: DELETE ALL QUEUES
document.getElementById("clearAllBtn").addEventListener("click", function () {
    if (
        sessionStorage.getItem("loggedIn") !== "true" ||
        sessionStorage.getItem("userRole") !== "admin"
    ) {
        alert("Access denied. Only the administrator can delete all records.");
        return;
    }

    if (!queues.length) {
        alert("There are no queue records to delete.");
        return;
    }

    if (!confirm("This will delete all queue records in this browser. Continue?")) {
        return;
    }

    queues = [];
    saveQueues();
    renderQueues();
    newQueueResult.hidden = true;

    alert("All queue records have been deleted.");
});

renderQueues();
updateDate();
setInterval(refreshTimers, 1000);