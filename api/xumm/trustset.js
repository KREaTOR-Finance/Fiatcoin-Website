import { xummCreatePayload } from "../_lib/xumm.js";

export default async function handler(req, res) {
  const currency = process.env.CURRENCY_CODE || "FIAT";
  const issuer = process.env.ISSUER_ADDRESS || "";
  const LimitAmount = { currency, issuer, value: "100000000000" };
  const payload = {
    txjson: { TransactionType: "TrustSet", LimitAmount },
    options: { return_url: { web: "https://fiatcoin.app/#/claim" } },
  };
  try {
    const out = await xummCreatePayload(payload);
    return res.json({ ok: true, uuid: out.uuid, deeplink: out.next?.always, qrPng: out.refs?.qr_png, note: `TrustSet for ${currency}.${issuer}` });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "xumm_error", detail: String(e?.message || e) });
  }
}


