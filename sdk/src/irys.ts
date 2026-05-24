/**
 * Irys HTTP upload utility.
 *
 * Uses the Irys HTTP gateway directly — no Node.js SDK dependency. This means
 * the upload path works from any runtime that has fetch() (Node, Deno, Bun,
 * browser, edge functions, Python via httpx, etc).
 *
 * Tradeoff: HTTP-only uploads support the public gateway path. If you need
 * paid permanent storage, signed receipts, or large files, use @irys/sdk
 * directly from a Node process and pass the resulting id into publishTrace().
 */

const DEFAULT_IRYS_NODE = 'https://node2.irys.xyz'

export interface IrysUploadResult {
  /** The Irys transaction id — store this on-chain as the irysReceipt */
  id: string
  /** Alias for id, kept for backward compatibility */
  receipt: string
}

export async function uploadToIrys(
  data: Record<string, unknown>,
  irysNodeUrl: string = DEFAULT_IRYS_NODE,
): Promise<IrysUploadResult> {
  const resp = await fetch(`${irysNodeUrl}/tx/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Irys upload failed: ${resp.status} ${text}`)
  }

  const result = (await resp.json()) as { id?: string; receipt?: string }
  const id = result.id || result.receipt
  if (!id) throw new Error('Irys upload returned no id')
  return { id, receipt: id }
}
