import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { AGENT_REGISTRY_ABI } from './abi.js'
import { hashTrace } from './hash.js'
import type {
  AgentRegistryConfig,
  ChainConfig,
  PublishResult,
  PublishTraceParams,
  RegisterResult,
} from './types.js'

function buildChain(cfg: ChainConfig) {
  return defineChain({
    id: cfg.chainId,
    name: cfg.name ?? `chain-${cfg.chainId}`,
    nativeCurrency: cfg.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpc] } },
  })
}

function normalizeHex(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex
}

/**
 * SDK client for AgentRegistry.
 *
 * The client is intentionally thin: it wraps `registerAgent()` and
 * `publishTrace()` with viem, parses the AgentRegistered event from the
 * registration receipt to surface the new bytes32 agentId, and hashes the
 * trace body before submitting.
 *
 * No chain or address is bundled. Callers supply both, so the SDK works
 * against any deployment of AgentRegistry.sol on any EVM chain.
 */
export class AgentRegistry {
  readonly address: Address
  readonly chainConfig: ChainConfig
  private readonly walletClient: WalletClient
  private readonly publicClient: PublicClient
  private readonly account: ReturnType<typeof privateKeyToAccount>

  constructor(config: AgentRegistryConfig) {
    this.address = normalizeHex(config.address) as Address
    this.chainConfig = config.chain
    this.account = privateKeyToAccount(normalizeHex(config.privateKey))

    const chain = buildChain(config.chain)
    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(config.chain.rpc),
    })
    this.publicClient = createPublicClient({
      chain,
      transport: http(config.chain.rpc),
    })
  }

  /** The owner address derived from the configured private key. */
  get ownerAddress(): Address {
    return this.account.address
  }

  /**
   * Register a new agent. Returns the bytes32 agentId (parsed from the
   * AgentRegistered event in the tx receipt) and the transaction hash.
   */
  async register(): Promise<RegisterResult> {
    const txHash = await this.walletClient.writeContract({
      address: this.address,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'registerAgent',
      account: this.account,
      chain: this.walletClient.chain,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: AGENT_REGISTRY_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'AgentRegistered') {
          return { agentId: decoded.args.agentId as Hex, txHash }
        }
      } catch {
        // not this event; keep scanning
      }
    }
    throw new Error('AgentRegistered event not found in transaction receipt')
  }

  /**
   * Publish a trace. The trace body is hashed via canonical-JSON keccak256;
   * the on-chain event stores the hash + the irysReceipt that points to the body.
   *
   * Idempotency: the contract is append-only and does not deduplicate. Callers
   * who need at-most-once semantics should derive a deterministic
   * (agentId, marketId, generatedAt) key off-chain and skip re-publication
   * themselves.
   */
  async publishTrace(params: PublishTraceParams): Promise<PublishResult> {
    if (params.rating < -3 || params.rating > 3) {
      throw new Error(`rating ${params.rating} out of range [-3, 3]`)
    }
    if (params.confidenceBps < 0 || params.confidenceBps > 10000) {
      throw new Error(`confidenceBps ${params.confidenceBps} out of range [0, 10000]`)
    }

    const traceHash = hashTrace(params.trace as Record<string, unknown>)

    const txHash = await this.walletClient.writeContract({
      address: this.address,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'publishTrace',
      args: [
        normalizeHex(params.agentId as string),
        normalizeHex(params.marketId as string),
        traceHash,
        params.rating,
        params.confidenceBps,
        params.irysReceipt,
      ],
      account: this.account,
      chain: this.walletClient.chain,
    })

    return { traceHash, txHash }
  }

  /** Read the owner of an agentId. Returns the zero address if unregistered. */
  async getAgentOwner(agentId: Hex | string): Promise<Address> {
    return this.publicClient.readContract({
      address: this.address,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'agentOwner',
      args: [normalizeHex(agentId as string)],
    })
  }
}
