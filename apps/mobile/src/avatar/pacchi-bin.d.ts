// I pacchetti del corpo (`assets/avatar/*.bin`) sono asset di Metro (`metro.config.js`): un
// import ne dà l'identificativo, che `expo-asset` trasforma in byte (`pacchi.ts`).
declare module '*.bin' {
  const asset: number
  export default asset
}
