export {};

// This file runs as a global setupFile for every test, including the
// plain-Node engine/scanner/security suites outside src/tests/ui — those
// have no DOM at all, so everything here must be a no-op for them rather
// than assuming jsdom's globals exist.
if (typeof Element !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');

  // jsdom doesn't implement scrollIntoView at all — several components
  // (ChatStudio's auto-scroll-to-bottom effect) call it unconditionally.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
