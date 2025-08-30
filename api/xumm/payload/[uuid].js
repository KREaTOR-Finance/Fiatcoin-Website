import { xummGetPayload } from "../../_lib/xumm.js";

export default async function handler(req, res) {
  const { uuid } = req.query;
  try {
    const data = await xummGetPayload(uuid);
    const signed = data?.meta?.signed === true;
    const rejected = data?.meta?.signed === false && data?.meta?.resolved === true;
    const account = data?.response?.account || null;
    let amountXrp = null;
    const amt = data?.response?.txjson?.Amount;
    if (typeof amt === "string") amountXrp = Number(amt) / 1_000_000;
    return res.json({ ok: true, status: signed ? "signed" : (rejected ? "rejected" : "pending"), account, amountXrp });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "xumm_error", detail: String(e?.message || e) });
  }
}


