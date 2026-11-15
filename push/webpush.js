// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) on Web Crypto — runs in Cloudflare Workers and Node 20.
const te = new TextEncoder();
export const b64u = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
};
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
/** Encrypts `plain` (Uint8Array) for a subscription's {p256dh, auth}. `t` = optional {as: CryptoKeyPair, salt} for tests. */
export async function encryptPayload(keys, plain, t = {}) {
  const ua = b64u.dec(keys.p256dh), authSecret = b64u.dec(keys.auth);
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const as = t.as || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, cat(te.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = t.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, cat(plain, new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, ct);
}
/** VAPID Authorization header value. `privJwk` = the private ECDSA P-256 JWK, `pub` = base64url uncompressed public key. */
export async function vapidAuth(endpoint, pub, privJwk, subject) {
  const hdr = b64u.enc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u.enc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(hdr + "." + body));
  return `vapid t=${hdr}.${body}.${b64u.enc(sig)}, k=${pub}`;
}
/** Sends one push. Returns the HTTP status (404/410 = the subscription is gone). */
export async function sendPush(sub, payload, env) {
  const body = await encryptPayload({ p256dh: sub.p256dh, auth: sub.auth }, te.encode(JSON.stringify(payload)));
  const res = await fetch(sub.endpoint, { method: "POST", body, headers: {
    Authorization: await vapidAuth(sub.endpoint, env.VAPID_PUBLIC, JSON.parse(env.VAPID_PRIVATE_JWK), env.VAPID_SUBJECT),
    "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "high" } });
  return res.status;
}
