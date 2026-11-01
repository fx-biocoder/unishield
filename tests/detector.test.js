const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createExtensionContext } = require('./helpers');

describe('UniShield.Detector', () => {
  const { ctx } = createExtensionContext();
  const Detector = ctx.UniShield.Detector;

  describe('isSuspiciousUsername (Reddit Auto-Generated Patterns)', () => {
    it('detects hyphen-separated auto-generated username ending in digits', () => {
      assert.strictEqual(Detector.isSuspiciousUsername('Sensitive-Hat-9871'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('No-Understanding-8997'), true);
    });

    it('detects underscore-separated auto-generated usernames ending in digits', () => {
      assert.strictEqual(Detector.isSuspiciousUsername('Lazy_Penguin_77'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('Ok_Ad_1234'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('Substantial_Car_9921'), true);
    });

    it('detects First_LastNumber and First-LastNumber patterns without extra separator before digits', () => {
      assert.strictEqual(Detector.isSuspiciousUsername('No_Hammer480'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('No-Understanding8997'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('Fast_Panda123'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('Blue_Sky42'), true);
    });

    it('detects CamelCase without separator ending in digits', () => {
      assert.strictEqual(Detector.isSuspiciousUsername('KiwiNo3001'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('HappyPanda4423'), true);
      assert.strictEqual(Detector.isSuspiciousUsername('ParticularCat9821'), true);
    });

    it('allows normal human usernames', () => {
      assert.strictEqual(Detector.isSuspiciousUsername('snoo'), false);
      assert.strictEqual(Detector.isSuspiciousUsername('dan_abramov'), false);
      assert.strictEqual(Detector.isSuspiciousUsername('linux_enthusiast'), false);
      assert.strictEqual(Detector.isSuspiciousUsername('coder2024'), false);
      assert.strictEqual(Detector.isSuspiciousUsername(''), false);
      assert.strictEqual(Detector.isSuspiciousUsername(null), false);
    });
  });

  describe('extractUsernameFromHref', () => {
    it('extracts username from /user/ links', () => {
      assert.strictEqual(Detector.extractUsernameFromHref('/user/testuser/'), 'testuser');
      assert.strictEqual(Detector.extractUsernameFromHref('https://reddit.com/user/another_user?tab=posts'), 'another_user');
    });

    it('extracts username from /u/ links', () => {
      assert.strictEqual(Detector.extractUsernameFromHref('/u/short_link'), 'short_link');
    });

    it('returns null for non-user links', () => {
      assert.strictEqual(Detector.extractUsernameFromHref('/r/programming'), null);
      assert.strictEqual(Detector.extractUsernameFromHref(null), null);
    });
  });

  describe('parseCounterText', () => {
    it('parses raw numbers', () => {
      assert.strictEqual(Detector.parseCounterText('42'), 42);
      assert.strictEqual(Detector.parseCounterText('500'), 500);
    });

    it('parses thousands with K suffix', () => {
      assert.strictEqual(Detector.parseCounterText('1.5K'), 1500);
      assert.strictEqual(Detector.parseCounterText('1,5k'), 1500);
      assert.strictEqual(Detector.parseCounterText('10K'), 10000);
    });

    it('parses millions with M suffix', () => {
      assert.strictEqual(Detector.parseCounterText('2M'), 2000000);
      assert.strictEqual(Detector.parseCounterText('1.2m'), 1200000);
    });

    it('returns 0 for empty or invalid inputs', () => {
      assert.strictEqual(Detector.parseCounterText(''), 0);
      assert.strictEqual(Detector.parseCounterText(null), 0);
      assert.strictEqual(Detector.parseCounterText('abc'), 0);
    });
  });

  describe('detectRagebait (Ratio statistical test)', () => {
    it('does not trigger below minInteractions volume', () => {
      const res = Detector.detectRagebait(2, 20, { minInteractions: 50 });
      assert.strictEqual(res.signal, false);
      assert.strictEqual(res.reason, 'Low interaction volume');
    });

    it('triggers signal on heavy comment-to-like imbalance (ragebait ratio)', () => {
      // 5,000 comments vs 100 likes = classic ragebait ratio
      const res = Detector.detectRagebait(100, 5000);
      assert.strictEqual(res.signal, true);
    });

    it('does not trigger signal on healthy positive interaction ratio', () => {
      // 5,000 likes vs 50 comments = healthy post
      const res = Detector.detectRagebait(5000, 50);
      assert.strictEqual(res.signal, false);
    });
  });

  describe('Political Content Detection on X', () => {
    const scoring = ctx.UniShield.Defaults.politicalScoring;

    it('scorePoliticalContent correctly calculates score based on triggers', () => {
      const mildTweet = 'Great new release of the web framework today!';
      assert.strictEqual(Detector.scorePoliticalContent(mildTweet, scoring), 0);

      const polarizingTweet = 'Milei es corrupto y el kirchnerismo es una casta de traidores que arruinan la democracia #WorldWar3';
      const score = Detector.scorePoliticalContent(polarizingTweet, scoring);
      assert.ok(score >= 6, `Expected score >= 6, got ${score}`);
    });

    it('isOverlyPoliticalTweet filters above threshold', () => {
      const polarizingTweet = 'Milei y el kirchnerismo son corruptos traidores que destruyen la democracia #WorldWar3';
      assert.strictEqual(Detector.isOverlyPoliticalTweet(polarizingTweet, 6, scoring), true);
      assert.strictEqual(Detector.isOverlyPoliticalTweet('Just enjoying a nice sunset in the mountains', 6, scoring), false);
    });

    it('hasPoliticalContent checks presence of any political entity (fast check)', () => {
      assert.strictEqual(Detector.hasPoliticalContent('El presidente firmó un nuevo decreto en el Congreso', scoring), true);
      assert.strictEqual(Detector.hasPoliticalContent('Disfrutando de una pizza con amigos', scoring), false);
    });
  });

  describe('Low-Effort Quote Tweet Detection', () => {
    it('detects one-word affirmations and passive agreements', () => {
      assert.strictEqual(Detector.isLowEffortQuote('This.'), true);
      assert.strictEqual(Detector.isLowEffortQuote('this'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Literally this 🙌'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Facts'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Fr fr'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Literal'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Tal cual'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Basado'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Factos.'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Amén 🙏'), true);
    });

    it('detects vague reaction exclamations', () => {
      assert.strictEqual(Detector.isLowEffortQuote('Wild'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Insane'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Sin palabras'), true);
      assert.strictEqual(Detector.isLowEffortQuote('No lo puedo creer'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Qué locura'), true);
      assert.strictEqual(Detector.isLowEffortQuote('El chiste se cuenta solo'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Bro...'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Bruh'), true);
    });

    it('detects cliché viral quote templates', () => {
      assert.strictEqual(Detector.isLowEffortQuote('Bro really said that with a straight face 💀'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Imagine believing this in 2026'), true);
      assert.strictEqual(Detector.isLowEffortQuote('He cooked here'), true);
      assert.strictEqual(Detector.isLowEffortQuote('Es cine 🚬'), true);
      assert.strictEqual(Detector.isLowEffortQuote('caught and exposed in 4k'), true);
      assert.strictEqual(Detector.isLowEffortQuote('caught her in 4k'), true);
    });

    it('detects emoji-only, punctuation-only, or empty reactions', () => {
      assert.strictEqual(Detector.isLowEffortQuote('💀'), true);
      assert.strictEqual(Detector.isLowEffortQuote('💀💀💀'), true);
      assert.strictEqual(Detector.isLowEffortQuote('😭😭😭'), true);
      assert.strictEqual(Detector.isLowEffortQuote('👀'), true);
      assert.strictEqual(Detector.isLowEffortQuote('???'), true);
      assert.strictEqual(Detector.isLowEffortQuote(''), true);
      assert.strictEqual(Detector.isLowEffortQuote('   '), true);
    });

    it('does not flag substantive, thoughtful quote commentary', () => {
      assert.strictEqual(Detector.isLowEffortQuote('A great analysis of the new software architecture and microservices migration.'), false);
      assert.strictEqual(Detector.isLowEffortQuote('No estoy de acuerdo con este hilo porque los datos del Banco Central muestran una caída del 4% en mayo.'), false);
      assert.strictEqual(Detector.isLowEffortQuote('I recommend checking page 12 of the research paper for the actual methodology used.'), false);
    });
  });

  describe('Broetry Detection (Excessive line breaks & single-sentence paragraphs)', () => {
    it('detects posts with excessive line breaks', () => {
      const excessiveBreaks = 'First point\nSecond point\nThird point\nFourth point\nFifth point\nSixth point';
      assert.strictEqual(Detector.isBroetry(excessiveBreaks), true);
      assert.strictEqual(Detector.isBroetry('Short text', 6), true);
    });

    it('detects single-sentence paragraph vertical structures (classic broetry)', () => {
      const broetryText = 'Most founders fail in their first year.\n\nHere is why.\n\nThey do not talk to customers.\n\nThey build what nobody wants.';
      assert.strictEqual(Detector.isBroetry(broetryText), true);
    });

    it('does not flag engagement bait hooks if there are no excessive line breaks', () => {
      // Text hooks belong to engagement bait, NOT broetry
      assert.strictEqual(Detector.isBroetry('True leadership is about serving others before yourself. Agree?'), false);
      assert.strictEqual(Detector.isBroetry('El éxito no es suerte. ¿Qué opinas?'), false);
    });

    it('does not flag normal multiline paragraphs with multiple sentences', () => {
      const normalArticle = 'This is a detailed analysis of renewable energy in South America. It examines wind, solar, and hydroelectric infrastructure across five countries. The data demonstrates significant year-over-year gains in total capacity.\n\nHowever, transmission bottlenecks remain a substantial challenge for grid operators. Further capital investments in high-voltage direct current lines will be required to stabilize distribution.';
      assert.strictEqual(Detector.isBroetry(normalArticle), false);
    });

    it('does not flag viral slang, emojis, or single-line phrases as broetry', () => {
      // Broetry is specifically excessive line breaks and single-sentence paragraphs, NOT slang or emojis
      assert.strictEqual(Detector.isBroetry('Her parents are wild ngl 💀'), false);
      assert.strictEqual(Detector.isBroetry('Bro was caught in 4k'), false);
      assert.strictEqual(Detector.isBroetry('This is insane'), false);
      assert.strictEqual(Detector.isBroetry('No way 💀💀💀'), false);
    });
  });

  describe('Viral Engagement Bait Detection', () => {
    it('detects conversational question hooks and thread starters', () => {
      assert.strictEqual(Detector.isEngagementBait('True leadership is about serving others. Agree?'), true);
      assert.strictEqual(Detector.isEngagementBait('El éxito no es suerte. ¿Qué opinas?'), true);
      assert.strictEqual(Detector.isEngagementBait('Abro hilo sobre lo que pasó ayer 🧵'), true);
      assert.strictEqual(Detector.isEngagementBait('Here is what happened: A breakdown'), true);
      assert.strictEqual(Detector.isEngagementBait('Aquí te cuento la verdad'), true);
    });

    it('detects wild and insane viral hooks', () => {
      assert.strictEqual(Detector.isEngagementBait('This situation is wild'), true);
      assert.strictEqual(Detector.isEngagementBait('Her parents are wild ngl'), true);
      assert.strictEqual(Detector.isEngagementBait('This is insane'), true);
      assert.strictEqual(Detector.isEngagementBait('They are insane for doing that'), true);
    });

    it('detects tweets starting with Bro', () => {
      assert.strictEqual(Detector.isEngagementBait('Bro really thought he could win'), true);
      assert.strictEqual(Detector.isEngagementBait('"Bro is not serious"'), true);
    });

    it('detects caught in 4k variants', () => {
      assert.strictEqual(Detector.isEngagementBait('He was caught in 4k during the stream'), true);
      assert.strictEqual(Detector.isEngagementBait('caught and exposed in 4k'), true);
      assert.strictEqual(Detector.isEngagementBait('caught her in 4k'), true);
    });

    it('detects skull emoji presence in text', () => {
      assert.strictEqual(Detector.isEngagementBait('Literally me 💀'), true);
      assert.strictEqual(Detector.isEngagementBait('I am dying ☠️'), true);
    });

    it('does not flag normal non-bait text', () => {
      assert.strictEqual(Detector.isEngagementBait('A fascinating documentary about wildlife in Patagonia'), false);
      assert.strictEqual(Detector.isEngagementBait('Meeting scheduled for 3pm in the conference room'), false);
    });
  });
});
