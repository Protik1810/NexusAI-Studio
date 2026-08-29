import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// This codebase's established idiom is `try { optionalWork() } catch (e) {}` for
// best-effort operations (cache writes, hardware probes, optional file reads).
// Rather than silence it per call site, allow the pattern everywhere and let
// no-empty/no-unused-vars keep catching *other* accidentally-empty blocks.
const allowEmptyCatch = { 'no-empty': ['error', { allowEmptyCatch: true }] }
const allowEmptyCatchTs = {
  ...allowEmptyCatch,
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
}
const allowEmptyCatchJs = {
  ...allowEmptyCatch,
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
}

export default tseslint.config(
  { ignores: ['dist', 'release', 'release-pkg', 'node_modules', 'docs', 'backend'] },

  // React + TypeScript source
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...allowEmptyCatchTs,
      // Only the two long-standing, uncontroversial hooks rules — not the
      // full v7 "recommended" bundle, which pulls in newer React Compiler
      // analysis rules (set-state-in-effect, purity, etc.) that would require
      // auditing this app's actual data-fetching patterns to address safely.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // This codebase leans on `any` at API/service boundaries (untyped JSON
      // from local HTTP endpoints and Hugging Face); tighten incrementally
      // rather than blocking on a repo-wide pass.
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },

  // Vitest test files require()-load the plain CommonJS electron/engine/*.cjs
  // modules directly — there's no typed ESM path into untyped .cjs files, and
  // dynamic import() would be awkward for top-level test setup.
  {
    files: ['src/tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  // Electron main/preload/server + build scripts (CommonJS, Node runtime)
  {
    files: ['electron/**/*.cjs', 'scripts/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node
    },
    rules: allowEmptyCatchJs
  },

  // vite.config.ts (Node runtime, mixed ESM/require — see comment in the file)
  {
    files: ['vite.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      ...allowEmptyCatchTs,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
)
