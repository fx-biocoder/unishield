# 🛡️ UniShield - Universal Feed Cleaner

[![Publish to Chrome Web Store](https://github.com/fx-biocoder/unishield/actions/workflows/publish-cws.yml/badge.svg?event=workflow_dispatch)](https://github.com/fx-biocoder/unishield/actions/workflows/publish-cws.yml) [![Publish to Firefox Add-ons](https://github.com/fx-biocoder/unishield/actions/workflows/publish-firefox.yml/badge.svg)](https://github.com/fx-biocoder/unishield/actions/workflows/publish-firefox.yml)

A lightweight, privacy-first, open-source browser extension that restores sanity, focus, and clarity to your digital life by silently filtering out bots, polarizing outrage, engagement traps, paid checkmark noise, and deceptive spam across **Reddit**, **X (Twitter)**, and **LinkedIn**.

---

Social media platforms were once envisioned as tools for connection and discovery. Today, their algorithms are intentionally designed to maximize screen time by amplifying conflict, manufactured outrage, astroturfing campaigns, and relentless engagement bait. 

This algorithmic toxicity has a profound and measurable cost on our lives:

- **Cognitive Exhaustion**, as constant exposure to polarizing rhetoric, political hostility, and bad-faith arguments forces the human nervous system into a chronic state of low-grade vigilance, irritation, and mental fatigue.
- **Derailed Focus & Unfinished Projects**, as creative work, learning, and meaningful projects require sustained deep focus and emotional equilibrium. Every minute lost to algorithmic ragebait or trivial timeline noise fragments our attention, siphons away willpower, and delays the goals that truly matter to our personal and professional fulfillment.
- **Erosion of Happiness & Wellbeing**, as replacing genuine human curiosity with cynical content farms and automated spam breeds anxiety and disillusionment, making it difficult to enjoy everyday life with presence and clarity.

### 100% Silent Filtering

Many ad-blockers and content warning tools disrupt your browsing experience by injecting flashy alert banners, warning labels, or awkward placeholders that still force you to acknowledge the garbage you wanted to avoid. UniShield believes that the user should never have to notice the tool at work.

- Filtered posts, tweets, and comments simply vanish from existence before they reach your retina and consume your attention.
- Platform aesthetics and structural layouts remain natural, without disruptive notifications.
- All filtering and evaluation run 100% locally in your browser with zero network requests, zero telemetry, and zero tracking.

By turning social media back into a quiet utility rather than an emotional battleground, UniShield protects your time, preserves your energy, and gives you back the mental clarity needed to live healthily.

---

## Features Overview

UniShield provides custom filtering mechanisms tailored specifically for each platform:

- **Reddit:** Auto-generated bot pattern detection, political content farm suppression (editorialized multi-sentence titles), subreddit blocklist, custom user blacklist, and custom muted keywords.
- **X (Twitter):** Three-tier political strictness slider (from allowing discussions to hiding all political noise), ragebait and "broetry" removal, AI low-effort reply suppression, checkmark tier filters (Blue/Grey/Gold), and crypto scam blocks.
- **LinkedIn:** Feed decluttering (promoted ads, suggested posts, reaction clutter), "broetry" suppression, stale job filtering (>30 days), job description red flag detectors, and private local candidate/profile notes.
- **User Experience:** Minimalist toolbar popup with live filter counters, full dark-mode settings dashboard, one-click JSON backup & restore, and native multi-language support (**English**, **Spanish**, **Portuguese**, and **Italian**).

**[Read the complete, detailed breakdown in FEATURES.md](FEATURES.md)**

---

## Privacy Architecture

UniShield is built from the ground up to respect privacy:
- **100% Client-Side Execution:** Every detection rule, list lookup, and filtering action executes strictly inside your browser.
- **Zero Network Requests:** UniShield never sends your browsing history, timelines, or personal data to any external server.
- **No Analytics or Trackers:** No telemetry, no usage analytics, no third-party scripts.
- **Open Source:** Full transparency under the GPL-3.0 license.

---

## Installation

### Official Web Stores (Recommended)

Install UniShield directly from your browser's store for automatic updates:

- **Chrome Web Store** (Google Chrome, Brave, Opera, Vivaldi, Microsoft Edge):  
  **[Install from Chrome Web Store](https://chromewebstore.google.com/detail/unishield-universal-feed/mmdlakegpcgplakmoopnnjhfpbclelcg)**

- **Firefox Add-ons**:  
  **[Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/unishield/)**

---

### Manual Installation (Developer Mode / From Source)

If you prefer building from source or running unpacked code locally:

#### Chromium Browsers (Google Chrome, Brave, Edge, Opera, Vivaldi)

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/fx-biocoder/unishield.git
   cd unishield
   ```
2. Open your browser and navigate to the extensions management page:
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`
3. Toggle on **"Developer mode"** (top-right corner).
4. Click **"Load unpacked"**.
5. Select the repository root folder containing `manifest.json`.
6. UniShield is now active in your browser.

#### Mozilla Firefox

1. **Clone and Package the Extension:**
   ```bash
   git clone https://github.com/fx-biocoder/unishield.git
   cd unishield
   ./build.sh
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Under *Temporary Extensions*, click **"Load Temporary Add-on..."**.
4. Select `dist/unishield_firefox_v{VERSION_NUMBER}.zip` (or the `manifest.json` inside the root folder).

---

## Testing

UniShield includes a full unit test suite covering heuristic pattern matching, detector functions, storage handlers, and internationalization:

```bash
npm test
```

---

## 💖 Support the Project

UniShield is completely free, open-source, independent, and tracker-free. Maintaining selector resilience against frequent DOM updates on Reddit, X, and LinkedIn requires continuous effort. If UniShield has given you back time, peace of mind, and focus, please consider supporting its continued development:

- ☕ **Ko-fi:** [ko-fi.com/biocoder](https://ko-fi.com/biocoder)
- ⭐ **GitHub Sponsors:** [github.com/sponsors/fx-biocoder](https://github.com/sponsors/fx-biocoder)
- 💳 **PayPal:** [paypal.me/facumartinez680](https://paypal.me/facumartinez680)


### 🚀 Other Ways to Help
- Star this repository on GitHub ⭐
- Report broken selectors or false positives via GitHub Issues 🐛
- Share UniShield with friends who want a quieter social media experience 📢

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

---

## ⚠️ Disclaimer

UniShield is an independent, unofficial open-source browser extension. It is not affiliated with, endorsed by, or connected to Reddit Inc., X Corp., Twitter, or LinkedIn Corporation.
