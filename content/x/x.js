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

    // Modern CSS selectors for X (Twitter)
    const SELECTORS = {
        tweets: 'article[data-testid="tweet"]',
        tweetText: '[data-testid="tweetText"]',
        userNameContainer: '[data-testid="User-Name"]',
        verifiedIcon: 'svg[data-testid="icon-verified"]',
        cellInner: '[data-testid="cellInnerDiv"]',
        // Structural SVG selectors
        blueCheckmark: 'svg[data-testid="icon-verified"]:not(:has(linearGradient)):not(:has(path[fill-rule]))',
        goldCheckmark: 'svg[data-testid="icon-verified"]:has(linearGradient)',
        greyCheckmark: 'svg[data-testid="icon-verified"]:not(:has(linearGradient)):has(path[fill-rule])',
        // Engagement metric selectors
        likeButton: '[data-testid="like"]',
        replyButton: '[data-testid="reply"]',
        transitionContainer: '[data-testid="app-text-transition-container"]'
    };

    const adBadges = new Set(['ad', 'promoted', 'patrocinado', 'publicidad', 'sponsorisé', 'gesponsert', 'publicité']);

    /**
     * Extracts text content from a DOM element, replacing emoji <img> tags with their alt text
     */
    function extractElementText(element) {
        if (!element) return '';
        const imgs = element.querySelectorAll('img[alt]');
        if (imgs.length === 0) return element.textContent || '';

        let text = '';
        const walk = (node) => {
            if (node.nodeType === 3) {
                text += node.nodeValue;
            } else if (node.nodeType === 1) {
                if (node.tagName === 'IMG') {
                    text += node.getAttribute('alt') || '';
                } else if (node.tagName === 'BR') {
                    text += '\n';
                } else {
                    for (let child = node.firstChild; child; child = child.nextSibling) {
                        walk(child);
                    }
                }
            }
        };
        walk(element);
        return text;
    }

    /**
     * Checks if a tweet is "Broetry" (excessive line breaks with single-sentence paragraphs).
     */
    function isBroetryTweet(text, textElement) {
        if (!text) return false;
        const detector = window.UniShield && window.UniShield.Detector;
        const brCount = textElement ? textElement.querySelectorAll('br').length : 0;
        if (detector && detector.isBroetry) {
            return detector.isBroetry(text, brCount);
        }

        // Fallback broetry structure evaluation
        const newlines = (text.match(/\n/g) || []).length;
        const lineBreakCount = Math.max(newlines, brCount);
        if (lineBreakCount >= 5) return true;

        const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
        if (paragraphs.length >= 3 && lineBreakCount >= 3) {
            let singleSentenceParas = 0;
            for (const p of paragraphs) {
                const words = p.split(/\s+/).filter(Boolean);
                const sentences = p.split(/[.!?]+/).filter(s => s.trim().length > 0);
                if (sentences.length <= 1 && words.length <= 25) {
                    singleSentenceParas++;
                }
            }
            if (singleSentenceParas >= 3 && (singleSentenceParas / paragraphs.length) >= 0.7) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if a tweet is low-effort viral engagement bait
     * (viral slang, "is wild", "is insane", "caught in 4k", starts with "Bro", skull emoji, etc.)
     */
    function isEngagementBaitTweet(text, tweet) {
        if (tweet && tweet.querySelector && tweet.querySelector('img[alt*="💀"], img[alt*="☠️"]')) {
            return true;
        }
        if (!text) return false;

        const detector = window.UniShield && window.UniShield.Detector;
        const defaults = getDefaults();
        const patterns = (defaults && defaults.xPatterns && defaults.xPatterns.engagementBait) || null;
        if (detector && detector.isEngagementBait) {
            return detector.isEngagementBait(text, patterns);
        }

        // Fallback checks using centralized patterns from defaults
        if (Array.isArray(patterns) && patterns.some(rx => rx.test(text))) {
            return true;
        }
        return false;
    }

    /**
     * Extracts quote tweet details if tweet contains an embedded quote tweet.
     * In X's DOM:
     * - Quote tweets contain two User-Name elements (author and quoted author)
     *   or a nested card in div[role="link"] containing user info or a second tweetText.
     */
    function getQuoteTweetDetails(tweet) {
        if (!tweet) return null;
        const userNames = tweet.querySelectorAll(SELECTORS.userNameContainer);
        const tweetTexts = tweet.querySelectorAll(SELECTORS.tweetText);

        const hasQuoteBox = userNames.length >= 2 ||
            tweetTexts.length >= 2 ||
            !!tweet.querySelector('div[role="link"] [data-testid="User-Name"]') ||
            !!tweet.querySelector('div[role="link"] [data-testid="tweetText"]');

        if (!hasQuoteBox) return null;

        // Quoter commentary is always the first tweetText
        const quoterTextEl = tweetTexts.length > 0 ? tweetTexts[0] : null;
        const quoterText = quoterTextEl ? extractElementText(quoterTextEl).trim() : '';

        return {
            isQuote: true,
            quoterText,
            quoterTextEl
        };
    }

    /**
     * Initializes the content script for X
     */
    async function init() {
        const storage = getStorage();
        if (storage) {
            config = await storage.getConfig();
        }

        if (isExtensionActive()) {
            runFullScan();
            startObserver();
        }

        setupMessageListener();
    }

    /**
     * Checks if filtering is globally and platform-specifically enabled
     */
    function isExtensionActive() {
        return config && config.global && config.global.enabled !== false && config.x && config.x.enabled !== false;
    }

    /**
     * Silently hides a tweet and optionally increments stats
     */
    function hideTweet(tweet, reason) {
        if (tweet.hasAttribute('data-bs-hidden')) return;
        tweet.setAttribute('data-bs-hidden', 'true');
        tweet.setAttribute('data-bs-processed', 'true');

        // Prefer hiding the whole virtual cell to avoid empty white boxes
        const cell = tweet.closest(SELECTORS.cellInner) || tweet;
        cell.classList.add('bs-x-hidden');

        pageStats.blocked++;
        const storage = getStorage();
        if (storage) {
            storage.incrementHidden('x').catch(() => { });
        }
    }

    /**
     * Checks if a tweet is an advertisement/promoted
     */
    function isPromotedTweet(tweet) {
        // 1. Placement tracking attribute
        if (tweet.querySelector('[data-testid="placementTracking"]')) return true;

        // 2. Direct ad spans in header/user area or badge
        const header = tweet.querySelector(SELECTORS.userNameContainer) || tweet;
        const spans = header.querySelectorAll('span');
        for (let i = 0; i < spans.length; i++) {
            const text = (spans[i].textContent || '').trim().toLowerCase();
            if (adBadges.has(text)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines badge color or type (blue, gold, grey) using structural selectors
     * without forcing synchronous reflow (no getComputedStyle).
     */
    function getVerificationType(tweet) {
        const icon = tweet.querySelector(SELECTORS.verifiedIcon);
        if (!icon) return null;

        // Fast structure checks directly on icon
        if (icon.querySelector('linearGradient')) return 'gold';
        const path = icon.querySelector('path');
        if (path && path.hasAttribute('fill-rule')) return 'grey';

        try {
            if (icon.matches(SELECTORS.goldCheckmark)) return 'gold';
            if (icon.matches(SELECTORS.greyCheckmark)) return 'grey';
            if (icon.matches(SELECTORS.blueCheckmark)) return 'blue';
        } catch (e) { }

        const fill = icon.getAttribute('fill') || (path && path.getAttribute('fill')) || '';
        if (fill.includes('234, 179, 8') || fill.toLowerCase().includes('#eab308') || fill.toLowerCase().includes('#ffd700')) {
            return 'gold';
        }
        if (fill.includes('130, 154, 171') || fill.toLowerCase().includes('#829aab')) {
            return 'grey';
        }

        return 'blue';
    }

    /**
     * Extracts numerical interaction counters (likes, replies) from a tweet
     */
    function getTweetInteractions(tweet) {
        let likes = 0;
        let comments = 0;

        const parseFn = (window.UniShield && window.UniShield.Detector && window.UniShield.Detector.parseCounterText)
            ? window.UniShield.Detector.parseCounterText
            : (t) => {
                if (!t) return 0;
                const cleaned = t.trim().replace(/,/g, '.');
                let m = 1;
                if (/[kK]$/.test(cleaned)) m = 1000;
                else if (/[mM]$/.test(cleaned)) m = 1000000;
                const n = parseFloat(cleaned.replace(/[kKmM]/g, ''));
                return isNaN(n) ? 0 : n * m;
            };

        const likeBtn = tweet.querySelector(SELECTORS.likeButton);
        if (likeBtn) {
            const container = likeBtn.querySelector(SELECTORS.transitionContainer);
            const text = (container && container.textContent.trim()) || likeBtn.textContent.trim() || likeBtn.getAttribute('aria-label') || '';
            const match = text.match(/[\d.,]+[kKmM]?/);
            if (match) likes = parseFn(match[0]);
        }

        const replyBtn = tweet.querySelector(SELECTORS.replyButton);
        if (replyBtn) {
            const container = replyBtn.querySelector(SELECTORS.transitionContainer);
            const text = (container && container.textContent.trim()) || replyBtn.textContent.trim() || replyBtn.getAttribute('aria-label') || '';
            const match = text.match(/[\d.,]+[kKmM]?/);
            if (match) comments = parseFn(match[0]);
        }

        return { likes, comments };
    }

    /**
     * Extracts username handle from a tweet element
     */
    function extractUsername(tweet) {
        const userContainer = tweet.querySelector(SELECTORS.userNameContainer);
        if (!userContainer) return null;

        const handleSpan = Array.from(userContainer.querySelectorAll('span')).find(s => s.textContent && s.textContent.startsWith('@'));
        if (handleSpan) {
            return handleSpan.textContent.replace('@', '').trim();
        }

        const link = userContainer.querySelector('a[href^="/"]');
        if (link) {
            const match = link.getAttribute('href').match(/^\/([^\/?#]+)/);
            if (match && !['home', 'explore', 'notifications', 'messages'].includes(match[1])) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Evaluates a single tweet against configured rules.
     * Reordered from cheapest to most expensive filters to maximize early exits.
     */
    function evaluateTweet(tweet) {
        if (!isExtensionActive()) return;
        if (tweet.hasAttribute('data-bs-processed')) return;

        // 1. Promoted / Ads filter
        if (config.x.removePromoted !== false && isPromotedTweet(tweet)) {
            hideTweet(tweet, 'promoted');
            return;
        }

        // 2. Checkmark filters (Blue, Grey, Gold) - only run if at least one checkmark filter is enabled
        const checkCheckmarks = config.x.removeBlueCheckmark === true || config.x.removeGreyCheckmark === true || config.x.removeGoldCheckmark === true;
        if (checkCheckmarks) {
            const badgeType = getVerificationType(tweet);
            if (badgeType) {
                if (badgeType === 'blue' && config.x.removeBlueCheckmark === true) {
                    hideTweet(tweet, 'blue-checkmark');
                    return;
                }
                if (badgeType === 'grey' && config.x.removeGreyCheckmark === true) {
                    hideTweet(tweet, 'grey-checkmark');
                    return;
                }
                if (badgeType === 'gold' && config.x.removeGoldCheckmark === true) {
                    hideTweet(tweet, 'gold-checkmark');
                    return;
                }
            }
        }

        // 2b. Low-Effort Quote Tweet filter
        if (config.x.removeLowEffortQuotes === true) {
            const quoteInfo = getQuoteTweetDetails(tweet);
            if (quoteInfo && quoteInfo.isQuote) {
                const detector = window.UniShield && window.UniShield.Detector;
                const defaults = getDefaults();
                const patterns = (defaults && defaults.xPatterns && defaults.xPatterns.lowEffortQuotes) || null;
                if (detector && detector.isLowEffortQuote && detector.isLowEffortQuote(quoteInfo.quoterText, patterns)) {
                    hideTweet(tweet, 'low-effort-quote');
                    return;
                }
            }
        }

        // Check skull emoji presence across the whole tweet if Engagement Bait filter is enabled
        if (config.x.removeBroetryPosts !== false) {
            if (tweet.querySelector && tweet.querySelector('img[alt*="💀"], img[alt*="☠️"]')) {
                hideTweet(tweet, 'engagement-bait');
                return;
            }
        }

        // Text content filters
        const textElement = tweet.querySelector(SELECTORS.tweetText);
        if (textElement) {
            const text = extractElementText(textElement);
            const lowerText = text.toLowerCase();
            const defaults = getDefaults();
            const patterns = (defaults && defaults.xPatterns) || {};

            // 3. Custom Muted Keywords filter (fastest string includes check)
            if (Array.isArray(config.x.mutedKeywords) && config.x.mutedKeywords.length > 0) {
                const hasMutedWord = config.x.mutedKeywords.some(keyword => {
                    const cleanKeyword = (keyword || '').trim().toLowerCase();
                    return cleanKeyword && lowerText.includes(cleanKeyword);
                });

                if (hasMutedWord) {
                    hideTweet(tweet, 'custom-keyword');
                    return;
                }
            }

            // 4. Broetry & Engagement Bait filters
            if (config.x.removeBroetryPosts !== false) {
                if (isBroetryTweet(text, textElement)) {
                    hideTweet(tweet, 'broetry');
                    return;
                }
                if (isEngagementBaitTweet(text, tweet)) {
                    hideTweet(tweet, 'engagement-bait');
                    return;
                }
            }

            // 5. AI Tweets filter
            if (config.x.removeAITweets !== false && patterns.ai) {
                const isAI = patterns.ai.some(regex => regex.test(text));
                if (isAI) {
                    hideTweet(tweet, 'ai-tweet');
                    return;
                }
            }

            // 6. Crypto Scams filter
            if (config.x.removeCryptoScams !== false && patterns.crypto) {
                const isCrypto = patterns.crypto.some(regex => regex.test(text));
                if (isCrypto) {
                    hideTweet(tweet, 'crypto-scam');
                    return;
                }
            }

            // 7. Racism and racial hate speech filter
            if (config.x.removeRacism !== false && patterns.racism) {
                const isHateSpeech = patterns.racism.some(regex => regex.test(text));
                if (isHateSpeech) {
                    hideTweet(tweet, 'hate-speech');
                    return;
                }
            }

            // 8. Gender-War toxicity filter
            if (config.x.removeGenderWar !== false && patterns.genderWar) {
                const isGenderWar = patterns.genderWar.some(regex => regex.test(text));
                if (isGenderWar) {
                    hideTweet(tweet, 'gender-war');
                    return;
                }
            }

            // 9. Political Content filter (strictness check)
            const strictness = typeof config.x.politicalStrictness === 'number'
                ? config.x.politicalStrictness
                : (config.x.removeOverlyPolitical === true || config.x.removePoliticalRagebait === true ? 1 : 0);

            if (strictness > 0) {
                const scoringLists = defaults && defaults.politicalScoring;
                const detector = window.UniShield && window.UniShield.Detector;

                if (strictness === 2) {
                    if (detector && detector.hasPoliticalContent && detector.hasPoliticalContent(text, scoringLists)) {
                        hideTweet(tweet, 'political-content');
                        return;
                    }
                } else if (strictness === 1) {
                    if (detector && detector.isOverlyPoliticalTweet && detector.isOverlyPoliticalTweet(text, 6, scoringLists)) {
                        hideTweet(tweet, 'overly-political');
                        return;
                    }
                }
            }

            // 10. Keyword Ragebait filter (fallback)
            if (config.x.removePoliticalRagebait === true && patterns.ragebait) {
                const isRage = patterns.ragebait.some(regex => regex.test(text));
                if (isRage) {
                    hideTweet(tweet, 'political-ragebait');
                    return;
                }
            }
        }

        // 11. Statistical Ragebait filter (Engagement ratio analysis via Bayesian smoothed ratio & z-score)
        // Evaluated last, only if enabled and tweet passed all text filters
        const checkRagebait = config.x.removeRagebait === true || config.x.removePoliticalRagebait === true;
        if (checkRagebait) {
            const { likes, comments } = getTweetInteractions(tweet);
            const detector = window.UniShield && window.UniShield.Detector;
            if (detector && detector.detectRagebait) {
                const rageResult = detector.detectRagebait(likes, comments);
                if (rageResult && rageResult.signal) {
                    hideTweet(tweet, 'ragebait-ratio');
                    return;
                }
            }
        }

        // Mark as evaluated to avoid re-evaluating unchanged items
        tweet.setAttribute('data-bs-processed', 'true');
    }

    /**
     * Runs scan over only unprocessed visible tweets on the page
     */
    function runFullScan() {
        if (!isExtensionActive()) return;
        const tweets = document.querySelectorAll(SELECTORS.tweets + ':not([data-bs-processed])');
        for (let i = 0; i < tweets.length; i++) {
            evaluateTweet(tweets[i]);
        }
    }

    /**
     * Clears all modifications made to the DOM
     */
    function clearAllModifications() {
        const hiddenCells = document.querySelectorAll('.bs-x-hidden');
        hiddenCells.forEach(el => el.classList.remove('bs-x-hidden'));

        const processed = document.querySelectorAll('[data-bs-processed]');
        processed.forEach(el => {
            el.removeAttribute('data-bs-processed');
            el.removeAttribute('data-bs-hidden');
        });

        pageStats.blocked = 0;
    }

    /**
     * Debounced mutation handler.
     * Auto-disconnects if extension context is invalidated.
     */
    function handleMutations() {
        const storage = getStorage();
        if (storage && !storage.isExtensionValid()) {
            stopObserver();
            return;
        }

        if (scanPending || !isExtensionActive()) return;

        scanPending = true;
        requestAnimationFrame(() => {
            scanPending = false;
            runFullScan();
        });
    }

    /**
     * Starts observer
     */
    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(handleMutations);
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
     * Message listener safely wrapped
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
                                runFullScan();
                                startObserver();
                            } else {
                                stopObserver();
                            }
                        }).catch(() => { });
                    }
                    sendResponse({ success: true });
                    return true;
                } else if (message.type === 'UNISHIELD_GET_STATS') {
                    sendResponse({ pageBlocked: pageStats.blocked });
                }
            });
        } catch (e) { }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
