import xrpl from "xrpl";

export async function getClient() {
  const url = process.env.XRPL_WSS || "wss://xrplcluster.com";
  const client = new xrpl.Client(url);
  await client.connect();
  return client;
}

export function formatIssuedAmount(value, currency, issuer) {
  return { currency, issuer, value: String(value) };
}

export function isClassic(addr = "") {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr);
}

// Helpers
export function dropsToXrp(drops) {
  return typeof drops === "string" ? Number(drops) / 1_000_000 : 0;
}

export function rippleToUnix(rippleTs) {
  return rippleTs ? xrpl.rippleTimeToUnixTime(rippleTs) : Date.now();
}

export default { getClient, formatIssuedAmount, isClassic };


