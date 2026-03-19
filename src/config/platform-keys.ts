import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
} from "../crypto/keys.js";

let cachedKeys: {
  signing: { publicKeyMultibase: string; privateKeyHex: string };
  encryption: { publicKeyMultibase: string; privateKeyHex: string };
} | null = null;

export interface PlatformKeys {
  signing: {
    publicKeyMultibase: string;
    type: "Ed25519VerificationKey2020";
  };
  encryption: {
    publicKeyMultibase: string;
    type: "X25519KeyAgreementKey2020";
  };
  publishedAt: string;
}

function generateKeys() {
  const signingKeyPair = generateEd25519KeyPair();
  const encryptionKeyPair = generateX25519KeyPair();

  cachedKeys = {
    signing: {
      publicKeyMultibase: signingKeyPair.publicKeyMultibase,
      privateKeyHex: Buffer.from(signingKeyPair.privateKey).toString("hex"),
    },
    encryption: {
      publicKeyMultibase: encryptionKeyPair.publicKeyMultibase,
      privateKeyHex: Buffer.from(encryptionKeyPair.privateKey).toString("hex"),
    },
  };

  if (process.env.PLATFORM_SIGNING_PUBLIC_KEY) {
    cachedKeys.signing.publicKeyMultibase =
      process.env.PLATFORM_SIGNING_PUBLIC_KEY;
  }
  if (process.env.PLATFORM_ENCRYPTION_PUBLIC_KEY) {
    cachedKeys.encryption.publicKeyMultibase =
      process.env.PLATFORM_ENCRYPTION_PUBLIC_KEY;
  }

  return cachedKeys;
}

export function getPlatformKeys(): PlatformKeys {
  if (!cachedKeys) {
    generateKeys();
  }

  return {
    signing: {
      publicKeyMultibase: cachedKeys!.signing.publicKeyMultibase,
      type: "Ed25519VerificationKey2020",
    },
    encryption: {
      publicKeyMultibase: cachedKeys!.encryption.publicKeyMultibase,
      type: "X25519KeyAgreementKey2020",
    },
    publishedAt: new Date().toISOString(),
  };
}

export function getPlatformPrivateKeys(): {
  signing: string;
  encryption: string;
} | null {
  if (!cachedKeys) {
    generateKeys();
  }
  return {
    signing: cachedKeys!.signing.privateKeyHex,
    encryption: cachedKeys!.encryption.privateKeyHex,
  };
}
