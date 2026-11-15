import { encryptPayload, b64u } from "./webpush.js";
// RFC 8291 appendix A test vector
const plain = new TextEncoder().encode("When I grow up, I want to be a watermelon");
const asPub = b64u.dec("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
const asPriv = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const jwk = { kty: "EC", crv: "P-256", x: b64u.enc(asPub.slice(1, 33)), y: b64u.enc(asPub.slice(33)), d: asPriv, ext: true };
const as = { publicKey: await crypto.subtle.importKey("jwk", { ...jwk, d: undefined }, { name: "ECDH", namedCurve: "P-256" }, true, []),
             privateKey: await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]) };
const out = await encryptPayload({ p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" }, plain, { as, salt: b64u.dec("DGv6ra1nlYgDCS1FRnbzlw") });
const want = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
console.log(b64u.enc(out) === want ? "RFC8291 vector: MATCH" : "MISMATCH\n" + b64u.enc(out) + "\n" + want);
