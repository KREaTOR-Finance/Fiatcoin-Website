import xrpl from "xrpl";
import { fetchPaymentsTo, xrpscan } from "../_lib/xrpscan.js";

export default async function handler(req,res){
  const dest = process.env.PRESALE_DESTINATION;
  if(!dest){
    return res.status(400).json({ ok:false, error: "missing_PRESALE_DESTINATION" });
  }
  const startLedger = Number(process.env.PRESALE_START_LEDGER || 0) || -1;
  const target = 50_000;

  try {
    const client = new xrpl.Client(process.env.XRPL_WSS || "wss://xrplcluster.com");
    await client.connect();
    let marker = null, total = 0;
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
      marker = resp.result.marker || null;
      for(const t of resp.result.transactions || []){
        if(!t.validated) continue;
        const { tx, meta } = t;
        if(tx.TransactionType !== "Payment") continue;
        if(tx.Destination !== dest) continue;
        const delivered = meta?.delivered_amount ?? tx.Amount;
        if(typeof delivered === "string") total += Number(delivered)/1_000_000;
      }
    } while(marker);
    const info = await client.request({ command: "account_info", account: dest, ledger_index: "validated" });
    const bal = Number(info.result.account_data.Balance)/1_000_000;
    await client.disconnect();
    const percent = target ? Math.min(100, (total/target)*100) : 0;
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=600");
    return res.json({ ok:true, address: dest, totalXrp: total, walletBalanceXrp: bal, target, percent, updatedAt: Date.now(), source: "xrpl:wss" });
  } catch {
    try {
      const rows = await fetchPaymentsTo(dest, { limitPages: 60 });
      let totalXrp = 0;
      for(const it of rows || []){
        const drops = it?.meta?.delivered_amount ?? it?.tx?.Amount;
        if(typeof drops === "string") totalXrp += Number(drops)/1_000_000;
      }
      // Prefer querying live balance from XRPL even if explorer is used for totals
      let walletBalanceXrp = 0;
      try {
        const backup = new xrpl.Client(process.env.XRPL_WSS || "wss://xrplcluster.com");
        await backup.connect();
        const info = await backup.request({ command: "account_info", account: dest, ledger_index: "validated" });
        walletBalanceXrp = Number(info?.result?.account_data?.Balance || 0) / 1_000_000;
        await backup.disconnect();
      } catch {
        const acct = await xrpscan(`/api/v1/account/${dest}`);
        walletBalanceXrp = acct?.account_data?.Balance ? Number(acct.account_data.Balance)/1_000_000 : 0;
      }
      const percent = target ? Math.min(100, (totalXrp/target)*100) : 0;
      res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=600");
      return res.json({ ok:true, address: dest, totalXrp, walletBalanceXrp, target, percent, updatedAt: Date.now(), source: "xrpscan:fallback" });
    } catch {
      return res.status(502).json({ ok:false, error: "both_sources_failed" });
    }
  }
}


