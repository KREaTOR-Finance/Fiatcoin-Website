import { xummCreatePayload } from "../_lib/xumm.js";

export default async function handler(req, res) {
  const dest = process.env.PRESALE_DESTINATION;
  const site = process.env.SITE_ORIGIN || "";
  const xrp = Math.max(0, Number(req.query.xrp || 0));
  const tag = req.query.tag ? Number(req.query.tag) : undefined;

  if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
    return res.status(500).json({ ok: false, error: "missing_xumm_credentials" });
  }

  if (!dest || !xrp) return res.status(400).json({ ok: false, error: "missing_params" });

  const drops = String(Math.round(xrp * 1_000_000));

  const payload = {
    txjson: {
      TransactionType: "Payment",
      Destination: dest,
      Amount: drops,
      ...(Number.isFinite(tag) ? { DestinationTag: tag } : {}),
    },
    options: {
      return_url: { web: `${site || ""}/#contributed` },
    },
    custom_meta: {
      instruction: "Contribute to FIATCOIN presale",
    }
  };

  try {
    const out = await xummCreatePayload(payload);
    return res.json({
      ok: true,
      uuid: out.uuid,
      deeplink: out.next?.always,
      qrPng: out.refs?.qr_png,
      requestedXrp: xrp
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "xumm_create_failed", detail: String(e?.message || e) });
  }
}


