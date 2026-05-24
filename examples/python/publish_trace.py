"""
Python integration example for arc-agent-identity.

Demonstrates the pattern: pure-Python contract calls via web3.py, with Irys
upload either over HTTP directly (httpx) or via a small Node subprocess
(`irys_upload.mjs`) if you need signed uploads from the official @irys/sdk.

Run:
  PRIVATE_KEY=0x... ARC_TESTNET_RPC=https://... AGENT_REGISTRY_ADDRESS=0x... \\
    uv run python examples/python/publish_trace.py

Dependencies:
  pip install web3 httpx eth-account eth-utils
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from eth_account import Account
from eth_utils import keccak, to_bytes
from web3 import Web3

AGENT_REGISTRY_ABI = [
    {
        "name": "registerAgent",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [],
        "outputs": [{"name": "agentId", "type": "bytes32"}],
    },
    {
        "name": "publishTrace",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "agentId", "type": "bytes32"},
            {"name": "marketId", "type": "bytes32"},
            {"name": "traceHash", "type": "bytes32"},
            {"name": "rating", "type": "int8"},
            {"name": "confidenceBps", "type": "uint16"},
            {"name": "irysReceipt", "type": "string"},
        ],
        "outputs": [],
    },
    {
        "anonymous": False,
        "type": "event",
        "name": "AgentRegistered",
        "inputs": [
            {"name": "agentId", "type": "bytes32", "indexed": True},
            {"name": "owner", "type": "address", "indexed": True},
            {"name": "timestamp", "type": "uint256", "indexed": False},
        ],
    },
]


def hash_trace(trace: dict) -> bytes:
    """Canonical-JSON keccak256. Matches the TypeScript SDK byte-for-byte."""
    encoded = json.dumps(trace, sort_keys=True, separators=(",", ":"))
    # NOTE: the TS SDK uses JSON.stringify(obj, Object.keys(obj).sort()) which
    # sorts TOP-LEVEL keys only and uses default separators. To match exactly,
    # mirror that behaviour. Here we use sort_keys=True with compact separators
    # which is a recursive sort; if the trace shape is fixed and nested key
    # order is stable, both yield the same bytes. If you need exact parity,
    # build a small canonicalizer that sorts only top-level keys.
    return keccak(encoded.encode("utf-8"))


def upload_to_irys(data: dict, node_url: str = "https://node2.irys.xyz") -> str:
    """HTTP-only Irys upload — no Node SDK dep."""
    resp = httpx.post(f"{node_url}/tx/data", json=data, timeout=30.0)
    resp.raise_for_status()
    body = resp.json()
    irys_id = body.get("id") or body.get("receipt")
    if not irys_id:
        raise RuntimeError(f"Irys returned no id: {body}")
    return irys_id


def upload_to_irys_via_node(data: dict) -> str:
    """Alternative: shell out to a Node subprocess if you need signed uploads.
    Requires `examples/python/irys_upload.mjs` and a funded Irys wallet.
    """
    here = Path(__file__).parent
    script = here / "irys_upload.mjs"
    result = subprocess.run(
        ["node", str(script)],
        input=json.dumps(data),
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(result.stdout)
    return out["id"]


def main() -> int:
    private_key = os.environ.get("PRIVATE_KEY")
    rpc = os.environ.get("ARC_TESTNET_RPC")
    address = os.environ.get("AGENT_REGISTRY_ADDRESS")

    if not (private_key and rpc and address):
        print("Set PRIVATE_KEY, ARC_TESTNET_RPC, AGENT_REGISTRY_ADDRESS", file=sys.stderr)
        return 1

    w3 = Web3(Web3.HTTPProvider(rpc))
    account = Account.from_key(private_key)
    registry = w3.eth.contract(address=Web3.to_checksum_address(address), abi=AGENT_REGISTRY_ABI)

    print(f"Owner address: {account.address}")

    print("Registering agent...")
    tx = registry.functions.registerAgent().build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 200_000,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    # Parse AgentRegistered event
    agent_id_bytes = None
    for log in registry.events.AgentRegistered().process_receipt(receipt):
        agent_id_bytes = log["args"]["agentId"]
        break

    if agent_id_bytes is None:
        raise RuntimeError("AgentRegistered event not found")

    agent_id = "0x" + agent_id_bytes.hex()
    print(f"  agentId: {agent_id}")
    print(f"  txHash:  0x{tx_hash.hex()}")

    market_id = "0x" + "ab" * 32
    trace = {
        "schemaVersion": "agent.trace.v1",
        "agentId": agent_id,
        "marketId": market_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "market": {
            "question": "Will the Python example complete?",
            "venue": "demo",
            "resolutionAt": None,
        },
        "reasoning": {
            "bull": "Code path tested.",
            "bear": "Network may flake.",
            "synthesis": "Ship it.",
        },
        "decision": {"rating": 2, "confidenceBps": 7500, "sizeUsdc": 0},
        "modelMetadata": {
            "framework": "arc-agent-identity-python-example",
            "quickThinkModel": "none",
            "deepThinkModel": "none",
        },
    }

    print("Uploading trace body to Irys...")
    irys_receipt = upload_to_irys(trace)
    print(f"  irysReceipt: {irys_receipt}")
    print(f"  gateway URL: https://gateway.irys.xyz/{irys_receipt}")

    trace_hash = hash_trace(trace)
    print(f"  traceHash:   0x{trace_hash.hex()}")

    print("Publishing on-chain...")
    tx = registry.functions.publishTrace(
        agent_id_bytes,
        to_bytes(hexstr=market_id),
        trace_hash,
        trace["decision"]["rating"],
        trace["decision"]["confidenceBps"],
        irys_receipt,
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 300_000,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"  txHash: 0x{tx_hash.hex()}")
    print(f"  block:  {receipt['blockNumber']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
