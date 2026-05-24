export const ARC_AGENT_IDENTITY_VERSION = '0.1.0'

export { AgentRegistry } from './client.js'
export { hashTrace } from './hash.js'
export { uploadToIrys } from './irys.js'
export { TraceSchema } from './schema.js'
export { AGENT_REGISTRY_ABI } from './abi.js'

export type {
  AgentRegistryConfig,
  ChainConfig,
  PublishResult,
  PublishTraceParams,
  RegisterResult,
} from './types.js'
export type { Trace } from './schema.js'
export type { IrysUploadResult } from './irys.js'

/** Arc testnet chain id. Hardcoded for ergonomics; pass any chainId to AgentRegistry. */
export const ARC_TESTNET_CHAIN_ID = 5042002

/** Canonical OSS deployment of AgentRegistry on Arc testnet. */
export const ARC_TESTNET_AGENT_REGISTRY: `0x${string}` = '0x0000000000000000000000000000000000000000'
