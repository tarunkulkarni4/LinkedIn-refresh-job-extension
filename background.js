// ============================================================
//  background.js  –  Service Worker
// ============================================================

const ALARM_NAME = "jobTabReloader";
const ALARM_PERIOD_MINUTES = 2;

let refreshVoice = null;
let newJobVoice = null;

// Query available system voices, prioritizing Google Cloud/external natural voices
function initVoices() {
    chrome.tts.getVoices((voices) => {
        if (!voices || voices.length === 0) return;
        
        const enVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
        if (enVoices.length > 0) {
            // Sort English voices so high-quality external/Google engine voices are placed first
            const sortedVoices = [...enVoices].sort((a, b) => {
                const aName = a.voiceName.toLowerCase();
                const bName = b.voiceName.toLowerCase();
                const aPref = aName.includes("google") || aName.includes("natural") || aName.includes("cloud");
                const bPref = bName.includes("google") || bName.includes("natural") || bName.includes("cloud");
                if (aPref && !bPref) return -1;
                if (!aPref && bPref) return 1;
                return 0;
            });

            // Standard female voice option from sorted set
            const femaleOption = sortedVoices.find(v => 
                v.gender === "female" || 
                v.voiceName.toLowerCase().includes("female") || 
                v.voiceName.toLowerCase().includes("zira") || 
                v.voiceName.toLowerCase().includes("hazel") ||
                v.voiceName.toLowerCase().includes("google us english")
            );

            // Deep/rough male voice option from sorted set
            const maleOption = sortedVoices.find(v => 
                v.gender === "male" || 
                v.voiceName.toLowerCase().includes("male") || 
                v.voiceName.toLowerCase().includes("david") || 
                v.voiceName.toLowerCase().includes("mark") ||
                v.voiceName.toLowerCase().includes("google uk english male")
            );

            refreshVoice = femaleOption ? femaleOption.voiceName : sortedVoices[0].voiceName;
            newJobVoice = maleOption ? maleOption.voiceName : (sortedVoices[1] ? sortedVoices[1].voiceName : sortedVoices[0].voiceName);
        }
        console.log(`Voices initialized - Refresh Alert: [${refreshVoice}], New Job Alert: [${newJobVoice}]`);
    });
}
initVoices();

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
    chrome.notifications.create("", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Jobs Refreshed! 🔄",
        message: "Your job search tabs have been updated. Check for new listings!",
        priority: 2
    });
    // Speak audio message using a distinct female voice, keeping general tone clear
    const options = {
        volume: 1.0,
        pitch: 1.1,      // Standard, slightly higher pitch for clarity
        rate: 1.0        // Default pace
    };
    if (refreshVoice) {
        options.voiceName = refreshVoice;
    }
    chrome.tts.speak("Jobs refreshed. Check your tabs!", options);
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

        // Check if the tab's current URL is a search page matching any saved patterns
        const match = validLinks.find(saved => tab.url.startsWith(saved.trim()));
        if (match) {
            // Track or update the tab's specific search URL (preserving location & keywords)
            if (currentMap[tab.id] !== tab.url) {
                currentMap[tab.id] = tab.url;
                mapChanged = true;
                console.log(`Tracking tab ${tab.id} for specific URL: ${tab.url}`);
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

// ── Scanned Jobs Handler (Text-to-Speech deep/loud voice) ──────
async function handleScannedJobs(jobs) {
    const { seenJobIds = [] } = await chrome.storage.local.get("seenJobIds");

    // If seenJobIds is empty, this is the very first time scanning (first startup/toggle).
    // Silent-register these initially to avoid spamming the user on page load.
    if (seenJobIds.length === 0) {
        const initialIds = jobs.map(j => j.id);
        await chrome.storage.local.set({ seenJobIds: initialIds });
        console.log(`Initial scan: registered ${initialIds.length} existing jobs silently.`);
        return;
    }

    const newJobs = [];
    const updatedIds = [...seenJobIds];

    for (const job of jobs) {
        if (!seenJobIds.includes(job.id)) {
            newJobs.push(job);
            updatedIds.push(job.id);
        }
    }

    if (newJobs.length > 0) {
        // Save the updated seen job IDs
        await chrome.storage.local.set({ seenJobIds: updatedIds });

        // Speak for each new job
        newJobs.forEach(job => {
            // Clean up role title to prevent TTS from reading special characters
            const cleanTitle = job.title.replace(/[^a-zA-Z0-9\s]/g, "");
            
            const speakOptions = {
                volume: 1.0,     // Maximum loudness
                pitch: 0.6,      // Low pitch for a deep/rough voice
                rate: 0.9,       // Slightly slower pace
                enqueue: true    // Queue them sequentially
            };
            if (newJobVoice) {
                speakOptions.voiceName = newJobVoice;
            }
            chrome.tts.speak(
                `Tarun, a new job entry came for ${cleanTitle} that came in LinkedIn.`,
                speakOptions
            );
        });
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

// Messages from Popup or Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TOGGLE_ALARM") {
        if (message.isOn) {
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
            syncTrackedTabs(); // Initial scan
        } else {
            chrome.alarms.clear(ALARM_NAME);
            chrome.storage.local.remove(["tabUrlMap", "seenJobIds"]); // Reset tracking on toggle off
        }
        sendResponse({ success: true });
    }
    else if (message.type === "LINKS_UPDATED") {
        syncTrackedTabs(); // Re-scan if user updated links
        sendResponse({ success: true });
    }
    else if (message.type === "JOBS_SCANNED") {
        handleScannedJobs(message.jobs);
        sendResponse({ success: true });
    }
    return true;
});

// Browser Startup
chrome.runtime.onStartup.addListener(async () => {
    initVoices();
    const { isOn = false } = await chrome.storage.local.get("isOn");
    if (isOn) {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
    }
});
