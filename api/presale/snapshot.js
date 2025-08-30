import { kvGet, kvSet } from "../_lib/kv.js";

function readJson(req){ return new Promise((resolve,reject)=>{ let b=""; req.on("data",c=>b+=c); req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch(e){reject(e)}})}); }

export default async function handler(req,res){
  const secret = req.query?.secret || req.headers["x-presale-secret"];
  if (secret !== process.env.INGEST_SECRET) return res.status(401).json({ok:false,error:"unauthorized"});
  const body = await readJson(req);
  const addrMap = body?.addresses || {};
  const totalXrp = Object.values(addrMap).reduce((a,b)=>a+Number(b||0),0);
  if (totalXrp <= 0) return res.status(400).json({ok:false,error:"no_total"});
  const PRESALE_TOKENS = 50_000_000_000;
  const rate = PRESALE_TOKENS / totalXrp;
  const snapshot = Object.fromEntries(Object.entries(addrMap).map(([a,x]) => [a, String(Number(x)*rate)]));
  await kvSet("presale:snapshot:current", { rate, totalXrp, snapshot, at: Date.now() });
  return res.json({ ok:true, rate, totalXrp, count: Object.keys(snapshot).length });
}


