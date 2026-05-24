# Architecture

A short, opinionated read on what the contract guarantees, what the SDK assumes, and where the seams are if you want to extend.

## Data flow

```
┌────────────────┐
│  Agent process │  off-chain reasoning (any framework)
└───────┬────────┘
        │
        │  1. build trace object  (Zod-validated against TraceSchema)
        ▼
┌────────────────┐
│  uploadToIrys  │  HTTP POST to node2.irys.xyz/tx/data
└───────┬────────┘
        │  returns irysReceipt (string id)
        ▼
┌────────────────┐
│   hashTrace    │  keccak256( canonical-JSON(trace) )
└───────┬────────┘
        │  returns traceHash (bytes32)
        ▼
┌────────────────────────────────────────────┐
│  AgentRegistry.publishTrace(               │
│    agentId, marketId, traceHash,           │
│    rating, confidenceBps, irysReceipt      │
│  )                                         │
└───────┬────────────────────────────────────┘
        │  emits TracePublished event
        ▼
┌────────────────┐
│   Arc chain    │  Any indexer can subscribe to events,
│   (events)     │  fetch the body from Irys by receipt,
└────────────────┘  re-hash, and verify against traceHash.
```

The chain is the source of truth for **which** trace was published when. Irys is the source of truth for **what** the trace said. The hash is the link.

## Contract invariants

These are the only properties the contract guarantees:

1. **Ownership is exclusive.** `agentOwner[agentId]` is set exactly once, when the agent is registered. There is no transfer function. Reverts on writes to an unowned `agentId` (via `NotAgentOwner`).
2. **Identity derivation is deterministic.** `agentId = keccak256(abi.encodePacked(msg.sender, nonce))`. The same address with the same nonce always produces the same id. `nonce` is per-address and increments on each `registerAgent` call.
3. **Trace publication is append-only.** No edit, no delete, no invalidate. The contract emits a `TracePublished` event and returns; it does not store the trace itself. State remains O(agents), not O(traces).
4. **Rating ∈ [-3, 3], confidence ∈ [0, 10000] bps.** Anything outside reverts (`InvalidRating`, `InvalidConfidence`). The contract makes no claim about how to interpret these numbers — they are conventions the SDK and downstream indexers agree on.

Out of scope, deliberately:

- No proof that the trace body matches `traceHash`. That verification is off-chain — re-hash the body fetched from Irys and compare. The contract trusts the publisher to compute the hash honestly; the publisher is identified by `msg.sender`, so the cost of lying is reputational.
- No timestamp validation beyond `block.timestamp`. If you need strict ordering across agents, use block number; for ordering within an agent, the contract's per-agent event sequence is already strictly increasing.
- No deduplication. The same `(agentId, marketId, traceHash)` can be republished any number of times. Off-chain indexers can dedupe; the contract intentionally does not.

## SDK assumptions

The SDK makes a few choices that callers should know about.

**Canonical-JSON hashing is top-level only.** `JSON.stringify(obj, Object.keys(obj).sort())` sorts top-level keys but does not recursively sort nested objects. This is sufficient for the `TraceSchema` because all nested objects are built from a fixed shape (`reasoning`, `decision`, `market`, etc.) and key order is therefore stable in practice. If you build traces with dynamic nested keys, write your own canonicalizer.

**Irys uploads are HTTP-only and unsigned.** The SDK posts to `node2.irys.xyz/tx/data`, which accepts free public uploads. Receipts are returned synchronously. If you need paid permanent storage, signed receipts, or large bodies, layer `@irys/sdk` on top and pass the resulting id into `publishTrace` directly — the contract does not care how you got the receipt string.

**Chain config is fully caller-supplied.** Nothing in the SDK assumes Arc. The exported `ARC_TESTNET_CHAIN_ID` constant is a convenience, not a default. The same SDK works against any EVM chain you've deployed `AgentRegistry` to.

**Private keys are EOA-only.** The SDK uses `viem`'s `privateKeyToAccount`. If you need smart-account signing (ERC-4337, ERC-1271, MPC), instantiate your own `WalletClient` and call the ABI directly — the SDK is a convenience layer, not a wall.

## Seams for extension

If you want to add anything to this repo, here are the natural cut lines:

- **Per-agent metadata.** Add a second contract `AgentMetadata.sol` that maps `bytes32 agentId → struct{ string handle; string framework; bytes ext }`. Keep `AgentRegistry` unchanged so the identity-derivation guarantee holds.
- **Multi-attester traces.** Add an `AgentAttests.sol` that lets agents endorse other agents' traces with a `(agentId, traceHash, score)` event. Composes cleanly with `AgentRegistry` because endorsements reference the existing `traceHash`.
- **Builder-fee routing.** Out of scope here. See the Stoa hackathon repo for a working Polymarket V2 routing layer that uses `agentId` as a builder code.
- **Treasury per agent.** Out of scope here. See `StoaTreasury.sol` in the Stoa hackathon repo for a USDC/USYC subscribe-redeem-yield pattern keyed by `agentId`.

The lesson the small contract teaches: pick one primitive, ship it with no escape hatches, and let composition do the rest.
