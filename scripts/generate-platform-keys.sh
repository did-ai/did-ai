#!/bin/bash

set -e

echo "========================================"
echo "  did:ai - Generate Platform Keys"
echo "========================================"
echo ""
echo "This script generates Ed25519 and X25519 key pairs for the platform."
echo "Add the output to your .env file."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

cd "$PROJECT_ROOT"

if ! npm list @noble/curves @noble/hashes &> /dev/null; then
    echo "Installing dependencies..."
    npm install @noble/curves @noble/hashes
fi

node --input-type=module << 'EOF'
import { ed25519 } from '@noble/curves/ed25519';
import { x25519 } from '@noble/curves/ed25519';
import { bytesToHex } from '@noble/hashes/utils';

const signingPriv = ed25519.utils.randomPrivateKey();
const signingPub = ed25519.getPublicKey(signingPriv);

const encryptionPriv = x25519.utils.randomPrivateKey();
const encryptionPub = x25519.getPublicKey(encryptionPriv);

console.log('# Add these to your .env file:');
console.log('');
console.log(`PLATFORM_SIGNING_PRIVATE_KEY=${bytesToHex(signingPriv)}`);
console.log(`PLATFORM_SIGNING_PUBLIC_KEY=${bytesToHex(signingPub)}`);
console.log(`PLATFORM_ENCRYPTION_PRIVATE_KEY=${bytesToHex(encryptionPriv)}`);
console.log(`PLATFORM_ENCRYPTION_PUBLIC_KEY=${bytesToHex(encryptionPub)}`);
EOF

echo ""
echo "Done!"
