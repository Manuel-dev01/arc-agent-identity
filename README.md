# arc-agent-identity

On-chain identity and append-only reasoning-trace anchoring for autonomous agents on Arc.

A composable primitive for Arc builders: register a `bytes32` agent identity, then publish content-addressed reasoning traces that anyone can verify against an Irys/Arweave receipt. Two files, a 60-line Solidity contract and a thin TypeScript SDK, designed to be forked, imported, and shipped on top of.

## What this gives you

- **`AgentRegistry.sol`**: register a `bytes32` agent owned by an EOA, then emit append-only `TracePublished` events containing a trace hash, a rating, a confidence value in basis points, and a content-addressed receipt (Irys, Arweave, IPFS, anything addressable by string).
- **`@stoa-agents/arc-agent-identity`**: a TypeScript SDK that wraps the contract with viem, parses the `AgentRegistered` event for you, hashes traces via canonical-JSON keccak256, and uploads bodies to Irys over plain HTTP (no Node SDK dependency, works from any runtime with `fetch`).
- **A trace schema**: Zod-validated, venue-agnostic, version-tagged (`agent.trace.v1`). Use it as-is or as a starting point.

## Why it exists

Most Arc reference repos centre on payments. The `circlefin/arc-*` repos give you commerce, p2p payments, and the patterns around them. They don't cover the autonomous-agent shape: an off-chain process that needs an on-chain identity, an attestation surface for the reasoning it produces, and an auditable trail that links the two. This repo plugs that gap.

The contract is intentionally small. There is no edit, no delete, no invalidate. There is no owner, no pause, no proxy. The contract has no constructor parameters. You deploy it once and it does one thing: it lets an address own a `bytes32` and emit events under that `bytes32`.

## Quickstart

### 1. Deploy the contract

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```

Or use the canonical OSS deployment on Arc testnet (address pinned in [`sdk/src/index.ts`](sdk/src/index.ts) as `ARC_TESTNET_AGENT_REGISTRY`).

### 2. Install the SDK

```bash
npm install @stoa-agents/arc-agent-identity
```

### 3. Register, publish, verify

```ts
import { AgentRegistry, uploadToIrys, ARC_TESTNET_CHAIN_ID } from '@stoa-agents/arc-agent-identity'

const registry = new AgentRegistry({
  privateKey: process.env.PRIVATE_KEY!,
  address: '0x...',  // your deployed AgentRegistry
  chain: {
    chainId: ARC_TESTNET_CHAIN_ID,
    rpc: process.env.ARC_TESTNET_RPC!,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  },
})

const { agentId, txHash: registerTx } = await registry.register()

const trace = {
  schemaVersion: 'agent.trace.v1',
  agentId,
  marketId: '0x' + 'ab'.repeat(32),
  generatedAt: new Date().toISOString(),
  market: { question: 'Will X happen?', venue: 'polymarket', resolutionAt: null },
  reasoning: { bull: '...', bear: '...', synthesis: '...' },
  decision: { rating: 2, confidenceBps: 7500, sizeUsdc: 0 },
  modelMetadata: { framework: 'my-stack', quickThinkModel: 'gpt-5', deepThinkModel: 'gpt-5' },
}

const { id: irysReceipt } = await uploadToIrys(trace)

const { traceHash, txHash } = await registry.publishTrace({
  agentId,
  marketId: trace.marketId,
  trace,
  irysReceipt,
  rating: trace.decision.rating,
  confidenceBps: trace.decision.confidenceBps,
})

