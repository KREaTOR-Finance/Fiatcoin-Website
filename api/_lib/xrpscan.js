const BASE = process.env.XRPSCAN_API || "https://api.xrpscan.com";

export async function xrpscan(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`XRPSCAN ${r.status} ${path}`);
  return r.json();
}

// Pull up to limitPages pages of txs to dest
export async function fetchPaymentsTo(dest, { limitPages = 60 } = {}) {
  let page = 1, all = [];
  while (page <= limitPages) {
    const rows = await xrpscan(`/api/v1/account/${dest}/transactions?page=${page}`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    const hits = rows.filter(r => r?.tx?.TransactionType === "Payment" && r?.tx?.Destination === dest);
    all.push(...hits);
    if (rows.length < 25) break;
    page++;
  }
  return all;
}

export default { xrpscan, fetchPaymentsTo };


