import { ed25519 } from "@noble/curves/ed25519";
import { x25519 } from "@noble/curves/ed25519";
import { bytesToHex } from "@noble/hashes/utils";

const signingPriv = ed25519.utils.randomPrivateKey();
const signingPub = ed25519.getPublicKey(signingPriv);

const encryptionPriv = x25519.utils.randomPrivateKey();
const encryptionPub = x25519.getPublicKey(encryptionPriv);

console.log("# Add these to your .env file:");
console.log("");
console.log(`PLATFORM_SIGNING_PRIVATE_KEY=${bytesToHex(signingPriv)}`);
console.log(`PLATFORM_SIGNING_PUBLIC_KEY=${bytesToHex(signingPub)}`);
console.log(`PLATFORM_ENCRYPTION_PRIVATE_KEY=${bytesToHex(encryptionPriv)}`);
console.log(`PLATFORM_ENCRYPTION_PUBLIC_KEY=${bytesToHex(encryptionPub)}`);
