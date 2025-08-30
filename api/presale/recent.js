export default async function handler(req,res){
  const address = process.env.PRESALE_DESTINATION || process.env.NEXT_PUBLIC_PRESALE_ADDRESS || "rsvjkcy91roaSeEdokijvmCbFBLoDFoXRP";
  let recent = [];
  try {
    const url = `https://data.ripple.com/v2/accounts/${address}/transactions?type=Payment&result=tesSUCCESS&limit=10&descending=true`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (r.ok) {
      const d = await r.json();
      const list = Array.isArray(d?.transactions) ? d.transactions : [];
      recent = list.map((row)=>{
        const tx = row?.tx || {}; const meta = row?.meta || {};
        const drops = typeof meta?.delivered_amount === 'string' ? meta.delivered_amount : (typeof tx?.Amount === 'string' ? tx.Amount : undefined);
        const amountXrp = drops ? Number(drops)/1_000_000 : 0;
        return { from: tx.Account, amountXrp, txHash: tx.hash || row?.hash };
      });
    }
  } catch {}
  return res.json({ ok:true, recent });
}