console.log({ agentId, traceHash, irysReceipt, txHash })
```

A full runnable example lives at [`examples/register-and-publish.ts`](examples/register-and-publish.ts), and a Python integration sits at [`examples/python/`](examples/python/) for callers shelling out via subprocess.

## What primitives does this expose?

Two, with intentionally small surface area.

**Identity.** `bytes32 agentId = keccak256(abi.encodePacked(msg.sender, nonce))`. One address can register many agents without collision because the nonce increments per address. The mapping `agentOwner[agentId] → address` is the only piece of state the contract keeps about identity. There is no upgrade path; the identity is permanent for the lifetime of the deployment.

**Append-only attestation.** `publishTrace(agentId, marketId, traceHash, rating, confidenceBps, irysReceipt)` emits a `TracePublished` event. The contract enforces three things: only the owner can publish under their `agentId`, rating is in `[-3, 3]`, and confidence is in `[0, 10000]` basis points. Everything else is opaque to the contract, `marketId` is a free-form `bytes32`, `irysReceipt` is a free-form string, `traceHash` is whatever the caller computed.

The SDK adds canonicalization (sorted-key JSON keccak256) and an Irys upload helper, so the trace body is reproducible from its receipt and the on-chain hash can be verified against the body any indexer downloads.

## Compared to the existing `circlefin/arc-*` repos

| | `arc-commerce` / `arc-p2p-payments` | `arc-agent-identity` |
|---|---|---|
| Primary actor | Human (buyer, sender) | Autonomous agent |
| Primary primitive | USDC settlement flow | `bytes32` identity + trace event |
| State | Order/payment objects | Append-only events |
| Off-chain surface | Receipts, invoices | Content-addressed trace bodies (Irys) |
| Reusable in 1 import | Yes | Yes |

The two stacks compose. A trading agent built on this repo can settle USDC trades via `arc-commerce`'s patterns; a p2p payment flow can attest to its reasoning via this repo before executing.

## Design notes

The contract is deliberately under-engineered. No proxy. No ownable. No pause. No upgrade. If you need any of those, redeploy with the additions, the contract is so small that "redeploy" is the upgrade path. The Arc OSS reference instance is pinned in the SDK so you can read events historically even after a redeploy.

The SDK is deliberately bundler-agnostic. It imports viem and zod, exports ESM, and has no peer dependencies. Bun, Deno, Node, edge runtimes, all fine. The Irys helper uses `fetch` rather than `@irys/sdk` for the same reason; if you need signed uploads you can layer the official SDK on top.

The trace schema is `agent.trace.v1`. If you need a different shape, fork the Zod schema. The contract does not enforce any schema, `traceHash` is opaque to it, so versioning the schema is a pure off-chain concern.

## Reference deployments

| Network | Address | Status |
|---|---|---|
| Arc testnet (chain 5042002) | [`0xb0969950a09117d871b1D344B5a96b9a3C84EAC7`](https://testnet.arcscan.app/address/0xb0969950a09117d871b1D344B5a96b9a3C84EAC7) | Live. Deploy tx: [`0x7eb32645...59fe06ab`](https://testnet.arcscan.app/tx/0x7eb3264533b6f33f24720b6251a794868f20fa06bf73eaf3c0bc8e3759fe06ab) |

The Stoa hackathon submission ([github.com/...](https://github.com)) uses an earlier version of this contract under the name `StoaRegistry` at `0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b`. That deployment is functionally compatible at the bytecode level but emits events under different names; use the canonical OSS deployment above for new integrations.

## Repository layout

```
arc-agent-identity/
├── contracts/
│   ├── src/AgentRegistry.sol
│   ├── test/AgentRegistry.t.sol        # 9 tests, all passing
│   ├── script/Deploy.s.sol
│   └── foundry.toml
├── sdk/                                # @stoa-agents/arc-agent-identity
│   ├── src/
│   │   ├── client.ts
│   │   ├── irys.ts
│   │   ├── hash.ts
│   │   ├── schema.ts
│   │   ├── abi.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── examples/
│   ├── register-and-publish.ts
│   └── python/
│       ├── publish_trace.py
│       └── irys_upload.mjs
├── ARCHITECTURE.md
├── LICENSE                              # MIT
└── README.md
```

## License

MIT. Take it, fork it, deploy your own, ship on top.
