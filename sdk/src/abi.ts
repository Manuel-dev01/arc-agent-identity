/**
 * Minimal AgentRegistry ABI, only the surface the SDK calls.
 * The full ABI is emitted by `forge build` at contracts/out/AgentRegistry.sol/AgentRegistry.json
 * if you need event decoding for everything.
 */
export const AGENT_REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'bytes32' }],
  },
  {
    name: 'publishTrace',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'bytes32' },
      { name: 'marketId', type: 'bytes32' },
      { name: 'traceHash', type: 'bytes32' },
      { name: 'rating', type: 'int8' },
      { name: 'confidenceBps', type: 'uint16' },
      { name: 'irysReceipt', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'agentOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TracePublished',
    inputs: [
      { name: 'agentId', type: 'bytes32', indexed: true },
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'traceHash', type: 'bytes32', indexed: false },
      { name: 'rating', type: 'int8', indexed: false },
      { name: 'confidenceBps', type: 'uint16', indexed: false },
      { name: 'irysReceipt', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const
