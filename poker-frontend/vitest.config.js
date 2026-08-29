import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom for component rendering (React Testing Library) - pure-
    // function util tests run fine under it too, so one environment
    // covers both instead of splitting config per test type.
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.js'],
    include: ['__tests__/**/*.test.js', '__tests__/**/*.test.jsx']
  }
});
