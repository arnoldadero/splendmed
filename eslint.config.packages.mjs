// Shared flat config for the non-Next workspace packages. The web app has its own
// config because it needs the Next.js plugin set.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // Tests assert against known fixtures, where a non-null assertion is clearer
      // than defensive branching that can never be taken.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // A leading underscore marks a parameter that exists to satisfy an interface
      // but is deliberately unused — notably in the HTTP driver, whose methods
      // must keep the port's signature while throwing (§3.1).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
