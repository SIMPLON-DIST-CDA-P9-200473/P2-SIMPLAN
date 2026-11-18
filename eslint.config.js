import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

// ESLint repère les erreurs de code ; la mise en forme est laissée à Prettier
// (eslint-config-prettier, en dernier, coupe les règles qui feraient doublon).
export default defineConfig([
  globalIgnores(['**/node_modules/', 'backend/public/', 'frontend/dist/']),

  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Un paramètre ou une variable préfixé par _ peut rester inutilisé.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  {
    files: ['backend/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['frontend/src/**/*.{js,jsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  {
    files: ['frontend/*.js'],
    languageOptions: { globals: globals.node },
  },

  prettier,
]);
