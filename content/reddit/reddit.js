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
  let spaListenersInitialized = false;

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
   * Checks if current page is a blocked subreddit and suppresses feed
   */
  async function checkPageSubreddit() {
    if (!isExtensionActive()) return;
    const pageSub = getCurrentPageSubreddit();
    const storage = getStorage();
    if (pageSub && storage) {
      const isBlocked = await storage.isSubredditBlocklisted(pageSub);
      if (isBlocked) {
        document.body.classList.add('unishield-blocked-subreddit-page');
      } else {
        document.body.classList.remove('unishield-blocked-subreddit-page');
      }
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

    const isEnabled = config && config.global && config.global.enabled !== false && config.reddit && config.reddit.enabled !== false;
    if (isEnabled) {
      await checkPageSubreddit();
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
   * Helper to extract visible text from Reddit post or comment
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
      textNodes.forEach(node => {
        text += (node.textContent || '') + ' ';
      });
    } else {
      text += (element.textContent || '') + ' ';
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
   *    Example: "Flávio Bolsonaro habría entrado... No se sabe dónde está. Eleonora Cole describe... Como siempre Milei..."
   * 2. Excessive Title Case / Capitalized Words pattern
   *    Example: "This Post Has To Be Blocked As Well"
   */
  function isEditorializedTitle(title) {
    if (!title || typeof title !== 'string') return false;
    let text = title.trim();
    if (text.length < 15) return false;

    // Pattern 1: Excessive Title Case / Capitalized words (tolerating occasional lowercase words)
    // e.g. "This Post Has To Be Blocked As Well"
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
   * Helper to extract subreddit name from a post or comment element
   */
  function extractSubreddit(element) {
    if (!element) return null;

    const storage = getStorage();
    const cleanFn = (storage && storage.cleanSubredditName) ||
      function(n) { return n ? n.replace(/^\/?r\//i, '').replace(/\/+$/, '').toLowerCase().trim() : ''; };

    // 1. Direct attributes on element
    const attrNames = [
      'subreddit-prefixed-name',
      'subreddit-name',
      'subreddit',
      'data-subreddit-name',
      'data-subreddit',
      'data-context-subreddit',
      'data-subreddit-prefixed-name'
    ];

    for (const attr of attrNames) {
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

    // 2. Permalink / URL attributes
    const urlAttrs = ['permalink', 'data-permalink', 'post-url', 'content-href', 'href'];
    for (const attr of urlAttrs) {
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

    // 3. Child links inside element
    if (element.querySelector) {
      const targetLinks = element.querySelectorAll(
        'a[slot="subreddit-name"], a[data-testid="subreddit-name"], a.subreddit-name, a[data-click-id="subreddit"], a[href*="/r/"]'
      );

      for (const a of targetLinks) {
        const href = a.getAttribute('href') || a.href || '';
        const match = href.match(/\/r\/([a-zA-Z0-9_]+)/i);
        if (match) {
          const clean = match[1].toLowerCase();
          if (clean && !['all', 'popular', 'mod', 'friends', 'user', 'u'].includes(clean)) {
            return clean;
          }
        }
      }
    }

    // 4. Closest parent container
    const parent = element.closest ? element.closest('shreddit-post, [data-subreddit], article') : null;
    if (parent && parent !== element) {
      const parentSub = extractSubreddit(parent);
      if (parentSub) return parentSub;
    }

    // 5. If currently on a subreddit page
    const pageSub = getCurrentPageSubreddit();
    if (pageSub) {
      return pageSub;
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
   * Scans a specific element and its subtree for posts/comments
   */
  async function scanElement(container) {
    if (!isExtensionActive() || !container) return;

    const items = [];

    if (container.querySelectorAll) {
      items.push(...Array.from(container.querySelectorAll(selectors.posts)));
      items.push(...Array.from(container.querySelectorAll(selectors.comments)));
    }

    if (container.matches && (container.matches(selectors.posts) || container.matches(selectors.comments))) {
      items.push(container);
    }

    if (container.shadowRoot && container.shadowRoot.querySelectorAll) {
      items.push(...Array.from(container.shadowRoot.querySelectorAll(selectors.posts)));
      items.push(...Array.from(container.shadowRoot.querySelectorAll(selectors.comments)));
    }

    for (const item of items) {
      // Skip if already hidden
      if (item.classList.contains('unishield-hidden') ||
          item.classList.contains('unishield-sub-hidden') ||
          item.classList.contains('unishield-promoted-hidden')) {
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

      // 2. Subreddit blocklist filter (checks both posts and comments)
      const subredditName = extractSubreddit(item);
      const storage = getStorage();
      if (subredditName && storage) {
        const isSubBlocked = await storage.isSubredditBlocklisted(subredditName);
        if (isSubBlocked) {
          item.classList.add('unishield-sub-hidden');
          const parentArticle = item.closest ? item.closest('article') : null;
          if (parentArticle && parentArticle !== item) {
            parentArticle.classList.add('unishield-sub-hidden');
          }
          item.setAttribute('data-unishield-processed', 'true');
          pageStats.blocked++;
          if (storage) {
            storage.incrementHidden('reddit').catch(() => {});
          }
          continue;
        }
      }

      // 3. User extraction
      let username = null;
      const tagName = item.tagName ? item.tagName.toLowerCase() : '';

      // Direct attributes on custom element
      if (tagName === 'shreddit-post' || tagName === 'shreddit-comment') {
        username = item.getAttribute('author');
      }

      if (!username && item.getAttribute) {
        username = item.getAttribute('data-author') || item.getAttribute('author');
      }

      // Check author links in light DOM
      if (!username && item.querySelectorAll) {
        const links = item.querySelectorAll(selectors.authorLinks);
        for (const link of links) {
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
        for (const link of shadowLinks) {
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

      // 4. Content and Text Filters: Editorialized titles, Muted keywords, Racism, and Gender-War
      const text = extractTextContent(item);
      const postTitle = isPost ? (extractPostTitle(item) || text) : '';

      // 4a. Editorialized titles filter (Call centers / political troll farm pattern: 2 to 4 sentences)
      if (isPost && config.reddit.removeEditorializedTitles !== false && postTitle) {
        if (isEditorializedTitle(postTitle)) {
          applyAction(item, username || 'editorialized-title');
          continue;
        }
      }

      // 4b. Custom muted keywords filter (post titles and comment body, tolerant to case and special characters)
      const mutedKeywords = (config.reddit && config.reddit.mutedKeywords) || [];
      if (mutedKeywords.length > 0) {
        if (isPost && postTitle) {
          const hasMutedInTitle = mutedKeywords.some(kw => matchesKeyword(postTitle, kw));
          if (hasMutedInTitle) {
            applyAction(item, username || 'muted-keyword-title');
            continue;
          }
        } else if (!isPost && text) {
          // Comment
          const hasMutedInComment = mutedKeywords.some(kw => matchesKeyword(text, kw));
          if (hasMutedInComment) {
            applyAction(item, username || 'muted-keyword-comment');
            continue;
          }
        }
      }

      // 4c. Racism and Gender-War toxicity text filters
      if (text) {
        const defaults = getDefaults();
        const patterns = (defaults && defaults.patterns) || {};

        if (config.reddit.removeRacism !== false && patterns.racism) {
          const isRacist = patterns.racism.some(regex => regex.test(text));
          if (isRacist) {
            applyAction(item, username || 'racism-filter');
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

      if (item.hasAttribute('data-unishield-processed')) continue;

      if (username) {
        let isAllowlisted = false;
        let isBlocklisted = false;
        let isSuspicious = false;

        const curStorage = getStorage();
        if (curStorage) {
          isAllowlisted = await curStorage.isRedditUserAllowlisted(username);
          isBlocklisted = await curStorage.isRedditUserBlocklisted(username);
        }

        // If whitelisted, NEVER block
        if (isAllowlisted) {
          item.setAttribute('data-unishield-processed', 'true');
          continue;
        }

        const detector = getDetector();
        if (isBlocklisted) {
          isSuspicious = true;
        } else if (config.reddit.detectBotPatterns !== false && detector && detector.isSuspiciousUsername) {
          isSuspicious = detector.isSuspiciousUsername(username);
        }

        if (isSuspicious) {
          applyAction(item, username);
        } else {
          item.setAttribute('data-unishield-processed', 'true');
        }
      }
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

    // Reddit SPA streams content after route changes.
    // Staggered scans ensure late-hydrating comments and elements are fully covered.
    runFullScan();
    setTimeout(runFullScan, 200);
    setTimeout(runFullScan, 600);
    setTimeout(runFullScan, 1200);
    setTimeout(runFullScan, 2500);
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
   * Handles debounced scanning for mutations.
   * Auto-disconnects if extension context is invalidated.
   */
  function handleMutations(mutations) {
    const storage = getStorage();
    if (storage && !storage.isExtensionValid()) {
      stopObserver();
      return;
    }

    // Fallback detection for client-side SPA navigation if history methods were bypassed
    if (window.location.href !== lastUrl) {
      handleUrlChange();
    }

    if (scanPending || !isExtensionActive()) return;

    scanPending = true;
    requestAnimationFrame(() => {
      scanPending = false;
      const targets = new Set();

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              targets.add(node);
            }
          }
        } else if (mutation.type === 'attributes') {
          if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
            // Re-evaluate element if author attribute was added or changed by hydration
            mutation.target.removeAttribute('data-unishield-processed');
            targets.add(mutation.target);
          }
        }
      }

      for (const target of targets) {
        scanElement(target);
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
              clearAllModifications();
              if (isExtensionActive()) {
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
