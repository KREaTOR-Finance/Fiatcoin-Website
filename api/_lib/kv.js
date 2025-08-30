const base = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

async function kv(path, body) {
  if (!base || !token) throw new Error("KV env not configured");
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`KV ${path} ${r.status}`);
  return r.json();
}

export async function kvSet(key, value){ return kv("/set", { key, value: JSON.stringify(value) }); }
export async function kvGet(key){
  const r = await kv("/get", { key });
  return r?.result ? JSON.parse(r.result) : null;
}
export async function kvHSet(key, map){ return kv("/hset", { key, map }); }
export async function kvHGetAll(key){
  const r = await kv("/hgetall", { key });
  return r?.result ? Object.fromEntries(r.result.map(({field,value}) => [field, JSON.parse(value)])) : {};
}
export async function kvZAdd(key, score, member){ return kv("/zadd", { key, score, member }); }
export async function kvZRevRange(key, start, stop){ return kv("/zrevrange", { key, start, stop }); }
export async function kvIncrByFloat(key, amount){ return kv("/incrbyfloat", { key, amount }); }

export default { kvSet, kvGet, kvHSet, kvHGetAll, kvZAdd, kvZRevRange, kvIncrByFloat };


