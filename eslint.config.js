const angularEslint = require('@angular-eslint/eslint-plugin');
const angularTemplateParser = require('@angular-eslint/template-parser');
const angularTemplatePlugin = require('@angular-eslint/eslint-plugin-template');
const tseslint = require('typescript-eslint');
const eslintPluginPrettier = require('eslint-plugin-prettier');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    ignores: ['projects/**/*', 'node_modules/**', 'dist/**'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.spec.json'],
        createDefaultProgram: true,
      },
    },
    plugins: {
      '@angular-eslint': angularEslint,
      prettier: eslintPluginPrettier,
    },
    extends: [
      'plugin:@angular-eslint/recommended',
      'plugin:@angular-eslint/template/process-inline-templates',
      'prettier',
    ],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/no-input-rename': 'error',
      '@angular-eslint/no-output-rename': 'error',
      '@angular-eslint/no-host-metadata-property': 'error',
      '@angular-eslint/no-inputs-metadata-property': 'error',
      '@angular-eslint/no-outputs-metadata-property': 'error',
      '@angular-eslint/use-lifecycle-interface': 'error',
      '@angular-eslint/use-pipe-transform-interface': 'error',
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-signals': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.html'],
    ignores: ['projects/**/*', 'node_modules/**', 'dist/**'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin,
      prettier: eslintPluginPrettier,
    },
    extends: [
      'plugin:@angular-eslint/template/recommended',
      'prettier',
    ],
    rules: {
      '@angular-eslint/template/click-events-have-key-events': 'error',
      '@angular-eslint/template/interactive-supports-focus': 'error',
      '@angular-eslint/template/label-has-associated-control': 'error',
      '@angular-eslint/template/no-positive-tabindex': 'error',
      'prettier/prettier': 'error',
    },
  }
);