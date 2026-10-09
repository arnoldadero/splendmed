import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      /*
       * Guardrail §3.4: the service-role key must never reach a browser bundle.
       * The admin client that holds it is server-only, so importing it from
       * anywhere that can be bundled for the client is a lint error rather than a
       * runtime surprise. The module does not exist yet — this rule is in place
       * before the first opportunity to misuse it.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/supabase/admin', '**/supabase/admin.*'],
              message:
                'The admin client uses the service-role key and is server-only. See BUILD_SPLENDMED.md §3.4.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
