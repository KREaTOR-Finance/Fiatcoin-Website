import { kvGet } from "../_lib/kv.js";

export default async function handler(req, res) {
  const address = String((req.query?.address || "")).trim();
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) return res.status(400).json({ ok: false, error: "bad_address" });
  let snap = await kvGet("presale:snapshot:current");
  let SNAPSHOT = snap?.snapshot || {};
  if (!Object.keys(SNAPSHOT).length) { try { SNAPSHOT = JSON.parse(process.env.SNAPSHOT_JSON || "{}"); } catch {} }
  const amount = SNAPSHOT[address];
  if (!amount) return res.status(404).json({ ok: false, error: "not_in_snapshot" });
  return res.json({ ok: true, address, amount });
}


