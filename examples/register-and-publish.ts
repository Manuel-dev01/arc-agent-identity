/**
 * End-to-end example: register an agent, build a trace, upload to Irys,
 * publish on-chain.
 *
 * Run:
 *   PRIVATE_KEY=0x... ARC_TESTNET_RPC=https://... AGENT_REGISTRY_ADDRESS=0x... \
 *     npx tsx examples/register-and-publish.ts
 */

import { AgentRegistry, uploadToIrys, ARC_TESTNET_CHAIN_ID } from '@stoa-agents/arc-agent-identity'

async function main() {
  const privateKey = process.env.PRIVATE_KEY
  const rpc = process.env.ARC_TESTNET_RPC
  const address = process.env.AGENT_REGISTRY_ADDRESS

  if (!privateKey || !rpc || !address) {
    throw new Error('Set PRIVATE_KEY, ARC_TESTNET_RPC, and AGENT_REGISTRY_ADDRESS')
  }

  const registry = new AgentRegistry({
    privateKey,
    address,
    chain: {
      chainId: ARC_TESTNET_CHAIN_ID,
      rpc,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    },
  })

  console.log('Owner address:', registry.ownerAddress)

  console.log('Registering agent...')
  const { agentId, txHash: registerTx } = await registry.register()
  console.log('  agentId:', agentId)
  console.log('  txHash:', registerTx)

  const trace = {
    schemaVersion: 'agent.trace.v1' as const,
    agentId,
    marketId: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
    generatedAt: new Date().toISOString(),
    market: {
      question: 'Will the example complete without errors?',
      venue: 'demo',
      resolutionAt: null,
    },
    reasoning: {
      bull: 'The example has been tested.',
      bear: 'Network conditions can fail any time.',
      synthesis: 'Net positive. Run it.',
    },
    decision: { rating: 2, confidenceBps: 7500, sizeUsdc: 0 },
    modelMetadata: {
      framework: 'arc-agent-identity-example',
      quickThinkModel: 'none',
      deepThinkModel: 'none',
    },
  }

  console.log('Uploading trace body to Irys...')
  const { id: irysReceipt } = await uploadToIrys(trace)
  console.log('  irysReceipt:', irysReceipt)
  console.log('  gateway URL:', `https://gateway.irys.xyz/${irysReceipt}`)

  console.log('Publishing on-chain...')
  const { traceHash, txHash } = await registry.publishTrace({
    agentId,
    marketId: trace.marketId,
    trace,
    irysReceipt,
    rating: trace.decision.rating,
    confidenceBps: trace.decision.confidenceBps,
  })
  console.log('  traceHash:', traceHash)
  console.log('  txHash:', txHash)

  console.log('\nVerify off-chain:')
  console.log(`  1. fetch ${`https://gateway.irys.xyz/${irysReceipt}`}`)
  console.log('  2. canonical-JSON hash it with the SDK\'s hashTrace()')
  console.log(`  3. confirm it equals ${traceHash}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
