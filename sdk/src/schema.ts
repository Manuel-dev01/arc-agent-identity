import { z } from 'zod'

/**
 * Canonical schema for an agent reasoning trace.
 *
 * Designed to be venue-agnostic: `market.venue` is a free-form string so traces
 * can attach to Polymarket, Kalshi, custom prediction markets, or non-market
 * topics (the contract treats marketId as opaque bytes32).
 *
 * Hashing: callers should hash via canonical-JSON keccak256 (see hashTrace()) so
 * the on-chain traceHash is deterministic and verifiable from the Irys body.
 */
export const TraceSchema = z.object({
  schemaVersion: z.literal('agent.trace.v1'),
  agentId: z.string().regex(/^0x[a-f0-9]{64}$/, 'agentId must be 0x-prefixed bytes32'),
  marketId: z.string().regex(/^0x[a-f0-9]{64}$/, 'marketId must be 0x-prefixed bytes32'),
  generatedAt: z.string().datetime(),
  market: z.object({
    question: z.string(),
    venue: z.string(),
    resolutionAt: z.string().datetime().nullable(),
  }),
  reasoning: z.object({
    bull: z.string(),
    bear: z.string(),
    synthesis: z.string(),
  }),
  decision: z.object({
    rating: z.number().int().min(-3).max(3),
    confidenceBps: z.number().int().min(0).max(10000),
    sizeUsdc: z.number().nonnegative(),
  }),
  modelMetadata: z.object({
    framework: z.string(),
    quickThinkModel: z.string(),
    deepThinkModel: z.string(),
  }),
})

export type Trace = z.infer<typeof TraceSchema>
