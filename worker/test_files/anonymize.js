/* eslint-disable */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUUID_PATTERN = /^[A-Za-z0-9_-]{78}$/;

// Signature bytes embedded into generated PUUIDs so we can detect anonymized values.
// Keep it short (4 bytes) and place at a fixed offset to avoid breaking formats.
const SIGNATURE = Buffer.from([0x4d, 0x4e, 0x4b, 0x01]); // 'MNK' + version byte
const SIG_OFFSET = 10; // position within the 58-byte buffer

function makeSignedPuuid() {
    const buf = crypto.randomBytes(58);
    SIGNATURE.copy(buf, SIG_OFFSET);
    return buf.toString('base64url');
}

function isAnonymizedPuuid(str) {
    if (typeof str !== 'string' || !PUUID_PATTERN.test(str)) return false;
    try {
        const buf = Buffer.from(str, 'base64url');
        if (buf.length !== 58) return false;
        for (let i = 0; i < SIGNATURE.length; i++) {
            if (buf[SIG_OFFSET + i] !== SIGNATURE[i]) return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}

function anonymizeValue(value, mapping) {
    if (typeof value === 'string' && PUUID_PATTERN.test(value)) {
        // If it's already one of our anonymized PUUIDs, leave it alone.
        if (isAnonymizedPuuid(value)) return value;

        if (!mapping.has(value)) {
            mapping.set(value, makeSignedPuuid());
        }

        return mapping.get(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => anonymizeValue(item, mapping));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                key,
                anonymizeValue(entry, mapping)
            ])
        );
    }

    return value;
}

function anonymizeFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(original);
    const mapping = new Map();
    const anonymized = anonymizeValue(parsed, mapping);
    fs.writeFileSync(filePath, `${JSON.stringify(anonymized, null, 4)}\n`);
    console.log(
        `Anonymized ${path.basename(filePath)} (${mapping.size} PUUID${mapping.size === 1 ? '' : 's'})`
    );
}

function walk(directoryPath) {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.json')) {
            anonymizeFile(fullPath);
        }
    }
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = process.argv[2] ? path.resolve(process.argv[2]) : scriptDirectory;
walk(rootDirectory);
