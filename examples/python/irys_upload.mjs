/**
 * Optional Node subprocess helper for Python callers who need signed Irys
 * uploads (paid permanent storage) rather than the free HTTP gateway.
 *
 * Usage from Python:
 *   subprocess.run(
 *     ["node", "examples/python/irys_upload.mjs"],
 *     input=json.dumps(trace),
 *     capture_output=True, text=True, check=True,
 *   )
 *
 * Reads the trace from stdin (JSON), prints {"id": "..."} to stdout.
 *
 * Install:
 *   npm install @irys/sdk
 *
 * Env:
 *   IRYS_PRIVATE_KEY   funded wallet for upload payments
 *   IRYS_NODE_URL      defaults to https://node2.irys.xyz
 *   IRYS_CURRENCY      defaults to "matic"
 */

import { readFileSync } from 'node:fs'
import Irys from '@irys/sdk'

async function main() {
  const raw = readFileSync(0, 'utf-8')
  const trace = JSON.parse(raw)

  const key = process.env.IRYS_PRIVATE_KEY
  if (!key) throw new Error('IRYS_PRIVATE_KEY required')

  const irys = new Irys({
    url: process.env.IRYS_NODE_URL || 'https://node2.irys.xyz',
    token: process.env.IRYS_CURRENCY || 'matic',
    key,
  })

  const receipt = await irys.upload(JSON.stringify(trace), {
    tags: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Schema', value: trace.schemaVersion || 'agent.trace.v1' },
    ],
  })

  process.stdout.write(JSON.stringify({ id: receipt.id }))
}

main().catch((err) => {
  process.stderr.write(String(err))
  process.exit(1)
})
