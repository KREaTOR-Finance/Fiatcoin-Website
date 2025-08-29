const base = "https://xumm.app/api/v1";

function headers() {
  return {
    "Content-Type": "application/json",
    "X-API-Key": process.env.XUMM_API_KEY,
    "X-API-Secret": process.env.XUMM_API_SECRET,
  };
}

export async function xummCreatePayload(body) {
  const r = await fetch(`${base}/payload`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`xummCreatePayload ${r.status}`);
  return r.json();
}

export async function xummGetPayload(uuid) {
  const r = await fetch(`${base}/payload/${uuid}`, { headers: headers() });
  if (!r.ok) throw new Error(`xummGetPayload ${r.status}`);
  return r.json();
}

export default { xummCreatePayload, xummGetPayload };


