import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import fyldo from './tools/lint/fyldo-plugin.js';

export default tseslint.config(
  { ignores: ['assets/**', 'build/**', 'e2e/.generated/**', 'node_modules/**', 'vendor/**', 'vendor-prefixed/**', 'test-results/**', 'playwright-report/**', '**/*.generated.*', '.tools/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off', // e2e helpers read untyped JSON
      'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
    plugins: { ...jsxA11y.flatConfigs.recommended.plugins, fyldo },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'fyldo/no-hex-colors': 'error',
      'fyldo/no-arbitrary-values': 'error',
      'fyldo/portal-container': 'error',
      'fyldo/icon-button-tooltip': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  { files: ['**/*.{js,mjs}'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // These scripts run INSIDE Figma (figma-console MCP), where `figma` is the plugin API.
  { files: ['tools/figma/*.js'], languageOptions: { globals: { figma: 'readonly' }, sourceType: 'script' }, rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-return-outside-function': 'off' } },
  // The generated icon data and icon modules are data, not components.
  { files: ['app/icons/inline.generated.ts'], rules: { 'fyldo/no-hex-colors': 'off' } },
);
