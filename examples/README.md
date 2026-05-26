# Examples

Two runnable end-to-end examples, TypeScript and Python.

## TypeScript

```bash
cd ..
pnpm add tsx
PRIVATE_KEY=0x... \
ARC_TESTNET_RPC=https://... \
AGENT_REGISTRY_ADDRESS=0x... \
  npx tsx examples/register-and-publish.ts
```

The script registers an agent, uploads a demo trace to Irys over HTTP, hashes
it via canonical-JSON keccak256, and publishes the resulting `TracePublished`
event on-chain. Output includes the Irys gateway URL so you can verify the
trace body and re-hash it locally.

## Python

```bash
cd python
pip install -r requirements.txt
PRIVATE_KEY=0x... \
ARC_TESTNET_RPC=https://... \
AGENT_REGISTRY_ADDRESS=0x... \
  python publish_trace.py
```

Pure-Python contract interaction via `web3.py`. Uses the same HTTP Irys upload
path as the TypeScript example. If you need signed/paid Irys uploads, set
`IRYS_PRIVATE_KEY` and call `upload_to_irys_via_node()` instead of
`upload_to_irys()`, it shells out to `irys_upload.mjs`, which uses
`@irys/sdk` for paid permanent storage. Install Node deps for that path with
`npm install @irys/sdk` in this directory.

## Verifying a trace someone else published

Given a `TracePublished` event with `traceHash` and `irysReceipt`:

```ts
import { hashTrace } from '@stoa-agents/arc-agent-identity'

const body = await fetch(`https://gateway.irys.xyz/${irysReceipt}`).then(r => r.json())
const recomputed = hashTrace(body)
console.assert(recomputed === traceHash, 'trace body has been tampered with')
```

The chain says **which** trace was published when, by whom. Irys says **what** it said. The hash links them. If they disagree, the publisher is untrustworthy.
