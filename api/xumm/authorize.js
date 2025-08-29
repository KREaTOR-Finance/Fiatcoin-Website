import { xummCreatePayload } from "../_lib/xumm.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const payload = {
    txjson: { TransactionType: "SignIn" },
    options: { return_url: { web: "https://fiatcoin.app/#/claim" } },
  };
  try {
    const out = await xummCreatePayload(payload);
    return res.json({ ok: true, uuid: out.uuid, deeplink: out.next?.always, qrPng: out.refs?.qr_png });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "xumm_error", detail: String(e?.message || e) });
  }
}


