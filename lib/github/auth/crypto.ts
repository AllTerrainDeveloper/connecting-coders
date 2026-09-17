const encoder = new TextEncoder();
export function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export function randomToken() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
export async function digest(value: string) {
  return encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
async function key(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret))
    throw new Error("Invalid session encryption key");
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret.match(/../g)!, (v) => parseInt(v, 16)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(value: string, secret: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    await key(secret),
    encoder.encode(value),
  );
  return `${encode(iv)}.${encode(new Uint8Array(data))}`;
}
export async function unseal(value: string, secret: string, context: string) {
  const [iv, data, extra] = value.split(".");
  if (!iv || !data || extra) throw new Error("Invalid sealed credential");
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(iv),
        additionalData: encoder.encode(context),
      },
      await key(secret),
      decode(data),
    ),
  );
}
