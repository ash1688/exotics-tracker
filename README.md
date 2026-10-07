# Exotics Tracker

Tick off the Division 2 exotics you own. Data comes from Tuxedo Bandido's exotics spreadsheet (`src/exotics.json`).

```bash
npm install
npm start
```

Opens http://localhost:5199. Progress is saved to `data/owned.json`, so it survives restarts and browser changes. A copy is also kept in browser storage in case the server can't be reached. Use **Export** / **Import** to back it up.

## Images

Item images are downloaded from [The Division wiki](https://thedivision.fandom.com) into `public/images`, with the mapping in `src/images.json`. To fetch any that are missing (for example after adding new exotics to `src/exotics.json`), run:

```bash
npm run fetch-images
```

Items without a wiki image show a placeholder. To use a specific wiki file for an item, add it to `FILE_OVERRIDES` in `scripts/fetch-images.ts`.
