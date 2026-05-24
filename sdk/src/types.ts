import type { Hex } from 'viem'
import type { Trace } from './schema.js'

/**
 * Chain config for the registry deployment.
 * The SDK does not bundle any chain or address — callers supply both.
 * This is intentional: the registry compiles and deploys on any EVM chain.
 */
export interface ChainConfig {
  /** EVM chain id (e.g. 5042002 for Arc testnet) */
  chainId: number
  /** RPC URL */
  rpc: string
  /** Optional human-friendly chain name (used only in viem's chain object) */
  name?: string
  /** Optional native currency override (defaults to ETH 18 decimals — Arc uses USDC 6) */
  nativeCurrency?: { name: string; symbol: string; decimals: number }
}

/**
 * Constructor config for the AgentRegistry SDK client.
 */
export interface AgentRegistryConfig {
  /** EOA private key (0x-prefixed hex) used to sign transactions */
  privateKey: Hex | string
  /** Deployed AgentRegistry contract address */
  address: Hex | string
  /** Chain config */
  chain: ChainConfig
}

export interface PublishTraceParams {
  agentId: Hex | string
  marketId: Hex | string
  /** The trace object — will be hashed via canonical-JSON keccak256 */
  trace: Trace | Record<string, unknown>
  /** Content-addressed receipt for the trace body (typically an Irys/Arweave id) */
  irysReceipt: string
  /** Rating in [-3, 3] */
  rating: number
  /** Confidence in basis points [0, 10000] */
  confidenceBps: number
}

export interface RegisterResult {
  agentId: Hex
  txHash: Hex
}

export interface PublishResult {
  traceHash: Hex
  txHash: Hex
}
