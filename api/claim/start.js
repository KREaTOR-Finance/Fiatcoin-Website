import xrpl from "xrpl";
import { getClient, formatIssuedAmount, isClassic } from "../_lib/xrpl.js";

function readJson(req) {
  return new Promise((resolve, reject) => {
    let b = ""; req.on("data", c => b += c); req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch (e) { reject(e); } });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { address } = await readJson(req);
    if (!isClassic(address)) return res.status(400).json({ ok: false, error: "bad_address" });

    let SNAPSHOT = {};
    try { SNAPSHOT = JSON.parse(process.env.SNAPSHOT_JSON || "{}"); } catch {}
    const amountOwed = SNAPSHOT[address];
    if (!amountOwed) return res.status(404).json({ ok: false, error: "not_in_snapshot" });

    const client = await getClient();
    const issuer = process.env.ISSUER_ADDRESS;
    const currency = process.env.CURRENCY_CODE || "FIAT";
    const lines = await client.request({ command: "account_lines", account: address, peer: issuer });
    const hasLine = (lines.result.lines || []).some(l => l.account === issuer && l.currency === currency);
    if (!hasLine) { await client.disconnect(); return res.status(400).json({ ok: false, error: "no_trustline" }); }

    const wallet = xrpl.Wallet.fromSeed(process.env.ISSUER_SECRET);
    const tx = { TransactionType: "Payment", Account: issuer, Destination: address, Amount: formatIssuedAmount(amountOwed, currency, issuer) };
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const submit = await client.submitAndWait(signed.tx_blob);
    const hash = submit?.result?.hash || signed.hash;
    await client.disconnect();
    return res.json({ ok: true, phase: "confirmed", txHash: hash });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
}


