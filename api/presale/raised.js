import { getClient } from "../_lib/xrpl.js";

function isXrpAmount(a) {
  return typeof a === "string" && /^[0-9]+$/.test(a);
}

export default async function handler(req, res) {
  try {
    // Allow override via query param, else use env, else fallback placeholder
    const q = req.query || {};
    const addrFromQuery = typeof q.address === "string" ? q.address : undefined;
    const address = (addrFromQuery && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addrFromQuery))
      ? addrFromQuery
      : (process.env.PRESALE_ADDRESS || process.env.NEXT_PUBLIC_PRESALE_ADDRESS || "rsvjkcy91roaSeEdokijvmCbFBLoDFoXRP");

    let drops = 0n;
    let txCount = 0;
    const events = [];

    try {
      const client = await getClient();
      // Use live account XRP balance as primary raised metric
      try {
        const ai = await client.request({ command: 'account_info', account: address, ledger_index: 'validated' });
        const balDrops = BigInt(ai?.result?.account_data?.Balance || 0);
        drops = balDrops;
      } catch {}
      let marker = undefined;
      do {
        const r = await client.request({
          command: "account_tx",
          account: address,
          ledger_index_min: -1,
          ledger_index_max: -1,
          limit: 200,
          binary: false,
          forward: false,
          marker,
        });
        for (const it of r.result.transactions || []) {
          const tx = it.tx || {};
          const meta = it.meta || {};
          if (it.validated !== true) continue;
          if (meta?.TransactionResult !== "tesSUCCESS") continue;
          if (tx.TransactionType !== "Payment") continue;
          if (tx.Destination !== address) continue;
          let incDrops = 0n;
          if (isXrpAmount(tx.Amount)) incDrops = BigInt(tx.Amount);
          else if (isXrpAmount(meta.delivered_amount)) incDrops = BigInt(meta.delivered_amount);
          else if (isXrpAmount(meta.DeliveredAmount)) incDrops = BigInt(meta.DeliveredAmount);
          if (incDrops > 0n) {
            drops += incDrops; txCount += 1;
            const amountXrp = Number(incDrops) / 1_000_000;
            const hash = tx.hash || it.hash || meta?.hash;
            events.push({ from: tx.Account, amountXrp, txHash: hash });
          }
        }
        marker = r.result.marker;
      } while (marker);
      await client.disconnect();
    } catch {}

    // XRPSCAN enrichment (best-effort)
    try {
      const url = `https://api.xrpscan.com/api/v1/account/${address}/transactions?type=Payment&result=tesSUCCESS&count=25&descending=true`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'fiatcoin-app' } });
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.transactions) ? data.transactions : []);
        for (const it of list) {
          const tx = it.tx || it || {};
          const meta = it.meta || {};
          const txType = tx.TransactionType || it.tx_type;
          if (txType !== 'Payment') continue;
          const dest = tx.Destination || it.Destination || it.destination;
          if (dest !== address) continue;
          let amtDrops;
          if (typeof tx.Amount === 'string' && isXrpAmount(tx.Amount)) amtDrops = BigInt(tx.Amount);
          else if (typeof meta.delivered_amount === 'string' && isXrpAmount(meta.delivered_amount)) amtDrops = BigInt(meta.delivered_amount);
          else if (typeof meta.DeliveredAmount === 'string' && isXrpAmount(meta.DeliveredAmount)) amtDrops = BigInt(meta.DeliveredAmount);
          else if (typeof it.amount === 'number') amtDrops = BigInt(Math.round(it.amount * 1_000_000));
          if (amtDrops) {
            const hash = tx.hash || it.hash || tx.tx?.hash;
            events.push({ from: tx.Account || it.Account || it.account, amountXrp: Number(amtDrops)/1_000_000, txHash: hash });
          }
        }
      }
    } catch {}

    // Final fallback: ripple data API
    if (events.length === 0) {
      try {
        const url = `https://data.ripple.com/v2/accounts/${address}/transactions?type=Payment&result=tesSUCCESS&limit=50&descending=true`;
        const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'fiatcoin-app' } });
        if (r.ok) {
          const data = await r.json();
          const list = Array.isArray(data?.transactions) ? data.transactions : [];
          for (const it of list) {
            const tx = it?.tx || {};
            const meta = it?.meta || {};
            if (tx?.TransactionType !== 'Payment') continue;
            if (tx?.Destination !== address) continue;
            let amtDrops;
            if (typeof meta?.delivered_amount === 'string' && isXrpAmount(meta.delivered_amount)) amtDrops = BigInt(meta.delivered_amount);
            else if (typeof tx?.Amount === 'string' && isXrpAmount(tx.Amount)) amtDrops = BigInt(tx.Amount);
            if (amtDrops) {
              events.push({ from: tx.Account, amountXrp: Number(amtDrops)/1_000_000, txHash: tx.hash || it?.hash });
            }
          }
        }
      } catch {}
    }

    // Deduplicate by hash and keep most recent 10 if dates exist later
    const seen = new Set();
    const unique = [];
    for (const e of events) {
      const key = e.txHash || `${e.from}:${e.amountXrp}`;
      if (seen.has(key)) continue; seen.add(key); unique.push(e);
    }

    const raisedXrp = Number(drops) / 1_000_000;
    return res.json({ ok: true, address, raisedXrp, txCount, events: unique.slice(0, 10) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
}


