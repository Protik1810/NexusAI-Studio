import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    // Engine/scanner/security tests run under plain Node — they're pure
    // functions over strings and the filesystem, and jsdom would only slow
    // them down for no benefit. UI component tests need a DOM, so they're
    // scoped to their own directory and get jsdom instead.
    environmentMatchGlobs: [['src/tests/ui/**', 'jsdom']],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    setupFiles: ['src/tests/ui/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/engine/**/*.cjs'],
      // Floor, not a target: set just below the real coverage this test
      // suite has today (~44%/58%/26%/44%), so CI catches a real regression
      // without being a fictional aspirational number nobody re-checks.
      // Raise these as real coverage grows — don't lower them to make a
      // failing PR pass.
      thresholds: {
        statements: 40,
        branches: 55,
        functions: 22,
        lines: 40
      }
    }
  }
});