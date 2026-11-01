# 🛡️ UniShield - Detailed Features & Capabilities

UniShield provides an extensive suite of silent, client-side content moderation, bot detection, and clutter-removal tools for **Reddit**, **X (Twitter)**, and **LinkedIn**. Every filter runs 100% locally in your browser with zero network requests and zero telemetry.

---

## 📑 Table of Contents
- [Reddit](#reddit)
- [X (Twitter)](#x-twitter)
- [LinkedIn](#linkedin)
- [User Interface & Experience](#user-interface--experience)

---

## Reddit

- **Auto-Generated Bot Detection:** Identifies and silently removes accounts created through Reddit's automated default username schemes (e.g. `Word-Word-1234`, `Word_Word1234`, or `CamelCase1234`).
- **User Whitelist:** Easily whitelist specific accounts to ensure genuine users who happen to keep default usernames are never mistakenly hidden.
- **Protection against Editorialized Titles:** Detects and removes submissions with sensationalized, multi-sentence editorialized titles commonly deployed by coordinated political content farms.
- **Politics Removal**: Detects and removes submissions with overly-polarizing political content, while optionally allowing to block all politics-related content.
- **Custom Muted Keywords:** Mute custom words or phrases across post titles and comment bodies, with tolerance for common casing and symbol disguises.
- **Subreddit Blocklist:** Silently block toxic communities, karma-farming hubs, or sensationalist subreddits from your feeds.
- **Custom User Blacklist:** Manually block persistent bad-faith accounts.
- **Promoted Ads Removal:** Strips sponsored submissions, promoted posts, and marketing banners.
- **Protection against Racism & Xenophobia:** Universally filters comments and submissions containing racist attacks, slurs, supremacy ideology, or xenophobic hostility across all ethnicities without double standards.
- **Protection against Religious Discrimination:** Shields against hate speech, derogatory slurs targeting believers, antisemitic tropes, Islamophobic attacks, and blanket dehumanization of faith communities.
- **Toxic "Gender War":** Hides toxic gender-war bait, misogynistic hostility, and misandrist attacks without double standards.

---

## X (Twitter)

- **Political Content Strictness Slider:** Fine-tune your exposure to political topics using an intuitive horizontal slider with three distinct operational levels:
  1. *Do not hide anything:* Keeps political content visible for users who wish to follow active political debates.
  2. *Hide highly polarizing tweets:* Evaluates political discourse and filters out aggressive attacks, sensationalist outrage, and political warfare, while permitting neutral news and discussions.
  3. *Hide all political content:* Strict mode that swiftly and cleanly filters out political entities, election campaigns, government controversies, and political discourse for total peace of mind.
- **Low-Effort Quote Tweet (QRT) Removal:** Eliminates algorithmic quote replies that quote a post and contribute zero substantive value or substance, gaming the feed for viral impressions:
  - *One-word affirmations & passive agreements:* `This.`, `Literally this`, `Facts`, `Fr fr`, `Based`, `Literal`, `Tal cual`, `Totalmente`, `Basado`, `Factos`, `Amén`.
  - *Vague & lazy reactions:* `Wild`, `Insane`, `Crazy`, `Sin palabras`, `No lo puedo creer`, `Qué locura`, `El chiste se cuenta solo`, `Bruh`, `Bro...`.
  - *Cliché viral quote templates:* `Bro really said that...`, `Imagine believing this...`, `He cooked`, `Es cine`.
  - *Reaction emojis & punctuation-only:* Blocks quote tweets consisting solely of emojis (`💀`, `😭😭😭`, `👀`) or empty punctuation (`???`).
  - *Substance-aware:* Intelligent character and word count thresholding ensures thoughtful commentary, counter-arguments, and genuine analysis are preserved.
- **"Broetry" Removal:** Evaluates post layout to detect posts structured with excessive vertical line breaks (5 or more breaks) and predominantly single-sentence paragraphs designed solely to artificially expand mobile screen dwell time.
- **Low-Effort Viral Engagement Bait:** Aggressively eliminates content engineered with algorithmic hooks to farm engagement:
  - *Conversational question hooks:* `Agree?`, `Thoughts?`, `¿Estás de acuerdo?`, `¿Qué opinas?`, `Concorda?`, `Opinioni?`.
  - *Artificial curiosity hooks & thread starters:* `a thread`, `abro hilo`, `un hilo`, `🧵`, `here's what happened`, `here's why`, `aquí te cuento`, `deja de hacer esto`, `stop doing this`.
  - *Viral slang:* `is wild`, `are wild`, `wild ngl`, `is insane`, `are insane`, `actually insane`, `locura total`.
  - *Skull emoji traps:* Filters posts with `💀` or `☠️` (including Twitter's platform-rendered image emojis).
  - *Viral hooks starting with "Bro":* e.g., `Bro was caught in 4k`, `Bro really thought...`, `"Bro is not serious"`.
  - *Viral catch-phrases:* `caught in 4k` (and variants such as `caught her in 4k`, `caught and exposed in 4k`, `atrapado en 4k`).
  - *Sarcastic templates:* `X is when Y` (`Capitalism is when...`, `El comunismo es cuando...`).
- **Ragebait Suppression:** Filters controversial posts engineered to provoke indignation and emotional hijacking via statistical interaction ratio imbalances.
- **AI-Generated Low-Effort Replies:** Filters generic bot signatures, copy-paste AI summaries, and hollow conversation starters.
- **Checkmark Tier Filtering:** Independently control visibility for Blue checkmark accounts (paid accounts and engagement-farming replies), Grey checkmarks (government entities and multilateral officials), and Gold checkmarks (verified organizations).
- **Crypto & Financial Scam Suppression:** Blocks memecoin promotions, wallet drain schemes, and fraudulent "guaranteed profit" hype traps.
- **Promoted Tweets Removal:** Eliminates timeline ads and sponsored promotional tweets.
- **Custom Muted Words & Phrases:** Mute specific topics or phrases from appearing on your timeline.
- **Hate Speech & Toxicity Filters:** Silently shields your timeline from racial slurs, xenophobic abuse, religious hate speech, and toxic gender-war rhetoric.

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
- **Multi-Language Support:** Fully translated into **English**, **Spanish**, **Portuguese**, and **Italian** using native browser language detection, with natural technical terminology and zero external localization libraries.


---

[← Back to Main README](README.md)
