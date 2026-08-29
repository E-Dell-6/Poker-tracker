import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmounts anything rendered by the previous test - without this, DOM
// from one test can leak into the next and cause false positives/negatives
// (e.g. a query matching an element left over from a prior render).
afterEach(() => {
  cleanup();
});
