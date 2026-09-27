// La configurazione di Expo, più una regola nostra.
const expoConfig = require('eslint-config-expo/flat')

module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*'] },
  {
    // I dati salvati passano da un modulo solo (ADR 0010, fase 3): una chiamata
    // a supabase-js in una schermata sarebbe la «terza strada» che
    // `.claude/rules/react-native.md` vieta. Scritta qui, perché una regola che
    // la CI non fa fallire è una buona intenzione.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['src/dati/supabase.ts', 'src/dati/accesso.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Supabase si usa da src/dati/supabase.ts (i dati) o src/dati/accesso.ts (l’accesso): chiama le loro funzioni.',
            },
          ],
        },
      ],
    },
  },
]
