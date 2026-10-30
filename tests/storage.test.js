const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createExtensionContext } = require('./helpers');

describe('UniShield.Storage', () => {
  it('loads default configuration when storage is empty', async () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    const config = await Storage.getConfig();
    assert.strictEqual(config.global.enabled, true);
    assert.strictEqual(config.reddit.removeEditorializedTitles, true);
    assert.strictEqual(config.x.politicalStrictness, 0);
  });

  it('saves and restores partial configuration changes', async () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    await Storage.getConfig();
    await Storage.setConfig({
      x: { politicalStrictness: 2 }
    });

    const updated = await Storage.getConfig();
    assert.strictEqual(updated.x.politicalStrictness, 2);
  });

  it('handles cleanSubredditName accurately', () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    assert.strictEqual(Storage.cleanSubredditName('r/programming'), 'programming');
    assert.strictEqual(Storage.cleanSubredditName('/r/AskReddit/'), 'askreddit');
    assert.strictEqual(Storage.cleanSubredditName('https://reddit.com/r/technology/comments/123'), 'technology');
    assert.strictEqual(Storage.cleanSubredditName('  ARGENTINA  '), 'argentina');
    assert.strictEqual(Storage.cleanSubredditName(''), '');
  });

  it('checks and updates subreddit blocklist', async () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    assert.strictEqual(await Storage.isSubredditBlocklisted('rust'), false);
    await Storage.addToSubredditBlocklist('rust');
    assert.strictEqual(await Storage.isSubredditBlocklisted('rust'), true);
    await Storage.removeFromSubredditBlocklist('rust');
    assert.strictEqual(await Storage.isSubredditBlocklisted('rust'), false);
  });

  it('checks and updates Reddit allowlist and user blocklist', async () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    assert.strictEqual(await Storage.isRedditUserAllowlisted('alice'), false);
    await Storage.addToRedditAllowlist('u/Alice');
    assert.strictEqual(await Storage.isRedditUserAllowlisted('alice'), true);

    assert.strictEqual(await Storage.isRedditUserBlocklisted('bob'), false);
    await Storage.addToRedditBlocklist('bob');
    assert.strictEqual(await Storage.isRedditUserBlocklisted('bob'), true);
  });

  it('checks X user allowlist and blocklist', async () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    assert.strictEqual(await Storage.isXUserAllowlisted('@trusted_dev'), false);
    await Storage.setConfig({ x: { allowlist: ['trusted_dev'] } });
    assert.strictEqual(await Storage.isXUserAllowlisted('@trusted_dev'), true);

    assert.strictEqual(await Storage.isXUserBlocklisted('@spammer_bot'), false);
    await Storage.setConfig({ x: { userBlocklist: ['spammer_bot'] } });
    assert.strictEqual(await Storage.isXUserBlocklisted('@spammer_bot'), true);
  });

  it('increments hidden stats safely', async () => {
    const { ctx } = createExtensionContext();
    const Storage = ctx.UniShield.Storage;

    await Storage.incrementHidden('reddit');
    await Storage.incrementHidden('x');
    await Storage.incrementHidden('linkedin');

    // Wait for the debounced flush timer (400ms)
    await new Promise(r => setTimeout(r, 500));

    const config = await Storage.getConfig();
    assert.strictEqual(config.global.stats.redditHidden, 1);
    assert.strictEqual(config.global.stats.xHidden, 1);
    assert.strictEqual(config.global.stats.linkedinHidden, 1);
    assert.strictEqual(config.global.stats.totalHidden, 3);
  });
});
