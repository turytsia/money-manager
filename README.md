# Money Manager

A fast, private expense tracker that installs on an iPhone from the browser.

- **Quick entry.** The app opens on the keypad. Type an amount, pick a category, tap Add.
- **Your own categories.** Hide the ones you don't use and add your own, with a name and an icon.
- **Insights.** Totals by day, week, month and year, split by category.
- **Works offline.** The app runs from the device and needs no connection.
- **Cloud sync.** Optional. Keeps a copy of the data off the phone and in step between devices.
- **Backup.** Export everything to a file and import it again on any device.

## Run it

Requires Node 22.12 or newer.

```bash
npm install
npm run dev       # start a local dev server
npm run check     # type check, lint, format check and tests
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

Cloud sync also works locally: `npm run dev` and `npm run preview` answer the sync
requests themselves and keep the data in a `.sync-data` folder. The password is `dev`,
or whatever `SYNC_PASSWORD` is set to.

## Deploy to Vercel

Vercel hosts the app and runs the small piece of server code that cloud sync needs.

1. Import the repository in Vercel. It is detected as a Vite project; keep the defaults.
2. In the project, open **Storage**, create a **Blob** store with **private** access,
   and connect it to the project.
3. In **Settings → Environment Variables**, add `SYNC_PASSWORD` with a long password
   of your choice.
4. Deploy (or redeploy, so the new settings are picked up).
5. In the app, open **Settings → Cloud sync**, enter the password, and tap **Turn on**.

To change the password, change `SYNC_PASSWORD`, redeploy, then turn sync off and on
again in the app with the new password.

The app also still deploys to GitHub Pages (see `.github/workflows/deploy.yml`), where
everything works except cloud sync, because GitHub Pages cannot run server code.

## Install on an iPhone

1. Open the published address in Safari.
2. Tap the Share button, then **Add to Home Screen**.

The app then opens full screen and works without a connection.

Good to know:

- An app added to the Home Screen has its own storage, separate from Safari.
- Removing the app from the Home Screen deletes its data on the phone. With cloud sync
  on, turning sync on again brings it back. Without it, export a backup first.
- Each address has its own data. After moving the app to a new address, bring the data
  over with Export and Import.

## How data is stored

The app always works from the device. Data lives in the browser's local storage, one
entry per month, so saving a change stays fast however long the history gets.

All reading and writing goes through `src/utilities/storage.ts` and `src/utilities/store.ts`.

### Categories

Built-in categories are fixed, but any of them except **Other** can be turned off, which
only hides them when adding. Custom categories have ids from 1000 up. Deleting a custom
category moves its transactions to **Other** of the same type (expense or income).

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
  "hiddenCategories": ["transport"],
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

## Cloud sync

Sync never gets in the way of using the app. Changes are saved on the device first and
sent a moment later in the background; if there is no connection they wait.

- **What is kept in the cloud** is one backup file per user, in the format above. It can
  be downloaded from the Vercel dashboard and imported by hand like any backup.
- **Older copies.** Before the first change of each day the server keeps a copy of the
  file as it was (`users/default/snapshots/<date>.json`), for 60 days. If a mistake gets
  synced, download the copy from before it and import it.
- **Two devices.** A change is only accepted if the device has seen the latest version.
  If another device saved first, the app fetches that version, combines it with its own
  unsent changes, and tries again. Deleting on one device deletes on the other.
- **Size.** The whole file is sent on each sync, compressed. Vercel accepts up to 4.5 MB
  per request, which is room for roughly 50,000 transactions.

### Changing where data is kept

The vendor-specific parts are small and sit behind two interfaces:

| To change                    | Write a new                                           | And swap it in |
| ---------------------------- | ----------------------------------------------------- | -------------- |
| Where the server keeps files | `DocumentStore` (`server/documentStore.ts`)           | `api/sync.ts`  |
| How people sign in           | `Authenticator` (`server/authenticator.ts`)           | `api/sync.ts`  |
| What the app talks to        | `SyncProvider` (`src/utilities/sync/syncProvider.ts`) | `src/main.tsx` |

`server/syncHandler.ts` holds the sync rules and knows nothing about Vercel. It already
keeps a separate file per user, so supporting several users only needs an
`Authenticator` that tells them apart. To leave Vercel entirely, serve
`createSyncHandler` from any host that speaks standard `Request` and `Response`.

Imports between server files end in `.js` on purpose: Vercel compiles each file on its
own and Node then needs the full file name.

## Project layout

```
api/            Vercel entry point for cloud sync
server/         sync rules, storage and sign-in for the server side
src/
  components/   shared interface pieces (buttons, sheet, entry form, ...)
  features/     one folder per screen: Entry, Activity, Insights, Settings
  utilities/    data, storage, sync, dates, money, theme
public/         icons, web app manifest, service worker
```
