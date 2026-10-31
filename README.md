# 🛡️ UniShield - Universal Feed Cleaner

[![Publish to Chrome Web Store](https://github.com/fx-biocoder/unishield/actions/workflows/publish-cws.yml/badge.svg?event=workflow_dispatch)](https://github.com/fx-biocoder/unishield/actions/workflows/publish-cws.yml)

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

## Key Features

### Reddit
- **Auto-Generated Bot Detection:** Identifies and silently removes accounts created through Reddit's automated default username schemes.
- **User Whitelist:** Easily whitelist specific accounts to ensure genuine users with default usernames are never mistakenly hidden.
- **Editorialized Titles (Content Farms & Astroturfing):** Detects and removes submissions with sensationalized, multi-sentence editorialized titles commonly deployed by coordinated political content farms.
- **Custom Muted Keywords:** Mute custom words or phrases across post titles and comment bodies, with complete tolerance for common casing and symbol disguises.
- **Subreddit Blocklist:** Silently block toxic communities, karma-farming hubs, or sensationalist subreddits from your feeds.
- **Custom User Blacklist:** Manually block persistent bad-faith accounts.
- **Promoted Ads Removal:** Strips sponsored submissions, promoted posts, and marketing banners.
- **Racism & Hate Speech Protection:** Universally filters comments and submissions containing racist attacks, slurs, or xenophobic hostility.
- **Toxic "Gender War":** Hides toxic gender-war bait, misogynistic hostility, and misandrist attacks without double standards.

### X (Twitter)
- **Political Content Strictness Slider:** Fine-tune your exposure to political topics using an intuitive horizontal slider with three distinct operational levels:
  1. *Do not hide anything:* Keeps political content visible for users who wish to follow active political debates.
  2. *Hide highly polarizing tweets:* Evaluates political discourse and filters out aggressive attacks, sensationalist outrage, and political warfare, while permitting neutral news and discussions.
  3. *Hide all political content:* Strict mode that swiftly and cleanly filters out political entities, election campaigns, government controversies, and political discourse for total peace of mind.
- **"Broetry" & Engagement Bait Removal:** Silently purges tweets and threads formatted with excessive single-line paragraphs and manipulative hooks designed solely to exploit mobile dwell time.
- **Engagement Ragebait Suppression:** Filters controversial posts engineered to provoke indignation and emotional hijacking.
- **AI-Generated Low-Effort Replies:** Filters generic bot signatures, copy-paste AI summaries, and hollow conversation starters.
- **Checkmark Tier Filtering:** Independently control visibility for Blue checkmark accounts (paid accounts and engagement-farming replies), Grey checkmarks (government entities and multilateral officials), and Gold checkmarks (verified organizations).
- **Crypto & Financial Scam Suppression:** Blocks memecoin promotions, wallet drain schemes, and fraudulent "guaranteed profit" hype traps.
- **Promoted Tweets Removal:** Eliminates timeline ads and sponsored promotional tweets.
- **Custom Muted Words & Phrases:** Mute specific topics or phrases from appearing on your timeline.
- **Hate Speech & Toxicity Filters:** Silently shields your timeline from racial slurs, xenophobic abuse, and toxic gender-war bait.

### LinkedIn
- **Feed Decluttering:**
  - **Promoted Posts & Ads:** Automatically removes sponsored advertising and corporate marketing banners.
  - **Suggested Content:** Filters out algorithmically suggested posts and unsolicited feed recommendations.
  - **Interaction Noise:** Mutes secondary activity clutter (posts showing up solely because second-degree contacts liked, commented, or celebrated them).
- **Style & Engagement Filters:**
  - **"Broetry" Suppression:** Hides corporate parables and viral posts formatted with dramatic, endless single-sentence line breaks.
  - **AI Thought-Leadership Boilerplate:** Filters hollow, buzzword-heavy corporate summaries and generic AI reflections.
  - **Emoji Spam:** Blocks posts saturated with emojis as clickbait visual hooks.
- **Muted Topics & Companies:**
  - Mute custom words or corporate buzzwords from your feed.
  - Mute updates and posts from specific companies.
- **Smart Job Search Filtering:**
  - **Promoted Jobs:** Hides sponsored placements to bring genuine, organic vacancies to the forefront.
  - **Expired & Stale Jobs:** Filters out listings older than 30 days to save you time from applying to ghost openings.
  - **Job Description Red Flags:** Highlights warning indicators for questionable postings (unpaid work, unrealistic requirement stacks, high-pressure buzzwords).
- **Profile Insights & Local Notes:**
  - **Suspicious Profile Warnings:** Alerts you to incomplete or questionable profiles.
  - **Private Local Notes & Tags:** Keep confidential notes and candidate tags directly on profiles, stored strictly on your local device.
  - **Photo Forensics Shortcut:** One-click integration to scan profile images through forensic verification.

---

## User Interface & Experience

- **Minimalist Toolbar Popup:** A clean popup featuring a master pause/resume switch and a live count of filtered items during your browsing session.
- **Custom Settings Dashboard:** An elegant dark-mode dashboard to customize every platform filter, manage blocklists and whitelists with interactive chips, and view statistics.
- **Sidebar Backup & Restore:** Export your entire configuration (including all strictness settings, custom keyword lists, and blocklists) into a clean JSON file, or restore an existing backup with a single click right from the sidebar.
- **Multi-Language Support:** Fully translated into **English**, **Spanish**, **Portuguese**, and **Italian** using native browser language detection, with zero external localization libraries.

---

## Privacy Architecture

UniShield is built from the ground up to respect privacy:
- **100% Client-Side Execution:** Every detection rule, list lookup, and filtering action executes strictly inside your browser.
- **Zero Network Requests:** UniShield never sends your browsing history, timelines, or personal data to any external server.
- **No Analytics or Trackers:** No telemetry, no usage analytics, no third-party scripts.
- **Open Source:** Full transparency under an open-source license.

---

## Installation

UniShield is available for manual installation in developer mode for all Chromium-based browsers and Mozilla Firefox.

### Chromium Browsers (Google Chrome, Brave, Edge, Opera, Vivaldi)

1. **Clone or Download the Repository:**
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
5. Select the `reddit-bot-blocker` folder containing `manifest.json`.
6. UniShield is now active in your browser.

### Mozilla Firefox

1. Open Firefox and navigate to `about:debugging`.
2. Click **"This Firefox"** in the sidebar.
3. Under *Temporary Extensions*, click **"Load Temporary Add-on..."**.
4. Select the `manifest.json` file inside the extension folder.

---

## Testing

```bash
npm test
```

---

## 💖 Support the Project

UniShield is completely free, open-source, independent, and tracker-free. Maintaining selector resilience against frequent DOM updates on Reddit, X, and LinkedIn requires continuous effort. If UniShield has given you back time, peace of mind, and focus, please consider supporting its continued development:

- ☕ **Ko-fi:** [ko-fi.com/biocoder](https://ko-fi.com/biocoder)
- ⭐ **GitHub Sponsors:** [github.com/sponsors/fx-biocoder](https://github.com/sponsors/fx-biocoder)
- 💳 **PayPal:** [paypal.me/facumartinez680](https://paypal.me/facumartinez680)
- 🇦🇷 **Mercado Pago:** [link.mercadopago.com.ar/betterlinkedin](https://link.mercadopago.com.ar/betterlinkedin)

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
