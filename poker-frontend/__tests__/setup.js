import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmounts anything rendered by the previous test - without this, DOM
// from one test can leak into the next and cause false positives/negatives
// (e.g. a query matching an element left over from a prior render).
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement ResizeObserver (used by PreflopMatrixControls.jsx's
// ScrollableRow to decide whether its scroll chevrons should show) - a
// no-op stub is enough since these tests never assert chevron visibility.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
