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

export default { getClient, formatIssuedAmount, isClassic };


