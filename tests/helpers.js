const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Creates an isolated browser-like sandbox with window, document, and chrome/browser storage mocks.
 */
function createExtensionContext(options = {}) {
  const localStorageStore = {};

  const chromeMock = {
    storage: {
      local: {
        get: (keys, cb) => {
          let res = {};
          if (keys === null || keys === undefined) {
            res = { ...localStorageStore };
          } else if (typeof keys === 'string') {
            res[keys] = localStorageStore[keys];
          } else if (Array.isArray(keys)) {
            keys.forEach(k => { res[k] = localStorageStore[k]; });
          } else if (typeof keys === 'object') {
            res = { ...keys };
            Object.keys(keys).forEach(k => {
              if (localStorageStore[k] !== undefined) res[k] = localStorageStore[k];
            });
          }
          if (cb) cb(res);
          return Promise.resolve(res);
        },
        set: (items, cb) => {
          Object.assign(localStorageStore, items);
          if (cb) cb();
          return Promise.resolve();
        },
        clear: (cb) => {
          Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
          if (cb) cb();
          return Promise.resolve();
        }
      },
      onChanged: {
        addListener: () => {}
      }
    },
    runtime: {
      id: 'unishield-test-extension-id',
      onMessage: { addListener: () => {} },
      sendMessage: () => {}
    }
  };

  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        style: {},
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        classList: { add: () => {}, remove: () => {} }
      })
    },
    navigator: {
      language: options.language || 'en-US'
    },
    chrome: chromeMock,
    browser: chromeMock,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval
  };

  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  const rootDir = path.resolve(__dirname, '..');

  // Load defaults.js
  const defaultsCode = fs.readFileSync(path.join(rootDir, 'lib', 'defaults.js'), 'utf8');
  vm.runInContext(defaultsCode, ctx);

  // Load detector.js
  const detectorCode = fs.readFileSync(path.join(rootDir, 'lib', 'detector.js'), 'utf8');
  vm.runInContext(detectorCode, ctx);

  // Load i18n.js
  const i18nCode = fs.readFileSync(path.join(rootDir, 'lib', 'i18n.js'), 'utf8');
  vm.runInContext(i18nCode, ctx);

  // Load storage.js
  const storageCode = fs.readFileSync(path.join(rootDir, 'lib', 'storage.js'), 'utf8');
  vm.runInContext(storageCode, ctx);

  return {
    ctx,
    chromeMock,
    localStorageStore
  };
}

/**
 * Extracts multiple helper functions or code blocks from a content script file.
 */
function extractFunction(filePath, funcName, contextDeps = {}) {
  const code = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`function\\s+${funcName}\\s*\\([\\s\\S]*?\\n  \\}`);
  const match = code.match(regex);
  if (!match) {
    throw new Error(`Could not find function ${funcName} in ${filePath}`);
  }
  const fnCtx = vm.createContext({ ...contextDeps });
  return vm.runInContext(`(${match[0]})`, fnCtx);
}

module.exports = {
  createExtensionContext,
  extractFunction
};
