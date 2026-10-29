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

    /**
     * Initializes the content script for LinkedIn Feed
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
        for (const span of spans) {
            const text = normalizeText(span.textContent);
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
    function checkKeywords(post) {
        const muted = config.linkedin.mutedWords || [];
        if (!Array.isArray(muted) || muted.length === 0) return false;
        const postWords = post.querySelector(SELECTORS.postBody);
        if (!postWords) return false;
        const text = (postWords.textContent || '').toLowerCase();
        return muted.some(k => {
            const clean = (k || '').trim().toLowerCase();
            return clean && text.includes(clean);
        });
    }

    /**
     * Check: Muted companies
     */
    function checkCompanies(post) {
        const companies = config.linkedin.mutedCompanies || [];
        if (!Array.isArray(companies) || companies.length === 0) return false;
        const spans = post.querySelectorAll('p > span, .feed-shared-actor__name, .update-components-actor__name');
        for (const span of spans) {
            const text = normalizeText(span.textContent).toLowerCase();
            if (companies.some(c => (c || '').trim().toLowerCase() === text)) {
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
        for (const span of spans) {
            const text = normalizeText(span.textContent);
            if (!text || text.length > 150) continue;
            const words = text.toLowerCase().split(' ');
            for (const word of words) {
                if (langInteractions.has(word)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check: AI-generated posts
     */
    function checkAI(post) {
        if (config.linkedin.removeAIPosts === false) return false;
        const postWords = post.querySelector(SELECTORS.postBody);
        if (!postWords) return false;
        const text = postWords.textContent || '';

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
        for (const span of spans) {
            const text = normalizeText(span.textContent);
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
    function checkEmojis(post) {
        if (config.linkedin.removePostsWithEmojis !== true) return false;
        const postWords = post.querySelector(SELECTORS.postBody);
        if (!postWords) return false;
        return regexEmoji.test(postWords.textContent || '');
    }

    /**
     * Check: "Broetry" & engagement bait (questions + excessive line breaks)
     */
    function checkBroetry(post) {
        if (config.linkedin.removeBroetryPosts === false) return false;
        const postWords = post.querySelector(SELECTORS.postBody);
        if (!postWords) return false;
        const text = postWords.textContent || '';
        if (regexBroetryWords.test(text)) {
            return true;
        }
        const html = postWords.innerHTML || '';
        const brCount = (html.match(/<br\s*\/?>/gi) || []).length;
        if (brCount > 6) {
            return true;
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
        if (checkKeywords(post)) {
            hidePost(post, 'muted-word');
            return;
        }
        if (checkCompanies(post)) {
            hidePost(post, 'muted-company');
            return;
        }
        if (checkAI(post)) {
            hidePost(post, 'ai-post');
            return;
        }
        if (checkBroetry(post)) {
            hidePost(post, 'broetry');
            return;
        }
        if (checkEmojis(post)) {
            hidePost(post, 'emoji');
            return;
        }

        post.setAttribute('data-bs-processed', 'true');
    }

    /**
     * Scans and filters all posts in the feed
     */
    function runFilters() {
        if (!isExtensionActive()) return;
        const posts = document.querySelectorAll(SELECTORS.postContainers);
        posts.forEach(evaluatePost);
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
     * Sets up message listener
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
