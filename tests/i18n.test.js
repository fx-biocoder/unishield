const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createExtensionContext } = require('./helpers');

describe('UniShield.i18n (Internationalization System)', () => {
  it('loads English strings correctly', () => {
    const { ctx } = createExtensionContext({ language: 'en-US' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.getLang(), 'en');
    assert.strictEqual(i18n.t('appName'), 'UniShield');
    assert.strictEqual(i18n.t('active'), 'Active');
    assert.strictEqual(i18n.t('redditHideEditorialized'), 'Hide Editorialized Titles');
  });

  it('loads Spanish strings correctly for es-AR / es-ES', () => {
    const { ctx } = createExtensionContext({ language: 'es-AR' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.getLang(), 'es');
    assert.strictEqual(i18n.t('active'), 'Activo');
    assert.strictEqual(i18n.t('redditHideEditorialized'), 'Ocultar títulos editorializados');
    assert.strictEqual(i18n.t('xPoliticalLevel0'), 'No ocultar nada');
    assert.strictEqual(i18n.t('xPoliticalLevel1'), 'Ocultar tweets altamente polarizantes');
    assert.strictEqual(i18n.t('xPoliticalLevel2'), 'Ocultar todo el contenido político');
  });

  it('loads Portuguese strings correctly for pt-BR', () => {
    const { ctx } = createExtensionContext({ language: 'pt-BR' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.getLang(), 'pt');
    assert.strictEqual(i18n.t('active'), 'Ativo');
    assert.strictEqual(i18n.t('redditHideEditorialized'), 'Ocultar títulos editorializados');
  });

  it('loads Italian strings correctly for it-IT', () => {
    const { ctx } = createExtensionContext({ language: 'it-IT' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.getLang(), 'it');
    assert.strictEqual(i18n.t('active'), 'Attivo');
    assert.strictEqual(i18n.t('redditHideEditorialized'), 'Nascondi titoli editorializzati');
  });

  it('falls back to English when language is unsupported', () => {
    const { ctx } = createExtensionContext({ language: 'ja-JP' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.getLang(), 'en');
    assert.strictEqual(i18n.t('active'), 'Active');
  });

  it('supports runtime setLang switching', () => {
    const { ctx } = createExtensionContext({ language: 'en' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.t('active'), 'Active');
    i18n.setLang('es');
    assert.strictEqual(i18n.getLang(), 'es');
    assert.strictEqual(i18n.t('active'), 'Activo');
    i18n.setLang('it');
    assert.strictEqual(i18n.t('active'), 'Attivo');
  });

  it('returns key if string is missing', () => {
    const { ctx } = createExtensionContext({ language: 'en' });
    const i18n = ctx.UniShield.i18n;

    assert.strictEqual(i18n.t('nonExistentKey123'), 'nonExistentKey123');
  });
});
