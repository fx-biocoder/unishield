/**
 * UniShield - LinkedIn Jobs Content Script
 * Hides promoted job listings, suppresses old job postings (>30 days),
 * and flags predatory or unrealistic job description keywords.
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
     * Initializes jobs script
     */
    async function init() {
        const storage = getStorage();
        if (storage) {
            config = await storage.getConfig();
        }

        if (isExtensionActive()) {
            runFilters();
            startObserver();
        }

        setupMessageListener();
    }

    function isExtensionActive() {
        return config && config.global && config.global.enabled !== false && config.linkedin && config.linkedin.enabled !== false;
    }

    /**
     * Changes visibility of a job card
     */
    function changeVisibility(job, shouldHide) {
        const target = job.closest('li.jobs-search-results__list-item') || job.closest('li.ember-view') || job.closest('div[data-display-contents="true"]') || job;
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
        for (const el of elements) {
            const content = (el.textContent || '').replace(/\n/g, '').trim();
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
        const elements = job.querySelectorAll('time, span, div, p');
        for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
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
     * Inspects active job details panel for predatory red flags
     */
    function processJobPanel() {
        if (!config || !config.linkedin || config.linkedin.jobRedFlags === false) return;

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

        const defaults = getDefaults();
        const flags = (defaults && defaults.linkedinPatterns && defaults.linkedinPatterns.jobRedFlags) || [
            'ninja', 'rockstar', 'guru', 'work under pressure', 'trabajar bajo presión',
            'fast-paced environment', 'multitasking', 'no remunerado', 'no remunerada'
        ];

        const text = (document.body.textContent || '').toLowerCase();
        const found = flags.filter(f => text.includes(f));
        if (found.length > 0) {
            const prefix = typeof t === 'function' ? t('redFlagsDetected') : 'Red flags detected in job description: ';
            injectWarningBanner(topCard, `${prefix}${found.join(', ')}`);
        }
    }

    /**
     * Runs filters on all jobs
     */
    function runFilters() {
        if (!isExtensionActive()) return;

        const jobs = document.querySelectorAll(SELECTORS.jobs);
        jobs.forEach(job => {
            const hide = isPromotedJob(job) || isOldJob(job);
            changeVisibility(job, hide);
        });

        const collections = document.querySelectorAll(SELECTORS.jobCollections);
        collections.forEach(job => {
            const hide = isPromotedJob(job) || isOldJob(job);
            changeVisibility(job, hide);
        });

        processJobPanel();
    }

    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(() => {
            if (scanPending || !isExtensionActive()) return;
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
                                runFilters();
                                startObserver();
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
