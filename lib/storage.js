(function() {
  'use strict';

  window.UniShield = window.UniShield || {};
  const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {});

  let cachedConfig = null;
  let pendingStatsFlushTimer = null;
  let pendingStatsDeltas = {
    totalHidden: 0,
    sessionHidden: 0,
    redditHidden: 0,
    xHidden: 0,
    linkedinHidden: 0
  };

  const DEFAULT_CONFIG = {
    global: {
      enabled: true,
      stats: {
        totalHidden: 0,
        sessionHidden: 0,
        redditHidden: 0,
        xHidden: 0,
        linkedinHidden: 0
      }
    },
    reddit: {
      enabled: true,
      mode: 'hide',
      detectBotPatterns: true,
      removePromoted: true,
      removeRacism: true,
      removeGenderWar: true,
      removeEditorializedTitles: true,
      subredditBlocklist: [],
      allowlist: [],
      userBlocklist: [],
      mutedKeywords: []
    },
    x: {
      enabled: true,
      removeBlueCheckmark: false,
      removeGreyCheckmark: false,
      removeGoldCheckmark: false,
      removePromoted: true,
      removeAITweets: true,
      removeCryptoScams: true,
      removeBroetryPosts: true,
      removeOverlyPolitical: false,
      politicalStrictness: 0,
      removeRagebait: false,
      removePoliticalRagebait: false,
      removeRacism: true,
      removeGenderWar: true,
      userBlocklist: [],
      allowlist: [],
      mutedKeywords: []
    },
    linkedin: {
      enabled: true,
      removePromotedPosts: true,
      removeSuggestedPosts: true,
      removeByInteractions: true,
      removeAIPosts: true,
      removeBroetryPosts: true,
      removePostsWithEmojis: false,
      removePromotedJobs: true,
      jobAgeAlerts: true,
      jobRedFlags: true,
      detectFakeProfiles: true,
      enableProfileNotes: true,
      mutedWords: [],
      mutedCompanies: []
    }
  };

  /**
   * Safely checks if extension runtime context is still valid.
   * Prevents "Extension context invalidated" errors when extension reloads.
   * @returns {boolean}
   */
  function isExtensionValid() {
    try {
      return Boolean(
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        Boolean(chrome.runtime.id) &&
        chrome.storage &&
        Boolean(chrome.storage.local)
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Deep merges target with source.
   */
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    const output = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        output[key] = source[key];
      }
    }
    return output;
  }

  /**
   * Migrate legacy single-platform config format if detected.
   */
  function migrateLegacyConfig(stored) {
    if (!stored) return DEFAULT_CONFIG;
    if (stored.global || stored.reddit || stored.x) {
      return deepMerge(DEFAULT_CONFIG, stored);
    }

    const migrated = {
      global: {
        enabled: stored.enabled !== undefined ? stored.enabled : true,
        stats: {
          totalHidden: stored.stats && stored.stats.totalBlocked ? stored.stats.totalBlocked : 0,
          sessionHidden: 0,
          redditHidden: stored.stats && stored.stats.totalBlocked ? stored.stats.totalBlocked : 0,
          xHidden: 0
        }
      },
      reddit: {
        enabled: stored.enabled !== undefined ? stored.enabled : true,
        mode: stored.mode || 'hide',
        detectBotPatterns: stored.patternDetection !== undefined ? stored.patternDetection : true,
        removePromoted: true,
        removeRacism: true,
        removeGenderWar: true,
        removeEditorializedTitles: stored.removeEditorializedTitles !== undefined ? stored.removeEditorializedTitles : true,
        subredditBlocklist: Array.isArray(stored.subredditBlocklist) ? stored.subredditBlocklist : DEFAULT_CONFIG.reddit.subredditBlocklist,
        allowlist: Array.isArray(stored.allowlist) ? stored.allowlist : [],
        userBlocklist: Array.isArray(stored.blocklist) ? stored.blocklist : (Array.isArray(stored.userBlocklist) ? stored.userBlocklist : []),
        mutedKeywords: Array.isArray(stored.mutedKeywords) ? stored.mutedKeywords : []
      },
      x: { ...DEFAULT_CONFIG.x }
    };

    return migrated;
  }

  /**
   * Retrieves the full configuration merged with defaults.
   * Completely resilient against "Extension context invalidated".
   * @returns {Promise<Object>}
   */
  function getConfig() {
    return new Promise((resolve) => {
      try {
        if (!isExtensionValid()) {
          resolve(cachedConfig || DEFAULT_CONFIG);
          return;
        }

        browserAPI.storage.local.get(['config'], (result) => {
          try {
            if (browserAPI.runtime && browserAPI.runtime.lastError) {
              resolve(cachedConfig || DEFAULT_CONFIG);
              return;
            }
            const raw = result ? result.config : null;
            const migrated = migrateLegacyConfig(raw);
            cachedConfig = migrated;
            resolve(migrated);
          } catch (err) {
            resolve(cachedConfig || DEFAULT_CONFIG);
          }
        });
      } catch (e) {
        // Fallback gracefully on invalidated context
        resolve(cachedConfig || DEFAULT_CONFIG);
      }
    });
  }

  /**
   * Updates partial configuration.
   * @param {Object} partial
   * @returns {Promise<Object>}
   */
  async function setConfig(partial) {
    try {
      if (!isExtensionValid()) {
        return cachedConfig || DEFAULT_CONFIG;
      }

      const current = await getConfig();
      const updated = deepMerge(current, partial);
      cachedConfig = updated;

      return new Promise((resolve) => {
        try {
          if (!isExtensionValid()) {
            resolve(updated);
            return;
          }
          browserAPI.storage.local.set({ config: updated }, () => {
            if (browserAPI.runtime && browserAPI.runtime.lastError) {
              resolve(updated);
              return;
            }
            resolve(updated);
          });
        } catch (err) {
          resolve(updated);
        }
      });
    } catch (e) {
      return cachedConfig || DEFAULT_CONFIG;
    }
  }

  /**
   * Clean subreddit name helper
   * Handles 'r/name', '/r/name/', full URLs, permalinks, and trailing slashes.
   */
  function cleanSubredditName(name) {
    if (!name || typeof name !== 'string') return '';
    let str = name.trim().toLowerCase();
    const urlMatch = str.match(/\/r\/([a-z0-9_]+)/i);
    if (urlMatch) return urlMatch[1].toLowerCase();
    return str
      .replace(/^https?:\/\/[^\/]+/i, '')
      .replace(/^\/?r\//i, '')
      .replace(/\/+$/, '')
      .split('/')[0]
      .trim();
  }

  /**
   * Check if a subreddit is blocklisted.
   * Checks both stored custom list and built-in defaults.
   */
  async function isSubredditBlocklisted(subreddit) {
    try {
      const clean = cleanSubredditName(subreddit);
      if (!clean) return false;
      const config = await getConfig();
      const list = (config.reddit && config.reddit.subredditBlocklist) || [];
      return list.some(s => cleanSubredditName(s) === clean);
    } catch (e) {
      return false;
    }
  }

  /**
   * Add subreddit to Reddit blocklist
   */
  async function addToSubredditBlocklist(subreddit) {
    try {
      const clean = cleanSubredditName(subreddit);
      if (!clean) return;
      const config = await getConfig();
      const list = (config.reddit && config.reddit.subredditBlocklist) || [];
      if (!list.some(s => cleanSubredditName(s) === clean)) {
        await setConfig({
          reddit: {
            ...config.reddit,
            subredditBlocklist: [...list, clean]
          }
        });
      }
    } catch (e) {}
  }

  /**
   * Remove subreddit from Reddit blocklist
   */
  async function removeFromSubredditBlocklist(subreddit) {
    try {
      const clean = cleanSubredditName(subreddit);
      if (!clean) return;
      const config = await getConfig();
      const list = (config.reddit && config.reddit.subredditBlocklist) || [];
      const updated = list.filter(s => cleanSubredditName(s) !== clean);
      await setConfig({
        reddit: {
          ...config.reddit,
          subredditBlocklist: updated
        }
      });
    } catch (e) {}
  }

  /**
   * Check if user is allowlisted in Reddit
   */
  async function isRedditUserAllowlisted(username) {
    try {
      if (!username) return false;
      const config = await getConfig();
      const clean = username.replace(/^\/?u(?:ser)?\//i, '').trim().toLowerCase();
      return ((config.reddit && config.reddit.allowlist) || []).some(
        u => u.replace(/^\/?u(?:ser)?\//i, '').trim().toLowerCase() === clean
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Add user to Reddit allowlist
   */
  async function addToRedditAllowlist(username) {
    try {
      if (!username) return;
      const config = await getConfig();
      const clean = username.replace(/^\/?u(?:ser)?\//i, '').trim();
      const list = (config.reddit && config.reddit.allowlist) || [];
      if (!list.some(u => u.toLowerCase() === clean.toLowerCase())) {
        await setConfig({
          reddit: {
            ...config.reddit,
            allowlist: [...list, clean]
          }
        });
      }
    } catch (e) {}
  }

  /**
   * Check if user is blocklisted in Reddit
   */
  async function isRedditUserBlocklisted(username) {
    try {
      if (!username) return false;
      const config = await getConfig();
      const clean = username.replace(/^\/?u(?:ser)?\//i, '').trim().toLowerCase();
      return ((config.reddit && config.reddit.userBlocklist) || []).some(
        u => u.replace(/^\/?u(?:ser)?\//i, '').trim().toLowerCase() === clean
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Add user to Reddit blocklist
   */
  async function addToRedditBlocklist(username) {
    try {
      if (!username) return;
      const config = await getConfig();
      const clean = username.replace(/^u\//i, '').trim();
      const list = (config.reddit && config.reddit.userBlocklist) || [];
      if (!list.some(u => u.toLowerCase() === clean.toLowerCase())) {
        await setConfig({
          reddit: {
            ...config.reddit,
            userBlocklist: [...list, clean]
          }
        });
      }
    } catch (e) {}
  }

  /**
   * Check if user is allowlisted in X
   */
  async function isXUserAllowlisted(username) {
    try {
      if (!username) return false;
      const config = await getConfig();
      const clean = username.replace(/^@/i, '').toLowerCase();
      return ((config.x && config.x.allowlist) || []).some(u => u.replace(/^@/i, '').toLowerCase() === clean);
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if user is blocklisted in X
   */
  async function isXUserBlocklisted(username) {
    try {
      if (!username) return false;
      const config = await getConfig();
      const clean = username.replace(/^@/i, '').toLowerCase();
      return ((config.x && config.x.userBlocklist) || []).some(u => u.replace(/^@/i, '').toLowerCase() === clean);
    } catch (e) {
      return false;
    }
  }

  /**
   * Flushes batched stat increments to storage safely.
   */
  async function flushPendingStats() {
    if (!isExtensionValid()) {
      pendingStatsDeltas = { totalHidden: 0, sessionHidden: 0, redditHidden: 0, xHidden: 0, linkedinHidden: 0 };
      return;
    }

    const deltas = { ...pendingStatsDeltas };
    pendingStatsDeltas = { totalHidden: 0, sessionHidden: 0, redditHidden: 0, xHidden: 0, linkedinHidden: 0 };

    if (deltas.totalHidden === 0) return;

    try {
      const config = await getConfig();
      const stats = (config.global && config.global.stats) || {
        totalHidden: 0,
        sessionHidden: 0,
        redditHidden: 0,
        xHidden: 0,
        linkedinHidden: 0
      };

      stats.totalHidden = (stats.totalHidden || 0) + deltas.totalHidden;
      stats.sessionHidden = (stats.sessionHidden || 0) + deltas.sessionHidden;
      stats.redditHidden = (stats.redditHidden || 0) + deltas.redditHidden;
      stats.xHidden = (stats.xHidden || 0) + deltas.xHidden;
      stats.linkedinHidden = (stats.linkedinHidden || 0) + deltas.linkedinHidden;

      await setConfig({ global: { stats } });
    } catch (e) {
      // Silently discard if extension context was invalidated
    }
  }

  /**
   * Debounced & safe increment of hidden count stat.
   * Prevents excessive writes and uncaught promise rejections on context invalidation.
   * @param {'reddit'|'x'|'linkedin'} platform
   */
  async function incrementHidden(platform) {
    pendingStatsDeltas.totalHidden++;
    pendingStatsDeltas.sessionHidden++;
    if (platform === 'reddit') {
      pendingStatsDeltas.redditHidden++;
    } else if (platform === 'x') {
      pendingStatsDeltas.xHidden++;
    } else if (platform === 'linkedin') {
      pendingStatsDeltas.linkedinHidden++;
    }

    if (pendingStatsFlushTimer) {
      clearTimeout(pendingStatsFlushTimer);
    }

    pendingStatsFlushTimer = setTimeout(() => {
      flushPendingStats().catch(() => {});
    }, 400);
  }

  window.UniShield.Storage = {
    DEFAULT_CONFIG,
    isExtensionValid,
    getConfig,
    setConfig,
    cleanSubredditName,
    isSubredditBlocklisted,
    addToSubredditBlocklist,
    removeFromSubredditBlocklist,
    isRedditUserAllowlisted,
    addToRedditAllowlist,
    isRedditUserBlocklisted,
    addToRedditBlocklist,
    isXUserAllowlisted,
    isXUserBlocklisted,
    incrementHidden
  };
})();
