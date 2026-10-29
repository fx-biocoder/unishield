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
});
