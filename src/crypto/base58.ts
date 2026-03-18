import bs58 from "bs58";

export function encode58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

export function decode58(str: string): Uint8Array {
  return Uint8Array.from(bs58.decode(str));
}
