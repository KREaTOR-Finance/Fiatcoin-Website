import { fetchPaymentsTo } from "../_lib/xrpscan.js";
import xrpl from "xrpl";

export default async function handler(req, res) {
  const dest = process.env.PRESALE_DESTINATION;
  if (!dest) return res.status(400).json({ ok: false, error: "missing_PRESALE_DESTINATION" });

  const top = Math.min(Math.max(Number(req.query.top || 25), 1), 200);

  try {
    const client = new xrpl.Client(process.env.XRPL_WSS || "wss://xrplcluster.com");
    await client.connect();

    const startLedger = Number(process.env.PRESALE_START_LEDGER || 0) || -1;
    let marker = null; const byAddr = new Map(); let fetched = 0;

    do {
      const resp = await client.request({
        command: "account_tx",
        account: dest,
        ledger_index_min: startLedger,
        ledger_index_max: -1,
        forward: true,
        limit: 200,
        marker
      });
      marker = resp.result.marker || null; fetched += (resp.result.transactions || []).length;

      for (const t of resp.result.transactions || []) {
        if (!t.validated) continue; const { tx, meta } = t;
        if (tx.TransactionType !== "Payment" || tx.Destination !== dest) continue;
        const drops = meta?.delivered_amount ?? tx.Amount; const amt = typeof drops === 'string' ? Number(drops) / 1_000_000 : 0; if (amt <= 0) continue;
        const from = tx.Account; const ts = tx?.date ? xrpl.rippleTimeToUnixTime(tx.date) : Date.now();
        const prev = byAddr.get(from) || { totalXrp: 0, count: 0, last: 0 }; prev.totalXrp += amt; prev.count += 1; prev.last = Math.max(prev.last, ts); byAddr.set(from, prev);
      }
    } while (marker);

    await client.disconnect();
    const leaderboard = [...byAddr.entries()].map(([address, v]) => ({ address, ...v })).sort((a, b) => b.totalXrp - a.totalXrp).slice(0, top);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    return res.json({ ok: true, address: dest, leaderboard, fetchedTxs: fetched, updatedAt: Date.now(), source: "xrpl:wss" });
  } catch (e) {
    const limitPages = Math.min(Math.max(Number(req.query.pages || 60), 1), 200);
    const txs = await fetchPaymentsTo(dest, { limitPages });
    const byAddr = new Map();
    for (const row of txs) {
      const from = row?.tx?.Account; if (!from) continue;
      const drops = row?.meta?.delivered_amount ?? row?.tx?.Amount; const xrp = typeof drops === 'string' ? Number(drops) / 1_000_000 : 0; if (xrp <= 0) continue;
      const when = ((row?.tx?.date_unix || row?.date || 0) * 1000) || Date.now();
      const prev = byAddr.get(from) || { totalXrp: 0, count: 0, last: 0 }; prev.totalXrp += xrp; prev.count += 1; prev.last = Math.max(prev.last, when); byAddr.set(from, prev);
    }
    const leaderboard = [...byAddr.entries()].map(([address, v]) => ({ address, ...v })).sort((a, b) => b.totalXrp - a.totalXrp).slice(0, top);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    return res.json({ ok: true, address: dest, leaderboard, updatedAt: Date.now(), source: "xrpscan:fallback" });
  }
}


