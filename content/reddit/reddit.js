(function () {
  'use strict';

  window.UniShield = window.UniShield || {};
  const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {});

  const getStorage = () => window.UniShield && window.UniShield.Storage;
  const getDefaults = () => window.UniShield && window.UniShield.Defaults;
  const getDetector = () => window.UniShield && window.UniShield.Detector;

  let config = null;
  let observer = null;
  let pageStats = { blocked: 0 };
  let scanPending = false;
  let pendingTargets = new Set();
  let spaListenersInitialized = false;

  // Cached in-memory sets for O(1) synchronous lookups
  let blockedSubredditsSet = new Set();
  let allowedRedditUsersSet = new Set();
  let blockedRedditUsersSet = new Set();
  let compiledMutedKeywords = [];

  // New Reddit (Shreddit) and Old Reddit selectors
  const selectors = {
    posts: 'shreddit-post, [data-testid="post-container"], article, .thing.link',
    comments: 'shreddit-comment, [data-testid="comment"], .thing.comment, shreddit-profile-comment, [data-testid="profile-comment"]',
    authorLinks: 'a[href^="/user/"], a[href^="/u/"], a[href*="/user/"], a[href*="/u/"], a.author, [data-testid="comment_author_link"]'
  };

  let lastUrl = window.location.href;

  /**
   * Helper to detect if current page is itself a subreddit page
   */
  function getCurrentPageSubreddit() {
    try {
      const match = window.location.pathname.match(/^\/r\/([a-zA-Z0-9_]+)/i);
      if (match) {
        const sub = match[1].toLowerCase();
        if (!['all', 'popular', 'friends', 'mod', 'random'].includes(sub)) {
          return sub;
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Updates in-memory lookup sets from configuration
   */
  function updateLookupCaches() {
    const storage = getStorage();
    const cleanFn = (storage && storage.cleanSubredditName) ||
      function(n) { return n ? n.replace(/^\/?r\//i, '').replace(/\/+$/, '').toLowerCase().trim() : ''; };

    const subs = (config && config.reddit && config.reddit.subredditBlocklist) || [];
    blockedSubredditsSet = new Set(subs.map(cleanFn).filter(Boolean));

    const allowList = (config && config.reddit && config.reddit.userAllowlist) || [];
    allowedRedditUsersSet = new Set(allowList.map(u => (u || '').toLowerCase().trim()).filter(Boolean));

    const blockList = (config && config.reddit && config.reddit.userBlocklist) || [];
    blockedRedditUsersSet = new Set(blockList.map(u => (u || '').toLowerCase().trim()).filter(Boolean));

    compileMutedKeywords();
  }

  /**
   * Checks if current page is a blocked subreddit and suppresses feed synchronously
   */
  function checkPageSubreddit() {
    if (!isExtensionActive()) return;
    const pageSub = getCurrentPageSubreddit();
    if (pageSub && blockedSubredditsSet.has(pageSub)) {
      document.body.classList.add('unishield-blocked-subreddit-page');
    } else {
      document.body.classList.remove('unishield-blocked-subreddit-page');
    }
  }

  /**
   * Initializes the content script
   */
  async function init() {
    const storage = getStorage();
    if (storage) {
      config = await storage.getConfig();
    }
    updateLookupCaches();

    const isEnabled = config && config.global && config.global.enabled !== false && config.reddit && config.reddit.enabled !== false;
    if (isEnabled) {
      checkPageSubreddit();
      runFullScan();
      startObserver();
      setupSpaListeners();
    }

    setupMessageListener();
  }

  /**
   * Checks if the extension is currently enabled for Reddit
   */
  function isExtensionActive() {
    return config && config.global && config.global.enabled !== false && config.reddit && config.reddit.enabled !== false;
  }

  /**
   * Silently hides a suspicious Reddit element
   */
  function applyAction(element, username) {
    if (element.hasAttribute('data-unishield-processed')) return;
    element.setAttribute('data-unishield-processed', 'true');
    element.setAttribute('data-unishield-username', username || '');
    element.classList.add('unishield-hidden');

    pageStats.blocked++;
    const storage = getStorage();
    if (storage) {
      storage.incrementHidden('reddit').catch(() => {});
    }
  }

  /**
   * Helper to extract visible text from Reddit post or comment,
   * avoiding quadratic nesting by skipping child comments/posts.
   */
  function extractTextContent(element) {
    if (!element) return '';
    let text = '';

    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    if (tagName === 'shreddit-post') {
      text += (element.getAttribute('post-title') || '') + ' ';
    }

    const textNodes = element.querySelectorAll('[slot="title"], [slot="text-body"], [slot="comment"], h1, h2, a[data-testid="post-title"], [data-testid="comment"], .usertext-body, p');
    if (textNodes.length > 0) {
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        // Exclude nodes belonging to child comments or posts to avoid quadratic complexity
        const closestItem = node.closest ? node.closest(selectors.comments + ', ' + selectors.posts) : null;
        if (closestItem && closestItem !== element) {
          continue;
        }
        text += (node.textContent || '') + ' ';
      }
    } else {
      if (!element.querySelector(selectors.comments)) {
        text += (element.textContent || '') + ' ';
      }
    }

    return text.trim();
  }

  /**
   * Helper to extract title from a Reddit post element
   */
  function extractPostTitle(element) {
    if (!element) return '';
    if (element.hasAttribute && element.hasAttribute('post-title')) {
      const attr = element.getAttribute('post-title');
      if (attr) return attr.trim();
    }
    if (element.querySelector) {
      const titleEl = element.querySelector(
        '[slot="title"], a[data-testid="post-title"], h1, h2, a.title, .entry .title a, p.title a'
      );
      if (titleEl) {
        return (titleEl.textContent || '').trim();
      }
    }
    return '';
  }

  /**
   * Detects political content farm / troll center editorialized titles:
   * 1. Multi-sentence editorialized titles (2-4 sentences)
   * 2. Excessive Title Case / Capitalized Words pattern
   */
  function isEditorializedTitle(title) {
    if (!title || typeof title !== 'string') return false;
    let text = title.trim();
    if (text.length < 15) return false;

    // Pattern 1: Excessive Title Case / Capitalized words (tolerating occasional lowercase words)
    const words = text.split(/\s+/).map(function(w) {
      return w.replace(/^[^a-zA-Z\u00C0-\u024F]+|[^a-zA-Z\u00C0-\u024F]+$/g, '');
    }).filter(function(w) { return w.length > 0; });

    if (words.length >= 5) {
      let capitalizedCount = 0;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const firstChar = w[0];
        if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
          capitalizedCount++;
        }
      }
      const ratio = capitalizedCount / words.length;
      if (ratio >= 0.70 && capitalizedCount >= 4) {
        return true;
      }
    }

    // Pattern 2: Troll farm / call center pattern composed of 2, 3, or 4 sentences
    if (text.length < 30) return false;

    // Protect common abbreviations and acronyms
    text = text.replace(/\b(sr|sra|dr|dra|lic|ing|prof|ee\.uu|vs|etc|pág|pag|art|gob|cap|no|num|vol|u\.s|a\.m|p\.m)\.\s*/gi, function(m, g1) {
      return g1 + '_DOT_ ';
    });
    // Protect numbers like 21.00, 1.5, or 20.000
    text = text.replace(/(\d+)[.,](\d+)/g, '$1_DOT_$2');
    // Protect URLs
    text = text.replace(/(?:https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?/gi, '_URL_');

    // Split by sentence terminators: '.', '!', '?' followed by whitespace or end of string, or newlines
    const rawSegments = text.split(/(?:[.!?]+(?:\s+|$)|[\n\r]+)/);
    const validSentences = rawSegments
      .map(function(s) { return s.replace(/_DOT_/g, '.').trim(); })
      .filter(function(s) {
        const segWords = s.split(/\s+/).filter(function(w) { return w.length > 0; });
        return segWords.length >= 2;
      });

    const count = validSentences.length;
    return count >= 2 && count <= 4;
  }

  /**
   * Normalizes text by lowercasing and stripping diacritics / accents
   */
  function normalizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Precompiles muted keywords once for O(1) matching per item
   */
  function compileMutedKeywords() {
    const keywords = (config && config.reddit && config.reddit.mutedKeywords) || [];
    compiledMutedKeywords = keywords.map(kw => {
      const cleanKw = (kw || '').trim();
      if (!cleanKw) return null;
      const normKw = normalizeText(cleanKw);
      if (!normKw) return null;

      const escapedKw = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let wordBoundaryRx = null;
      try {
        wordBoundaryRx = new RegExp('(^|[\\s\\p{P}\\p{S}])' + escapedKw + '([\\s\\p{P}\\p{S}]|$)', 'iu');
      } catch (e) {}

      const leetMap = {
        'a': '[a@4áàâä]', 'e': '[e3éèêë]', 'i': '[i1!íìîï|]', 'o': '[o0óòôö]',
        'u': '[uúùûü]', 's': '[s5$]', 't': '[t7+]', 'c': '[c(k]', 'b': '[b8]'
      };
      const pattern = normKw.split('').map(function(char) {
        const lower = char.toLowerCase();
        if (/\s/.test(char)) return '[\\s\\W_]+';
        return leetMap[lower] || (/[a-z0-9]/i.test(char) ? char : '\\' + char);
      }).join('[\\W_\\s]*');

      let leetRx = null;
      try {
        leetRx = new RegExp('(^|[\\s\\p{P}\\p{S}])' + pattern + '([\\s\\p{P}\\p{S}]|$)', 'iu');
      } catch (e) {}

      return {
        raw: cleanKw,
        norm: normKw,
        wordBoundaryRx,
        leetRx
      };
    }).filter(Boolean);
  }

  /**
   * Fast check against all precompiled muted keywords
   */
  function matchesAnyMutedKeyword(rawText) {
    if (!rawText || compiledMutedKeywords.length === 0) return false;
    const normText = normalizeText(rawText);

    for (let i = 0; i < compiledMutedKeywords.length; i++) {
      const item = compiledMutedKeywords[i];
      if (item.wordBoundaryRx) {
        if (item.wordBoundaryRx.test(normText)) return true;
      } else if (normText.includes(item.norm)) {
        return true;
      }
      if (item.leetRx) {
        if (item.leetRx.test(rawText) || item.leetRx.test(normText)) return true;
      }
    }
    return false;
  }

  /**
   * Matches keyword against text, tolerant to casing, diacritics, and special characters / obfuscations
   */
  function matchesKeyword(text, keyword) {
    if (!text || !keyword) return false;
    const cleanKw = keyword.trim();
    if (!cleanKw) return false;

    const normText = normalizeText(text);
    const normKw = normalizeText(cleanKw);
    if (!normKw) return false;

    // 1. Direct word-boundary match on normalized text
    const escapedKw = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const wordBoundaryRx = new RegExp('(^|[\\s\\p{P}\\p{S}])' + escapedKw + '([\\s\\p{P}\\p{S}]|$)', 'iu');
      if (wordBoundaryRx.test(normText)) return true;
    } catch (e) {
      if (normText.includes(normKw)) return true;
    }

    // 2. Leet / obfuscation / special characters tolerance (e.g. M.i.l.e.i, #milei, f4ch0)
    const leetMap = {
      'a': '[a@4áàâä]',
      'e': '[e3éèêë]',
      'i': '[i1!íìîï|]',
      'o': '[o0óòôö]',
      'u': '[uúùûü]',
      's': '[s5$]',
      't': '[t7+]',
      'c': '[c(k]',
      'b': '[b8]'
    };

    const pattern = normKw.split('').map(function(char) {
      const lower = char.toLowerCase();
      if (/\s/.test(char)) return '[\\s\\W_]+';
      return leetMap[lower] || (/[a-z0-9]/i.test(char) ? char : '\\' + char);
    }).join('[\\W_\\s]*');

    try {
      const rx = new RegExp('(^|[\\s\\p{P}\\p{S}])' + pattern + '([\\s\\p{P}\\p{S}]|$)', 'iu');
      if (rx.test(text) || rx.test(normText)) return true;
    } catch (e) {}

    return false;
  }

  /**
   * Helper to extract subreddit name from a post or comment element efficiently
   */
  function extractSubreddit(element) {
    if (!element) return null;

    // 1. Page subreddit is the fastest and most accurate for single-post views or subreddit feeds
    const pageSub = getCurrentPageSubreddit();
    if (pageSub) {
      return pageSub;
    }

    const storage = getStorage();
    const cleanFn = (storage && storage.cleanSubredditName) ||
      function(n) { return n ? n.replace(/^\/?r\//i, '').replace(/\/+$/, '').toLowerCase().trim() : ''; };

    // 2. Direct attributes on element
    const attrNames = [
      'subreddit-prefixed-name',
      'subreddit-name',
      'subreddit',
      'data-subreddit-name',
      'data-subreddit',
      'data-context-subreddit',
      'data-subreddit-prefixed-name'
    ];

    for (let i = 0; i < attrNames.length; i++) {
      const attr = attrNames[i];
      if (element.hasAttribute && element.hasAttribute(attr)) {
        const val = element.getAttribute(attr);
        if (val) {
          const clean = cleanFn(val);
          if (clean && !['all', 'popular', 'mod', 'friends'].includes(clean)) {
            return clean;
          }
        }
      }
    }

    // 3. Closest parent container (if element is a comment inside a post card)
    const parent = element.closest ? element.closest('shreddit-post, [data-subreddit], article') : null;
    if (parent && parent !== element) {
      for (let i = 0; i < attrNames.length; i++) {
        const attr = attrNames[i];
        if (parent.hasAttribute && parent.hasAttribute(attr)) {
          const val = parent.getAttribute(attr);
          if (val) {
            const clean = cleanFn(val);
            if (clean && !['all', 'popular', 'mod', 'friends'].includes(clean)) {
              return clean;
            }
          }
        }
      }
    }

    // 4. Permalink / URL attributes
    const urlAttrs = ['permalink', 'data-permalink', 'post-url', 'content-href', 'href'];
    for (let i = 0; i < urlAttrs.length; i++) {
      const attr = urlAttrs[i];
      if (element.hasAttribute && element.hasAttribute(attr)) {
        const val = element.getAttribute(attr);
        if (val) {
          const match = val.match(/\/r\/([a-zA-Z0-9_]+)/i);
          if (match) {
            const clean = match[1].toLowerCase();
            if (clean && !['all', 'popular', 'mod', 'friends'].includes(clean)) {
              return clean;
            }
          }
        }
      }
    }

    // 5. Child subreddit badge links (avoiding random links in comment body)
    if (element.querySelector) {
      const targetLink = element.querySelector(
        'a[slot="subreddit-name"], a[data-testid="subreddit-name"], a.subreddit-name, a[data-click-id="subreddit"]'
      );
      if (targetLink) {
        const href = targetLink.getAttribute('href') || targetLink.href || '';
        const match = href.match(/\/r\/([a-zA-Z0-9_]+)/i);
        if (match) {
          const clean = match[1].toLowerCase();
          if (clean && !['all', 'popular', 'mod', 'friends', 'user', 'u'].includes(clean)) {
            return clean;
          }
        }
      }
    }

    return null;
  }

  /**
   * Restores all modified elements
   */
  function clearAllModifications() {
    document.body.classList.remove('unishield-blocked-subreddit-page');

    const hiddenElements = document.querySelectorAll(
      '.unishield-hidden, .unishield-sub-hidden, .unishield-promoted-hidden'
    );
    hiddenElements.forEach(el => {
      el.classList.remove(
        'unishield-hidden', 'unishield-sub-hidden', 'unishield-promoted-hidden'
      );
    });

    const processed = document.querySelectorAll('[data-unishield-processed]');
    processed.forEach(el => {
      el.removeAttribute('data-unishield-processed');
      el.removeAttribute('data-unishield-username');
    });

    pageStats.blocked = 0;
  }

  /**
   * Collects unique items, avoiding duplicate outer-inner wrappers
   */
  function collectElements(container) {
    const items = [];

    if (container.querySelectorAll) {
      const posts = container.querySelectorAll(selectors.posts);
      for (let i = 0; i < posts.length; i++) {
        const el = posts[i];
        if (el.tagName && el.tagName.toLowerCase() === 'article' && el.querySelector('shreddit-post, [data-testid="post-container"]')) {
          continue;
        }
        items.push(el);
      }
      const comments = container.querySelectorAll(selectors.comments);
      for (let i = 0; i < comments.length; i++) {
        const el = comments[i];
        if (el.getAttribute && el.getAttribute('data-testid') === 'comment' && el.closest('shreddit-comment') && el.tagName.toLowerCase() !== 'shreddit-comment') {
          continue;
        }
        items.push(el);
      }
    }

    if (container.matches) {
      if (container.matches(selectors.posts)) {
        if (!(container.tagName && container.tagName.toLowerCase() === 'article' && container.querySelector('shreddit-post, [data-testid="post-container"]'))) {
          items.push(container);
        }
      } else if (container.matches(selectors.comments)) {
        items.push(container);
      }
    }

    if (container.shadowRoot && container.shadowRoot.querySelectorAll) {
      const shadowPosts = container.shadowRoot.querySelectorAll(selectors.posts);
      for (let i = 0; i < shadowPosts.length; i++) {
        const el = shadowPosts[i];
        if (el.tagName && el.tagName.toLowerCase() === 'article' && el.querySelector('shreddit-post, [data-testid="post-container"]')) {
          continue;
        }
        items.push(el);
      }
      const shadowComments = container.shadowRoot.querySelectorAll(selectors.comments);
      for (let i = 0; i < shadowComments.length; i++) {
        items.push(shadowComments[i]);
      }
    }

    return items;
  }

  /**
   * Scans a specific element and its subtree synchronously
   */
  function scanElement(container) {
    if (!isExtensionActive() || !container) return;

    const items = collectElements(container);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Skip immediately if already processed or already hidden
      if (item.hasAttribute('data-unishield-processed')) {
        continue;
      }
      if (item.classList.contains('unishield-hidden') ||
          item.classList.contains('unishield-sub-hidden') ||
          item.classList.contains('unishield-promoted-hidden')) {
        item.setAttribute('data-unishield-processed', 'true');
        continue;
      }

      const isPost = item.matches ? item.matches(selectors.posts) : false;

      // 1. Promoted / Ads filter
      if (isPost && config.reddit.removePromoted !== false) {
        const isPromoted = item.hasAttribute('promoted') ||
          item.getAttribute('promoted') === 'true' ||
          (item.querySelector && item.querySelector('[data-testid="promoted-post"], .promotedlink, .promoted'));

        if (isPromoted) {
          item.classList.add('unishield-promoted-hidden');
          const parentArticle = item.closest ? item.closest('article') : null;
          if (parentArticle && parentArticle !== item) {
            parentArticle.classList.add('unishield-promoted-hidden');
          }
          item.setAttribute('data-unishield-processed', 'true');
          pageStats.blocked++;
          const storage = getStorage();
          if (storage) {
            storage.incrementHidden('reddit').catch(() => {});
          }
          continue;
        }
      }

      // 2. Subreddit blocklist filter (checks both posts and comments, synchronous lookup)
      const subredditName = extractSubreddit(item);
      if (subredditName && blockedSubredditsSet.has(subredditName)) {
        item.classList.add('unishield-sub-hidden');
        const parentArticle = item.closest ? item.closest('article') : null;
        if (parentArticle && parentArticle !== item) {
          parentArticle.classList.add('unishield-sub-hidden');
        }
        item.setAttribute('data-unishield-processed', 'true');
        pageStats.blocked++;
        const storage = getStorage();
        if (storage) {
          storage.incrementHidden('reddit').catch(() => {});
        }
        continue;
      }

      // 3. User extraction
      let username = null;
      const tagName = item.tagName ? item.tagName.toLowerCase() : '';

      if (tagName === 'shreddit-post' || tagName === 'shreddit-comment') {
        username = item.getAttribute('author');
      }

      if (!username && item.getAttribute) {
        username = item.getAttribute('data-author') || item.getAttribute('author');
      }

      // Check author links in light DOM
      if (!username && item.querySelectorAll) {
        const links = item.querySelectorAll(selectors.authorLinks);
        for (let j = 0; j < links.length; j++) {
          const link = links[j];
          const parentComponent = link.closest ? link.closest('shreddit-post, shreddit-comment') : null;
          if (parentComponent && parentComponent !== item) continue;

          const detector = getDetector();
          if (detector && detector.extractUsernameFromHref) {
            const extracted = detector.extractUsernameFromHref(link.getAttribute('href') || link.href);
            if (extracted) {
              username = extracted;
              break;
            }
          } else {
            const hrefVal = link.getAttribute('href') || link.href || '';
            const match = hrefVal.match(/\/(?:user|u)\/([^/?#]+)/);
            if (match) {
              username = match[1];
              break;
            }
          }
        }
      }

      // Check author links in shadowRoot if present
      if (!username && item.shadowRoot && item.shadowRoot.querySelectorAll) {
        const shadowLinks = item.shadowRoot.querySelectorAll(selectors.authorLinks);
        for (let j = 0; j < shadowLinks.length; j++) {
          const link = shadowLinks[j];
          const detector = getDetector();
          if (detector && detector.extractUsernameFromHref) {
            const extracted = detector.extractUsernameFromHref(link.getAttribute('href') || link.href);
            if (extracted) {
              username = extracted;
              break;
            }
          }
        }
      }

      // Check allowlist early if username is present
      const cleanUsername = username ? username.toLowerCase().trim() : null;
      if (cleanUsername && allowedRedditUsersSet.has(cleanUsername)) {
        item.setAttribute('data-unishield-processed', 'true');
        continue;
      }

      // Check user blocklist early
      if (cleanUsername && blockedRedditUsersSet.has(cleanUsername)) {
        applyAction(item, username);
        continue;
      }

      // 4. Content and Text Filters
      const text = extractTextContent(item);
      const postTitle = isPost ? (extractPostTitle(item) || text) : '';

      // 4a. Editorialized titles filter
      if (isPost && config.reddit.removeEditorializedTitles !== false && postTitle) {
        if (isEditorializedTitle(postTitle)) {
          applyAction(item, username || 'editorialized-title');
          continue;
        }
      }

      // 4b. Custom muted keywords filter
      if (compiledMutedKeywords.length > 0) {
        if (isPost && postTitle && matchesAnyMutedKeyword(postTitle)) {
          applyAction(item, username || 'muted-keyword-title');
          continue;
        } else if (!isPost && text && matchesAnyMutedKeyword(text)) {
          applyAction(item, username || 'muted-keyword-comment');
          continue;
        }
      }

      // 4c. Toxicity text filters (single check for racism/hate speech + religious discrimination)
      if (text) {
        const defaults = getDefaults();
        const patterns = (defaults && defaults.patterns) || {};

        if (config.reddit.removeRacism !== false && patterns.racism) {
          const isHateSpeech = patterns.racism.some(regex => regex.test(text));
          if (isHateSpeech) {
            applyAction(item, username || 'hate-speech-filter');
            continue;
          }
        }

        if (config.reddit.removeGenderWar !== false && patterns.genderWar) {
          const isGenderWar = patterns.genderWar.some(regex => regex.test(text));
          if (isGenderWar) {
            applyAction(item, username || 'genderwar-filter');
            continue;
          }
        }
      }

      // 5. Bot username detection
      if (username) {
        const detector = getDetector();
        if (config.reddit.detectBotPatterns !== false && detector && detector.isSuspiciousUsername) {
          if (detector.isSuspiciousUsername(username)) {
            applyAction(item, username);
            continue;
          }
        }
      }

      // Item passed all checks: mark as processed to prevent redundant scans
      item.setAttribute('data-unishield-processed', 'true');
    }
  }

  /**
   * Runs a full scan on the body
   */
  function runFullScan() {
    scanElement(document.body);
  }

  /**
   * Handles SPA URL change and triggers progressive scans for streaming content
   */
  function handleUrlChange() {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;

    checkPageSubreddit();

    // Reddit SPA streams content after route changes
    runFullScan();
    setTimeout(runFullScan, 400);
    setTimeout(runFullScan, 1500);
  }

  /**
   * Sets up SPA navigation event listeners (pushState, replaceState, popstate)
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
   * Handles debounced scanning for mutations without dropping mutations across frames.
   */
  function handleMutations(mutations) {
    const storage = getStorage();
    if (storage && !storage.isExtensionValid()) {
      stopObserver();
      return;
    }

    if (window.location.href !== lastUrl) {
      handleUrlChange();
    }

    if (!isExtensionActive()) return;

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (mutation.type === 'childList') {
        const added = mutation.addedNodes;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingTargets.add(node);
          }
        }
      } else if (mutation.type === 'attributes') {
        if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
          mutation.target.removeAttribute('data-unishield-processed');
          pendingTargets.add(mutation.target);
        }
      }
    }

    if (scanPending) return;

    scanPending = true;
    requestAnimationFrame(() => {
      scanPending = false;
      const targetsToProcess = pendingTargets;
      pendingTargets = new Set();

      for (const target of targetsToProcess) {
        if (target.isConnected) {
          scanElement(target);
        }
      }
    });
  }

  /**
   * Starts observing the DOM with support for dynamic additions and attribute hydration
   */
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['author', 'data-author']
    });
  }

  /**
   * Stops the DOM observer
   */
  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  /**
   * Sets up browser message listener safely
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
              updateLookupCaches();
              clearAllModifications();
              if (isExtensionActive()) {
                checkPageSubreddit();
                runFullScan();
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
