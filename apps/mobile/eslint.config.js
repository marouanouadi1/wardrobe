// La configurazione di Expo, più tre eccezioni motivate.
const expoConfig = require('eslint-config-expo/flat')

module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*'] },
  {
    // react-three-fiber non usa elementi DOM: `<mesh position={...}>` e
    // `<sphereGeometry args={...}>` sono componenti three.js, e la regola sulle
    // proprietà sconosciute è scritta per l'HTML.
    files: ['src/avatar/Manichino3D.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
      // Il ciclo di disegno di three.js non è un render di React: mutare lo
      // stato del trascinamento dentro `useFrame` sessanta volte al secondo è
      // il modo previsto di animare in r3f, non un accesso a un ref durante il
      // render. Le regole del compilatore React presuppongono un albero di
      // componenti; qui il frame loop vive fuori.
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
    },
  },
]
