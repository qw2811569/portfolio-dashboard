import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.min.js'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/lib/dataAdapters/finmindClient.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value='https://api.finmindtrade.com/api/v4/data']",
          message:
            'Route FinMind access through src/lib/dataAdapters/finmindAdapter.js or finmindClient.js boundary.',
        },
      ],
    },
  },
  {
    files: ['src/App.routes.jsx', 'src/pages/**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
]
