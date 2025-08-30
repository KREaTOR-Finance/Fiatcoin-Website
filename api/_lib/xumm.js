import { XummSdk } from "xumm-sdk";

function getSdk(){
  const key = process.env.XUMM_API_KEY;
  const secret = process.env.XUMM_API_SECRET;
  if(!key || !secret) throw new Error("missing_xumm_credentials");
  return new XummSdk(key, secret);
}

export async function xummCreatePayload(body){
  const sdk = getSdk();
  return sdk.payload.create(body);
}

export async function xummGetPayload(uuid){
  const sdk = getSdk();
  return sdk.payload.get(uuid, true);
}

export default { xummCreatePayload, xummGetPayload };


