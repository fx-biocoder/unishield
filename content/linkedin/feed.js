/**
 * UniShield - LinkedIn Feed Content Script
 * Filters promoted posts, suggested updates, contact interactions, AI content,
 * broetry engagement-bait, emojis, and custom muted words/companies.
 */
(function () {
    'use strict';

    window.UniShield = window.UniShield || {};
    const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {});

    const getStorage = () => window.UniShield && window.UniShield.Storage;
    const getDefaults = () => window.UniShield && window.UniShield.Defaults;

    let config = null;
    let observer = null;
    let pageStats = { blocked: 0 };
    let scanPending = false;
    let mutedCompaniesSet = new Set();
    let mutedKeywordsList = [];

    // Multilingual interaction action words
    const interactions = {
        en: new Set(['likes', 'celebrates', 'insightful', 'finds', 'funny', 'loves', 'commented', 'supports', 'reacted']),
        es: new Set(['recomienda', 'celebra', 'interesante', 'gracia', 'encanta', 'comentado', 'apoya', 'reaccionado']),
        pt: new Set(['gostou', 'parabenizou', 'interessante', 'engraçado', 'amou', 'comentou', 'apoiou']),
        it: new Set(['geniale', 'Consigliato', 'Commentato', 'festeggia', 'sostegno'])
    };

    const promotedWords = new Set([
        'Promoted',
        'Promocionado',
        'Promovido',
        'Promovida',
        'Post sponsorizzato',
        'Promosso'
    ]);

    const suggestedWords = new Set([
        'Suggested',
        'Sugerencias',
        'Sugerido',
        'Sugerida',
        'Consigliati'
    ]);

    const regexBroetryWords = /agree\?|thoughts\?|¿estás de acuerdo\?|¿qué opinas\?|concorda\?|opinioni\?/i;
    const regexEmoji = /\p{Emoji}/u;

    // CSS selectors for LinkedIn feed
    const SELECTORS = {
        feed: 'div[data-testid="mainFeed"], main.scaffold-layout__main, div.scaffold-finite-scroll__content',
        postContainers: '[role="listitem"][componentkey^="update-card-focus"], div.feed-shared-update-v2, div[data-id^="urn:li:activity"]',
        postBody: 'span[data-testid="expandable-text-box"], div.feed-shared-update-v2__description-wrapper, div.update-components-text'
    };

    function updateCaches() {
        const comps = (config && config.linkedin && config.linkedin.mutedCompanies) || [];
        mutedCompaniesSet = new Set(comps.map(c => (c || '').trim().toLowerCase()).filter(Boolean));

        const words = (config && config.linkedin && config.linkedin.mutedWords) || [];
        mutedKeywordsList = words.map(k => (k || '').trim().toLowerCase()).filter(Boolean);
    }

    /**
     * Initializes the content script for LinkedIn Feed
     */
    async function init() {
        const storage = getStorage();
        if (storage) {
            config = await storage.getConfig();
        }
        updateCaches();

        if (isExtensionActive()) {
            runFilters();
            startObserver();
        }

        setupMessageListener();
    }

    /**
     * Checks if filtering is globally and platform-specifically enabled
     */
    function isExtensionActive() {
        return config && config.global && config.global.enabled !== false && config.linkedin && config.linkedin.enabled !== false;
    }

    /**
     * Trims leading/trailing whitespace and collapses internal whitespace
     */
    function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Silently hides a post and increments stats
     */
    function hidePost(post, reason) {
        if (post.hasAttribute('data-bs-hidden')) return;
        post.setAttribute('data-bs-hidden', 'true');
        post.setAttribute('data-bs-processed', 'true');
        post.style.display = 'none';

        pageStats.blocked++;
        const storage = getStorage();
        if (storage) {
            storage.incrementHidden('linkedin').catch(() => {});
        }
    }

    /**
     * Check: Promoted posts & ads
     */
    function checkPromoted(post) {
        if (config.linkedin.removePromotedPosts === false) return false;
        const spans = post.querySelectorAll('p > span, span.feed-shared-actor__sub-description');
        for (let i = 0; i < spans.length; i++) {
            const text = normalizeText(spans[i].textContent);
            if (!text || text.length > 150) continue;
            for (const word of promotedWords) {
                if (text === word || text.startsWith(word + ' ')) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check: Custom muted keywords
     */
    function checkKeywords(lowerText) {
        if (!lowerText || mutedKeywordsList.length === 0) return false;
        for (let i = 0; i < mutedKeywordsList.length; i++) {
            if (lowerText.includes(mutedKeywordsList[i])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check: Muted companies (O(1) Set lookups)
     */
    function checkCompanies(post) {
        if (mutedCompaniesSet.size === 0) return false;
        const spans = post.querySelectorAll('p > span, .feed-shared-actor__name, .update-components-actor__name');
        for (let i = 0; i < spans.length; i++) {
            const text = normalizeText(spans[i].textContent).toLowerCase();
            if (mutedCompaniesSet.has(text)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check: Interaction posts ("liked by...", "celebrates this", etc.)
     */
    function checkInteractions(post) {
        if (config.linkedin.removeByInteractions === false) return false;
        const spans = post.querySelectorAll('p > span, span.feed-shared-header__text-view, .update-components-header');
        const lang = (document.documentElement.lang || 'en').substring(0, 2);
        const langInteractions = interactions[lang] || interactions['en'];
        for (let i = 0; i < spans.length; i++) {
            const text = normalizeText(spans[i].textContent);
            if (!text || text.length > 150) continue;
            const words = text.toLowerCase().split(' ');
            for (let j = 0; j < words.length; j++) {
                if (langInteractions.has(words[j])) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check: AI-generated posts
     */
    function checkAI(text) {
        if (!text || config.linkedin.removeAIPosts === false) return false;
        const defaults = getDefaults();
        const aiPatterns = (defaults && defaults.linkedinPatterns && defaults.linkedinPatterns.ai) || [];
        return aiPatterns.some(regex => regex.test(text));
    }

    /**
     * Check: Suggested updates
     */
    function checkSuggested(post) {
        if (config.linkedin.removeSuggestedPosts === false) return false;
        const spans = post.querySelectorAll('p > span, .feed-shared-header__text-view');
        for (let i = 0; i < spans.length; i++) {
            const text = normalizeText(spans[i].textContent);
            if (!text || text.length > 150) continue;
            if (suggestedWords.has(text)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check: Posts with emojis
     */
    function checkEmojis(text) {
        if (!text || config.linkedin.removePostsWithEmojis !== true) return false;
        return regexEmoji.test(text);
    }

    /**
     * Check: "Broetry" & engagement bait (questions + excessive line breaks)
     */
    function checkBroetry(postWords, text) {
        if (config.linkedin.removeBroetryPosts === false) return false;
        if (regexBroetryWords.test(text)) {
            return true;
        }
        if (postWords) {
            const brCount = postWords.querySelectorAll('br').length;
            if (brCount > 6) {
                return true;
            }
        }
        return false;
    }

    /**
     * Evaluates a single LinkedIn post
     */
    function evaluatePost(post) {
        if (!isExtensionActive()) return;
        if (post.hasAttribute('data-bs-processed')) return;

        if (checkPromoted(post)) {
            hidePost(post, 'promoted');
            return;
        }
        if (checkSuggested(post)) {
            hidePost(post, 'suggested');
            return;
        }
        if (checkInteractions(post)) {
            hidePost(post, 'interaction');
            return;
        }
        if (checkCompanies(post)) {
            hidePost(post, 'muted-company');
            return;
        }

        // Text-based checks: query body once
        const postWords = post.querySelector(SELECTORS.postBody);
        const text = postWords ? (postWords.textContent || '') : '';
        const lowerText = text.toLowerCase();

        if (checkKeywords(lowerText)) {
            hidePost(post, 'muted-word');
            return;
        }
        if (checkAI(text)) {
            hidePost(post, 'ai-post');
            return;
        }
        if (checkBroetry(postWords, text)) {
            hidePost(post, 'broetry');
            return;
        }
        if (checkEmojis(text)) {
            hidePost(post, 'emoji');
            return;
        }

        post.setAttribute('data-bs-processed', 'true');
    }

    /**
     * Scans and filters only unprocessed posts in the feed
     */
    function runFilters() {
        if (!isExtensionActive()) return;
        const posts = document.querySelectorAll(SELECTORS.postContainers + ':not([data-bs-processed])');
        for (let i = 0; i < posts.length; i++) {
            evaluatePost(posts[i]);
        }
    }

    /**
     * Clears all modifications made to the DOM
     */
    function clearAllModifications() {
        const processed = document.querySelectorAll('[data-bs-processed]');
        processed.forEach(el => {
            el.removeAttribute('data-bs-processed');
            el.removeAttribute('data-bs-hidden');
            el.style.display = '';
        });
        pageStats.blocked = 0;
    }

    /**
     * Starts observer
     */
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

    /**
     * Stops observer
     */
    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    /**
     * Handles message events safely
     */
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
                            updateCaches();
                            clearAllModifications();
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
                } else if (message.type === 'UNISHIELD_GET_STATS') {
                    sendResponse({ pageBlocked: pageStats.blocked });
                }
            });
        } catch (e) {}
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
