function isXrpAmount(a) { return typeof a === 'string' && /^[0-9]+$/.test(a); }

export default async function handler(req, res) {
  const { hash } = req.query || {};
  if (!hash || typeof hash !== 'string') return res.status(400).json({ ok: false, error: 'bad_hash' });
  const result = { ok: true, validated: false, tx: null };

  // Try Ripple Data API
  try {
    const r = await fetch(`https://data.ripple.com/v2/transactions/${hash}`);
    if (r.ok) {
      const d = await r.json();
      if (d && d.validated && d.tx) {
        const tx = d.tx || d?.transaction || {};
        const meta = d.meta || {};
        const delivered = typeof meta?.delivered_amount === 'string' ? meta.delivered_amount : (typeof tx?.Amount === 'string' ? tx.Amount : undefined);
        const amountXrp = delivered && isXrpAmount(delivered) ? Number(delivered) / 1_000_000 : null;
        result.validated = Boolean(d.validated);
        result.tx = {
          hash: tx.hash || hash,
          from: tx.Account,
          to: tx.Destination,
          amountXrp,
          memo: Array.isArray(tx.Memos) && tx.Memos[0]?.Memo?.MemoData ? tx.Memos[0].Memo.MemoData : undefined,
          dateIso: typeof tx.date === 'number' ? new Date((tx.date + 946684800) * 1000).toISOString() : undefined,
        };
        return res.json(result);
      }
    }
  } catch {}

  // Fallback to XRPSCAN
  try {
    const r = await fetch(`https://api.xrpscan.com/api/v1/transaction/${hash}`);
    if (r.ok) {
      const d = await r.json();
      const tx = d?.tx || d || {};
      const meta = d?.meta || {};
      const delivered = typeof meta?.delivered_amount === 'string' ? meta.delivered_amount : (typeof tx?.Amount === 'string' ? tx.Amount : undefined);
      const amountXrp = delivered && isXrpAmount(delivered) ? Number(delivered) / 1_000_000 : (typeof d?.amount === 'number' ? d.amount : null);
      result.validated = Boolean(d?.validated ?? d?.success);
      result.tx = {
        hash: tx.hash || hash,
        from: tx.Account || d?.Account || d?.account,
        to: tx.Destination || d?.Destination || d?.destination,
        amountXrp,
        memo: Array.isArray(tx.Memos) && tx.Memos[0]?.Memo?.MemoData ? tx.Memos[0].Memo.MemoData : undefined,
        dateIso: d?.date ? new Date(d.date).toISOString() : undefined,
      };
      return res.json(result);
    }
  } catch {}

  return res.json(result);
}


