# 🔄 Job Tab Auto Reloader – Chrome Extension

A professional **Manifest V3** Chrome extension designed for job seekers. It ensures your search results are always fresh by automatically refreshing job search tabs every **3 minutes**, with smart logic to navigate back to search results if you've wandered away.

---

## ✨ Features

- **🎯 Smart Tab Tracking**: Automatically detects and tracks open tabs that match your saved job search URLs.
- **➕ Dynamic URL Management**: Add as many job search links as you need with the new dynamic input system.
- **🔄 Intelligent Navigation**: If you've clicked into a specific job listing, the extension forcefully navigates the tab back to the original search results *before* refreshing.
- **⏲️ Visual Live Countdown**: A sleek, real-time timer in the extension popup shows exactly when the next refresh will happen.
- **🔔 Smart Notifications**: Get notified instantly when your tabs are refreshed so you can check for new opportunities.
- **🖥️ Floating Control Window**: Opens as a dedicated floating popup for easy management without losing your place.
- **💾 Persistent State**: Your URLs, toggle status, and tracking settings survive browser restarts.

---

## 🛠️ Technology Stack

- **Architecture**: Chrome Extension Manifest V3
- **Core Logic**: Background Service Workers (JavaScript)
- **UI/UX**: HTML5, CSS3 (Vanilla), and Google Fonts (Outfit)
- **Communication**: `chrome.runtime` messaging for real-time synchronization
- **Scheduling**: `chrome.alarms` for reliable background execution

---

## 📁 Project Structure

```text
Refresh-job-Extension/
├── manifest.json       # Extension metadata, permissions & service worker registration
├── background.js       # Core engine: Alarms, tab tracking, and reload logic
├── popup.html          # Modern, responsive management interface
├── popup.js            # Frontend logic: Live countdown and storage management
├── icons/              # Extension branding (16px, 48px, 128px)
└── README.md           # Documentation
```

---

## 🚀 Installation Guide

1. **Download/Clone** the repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **Load unpacked** button.
5. Select the `Refresh-job-Extension` folder.
6. **Pin the extension** to your toolbar for quick access.

---

## 🔧 How It Works

### Intelligent Reload Logic (`background.js`)
The extension uses a 3-minute `chrome.alarms` cycle. On every tick:
1. **Detection**: It scans all open tabs for URLs matching your saved search links.
2. **Back-to-Search**: If a tracked tab has navigated away (e.g., viewing a specific job), it updates the tab URL back to the search results.
3. **Bypass Cache**: If already on the search page, it performs a hard reload (`bypassCache: true`) to fetch the most recent data.

### Modern Management UI (`popup.html/js`)
- The UI features a **Setup View** for adding URLs and an **Active View** for monitoring.
- The **Live Timer** fetches the exact scheduled time from the alarm service worker, ensuring the countdown is perfectly synced with the background process.

---

## 💡 Usage Tips

- **URL Matching**: For best results, enter the **base search URL** (e.g., `https://www.linkedin.com/jobs/search/`). The extension will then track any search performed on that site and automatically bring you back to your primary search results every 3 minutes.
- **Proactive Tracking**: The extension now detects matching tabs the moment you navigate to them, ensuring they are queued for the next refresh even if you click into a job listing immediately.
- **Multiple Sources**: You can track an unlimited number of job boards simultaneously using the **+ Add Link** button.

---

## 🤝 Contributing

Feel free to fork this project and submit pull requests for any features or improvements you'd like to see!

---

*Designed to help you land your next role faster. Happy hunting!* 🚀
