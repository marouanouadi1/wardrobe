/**
 * Il pacchetto Python, costruito da CDK stesso.
 *
 * `cdk synth` deve funzionare da solo, senza «prima ricordati di lanciare lo
 * script di build»: quel genere di prerequisito non documentato è esattamente
 * ciò che rompe il deploy alle sette di sera. Il bundling locale chiama
 * `services/api/scripts/build_lambda.sh` e scompatta il risultato dove CDK lo
 * aspetta.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DockerImage } from 'aws-cdk-lib'
import { Code } from 'aws-cdk-lib/aws-lambda'

const QUI = dirname(fileURLToPath(import.meta.url))
const SERVIZIO = join(QUI, '..', '..', 'services', 'api')

export function codiceApi(): Code {
  return Code.fromAsset(SERVIZIO, {
    // Escludiamo tutto ciò che non finisce nello zip: senza questo, ogni
    // modifica a un test cambierebbe l'hash dell'asset e farebbe ripartire un
    // deploy identico.
    exclude: ['.venv', 'build', 'tests', '__pycache__', '*.pyc', '.pytest_cache', '.ruff_cache'],
    bundling: {
      // Mai usata quando il bundling locale riesce; CDK la pretende comunque.
      image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12'),
      command: [],
      local: {
        tryBundle(cartellaUscita: string): boolean {
          try {
            // Lo script scrive direttamente dove CDK vuole: comprimere e
            // scompattare per poi far ricomprimere a CDK sarebbe lavoro doppio.
            execFileSync('bash', ['scripts/build_lambda.sh', cartellaUscita], {
              cwd: SERVIZIO,
              stdio: 'inherit',
            })
            return existsSync(join(cartellaUscita, 'handlers'))
          } catch (errore) {
            console.error(
              '\nBundling locale fallito: servono bash e uv (`npm run api:sync`).',
              errore instanceof Error ? errore.message : errore,
            )
            return false
          }
        },
      },
    },
  })
}
