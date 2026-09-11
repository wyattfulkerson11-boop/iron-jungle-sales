const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('No script tag found in index.html');

// Create mock localStorage & DOM
const storage = new Map();
const context = {
  localStorage: {
    getItem: (k) => storage.has(k) ? storage.get(k) : null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => Array.from(storage.keys())[i] || null
  },
  console: console,
  document: {
    createElement: () => ({ 
        style: {}, 
        dataset: {}, 
        addEventListener: () => {}, 
        appendChild: () => {},
        textContent: ''
    }),
    getElementById: () => ({ appendChild: () => {}, innerHTML: '' })
  },
  window: { localStorage: null }, // filled below
  setTimeout: () => {},
  Date: Date,
  JSON: JSON,
  Array: Array,
  Set: Set,
  Map: Map,
  Object: Object,
  Error: Error,
  Number: Number
};
context.window.localStorage = context.localStorage;

vm.createContext(context);
vm.runInContext(scriptMatch[1], context);

const storageResults = context.demoStorage();
const catalogResults = context.demoCatalog();

const allResults = [...storageResults, ...catalogResults];
const passed = allResults.filter(r => r.ok).length;
console.log(`Task 2 & 3 Combined tests: ${passed}/${allResults.length} passed`);

if (passed === allResults.length) {
  console.log('ALL PASSED');
  process.exit(0);
} else {
  console.error('SOME FAILED');
  process.exit(1);
}
