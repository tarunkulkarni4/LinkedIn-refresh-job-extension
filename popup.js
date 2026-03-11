// ============================================================
//  popup.js
// ============================================================

// ── DOM refs ──────────────────────────────────────────────────
const setupView = document.getElementById("setupView");
const activeView = document.getElementById("activeView");
const urlContainer = document.getElementById("urlContainer");
const addLinkBtn = document.getElementById("addLinkBtn");
const saveBtn = document.getElementById("saveBtn");
const editBtn = document.getElementById("editBtn");
const toggleSwitch = document.getElementById("toggleSwitch");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const timerDisplay = document.getElementById("timerVal");

let countdownInterval = null;

// ── Dynamic Input Management ─────────────────────────────────
function createInputRow(value = "") {
    const row = document.createElement("div");
    row.className = "input-row";

    const input = document.createElement("input");
    input.type = "url";
    input.placeholder = "https://job-site.com/search/...";
    input.value = value;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.innerHTML = "✕";
    removeBtn.title = "Remove link";
    removeBtn.onclick = () => {
        row.remove();
        // If no rows left, add one empty one
        if (urlContainer.children.length === 0) {
            createInputRow();
        }
    };

    row.appendChild(input);
    row.appendChild(removeBtn);
    urlContainer.appendChild(row);
    return input;
}

function getSavedLinksFromUI() {
    const inputs = urlContainer.querySelectorAll('input[type="url"]');
    return Array.from(inputs).map(i => i.value.trim()).filter(v => v !== "");
}

// ── Switch between setup and active view ─────────────────────
function showView(hasLinks) {
    if (hasLinks) {
        setupView.classList.add("hidden");
        activeView.classList.remove("hidden");
    } else {
        activeView.classList.add("hidden");
        setupView.classList.remove("hidden");
    }
}

// ── Status dot + text ─────────────────────────────────────────
function updateStatus(isOn) {
    if (isOn) {
        statusDot.classList.add("on");
        statusText.textContent = "On — all tabs refresh together";
    } else {
        statusDot.classList.remove("on");
        statusText.textContent = "Off — toggle to start";
    }
}

// ── Format ms → "M:SS" ───────────────────────────────────────
function formatTime(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Live countdown using chrome.alarms.get() scheduled time ──
function startCountdown() {
    stopCountdown();

    function tick() {
        chrome.alarms.get("jobTabReloader", (alarm) => {
            if (!alarm) {
                timerDisplay.textContent = "--:--";
                timerDisplay.className = "timer-val off";
                stopCountdown();
                return;
            }

            const remaining = alarm.scheduledTime - Date.now();

            if (remaining <= 0) {
                timerDisplay.textContent = "0:00";
                timerDisplay.className = "timer-val soon";
                return;
            }

            timerDisplay.textContent = formatTime(remaining);
            timerDisplay.className = remaining <= 30000 ? "timer-val soon" : "timer-val";
        });
    }

    tick();
    countdownInterval = setInterval(tick, 1000);
}

function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

function resetTimer() {
    stopCountdown();
    timerDisplay.textContent = "--:--";
    timerDisplay.className = "timer-val off";
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
    const { savedLinks = [], isOn = false } = await chrome.storage.local.get(["savedLinks", "isOn"]);

    // Clear container
    urlContainer.innerHTML = "";

    if (savedLinks.length > 0) {
        savedLinks.forEach(url => createInputRow(url));
    } else {
        // Add two defaults if empty, like the original
        createInputRow();
        createInputRow();
    }

    const hasLinks = savedLinks.some(url => url.trim() !== "");
    showView(hasLinks);

    toggleSwitch.checked = isOn;
    updateStatus(isOn);
    if (isOn) startCountdown();
}

// ── Events ───────────────────────────────────────────────────
addLinkBtn.addEventListener("click", () => {
    const input = createInputRow();
    input.focus();
});

saveBtn.addEventListener("click", async () => {
    const links = getSavedLinksFromUI();
    const hasLinks = links.length > 0;

    await chrome.storage.local.set({ savedLinks: links });
    if (hasLinks) {
        chrome.runtime.sendMessage({ type: "LINKS_UPDATED" });
        showView(true);
    } else {
        alert("Please add at least one job search URL.");
    }
});

editBtn.addEventListener("click", () => showView(false));

toggleSwitch.addEventListener("change", async () => {
    const isOn = toggleSwitch.checked;
    await chrome.storage.local.set({ isOn });
    chrome.runtime.sendMessage({ type: "TOGGLE_ALARM", isOn });
    updateStatus(isOn);
    if (isOn) {
        setTimeout(startCountdown, 300); // wait for alarm to be registered
    } else {
        resetTimer();
    }
});

window.addEventListener("unload", stopCountdown);
init();
