// ============================================================
//  background.js  –  Service Worker
// ============================================================

const ALARM_NAME = "jobTabReloader";
const ALARM_PERIOD_MINUTES = 3;

// ── Open floating window on icon click ────────────────────────
chrome.action.onClicked.addListener(() => {
    chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 300,
        height: 480,
        focused: true,
    });
});

// ── Notifications Helper ──────────────────────────────────────
function showNotification() {
    chrome.notifications.create("jobRefreshNotify", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Jobs Refreshed! 🔄",
        message: "Your job search tabs have been updated. Check for new listings!",
        priority: 2
    });
}

// ── Tab Tracking Utility ──────────────────────────────────────
async function syncTrackedTabs() {
    const { savedLinks = [], isOn = false, tabUrlMap = {} } =
        await chrome.storage.local.get(["savedLinks", "isOn", "tabUrlMap"]);

    if (!isOn) return;

    const validLinks = savedLinks.filter(url => url.trim() !== "");
    if (validLinks.length === 0) return;

    const currentMap = { ...tabUrlMap };
    let mapChanged = false;

    // Scan all open tabs
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
        if (!tab.url) continue;

        // If this tab is NOT already tracked, check if it matches any saved search URL
        if (!currentMap[tab.id]) {
            const match = validLinks.find(saved => tab.url.startsWith(saved.trim()));
            if (match) {
                currentMap[tab.id] = match.trim();
                mapChanged = true;
                console.log(`Now tracking tab ${tab.id} for URL: ${match}`);
            }
        }
    }

    if (mapChanged) {
        await chrome.storage.local.set({ tabUrlMap: currentMap });
    }
}

// ── Main logic for reloading tabs ─────────────────────────────
async function triggerReload() {
    const { isOn = false, tabUrlMap = {} } = await chrome.storage.local.get(["isOn", "tabUrlMap"]);

    if (!isOn) return;

    // First, sync any new tabs that might have matching search URLs
    await syncTrackedTabs();

    // Refresh the map from storage after sync
    const { tabUrlMap: currentMap = {} } = await chrome.storage.local.get("tabUrlMap");

    const tabIds = Object.keys(currentMap);
    if (tabIds.length === 0) return;

    // Show notification to user
    showNotification();

    const updatedMap = { ...currentMap };
    let mapChanged = false;

    // Loop through all tracked tabs and force them back to the saved search URL.
    for (const [tabIdStr, savedUrl] of Object.entries(currentMap)) {
        const tabId = parseInt(tabIdStr);
        try {
            const tab = await chrome.tabs.get(tabId);

            // LOGIC:
            // 1. If user is currently on the saved search URL exactly, reload it (bypass cache).
            // 2. If user has navigated away (clicked a job), forcefully update to search URL.
            if (tab.url === savedUrl) {
                await chrome.tabs.reload(tabId, { bypassCache: true });
                console.log(`Reloaded search tab: ${tabId}`);
            } else {
                await chrome.tabs.update(tabId, { url: savedUrl });
                console.log(`Reset tab ${tabId} back to search URL: ${savedUrl}`);
            }
        } catch (e) {
            // Tab was closed, remove from map
            delete updatedMap[tabIdStr];
            mapChanged = true;
        }
    }

    if (mapChanged) {
        await chrome.storage.local.set({ tabUrlMap: updatedMap });
    }
}

// ── Event Listeners ───────────────────────────────────────────

// Alarm Tick
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) triggerReload();
});

// Proactive Tracking: Listen for tab navigation to catch search pages immediately
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        syncTrackedTabs();
    }
});

// Tab Close: Clean up map
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const { tabUrlMap = {} } = await chrome.storage.local.get("tabUrlMap");
    if (tabUrlMap[tabId]) {
        delete tabUrlMap[tabId];
        await chrome.storage.local.set({ tabUrlMap });
    }
});

// Messages from Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TOGGLE_ALARM") {
        if (message.isOn) {
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
            syncTrackedTabs(); // Initial scan
        } else {
            chrome.alarms.clear(ALARM_NAME);
            chrome.storage.local.remove("tabUrlMap");
        }
        sendResponse({ success: true });
    }
    else if (message.type === "LINKS_UPDATED") {
        syncTrackedTabs(); // Re-scan if user updated links
        sendResponse({ success: true });
    }
    return true;
});

// Browser Startup
chrome.runtime.onStartup.addListener(async () => {
    const { isOn = false } = await chrome.storage.local.get("isOn");
    if (isOn) {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
    }
});
