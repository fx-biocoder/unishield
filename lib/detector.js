window.UniShield = window.UniShield || {};

/**
 * Detector module for identifying suspicious Reddit accounts.
 */
window.UniShield.Detector = (function() {
  /**
   * Tests if a username matches the auto-generated Reddit username pattern.
   * Reddit auto-generates usernames using combinations like:
   * 1. Separated by hyphens/underscores: e.g. No-Understanding8997, No-Understanding-8997, Sensitive-Hat-9871, Lazy_Penguin_77, Ok_Ad_1234
   * 2. CamelCase/PascalCase without separator: e.g. KiwiNo3001, HappyPanda4423, ParticularCat9821
   * 3. CamelCase with separator before number: e.g. KiwiNo-3001, HappyPanda_4423
   * 
   * @param {string} username - The username to test
   * @returns {boolean} True if suspicious
   */
  function isSuspiciousUsername(username) {
    if (!username || typeof username !== 'string') return false;
    
    const trimmed = username.trim();

    // Pattern 1: 2 or more words separated by hyphens or underscores, ending with 2-5 digits
    // e.g. No-Understanding8997, No-Understanding-8997, Sensitive-Hat-9871, Lazy_Penguin_77, Ok_Ad_1234
    if (/^[a-zA-Z]+([-_][a-zA-Z]+)+[-_]?\d{2,5}$/.test(trimmed)) {
      return true;
    }

    // Pattern 2: 2 or more CamelCase/PascalCase words without separator (or with separator before digits), ending with 2-5 digits
    // e.g. KiwiNo3001, HappyPanda4423, ParticularCat9821, KiwiNo-3001, HappyPanda_4423
    if (/^([A-Z][a-z]+){2,}[-_]?\d{2,5}$/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Extracts username from a Reddit user profile URL path.
   * @param {string} href - The href string
   * @returns {string|null} Extracted username or null
   */
  function extractUsernameFromHref(href) {
    if (!href) return null;
    const match = href.match(/\/(?:user|u)\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  /**
   * Finds the first user link in an element and extracts the username.
   * @param {HTMLElement} element - The DOM element to search
   * @returns {string|null} Extracted username or null
   */
  function extractUsernameFromElement(element) {
    if (!element) return null;
    const link = element.querySelector('a[href^="/user/"], a[href^="/u/"], a[href*="/user/"], a[href*="/u/"], a.author, [data-testid="comment_author_link"]');
    if (!link) return null;
    
    const href = link.getAttribute('href') || link.href;
    return extractUsernameFromHref(href);
  }

  /**
   * General purpose function to parse a count string with K or M suffixes.
   * Handles "1.5K", "1,5K", "2M", "500", etc.
   * @param {string} text - Number string
   * @returns {number} Numeric count
   */
  function parseCounterText(text) {
    if (!text || typeof text !== 'string') return 0;
    const cleaned = text.trim().replace(/,/g, '.');
    let multiplier = 1;
    if (/[kK]$/.test(cleaned)) {
      multiplier = 1000;
    } else if (/[mM]$/.test(cleaned)) {
      multiplier = 1000000;
    }
    const num = parseFloat(cleaned.replace(/[kKmM]/g, ''));
    return isNaN(num) ? 0 : num * multiplier;
  }

  /**
   * Performs statistical analysis based on likes and comments to detect potential ragebait.
   * Uses Bayesian smoothed ratio, sample size weighting, and standard deviation z-score.
   * 
   * @param {number|string} unparsedLikeCount - Likes count (number or text)
   * @param {number|string} unparsedCommentCount - Comments count (number or text)
   * @param {object} config - Configuration options
   * @returns {object} Results of the statistical analysis
   */
  function detectRagebait(unparsedLikeCount, unparsedCommentCount, config = {}) {
    const {
      minInteractions = 50,     // Minimum interaction threshold
      alpha = 10,               // Comment smoothing constant
      beta = 10,                // Like smoothing constant
      k = 100,                  // Confidence growth scale
      baselineRatio = 0.2,      // Historical average comments/likes ratio
      zThreshold = 2            // Z-score threshold
    } = config;

    const likes = typeof unparsedLikeCount === 'number' ? unparsedLikeCount : parseCounterText(String(unparsedLikeCount || ''));
    const comments = typeof unparsedCommentCount === 'number' ? unparsedCommentCount : parseCounterText(String(unparsedCommentCount || ''));

    const total = likes + comments;

    // Minimum volume filter
    if (total < minInteractions) {
      return {
        signal: false,
        confidence: 0,
        reason: "Low interaction volume",
        metrics: { likes, comments, total }
      };
    }

    // Smoothed ratio
    const smoothedRatio = (comments + alpha) / (likes + beta);

    // Proportion over total interactions
    const p = comments / total;

    // Sample size weighting: 1 - exp(-total / k)
    const weight = 1 - Math.exp(-total / k);
    const weightedRatio = smoothedRatio * weight;

    // Simple z-score against baseline (Binomial standard deviation approximation)
    const std = Math.sqrt((baselineRatio * (1 - baselineRatio)) / total);
    const z = (p - baselineRatio) / (std || 0.001);

    const isRagebait = weightedRatio >= 1 || z > zThreshold;

    return {
      signal: isRagebait,
      confidence: Math.min(1, weight),
      metrics: {
        likes,
        comments,
        total,
        smoothedRatio,
        weightedRatio,
        proportion: p,
        zScore: z
      }
    };
  }

  /**
   * Evaluates a piece of text and scores its political and rage provocation level.
   * @param {string} text - The tweet or comment text
   * @param {object} lists - Pattern lists (entities, rageTerms, engagementTriggers, intensitySignals, rageHashtags)
   * @returns {number} Political score
   */
  function scorePoliticalContent(text, lists) {
    if (!text || typeof text !== 'string') return 0;
    const l = lists || (window.UniShield && window.UniShield.Defaults && window.UniShield.Defaults.politicalScoring) || {};
    let score = 0;

    const entities = l.entities || [];
    const rage = l.rageTerms || [];
    const triggers = l.engagementTriggers || [];
    const intensity = l.intensitySignals || [];
    const hashtags = l.rageHashtags || [];

    entities.forEach(r => { if (r.test(text)) score += 2; });
    rage.forEach(r => { if (r.test(text)) score += 3; });
    triggers.forEach(r => { if (r.test(text)) score += 3; });
    intensity.forEach(r => { if (r.test(text)) score += 1; });
    hashtags.forEach(r => { if (r.test(text)) score += 4; });

    return score;
  }

  /**
   * Determines if a tweet exceeds the threshold for overly political/sensationalist content.
   * @param {string} text - The text content of a tweet
   * @param {number} threshold - Score threshold that triggers hiding (default: 6)
   * @param {object} lists - Optional scoring lists
   * @returns {boolean} True if tweet should be filtered
   */
  function isOverlyPoliticalTweet(text, threshold = 6, lists) {
    return scorePoliticalContent(text, lists) >= threshold;
  }

  /**
   * Fast check for presence of political entities or general political keywords (no score calculation needed).
   * @param {string} text - The tweet or comment text
   * @param {object} lists - Pattern lists (entities, generalPolitical)
   * @returns {boolean} True if any political entity or keyword is detected
   */
  function hasPoliticalContent(text, lists) {
    if (!text || typeof text !== 'string') return false;
    const l = lists || (window.UniShield && window.UniShield.Defaults && window.UniShield.Defaults.politicalScoring) || {};
    const entities = l.entities || [];
    const generalPolitical = l.generalPolitical || [];

    for (let i = 0; i < entities.length; i++) {
      if (entities[i].test(text)) return true;
    }
    for (let i = 0; i < generalPolitical.length; i++) {
      if (generalPolitical[i].test(text)) return true;
    }
    return false;
  }

  return {
    isSuspiciousUsername,
    extractUsernameFromHref,
    extractUsernameFromElement,
    parseCounterText,
    detectRagebait,
    scorePoliticalContent,
    isOverlyPoliticalTweet,
    hasPoliticalContent
  };
})();
