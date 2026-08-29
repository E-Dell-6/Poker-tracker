import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' is enough for the pure-function util tests this project has
    // today. Switch to 'jsdom' (and add it as a devDependency) if/when
    // component tests are added.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js', 'src/**/__tests__/**/*.test.jsx'],
    // No frontend test files exist yet (backend-heavy work so far) - don't
    // fail `npm test` on that until the first one is added.
    passWithNoTests: true
  }
});
