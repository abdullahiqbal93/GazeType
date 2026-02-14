/**
 * Jest setup file — polyfills for test environment.
 */

// structuredClone is available in Node 17+; polyfill for older versions / jsdom
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value));
}
