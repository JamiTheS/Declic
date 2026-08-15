// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // French copy uses apostrophes heavily in JSX text; escaping hurts readability.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
