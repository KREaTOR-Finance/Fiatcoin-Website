import { xummCreatePayload } from "../_lib/xumm.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_xumm_credentials" });
    }
    const dest = process.env.PRESALE_DESTINATION || process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
    if (!dest) return res.status(400).json({ ok: false, error: "missing_PRESALE_DESTINATION" });
    const body = req.body || {};
    const amountXrp = body.amountXrp;
    const value = Number(amountXrp);
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ ok: false, error: "invalid_amount" });

    // XRPL Memos require hex-encoded strings
    const memoText = "FIATCOIN PRESALE";
    const memoType = "text";
    const txjson = {
      TransactionType: "Payment",
      Destination: dest,
      Amount: String(Math.round(value * 1_000_000)),
      Memos: [
        { Memo: { MemoType: Buffer.from(memoType, 'utf8').toString('hex'), MemoData: Buffer.from(memoText, 'utf8').toString('hex') } }
      ],
    };

    const payload = {
      txjson,
      options: { return_url: { web: "https://fiatcoin.app/#/presale" } },
      custom_meta: { instruction: "FIATCOIN Presale contribution" },
    };

    const out = await xummCreatePayload(payload);
    return res.json({ ok: true, uuid: out.uuid, deeplink: out.next?.always, qrPng: out.refs?.qr_png });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "xumm_error", detail: String(e?.message || e) });
  }
}


