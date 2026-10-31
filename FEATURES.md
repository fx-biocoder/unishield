# 🛡️ UniShield - Detailed Features & Capabilities

UniShield provides an extensive suite of silent, client-side content moderation, bot detection, and clutter-removal tools for **Reddit**, **X (Twitter)**, and **LinkedIn**. Every filter runs 100% locally in your browser with zero network requests and zero telemetry.

---

## 📑 Table of Contents
- [Reddit](#reddit)
- [X (Twitter)](#x-twitter)
- [LinkedIn](#linkedin)
- [User Interface & Experience](#user-interface--experience)
- [Privacy Architecture](#privacy-architecture)

---

## Reddit

- **Auto-Generated Bot Detection:** Identifies and silently removes accounts created through Reddit's automated default username schemes (e.g. `Word-Word-1234` or `Word_Word1234`).
- **User Whitelist:** Easily whitelist specific accounts to ensure genuine users who happen to keep default usernames are never mistakenly hidden.
- **Editorialized Titles (Content Farms & Astroturfing):** Detects and removes submissions with sensationalized, multi-sentence editorialized titles commonly deployed by coordinated political content farms.
- **Custom Muted Keywords:** Mute custom words or phrases across post titles and comment bodies, with complete tolerance for common casing and symbol disguises.
- **Subreddit Blocklist:** Silently block toxic communities, karma-farming hubs, or sensationalist subreddits from your feeds.
- **Custom User Blacklist:** Manually block persistent bad-faith accounts.
- **Promoted Ads Removal:** Strips sponsored submissions, promoted posts, and marketing banners.
- **Racism & Hate Speech Protection:** Universally filters comments and submissions containing racist attacks, slurs, or xenophobic hostility.
- **Toxic "Gender War":** Hides toxic gender-war bait, misogynistic hostility, and misandrist attacks without double standards.

---

## X (Twitter)

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

---

## LinkedIn

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

[← Back to Main README](README.md)
