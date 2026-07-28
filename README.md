# Interest Manager

Personal local-first PWA base for managing lending data after the base source is stable.

## Current Scope

This source currently contains the technical base only:

- Vite + React + TypeScript app shell
- Offline PWA packaging
- IndexedDB local storage
- Encrypted JSON backup export
- Encrypted JSON restore import

It does not contain borrower, loan, interest, payment, reminder, report, or chart features.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## iPhone Usage

Deploy the built static files to GitHub Pages, open the site in Safari, then use Share > Add to Home Screen.

## Backup

Use the Backup passphrase field and Backup button to export an encrypted `.json` file. Save that file to iCloud Drive, Google Drive, or another synced file location.

The passphrase is not stored by the app. Without the passphrase, the encrypted file cannot be restored.

## Restore

Use the Restore passphrase field and Restore button to select a backup `.json` file. The base restore flow replaces local records with the records inside the backup.

## Deployment

The app builds to static assets in `dist/`, which can be published with GitHub Pages at no cost.
