/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: false,
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // React / TS ergonomics
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    'import/no-named-as-default': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],

    // General style preferences (warnings only)
    'no-empty': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',

    // Accessibility: start permissive to avoid blocking; tighten later
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/interactive-supports-focus': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
  'jsx-a11y/no-noninteractive-tabindex': 'off',
  'react/no-unescaped-entities': 'warn',
  'no-useless-catch': 'warn',
  'jsx-a11y/label-has-associated-control': 'error',
  'jsx-a11y/no-autofocus': 'error',

    // Import ordering as a soft rule
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        groups: [
          ['builtin', 'external'],
          ['internal', 'parent', 'sibling', 'index'],
          'object',
          'type',
        ],
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**/*'],
      rules: {
        'no-var': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'react/no-unescaped-entities': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    'vite.config.ts',
    '**/*.css',
  ],
};
