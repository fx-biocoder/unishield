const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { extractFunction } = require('./helpers');

describe('Reddit Content Filtering Logic', () => {
  const redditJsPath = path.resolve(__dirname, '..', 'content', 'reddit', 'reddit.js');
  const normalizeText = extractFunction(redditJsPath, 'normalizeText');
  const isEditorializedTitle = extractFunction(redditJsPath, 'isEditorializedTitle');
  const matchesKeyword = extractFunction(redditJsPath, 'matchesKeyword', { normalizeText });

  describe('isEditorializedTitle', () => {
    describe('Pattern 1: Title Case / Capitalized words', () => {
      it('blocks titles where all words are capitalized', () => {
        assert.strictEqual(isEditorializedTitle('This Post Has To Be Blocked As Well'), true);
        assert.strictEqual(isEditorializedTitle('Breaking News About Something That Happened Today'), true);
      });

      it('blocks titles with occasional lowercase prepositions/articles', () => {
        assert.strictEqual(isEditorializedTitle('Why Are People Still Doing this Kind of Thing Today?'), true);
        assert.strictEqual(isEditorializedTitle('New Discovery In Ancient Egypt May Change History Forever'), true);
      });

      it('tolerates normal sentence case titles', () => {
        assert.strictEqual(isEditorializedTitle('This is a normal title with typical capitalization'), false);
        assert.strictEqual(isEditorializedTitle('NASA announces a new telescope mission to study exoplanets'), false);
      });

      it('does not trigger on very short titles (< 5 words or < 15 chars)', () => {
        assert.strictEqual(isEditorializedTitle('Short Title'), false);
        assert.strictEqual(isEditorializedTitle('Three Words Here'), false);
        assert.strictEqual(isEditorializedTitle('Only Four Capitalized Words'), false);
      });
    });

    describe('Pattern 2: Multi-sentence editorialized troll farm titles (2-4 sentences)', () => {
      it('blocks 2, 3, or 4 sentence political farm titles', () => {
        const title4 = 'Flávio Bolsonaro habría entrado caminando a la Argentina, con documentos, entre las 21 y las 22. No se sabe dónde está. Eleonora Cole describe cómo habría sido el mecanismo. Como siempre Milei complice de delincuentes investigados.';
        assert.strictEqual(isEditorializedTitle(title4), true);

        const title2 = 'El ministro anunció una medida controversial ayer por la tarde. Varios analistas aseguran que aumentará la inflación de inmediato.';
        assert.strictEqual(isEditorializedTitle(title2), true);

        const title3 = 'Primera frase con sentido completo. Segunda oración que aporta contexto. Tercera conclusión sensacionalista.';
        assert.strictEqual(isEditorializedTitle(title3), true);
      });

      it('does not split on protected abbreviations or numbers', () => {
        const withAbbr = 'El Dr. Gómez presentó su nuevo libro en EE.UU. a las 21.00 hs.';
        assert.strictEqual(isEditorializedTitle(withAbbr), false);
      });

      it('allows single-sentence long titles', () => {
        const singleSentence = 'Investigadores de la universidad desarrollan un nuevo método para reciclar plástico con bacterias en solo tres días.';
        assert.strictEqual(isEditorializedTitle(singleSentence), false);
      });

      it('rejects empty or non-string titles', () => {
        assert.strictEqual(isEditorializedTitle(''), false);
        assert.strictEqual(isEditorializedTitle(null), false);
        assert.strictEqual(isEditorializedTitle(undefined), false);
      });
    });
  });

  describe('normalizeText', () => {
    it('lowercases and removes accents/diacritics', () => {
      assert.strictEqual(normalizeText('Campaña Política'), 'campana politica');
      assert.strictEqual(normalizeText('ÚLTIMA HORA'), 'ultima hora');
      assert.strictEqual(normalizeText('São Paulo'), 'sao paulo');
    });

    it('handles empty inputs safely', () => {
      assert.strictEqual(normalizeText(''), '');
      assert.strictEqual(normalizeText(null), '');
    });
  });

  describe('matchesKeyword', () => {
    it('matches whole words and phrases ignoring case and diacritics', () => {
      assert.strictEqual(matchesKeyword('Gran oferta de drop shipping aquí', 'drop shipping'), true);
      assert.strictEqual(matchesKeyword('Este es un post con estafa cripto', 'estafa'), true);
    });

    it('does not match partial substrings inside larger unrelated words', () => {
      assert.strictEqual(matchesKeyword('La casa rodante', 'as'), false);
    });
  });

  describe('Reddit Political Content Filtering (Levels 0, 1, 2)', () => {
    const { createExtensionContext } = require('./helpers');
    const { ctx } = createExtensionContext();
    const Detector = ctx.UniShield.Detector;
    const scoring = ctx.UniShield.Defaults.politicalScoring;

    it('Level 0: does not hide posts regardless of political content', () => {
      const strictness = 0;
      const title = 'El presidente habló hoy en el Congreso Nacional';
      const shouldBlock = strictness === 2
        ? Detector.hasPoliticalContent(title, scoring)
        : (strictness === 1 ? Detector.isOverlyPoliticalTweet(title, 6, scoring) : false);
      assert.strictEqual(shouldBlock, false);
    });

    it('Level 1: blocks highly polarizing political posts and comments (score >= 6)', () => {
      const strictness = 1;
      const polarizingPost = 'Milei y el kirchnerismo son corruptos traidores que destruyen la democracia #WorldWar3';
      const normalPoliticalPost = 'El presidente firmó un nuevo decreto en el Congreso';

      const blockPolarizing = strictness === 2
        ? Detector.hasPoliticalContent(polarizingPost, scoring)
        : (strictness === 1 ? Detector.isOverlyPoliticalTweet(polarizingPost, 6, scoring) : false);

      const blockNormal = strictness === 2
        ? Detector.hasPoliticalContent(normalPoliticalPost, scoring)
        : (strictness === 1 ? Detector.isOverlyPoliticalTweet(normalPoliticalPost, 6, scoring) : false);

      assert.strictEqual(blockPolarizing, true);
      assert.strictEqual(blockNormal, false);
    });

    it('Level 2: blocks all political content (any political entity or keyword)', () => {
      const strictness = 2;
      const normalPoliticalPost = 'El presidente firmó un nuevo decreto en el Congreso';
      const nonPoliticalPost = 'Fotos de mi gato durmiendo en el sillón';

      const blockPolitical = strictness === 2
        ? Detector.hasPoliticalContent(normalPoliticalPost, scoring)
        : (strictness === 1 ? Detector.isOverlyPoliticalTweet(normalPoliticalPost, 6, scoring) : false);

      const blockNonPolitical = strictness === 2
        ? Detector.hasPoliticalContent(nonPoliticalPost, scoring)
        : (strictness === 1 ? Detector.isOverlyPoliticalTweet(nonPoliticalPost, 6, scoring) : false);

      assert.strictEqual(blockPolitical, true);
      assert.strictEqual(blockNonPolitical, false);
    });
  });
});
