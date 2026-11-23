# Money Manager

A fast, private expense tracker that installs on an iPhone from the browser.

- **Quick entry.** The app opens on the keypad. Type an amount, pick a category, tap Add.
- **Custom categories.** Add your own, with a name and an icon, right from the entry screen or in Settings.
- **Insights.** Totals by day, week, month and year, split by category.
- **Private and offline.** Data is stored on the device only. No account, no server.
- **Backup.** Export everything to a file and import it again on any device.
- **Storage meter.** Settings shows how much space is used and how much is left.

## Run it

Requires Node 22.12 or newer.

```bash
npm install
npm run dev       # start a local dev server
npm run check     # type check, lint, format check and tests
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` checks, builds and publishes the app.

The build uses relative paths, so it works under any repository name without changes.

## Install on an iPhone

1. Open the published address in Safari.
2. Tap the Share button, then **Add to Home Screen**.

The app then opens full screen and works without a connection.

Good to know:

- An app added to the Home Screen has its own storage, separate from Safari.
- Removing the app from the Home Screen deletes its data. Export a backup first.

## How data is stored

Data lives in the browser's local storage, which holds about 5 MB per site.
Transactions are saved in a compact form, one entry per month, at roughly 50 bytes each,
so 5 MB is room for around 100,000 transactions.

All reading and writing goes through `src/utilities/storage.ts` and `src/utilities/store.ts`.
Those two files are the only ones that need to change to move to a different kind of storage.

### Categories

Built-in categories are fixed. Custom categories have ids from 1000 up and are saved
under their own key. Deleting a custom category moves its transactions to **Other**
of the same type (expense or income).

### Backup file format

Backups are plain JSON. Transactions refer to built-in categories by name (such as
`groceries`) and to custom ones by the `key` listed under `categories`:

```json
{
  "app": "money-manager",
  "version": 2,
  "exportedAt": "2026-11-23T20:15:00.000Z",
  "currency": "EUR",
  "categories": [
    {
      "key": "custom-1000",
      "name": "Coffee",
      "kind": "expense",
      "icon": "coffee"
    }
  ],
  "transactions": [
    {
      "id": "mhr2k3ab",
      "date": "2026-11-23",
      "category": "custom-1000",
      "amount": 4.5
    }
  ]
}
```

On import, a custom category with the same name and type as one that already exists
is merged into it. Version 1 files, made before custom categories existed, still import.

## Project layout

```
src/
  components/   shared interface pieces (buttons, sheet, entry form, ...)
  features/     one folder per screen: Entry, Activity, Insights, Settings
  utilities/    data, storage, dates, money, theme
public/         icons, web app manifest, service worker
```
