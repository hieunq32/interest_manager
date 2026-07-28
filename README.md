# Interest Manager

Personal local-first PWA for tracking borrowers, loans, schedules, payments, promises, and reminder exports. IndexedDB is the source of truth; the online indicator is informational and no backend account is required.

## Lending Workflows

- The dashboard groups active loans with due-today, upcoming (next seven days), promised, and overdue work, plus outstanding VND totals.
- Loan schedules are versioned. Revisions retain prior entries and mark a prior calendar export stale until the active schedule is exported again.
- Global reminders default to enabled, one day before, at `08:00`. A loan can keep its own reminder override from the loan form.
- Calendar export creates an `.ics` file for Apple Calendar or another calendar app. Paid entries and settled or archived loans are excluded.
- Browser reminder delivery depends on the calendar app that imports the file; this PWA does not schedule background push notifications.

## Calculation Assumptions

- Supported models are interest-only with principal at maturity, and equal principal with flat interest.
- Rates are monthly or daily. A partial first period uses either the configured full-period rule or calendar-day proration.
- Payments reduce principal and interest independently. An entry becomes paid only when both outstanding amounts reach zero.
- An open future promise marks an unpaid entry promised; an expired or due promise marks it overdue.

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

## Backup And Restore

Open Settings, enter a backup passphrase, and choose Backup. The downloaded encrypted JSON includes all typed lending records and global reminder settings. The passphrase is never stored; without it, the backup cannot be restored.

To restore, select the encrypted JSON file and enter its passphrase. Confirm the explicit replacement prompt. Restore replaces lending records only and preserves unrelated records that may share the local IndexedDB database.

## Apple Calendar

Open a loan, choose Export Calendar, then save or share the `interest-manager-calendar-YYYY-MM-DD.ics` file. On iPhone, open it from Files and choose Add All in Calendar. Re-export after a schedule revision whenever the loan shows that the calendar export is stale.

## Deployment

The app builds to static assets in `dist/`, which can be published with GitHub Pages at no cost.
