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

  /**
   * Evaluates if a quote tweet's commentary is low-effort (vague reaction,
   * single-word affirmation, emoji-only, or cliché algorithmic bait).
   * @param {string} text - The quoter's text commentary
   * @param {Array<RegExp>} customPatterns - Optional list of regex patterns
   * @returns {boolean} True if low effort
   */
  function isLowEffortQuote(text, customPatterns) {
    if (!text || typeof text !== 'string') return true;
    const trimmed = text.trim();
    if (!trimmed) return true;

    // 1. Emoji and punctuation only (no letters or numbers)
    const strippedAlpha = trimmed.replace(/[\p{Emoji}\p{Extended_Pictographic}\p{P}\p{Z}\p{S}\s]+/gu, '');
    if (strippedAlpha.length === 0) {
      return true;
    }

    // 2. Length threshold: Low-effort QRTs are short (<= 80 characters and <= 12 words)
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (trimmed.length > 80 || words.length > 12) {
      return false;
    }

    // 3. Low-effort reaction patterns evaluated against centralized defaults
    const fallbackFromDefaults = window.UniShield && window.UniShield.Defaults && window.UniShield.Defaults.patterns && window.UniShield.Defaults.patterns.lowEffortQuotes;
    const patterns = customPatterns || fallbackFromDefaults || [];
    return patterns.some(rx => rx.test(trimmed));
  }

  /**
   * Evaluates if text matches the "broetry" format:
   * posts formatted with excessive line breaks and paragraphs that are
   * predominantly single sentences (designed to artificially expand vertical dwell time).
   * 
   * @param {string} text - The post text content
   * @param {number} [lineBreaks] - Optional precalculated count of line breaks / <br> tags
   * @returns {boolean} True if post is broetry
   */
  function isBroetry(text, lineBreaks) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    const newlines = (trimmed.match(/\n/g) || []).length;
    const totalLineBreaks = typeof lineBreaks === 'number' ? Math.max(newlines, lineBreaks) : newlines;

    // 1. Excessive vertical line breaks threshold (5 or more breaks)
    if (totalLineBreaks >= 5) {
      return true;
    }

    // 2. Single-sentence paragraph structure analysis
    // Broetry typically breaks text into multiple short paragraphs, each being a single sentence.
    const paragraphs = trimmed
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length >= 3 && totalLineBreaks >= 3) {
      let singleSentenceParagraphs = 0;
      for (const p of paragraphs) {
        const words = p.split(/\s+/).filter(Boolean);
        const sentences = p.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length <= 1 && words.length <= 25) {
          singleSentenceParagraphs++;
        }
      }

      if (singleSentenceParagraphs >= 3 && (singleSentenceParagraphs / paragraphs.length) >= 0.7) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates if text contains low-effort viral engagement bait patterns
   * (e.g. conversational hooks, "is wild", "is insane", "caught in 4k", starts with "Bro", skull emoji spam, "X is when Y").
   * 
   * @param {string} text - The text content
   * @param {Array<RegExp>} [customPatterns] - Optional pattern list
   * @returns {boolean} True if text matches engagement bait patterns
   */
  function isEngagementBait(text, customPatterns) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Evaluated against engagement bait patterns from centralized defaults
    const fallbackFromDefaults = window.UniShield && window.UniShield.Defaults && window.UniShield.Defaults.patterns && window.UniShield.Defaults.patterns.engagementBait;
    const patterns = customPatterns || fallbackFromDefaults || [];
    return patterns.some(rx => rx.test(trimmed));
  }

  return {
    isSuspiciousUsername,
    extractUsernameFromHref,
    extractUsernameFromElement,
    parseCounterText,
    detectRagebait,
    scorePoliticalContent,
    isOverlyPoliticalTweet,
    hasPoliticalContent,
    isLowEffortQuote,
    isBroetry,
    isEngagementBait
  };
})();
