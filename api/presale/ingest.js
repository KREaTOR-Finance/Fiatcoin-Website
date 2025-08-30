import xrpl from "xrpl";
import { kvGet, kvSet, kvHSet, kvZAdd, kvIncrByFloat } from "../_lib/kv.js";

export default async function handler(req, res){
  const secret = req.query?.secret || req.headers["x-presale-secret"];
  if (secret !== process.env.INGEST_SECRET) return res.status(401).json({ok:false,error:"unauthorized"});

  const dest = process.env.PRESALE_DESTINATION || process.env.NEXT_PUBLIC_PRESALE_ADDRESS || "rsvjkcy91roaSeEdokijvmCbFBLoDFoXRP";
  const cutoff = Number(process.env.SNAPSHOT_CUTOFF_LEDGER || 0) || Infinity;
  const cursorKey = "presale:cursor";
  const last = (await kvGet(cursorKey)) || { ledger_index: 0 };
  const startLedger = last.ledger_index + 1;

  const client = new xrpl.Client(process.env.XRPL_WSS || "wss://xrplcluster.com");
  await client.connect();

  let marker = null, seen = 0, newestLedger = last.ledger_index;
  try {
    do {
      const resp = await client.request({
        command: "account_tx",
        account: dest,
        ledger_index_min: startLedger,
        ledger_index_max: cutoff === Infinity ? -1 : cutoff,
        binary: false,
        forward: true,
        limit: 200,
        marker
      });
      marker = resp.result.marker || null;
      for(const t of resp.result.transactions || []){
        const { tx, meta, validated } = t;
        if(!validated) continue;
        if(tx.TransactionType !== "Payment") continue;
        if(tx.Destination !== dest) continue;
        const drops = meta?.delivered_amount ?? tx.Amount;
        const amountXrp = typeof drops === "string" ? Number(drops)/1_000_000 : 0;
        if (amountXrp <= 0) continue;
        const hash = tx.hash;
        const from = tx.Account;
        const ts = t?.tx?.date ? xrpl.rippleTimeToUnixTime(t.tx.date) : Date.now();

        const txKey = `presale:tx:${hash}`;
        await kvHSet(txKey, { hash: JSON.stringify(hash), from: JSON.stringify(from) }).catch(()=>{});
        const addrKey = `presale:addr:${from}`;
        await kvIncrByFloat(`${addrKey}:xrp`, amountXrp);
        await kvZAdd("presale:recent", ts, JSON.stringify({hash, from, amountXrp, ts}));
        await kvIncrByFloat(`presale:leader:${from}`, amountXrp);
        await kvIncrByFloat(`presale:total:xrp`, amountXrp);
        seen++; newestLedger = Math.max(newestLedger, t.ledger_index || 0);
      }
    } while(marker);
  } finally {
    await client.disconnect();
  }

  if(newestLedger > last.ledger_index) await kvSet(cursorKey, { ledger_index: newestLedger });
  return res.json({ ok:true, seen, newestLedger });
}


