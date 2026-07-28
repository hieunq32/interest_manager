# PWA Base Source Design

Date: 2026-07-28

## Goal

Build a stable base source for a personal money-lending management app before adding lending-domain features.

The base must support iPhone usage without a Mac, work offline, cost nothing to develop and deploy, and include a recovery path when the phone is lost or replaced.

## Chosen Approach

Use Vite, React, and TypeScript to build a local-first Progressive Web App.

The app will be hosted as static files, suitable for free deployment through GitHub Pages. On iPhone, it will be opened in Safari and added to the Home Screen.

## Scope

The base source includes:

- Vite + React + TypeScript project setup.
- PWA manifest and installable app shell.
- Service worker support for offline app loading.
- IndexedDB-backed local storage layer.
- Encrypted backup export using Web Crypto API.
- Encrypted restore import using Web Crypto API.
- Minimal operational UI for checking online/offline status, storage readiness, backup, and restore.
- Basic tests around encryption, backup packaging, restore parsing, and storage adapters.
- Documentation for local development, build, deployment, backup, and restore.

The base source does not include:

- Borrower/customer management.
- Loan creation.
- Interest calculation.
- Payment schedules.
- Debt reminders.
- Reports or charts.
- Any lending-business workflow decisions.

Those features will be designed only after the base source is stable.

## Architecture

The source should be organized around clear technical boundaries:

- `app`: application shell, routes, and top-level providers.
- `ui`: reusable visual components used by the base screens.
- `storage`: IndexedDB adapter and persistence contracts.
- `crypto`: encryption, key derivation, random salt/IV generation, and serialization helpers.
- `backup`: backup file schema, export flow, import flow, validation, and versioning.
- `pwa`: service worker registration, manifest assets, and update handling.
- `shared`: small cross-cutting types and utilities.

Domain data should pass through the storage and backup contracts, but no lending-domain schema should be finalized in this base phase.

## Data Model

The base backup format should be versioned from the beginning:

```json
{
  "format": "interest-manager-backup",
  "version": 1,
  "createdAt": "2026-07-28T00:00:00.000Z",
  "cipher": {
    "name": "AES-GCM",
    "kdf": "PBKDF2",
    "iterations": 250000
  },
  "payload": {
    "salt": "base64",
    "iv": "base64",
    "data": "base64"
  }
}
```

The decrypted payload should also be versioned:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-07-28T00:00:00.000Z",
  "records": []
}
```

In the base phase, `records` can remain generic. Later lending features will define typed records and migrations.

## Backup And Restore

Backup export:

1. Read all local records through the storage contract.
2. Build a versioned plaintext backup payload.
3. Derive an encryption key from a passphrase using PBKDF2.
4. Encrypt the payload with AES-GCM.
5. Download a `.json` backup file that can be saved to iCloud Drive, Google Drive, or another file location.

Restore import:

1. Select a backup `.json` file.
2. Validate the outer backup format and version.
3. Ask for the passphrase.
4. Derive the key and decrypt the payload.
5. Validate the decrypted schema version.
6. Replace or merge local data only after explicit user confirmation.

The base implementation should support replace restore first. Merge restore can be added later when domain records have stable identifiers and conflict rules.

## Error Handling

The base UI should surface practical recovery messages for:

- IndexedDB unavailable or blocked.
- Service worker registration failure.
- Invalid backup file.
- Wrong backup passphrase.
- Unsupported backup version.
- Restore cancelled before local data changes.

Errors should not leak passphrases, raw cryptographic keys, or decrypted payloads into logs.

## Testing

The first test layer should cover:

- Key derivation produces usable AES-GCM keys.
- Encrypt then decrypt returns the original payload.
- Wrong passphrase fails decrypt.
- Backup export creates the expected outer format.
- Restore validation rejects invalid format and unsupported versions.
- Storage adapter can create, list, replace, and clear generic records.

Manual verification should include:

- App loads locally.
- App still opens after the dev server is stopped or network is disabled.
- Backup file can be exported.
- Restore can rebuild local data from an exported file.

## Deployment

The app should build to static assets and be compatible with GitHub Pages.

The deployment path should keep costs at zero. No paid backend, paid database, Apple Developer account, or Mac-specific build step is required.

## Security Notes

The app is for one personal user. The backup passphrase is the user's responsibility; without it, encrypted backups cannot be restored.

The app should never store the backup passphrase permanently. If temporary convenience is needed later, it must be an explicit feature decision.

Encrypted backup protects exported files, but local browser storage remains protected mainly by the iPhone passcode and browser sandbox. This is acceptable for the base source, with the option to add app-level lock later.
