/**
 * UniShield - LinkedIn Jobs Content Script
 * Hides promoted job listings, suppresses old job postings (>30 days),
 * and flags predatory or unrealistic job description keywords.
 * Compatible with LinkedIn SPA route transitions.
 */
(function() {
    'use strict';

    window.UniShield = window.UniShield || {};
    const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {});

    const getStorage = () => window.UniShield && window.UniShield.Storage;
    const getDefaults = () => window.UniShield && window.UniShield.Defaults;

    let config = null;
    let observer = null;
    let scanPending = false;
    let jobPanelTimer = null;
    let lastUrl = window.location.href;
    let spaListenersInitialized = false;

    const promotedWords = new Set([
        'Promoted',
        'Promocionado',
        'Promovida',
        'Promosso'
    ]);

    const SELECTORS = {
        jobs: 'div[data-display-contents="true"] a[tabindex="0"], div[componentkey^="job-card-component-ref-"], li.jobs-search-results__list-item, div.job-card-container',
        jobCollections: 'li.ember-view'
    };

    /**
     * Checks if current URL is a LinkedIn jobs page
     */
    function isJobsPage() {
        const path = window.location.pathname || '';
        return path.startsWith('/jobs') || path.includes('/jobs');
    }

    /**
     * Checks if extension is active
     */
    function isExtensionActive() {
        return config && config.global && config.global.enabled !== false && config.linkedin && config.linkedin.enabled !== false;
    }

    /**
     * Initializes jobs script and sets up SPA navigation listeners
     */
    async function init() {
        const storage = getStorage();
        if (storage) {
            config = await storage.getConfig();
        }

        if (isExtensionActive()) {
            if (isJobsPage()) {
                runFilters();
            }
            startObserver();
            setupSpaListeners();
        }

        setupMessageListener();
    }

    /**
     * Handles SPA URL change and triggers scans when entering /jobs routes
     */
    function handleUrlChange() {
        if (window.location.href === lastUrl) return;
        lastUrl = window.location.href;

        if (isExtensionActive() && isJobsPage()) {
            runFilters();
        }
    }

    /**
     * Sets up history and popstate listeners for SPA route transitions
     */
    function setupSpaListeners() {
        if (spaListenersInitialized) return;
        spaListenersInitialized = true;

        try {
            const originalPushState = history.pushState;
            history.pushState = function (...args) {
                originalPushState.apply(this, args);
                handleUrlChange();
            };

            const originalReplaceState = history.replaceState;
            history.replaceState = function (...args) {
                originalReplaceState.apply(this, args);
                handleUrlChange();
            };

            window.addEventListener('popstate', handleUrlChange);
        } catch (e) {}
    }

    /**
     * Changes visibility of a job card
     */
    function changeVisibility(job, shouldHide) {
        const target = job.closest('li.jobs-search-results__list-item') || job.closest('li.ember-view') || job.closest('div[data-display-contents="true"]') || job;
        target.setAttribute('data-unishield-processed', 'true');
        job.setAttribute('data-unishield-processed', 'true');

        if (shouldHide) {
            if (target.style.display !== 'none') {
                target.style.display = 'none';
                const storage = getStorage();
                if (storage) storage.incrementHidden('linkedin').catch(() => {});
            }
            return true;
        } else {
            if (target.style.display === 'none') {
                target.style.display = '';
            }
            return false;
        }
    }

    /**
     * Checks if job card is promoted
     */
    function isPromotedJob(job) {
        if (!config || !config.linkedin || config.linkedin.removePromotedJobs === false) return false;
        const elements = job.querySelectorAll('p, span');
        for (let i = 0; i < elements.length; i++) {
            const content = (elements[i].textContent || '').replace(/\n/g, '').trim();
            if (content.length > 150) continue;
            for (const word of promotedWords) {
                if (content === word || content.startsWith(word + ' ')) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Checks if job posting is older than 30 days
     */
    function isOldJob(job) {
        if (!config || !config.linkedin || config.linkedin.jobAgeAlerts === false) return false;
        const elements = job.querySelectorAll('time, [class*="time"], [class*="date"], p, span');
        for (let i = 0; i < elements.length; i++) {
            const text = (elements[i].textContent || '').trim().toLowerCase();
            if (text.length > 40) continue;

            if ((text.includes(' ago') || text.includes('hace ')) && 
                (text.includes('month') || text.includes('mes') || 
                (text.includes('day') && parseInt(text.replace(/\D/g, ''), 10) > 30) || 
                (text.includes('día') && parseInt(text.replace(/\D/g, ''), 10) > 30))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Injects red flag warning banner into job view
     */
    function injectWarningBanner(container, message) {
        if (!container) return;
        const existing = container.querySelector(`.unishield-warning-banner[data-msg="${CSS.escape(message)}"]`);
        if (existing) return;

        const banner = document.createElement('div');
        banner.className = 'unishield-warning-banner';
        banner.dataset.msg = message;
        banner.style.padding = '12px 16px';
        banner.style.margin = '16px 0';
        banner.style.borderRadius = '8px';
        banner.style.backgroundColor = '#1e1e1e';
        banner.style.color = '#ff6b6b';
        banner.style.border = '1px solid #ff4d4d';
        banner.style.fontWeight = '500';
        banner.style.fontSize = '14px';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '8px';

        const strong = document.createElement('strong');
        strong.textContent = typeof t === 'function' ? t('alertPrefix') : '⚠️ UniShield Alert:';
        const span = document.createElement('span');
        span.textContent = message;

        banner.appendChild(strong);
        banner.appendChild(span);
        container.prepend(banner);
    }

    /**
     * Inspects active job details panel for predatory red flags (scoped to details panel, debounced)
     */
    function processJobPanel() {
        if (!config || !config.linkedin || config.linkedin.jobRedFlags === false) return;

        const detailsPanel = document.querySelector(
            '.jobs-search__job-details, .jobs-description, .job-view-layout, .jobs-description-content, [data-view-name="job-details"]'
        );

        let targetContainer = detailsPanel;
        if (!targetContainer) {
            const buttons = Array.from(document.querySelectorAll('button'));
            const actionBtns = buttons.filter(b => {
                const label = b.getAttribute('aria-label');
                return label && (
                    label.toLowerCase().includes('save') ||
                    label.toLowerCase().includes('guardar') ||
                    label.toLowerCase().includes('apply') ||
                    label.toLowerCase().includes('solicitar') ||
                    label.toLowerCase().includes('postular')
                );
            });

            if (actionBtns.length === 0) return;

            let topCard = actionBtns[0].parentElement;
            for (let i = 0; i < 10; i++) {
                if (topCard.parentElement && topCard.parentElement.tagName !== 'MAIN' && topCard.parentElement.tagName !== 'BODY') {
                    topCard = topCard.parentElement;
                }
            }
            targetContainer = topCard;
        }

        if (!targetContainer) return;

        const defaults = getDefaults();
        const flags = (defaults && defaults.linkedinPatterns && defaults.linkedinPatterns.jobRedFlags) || [
            'ninja', 'rockstar', 'guru', 'work under pressure', 'trabajar bajo presión',
            'fast-paced environment', 'multitasking', 'no remunerado', 'no remunerada'
        ];

        // Read text ONLY from the job details container, never document.body
        const text = (targetContainer.textContent || '').toLowerCase();
        const found = flags.filter(f => text.includes(f));
        if (found.length > 0) {
            const prefix = typeof t === 'function' ? t('redFlagsDetected') : 'Red flags detected in job description: ';
            injectWarningBanner(targetContainer, `${prefix}${found.join(', ')}`);
        }
    }

    /**
     * Debounced wrapper for job details analysis
     */
    function scheduleJobPanelCheck() {
        if (jobPanelTimer) clearTimeout(jobPanelTimer);
        jobPanelTimer = setTimeout(() => {
            processJobPanel();
        }, 300);
    }

    /**
     * Runs filters on unprocessed jobs
     */
    function runFilters() {
        if (!isExtensionActive() || !isJobsPage()) return;

        const jobs = document.querySelectorAll(SELECTORS.jobs);
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            if (job.hasAttribute('data-unishield-processed')) continue;
            const hide = isPromotedJob(job) || isOldJob(job);
            changeVisibility(job, hide);
        }

        const collections = document.querySelectorAll(SELECTORS.jobCollections);
        for (let i = 0; i < collections.length; i++) {
            const job = collections[i];
            if (job.hasAttribute('data-unishield-processed')) continue;
            const hide = isPromotedJob(job) || isOldJob(job);
            changeVisibility(job, hide);
        }

        scheduleJobPanelCheck();
    }

    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                handleUrlChange();
            }
            if (!isExtensionActive() || !isJobsPage() || scanPending) return;
            scanPending = true;
            requestAnimationFrame(() => {
                scanPending = false;
                runFilters();
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (jobPanelTimer) {
            clearTimeout(jobPanelTimer);
            jobPanelTimer = null;
        }
    }

    function setupMessageListener() {
        try {
            const storage = getStorage();
            if (storage && !storage.isExtensionValid()) return;
            browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
                const curStorage = getStorage();
                if (curStorage && !curStorage.isExtensionValid()) return;
                if (message.type === 'UNISHIELD_CONFIG_UPDATED') {
                    if (curStorage) {
                        curStorage.getConfig().then(newConfig => {
                            config = newConfig;
                            if (isExtensionActive()) {
                                if (isJobsPage()) {
                                    runFilters();
                                }
                                startObserver();
                                setupSpaListeners();
                            } else {
                                stopObserver();
                            }
                        }).catch(() => {});
                    }
                    sendResponse({ success: true });
                    return true;
                }
            });
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
