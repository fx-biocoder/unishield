(function() {
    'use strict';

    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
    let config = null;

    const getStorage = () => window.UniShield && window.UniShield.Storage;
    const getDefaults = () => window.UniShield && window.UniShield.Defaults;

    /**
     * Initializes the options page
     */
    async function init() {
        const storage = getStorage();
        if (!storage) return;

        config = await storage.getConfig();

        setupTabs();
        populateControls();
        renderAllLists();
        setupEventListeners();
    }

    /**
     * Tab switching logic
     */
    function setupTabs() {
        const navItems = document.querySelectorAll('.nav-item[data-tab]');
        const tabContents = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(nav => nav.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                item.classList.add('active');
                const targetTabId = item.getAttribute('data-tab');
                const targetContent = document.getElementById(targetTabId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });

        // Check URL parameter or hash to activate specific tab
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab') || (window.location.hash ? window.location.hash.replace('#', '') : null);
        if (tabParam) {
            const targetNav = document.querySelector(`.nav-item[data-tab="settings-${tabParam}"]`) || document.querySelector(`.nav-item[data-tab="${tabParam}"]`);
            if (targetNav) targetNav.click();
        }
    }

    /**
     * Populates all inputs and toggles from configuration
     */
    function populateControls() {
        const setChecked = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };

        // Stats
        const stats = config.global.stats || {};
        const redHiddenEl = document.getElementById('redditHiddenCount');
        if (redHiddenEl) redHiddenEl.textContent = stats.redditHidden || 0;
        const xHiddenEl = document.getElementById('xHiddenCount');
        if (xHiddenEl) xHiddenEl.textContent = stats.xHidden || 0;
        const liHiddenEl = document.getElementById('linkedinHiddenCount');
        if (liHiddenEl) liHiddenEl.textContent = stats.linkedinHidden || 0;

        // Reddit Toggles
        setChecked('redditDetectBotPatterns', config.reddit.detectBotPatterns !== false);
        setChecked('redditRemovePromoted', config.reddit.removePromoted !== false);
        setChecked('redditRemoveRacism', config.reddit.removeRacism !== false);
        setChecked('redditRemoveGenderWar', config.reddit.removeGenderWar !== false);
        setChecked('redditRemoveEditorializedTitles', config.reddit.removeEditorializedTitles !== false);

        // X Toggles
        setChecked('xRemovePromoted', config.x.removePromoted !== false);
        setChecked('xRemoveBlueCheckmark', config.x.removeBlueCheckmark === true);
        setChecked('xRemoveGreyCheckmark', config.x.removeGreyCheckmark === true);
        setChecked('xRemoveGoldCheckmark', config.x.removeGoldCheckmark === true);
        setChecked('xRemoveAITweets', config.x.removeAITweets !== false);
        setChecked('xRemoveBroetryPosts', config.x.removeBroetryPosts !== false);
        setChecked('xRemoveCryptoScams', config.x.removeCryptoScams !== false);

        // Political strictness slider (0 = None, 1 = High polarization, 2 = All political)
        const strictness = typeof config.x.politicalStrictness === 'number'
            ? config.x.politicalStrictness
            : (config.x.removeOverlyPolitical === true || config.x.removePoliticalRagebait === true ? 1 : 0);
        const sliderEl = document.getElementById('xPoliticalStrictness');
        if (sliderEl) {
            sliderEl.value = strictness;
            updatePoliticalSliderUI(strictness);
        }

        const rageEl = document.getElementById('xRemoveRagebait');
        if (rageEl) {
            rageEl.checked = config.x.removeRagebait === true || config.x.removePoliticalRagebait === true;
        }
        setChecked('xRemoveRacism', config.x.removeRacism !== false);
        setChecked('xRemoveGenderWar', config.x.removeGenderWar !== false);

        // LinkedIn Toggles
        const li = config.linkedin || {};
        setChecked('linkedinRemovePromotedPosts', li.removePromotedPosts !== false);
        setChecked('linkedinRemoveSuggestedPosts', li.removeSuggestedPosts !== false);
        setChecked('linkedinRemoveByInteractions', li.removeByInteractions !== false);
        setChecked('linkedinRemoveAIPosts', li.removeAIPosts !== false);
        setChecked('linkedinRemoveBroetryPosts', li.removeBroetryPosts !== false);
        setChecked('linkedinRemovePostsWithEmojis', li.removePostsWithEmojis === true);
        setChecked('linkedinRemovePromotedJobs', li.removePromotedJobs !== false);
        setChecked('linkedinJobAgeAlerts', li.jobAgeAlerts !== false);
        setChecked('linkedinJobRedFlags', li.jobRedFlags !== false);
        setChecked('linkedinDetectFakeProfiles', li.detectFakeProfiles !== false);
        setChecked('linkedinEnableProfileNotes', li.enableProfileNotes !== false);
    }

    /**
     * Updates the political strictness slider UI (badge, fill bar, tick active states)
     */
    function updatePoliticalSliderUI(val) {
        const badgeEl = document.getElementById('xPoliticalLevelBadge');
        if (badgeEl) {
            badgeEl.className = `level-badge level-badge-${val}`;
            const key = val === 2 ? 'xPoliticalLevel2' : (val === 1 ? 'xPoliticalLevel1' : 'xPoliticalLevel0');
            const fallback = val === 2 ? 'Ocultar todo el contenido político' : (val === 1 ? 'Ocultar tweets altamente polarizantes' : 'No ocultar nada');
            badgeEl.textContent = typeof t === 'function' ? t(key) : fallback;
        }

        const fillBar = document.getElementById('xPoliticalFillBar');
        if (fillBar) {
            fillBar.style.width = `${val * 50}%`;
        }

        const ticks = document.querySelectorAll('.tick-step[data-step]');
        ticks.forEach(tick => {
            const step = parseInt(tick.getAttribute('data-step'), 10);
            if (step === val) {
                tick.classList.add('active');
            } else {
                tick.classList.remove('active');
            }
        });
    }

    /**
     * Renders all chip lists
     */
    function renderAllLists() {
        renderSubredditLists();
        renderChipList('redditAllowlistUl', config.reddit.allowlist || [], (val) => removeListItem('reddit', 'allowlist', val), 'u/');
        renderChipList('redditBlocklistUl', config.reddit.userBlocklist || [], (val) => removeListItem('reddit', 'userBlocklist', val), 'u/');
        renderChipList('redditMutedWordsUl', config.reddit.mutedKeywords || [], (val) => removeListItem('reddit', 'mutedKeywords', val));
        renderChipList('xMutedWordsUl', config.x.mutedKeywords || [], (val) => removeListItem('x', 'mutedKeywords', val));
        renderChipList('linkedinMutedWordsUl', (config.linkedin && config.linkedin.mutedWords) || [], (val) => removeListItem('linkedin', 'mutedWords', val));
        renderChipList('linkedinMutedCompaniesUl', (config.linkedin && config.linkedin.mutedCompanies) || [], (val) => removeListItem('linkedin', 'mutedCompanies', val));
    }

    /**
     * Renders built-in and user subreddits
     */
    function renderSubredditLists() {
        const defaultsModule = getDefaults();
        const storage = getStorage();
        const defaults = (defaultsModule && defaultsModule.reddit && defaultsModule.reddit.subredditBlocklist) || [];
        const defaultUl = document.getElementById('defaultSubredditList');
        defaultUl.replaceChildren();

        defaults.forEach(sub => {
            const li = document.createElement('li');
            li.className = 'builtin-chip';

            const spanText = document.createElement('span');
            spanText.textContent = `r/${sub}`;

            const badge = document.createElement('span');
            badge.className = 'chip-tag';
            badge.textContent = typeof t === 'function' ? t('builtInBadge') : 'Built-in';

            li.appendChild(spanText);
            li.appendChild(badge);
            defaultUl.appendChild(li);
        });

        const customUl = document.getElementById('customSubredditList');
        customUl.replaceChildren();

        const userSubs = config.reddit.subredditBlocklist || [];
        const customOnly = userSubs.filter(s => !defaults.some(d => d.toLowerCase() === s.toLowerCase()));

        if (customOnly.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.border = 'none';
            emptyLi.style.background = 'transparent';
            emptyLi.style.color = '#94a3b8';
            emptyLi.textContent = typeof t === 'function' ? t('redditNoCustomSubs') : 'No custom subreddits added';
            customUl.appendChild(emptyLi);
        } else {
            customOnly.forEach(sub => {
                const li = document.createElement('li');

                const span = document.createElement('span');
                span.textContent = `r/${sub}`;
                li.appendChild(span);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'chip-remove-btn';
                removeBtn.textContent = '×';
                removeBtn.title = typeof t === 'function' ? t('remove') : 'Remove';
                removeBtn.onclick = async () => {
                    if (storage) {
                        await storage.removeFromSubredditBlocklist(sub);
                        config = await storage.getConfig();
                    }
                    renderSubredditLists();
                    notifyTabs();
                };

                li.appendChild(removeBtn);
                customUl.appendChild(li);
            });
        }
    }

    /**
     * Generic chip list renderer
     */
    function renderChipList(elementId, items, onRemove, prefix = '') {
        const ul = document.getElementById(elementId);
        if (!ul) return;
        ul.replaceChildren();

        if (!items || items.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.style.border = 'none';
            emptyLi.style.background = 'transparent';
            emptyLi.style.color = '#94a3b8';
            emptyLi.textContent = typeof t === 'function' ? t('noneAdded') : 'None added yet';
            ul.appendChild(emptyLi);
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');

            const span = document.createElement('span');
            span.textContent = `${prefix}${item}`;
            li.appendChild(span);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'chip-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.title = typeof t === 'function' ? t('remove') : 'Remove';
            removeBtn.onclick = () => onRemove(item);

            li.appendChild(removeBtn);
            ul.appendChild(li);
        });
    }

    /**
     * Remove item helper
     */
    async function removeListItem(section, key, value) {
        const list = config[section][key] || [];
        config[section][key] = list.filter(item => item.toLowerCase() !== value.toLowerCase());
        await savePartialConfig({ [section]: config[section] });
        renderAllLists();
    }

    /**
     * Add item helper
     */
    async function addListItem(section, key, inputId, cleanFn) {
        const input = document.getElementById(inputId);
        let val = input.value.trim();
        if (cleanFn) val = cleanFn(val);
        if (!val) return;

        const list = config[section][key] || [];
        if (!list.some(item => item.toLowerCase() === val.toLowerCase())) {
            config[section][key] = [...list, val];
            await savePartialConfig({ [section]: config[section] });
            input.value = '';
            renderAllLists();
        }
    }

    /**
     * Save partial config and broadcast
     */
    async function savePartialConfig(partial) {
        const storage = getStorage();
        if (storage) {
            await storage.setConfig(partial);
            config = await storage.getConfig();
        }
        notifyTabs();
    }

    /**
     * Notifies all tabs about configuration updates
     */
    function notifyTabs() {
        browserAPI.runtime.sendMessage({ type: 'UNISHIELD_CONFIG_UPDATED' }).catch(() => {});
    }

    /**
     * Setup event listeners for options page
     */
    function setupEventListeners() {
        const bindToggle = (id, saveFn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', saveFn);
        };

        // Reddit Toggles
        bindToggle('redditDetectBotPatterns', (e) => savePartialConfig({ reddit: { ...config.reddit, detectBotPatterns: e.target.checked } }));
        bindToggle('redditRemovePromoted', (e) => savePartialConfig({ reddit: { ...config.reddit, removePromoted: e.target.checked } }));
        bindToggle('redditRemoveRacism', (e) => savePartialConfig({ reddit: { ...config.reddit, removeRacism: e.target.checked } }));
        bindToggle('redditRemoveGenderWar', (e) => savePartialConfig({ reddit: { ...config.reddit, removeGenderWar: e.target.checked } }));
        bindToggle('redditRemoveEditorializedTitles', (e) => savePartialConfig({ reddit: { ...config.reddit, removeEditorializedTitles: e.target.checked } }));

        // X Toggles
        bindToggle('xRemovePromoted', (e) => savePartialConfig({ x: { ...config.x, removePromoted: e.target.checked } }));
        bindToggle('xRemoveBlueCheckmark', (e) => savePartialConfig({ x: { ...config.x, removeBlueCheckmark: e.target.checked } }));
        bindToggle('xRemoveGreyCheckmark', (e) => savePartialConfig({ x: { ...config.x, removeGreyCheckmark: e.target.checked } }));
        bindToggle('xRemoveGoldCheckmark', (e) => savePartialConfig({ x: { ...config.x, removeGoldCheckmark: e.target.checked } }));
        bindToggle('xRemoveAITweets', (e) => savePartialConfig({ x: { ...config.x, removeAITweets: e.target.checked } }));
        bindToggle('xRemoveBroetryPosts', (e) => savePartialConfig({ x: { ...config.x, removeBroetryPosts: e.target.checked } }));
        bindToggle('xRemoveCryptoScams', (e) => savePartialConfig({ x: { ...config.x, removeCryptoScams: e.target.checked } }));

        // X Political Strictness Slider
        const sliderEl = document.getElementById('xPoliticalStrictness');
        if (sliderEl) {
            sliderEl.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                updatePoliticalSliderUI(val);
            });
            sliderEl.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                savePartialConfig({
                    x: {
                        ...config.x,
                        politicalStrictness: val,
                        removeOverlyPolitical: val > 0
                    }
                });
            });
        }

        const tickBtns = document.querySelectorAll('.tick-step[data-step]');
        tickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.getAttribute('data-step'), 10) || 0;
                if (sliderEl) {
                    sliderEl.value = val;
                    updatePoliticalSliderUI(val);
                    savePartialConfig({
                        x: {
                            ...config.x,
                            politicalStrictness: val,
                            removeOverlyPolitical: val > 0
                        }
                    });
                }
            });
        });

        bindToggle('xRemoveRagebait', (e) => savePartialConfig({ x: { ...config.x, removeRagebait: e.target.checked } }));
        bindToggle('xRemoveRacism', (e) => savePartialConfig({ x: { ...config.x, removeRacism: e.target.checked } }));
        bindToggle('xRemoveGenderWar', (e) => savePartialConfig({ x: { ...config.x, removeGenderWar: e.target.checked } }));

        // List additions: Subreddits
        const storage = getStorage();
        const addSubreddit = () => addListItem('reddit', 'subredditBlocklist', 'newSubredditInput', storage ? storage.cleanSubredditName : null);
        const addSubBtn = document.getElementById('addSubredditBtn');
        const addSubInp = document.getElementById('newSubredditInput');
        if (addSubBtn) addSubBtn.addEventListener('click', addSubreddit);
        if (addSubInp) addSubInp.addEventListener('keypress', (e) => e.key === 'Enter' && addSubreddit());

        // List additions: Reddit Allowlist
        const addRedditAllow = () => addListItem('reddit', 'allowlist', 'newRedditAllowlistInput', (v) => v.replace(/^u\//i, '').trim());
        const addRedAllowBtn = document.getElementById('addRedditAllowlistBtn');
        const addRedAllowInp = document.getElementById('newRedditAllowlistInput');
        if (addRedAllowBtn) addRedAllowBtn.addEventListener('click', addRedditAllow);
        if (addRedAllowInp) addRedAllowInp.addEventListener('keypress', (e) => e.key === 'Enter' && addRedditAllow());

        // List additions: Reddit Blocklist
        const addRedditBlock = () => addListItem('reddit', 'userBlocklist', 'newRedditBlocklistInput', (v) => v.replace(/^u\//i, '').trim());
        const addRedBlockBtn = document.getElementById('addRedditBlocklistBtn');
        const addRedBlockInp = document.getElementById('newRedditBlocklistInput');
        if (addRedBlockBtn) addRedBlockBtn.addEventListener('click', addRedditBlock);
        if (addRedBlockInp) addRedBlockInp.addEventListener('keypress', (e) => e.key === 'Enter' && addRedditBlock());

        // List additions: Reddit Muted Words
        const addRedditMuted = () => addListItem('reddit', 'mutedKeywords', 'newRedditMutedWordInput', (v) => v.trim());
        const addRedditMutedBtn = document.getElementById('addRedditMutedWordBtn');
        const addRedditMutedInp = document.getElementById('newRedditMutedWordInput');
        if (addRedditMutedBtn) addRedditMutedBtn.addEventListener('click', addRedditMuted);
        if (addRedditMutedInp) addRedditMutedInp.addEventListener('keypress', (e) => e.key === 'Enter' && addRedditMuted());

        // List additions: X Muted Words
        const addXMuted = () => addListItem('x', 'mutedKeywords', 'newXMutedWordInput', (v) => v.trim());
        const addXMutedBtn = document.getElementById('addXMutedWordBtn');
        const addXMutedInp = document.getElementById('newXMutedWordInput');
        if (addXMutedBtn) addXMutedBtn.addEventListener('click', addXMuted);
        if (addXMutedInp) addXMutedInp.addEventListener('keypress', (e) => e.key === 'Enter' && addXMuted());

        // LinkedIn Toggles & Lists
        const bindLiToggle = (id, key) => {
            bindToggle(id, (e) => {
                const liConfig = config.linkedin || {};
                savePartialConfig({ linkedin: { ...liConfig, [key]: e.target.checked } });
            });
        };
        bindLiToggle('linkedinRemovePromotedPosts', 'removePromotedPosts');
        bindLiToggle('linkedinRemoveSuggestedPosts', 'removeSuggestedPosts');
        bindLiToggle('linkedinRemoveByInteractions', 'removeByInteractions');
        bindLiToggle('linkedinRemoveAIPosts', 'removeAIPosts');
        bindLiToggle('linkedinRemoveBroetryPosts', 'removeBroetryPosts');
        bindLiToggle('linkedinRemovePostsWithEmojis', 'removePostsWithEmojis');
        bindLiToggle('linkedinRemovePromotedJobs', 'removePromotedJobs');
        bindLiToggle('linkedinJobAgeAlerts', 'jobAgeAlerts');
        bindLiToggle('linkedinJobRedFlags', 'jobRedFlags');
        bindLiToggle('linkedinDetectFakeProfiles', 'detectFakeProfiles');
        bindLiToggle('linkedinEnableProfileNotes', 'enableProfileNotes');

        const addLiKeyword = () => addListItem('linkedin', 'mutedWords', 'newLinkedinKeywordInput', (v) => v.trim());
        const addLiKeyBtn = document.getElementById('addLinkedinKeywordBtn');
        const addLiKeyInp = document.getElementById('newLinkedinKeywordInput');
        if (addLiKeyBtn) addLiKeyBtn.addEventListener('click', addLiKeyword);
        if (addLiKeyInp) addLiKeyInp.addEventListener('keypress', (e) => e.key === 'Enter' && addLiKeyword());

        const addLiCompany = () => addListItem('linkedin', 'mutedCompanies', 'newLinkedinCompanyInput', (v) => v.trim());
        const addLiCompBtn = document.getElementById('addLinkedinCompanyBtn');
        const addLiCompInp = document.getElementById('newLinkedinCompanyInput');
        if (addLiCompBtn) addLiCompBtn.addEventListener('click', addLiCompany);
        if (addLiCompInp) addLiCompInp.addEventListener('keypress', (e) => e.key === 'Enter' && addLiCompany());

        // Backup Actions in Sidebar
        const exportBtn = document.getElementById('exportConfigBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportConfiguration);
        const importInp = document.getElementById('importConfigFile');
        if (importInp) importInp.addEventListener('change', importConfiguration);
    }

    /**
     * Exports full config as JSON
     */
    function exportConfiguration() {
        const exportData = {
            appName: "UniShield",
            schemaVersion: "2.0",
            exportedAt: new Date().toISOString(),
            config: config
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unishield-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Imports config from JSON
     */
    function importConfiguration(e) {
        const file = e.target.files && e.target.files[0];
        const statusEl = document.getElementById('importStatus');
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                const importedConfig = parsed.config || parsed;
                const storage = getStorage();

                if (storage) {
                    await storage.setConfig(importedConfig);
                    config = await storage.getConfig();
                }

                populateControls();
                renderAllLists();
                notifyTabs();

                if (statusEl) {
                    statusEl.textContent = typeof t === 'function' ? t('importSuccess') : '✓ Imported successfully!';
                    statusEl.className = 'sidebar-status-msg success';
                    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
                }
            } catch (err) {
                if (statusEl) {
                    statusEl.textContent = typeof t === 'function' ? t('importError') : '✗ Invalid JSON backup file.';
                    statusEl.className = 'sidebar-status-msg error';
                    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
                }
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
