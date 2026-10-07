# Exotics Tracker

Tick off the Division 2 exotics you own. Data comes from [Tuxedo Bandido](https://www.youtube.com/@TuxedoBandido)'s Division 2 exotics spreadsheet (`src/exotics.json`). All credit for the data goes to him. Check out his channel for Division 2 guides.

- View the spreadsheet: https://ggl.link/TuxExotics (to tick the Got column, use File → Make a copy to save it to your own Drive)
- Download it (xlsx): https://ggl.link/TuxExoticsDownload

The **Tux's exotic unlock order** panel summarises the game plan and top six picks from his video [Every Exotic & Where to Get It in 2026](https://www.youtube.com/watch?v=jP-AEM2w9vA). Edit `src/tuxPlan.ts` to change it.

```bash
npm install
npm start
```

Opens http://localhost:5199. Progress is saved to `data/owned.json`, so it survives restarts and browser changes. A copy is also kept in browser storage in case the server can't be reached. Use **Export** / **Import** to back it up.

## Online version

The app is published to GitHub Pages at https://ash1688.github.io/exotics-tracker/ on every push to `main` (`.github/workflows/pages.yml`). There's no server there, so progress is saved in your browser only. Use **Export** / **Import** to move it between devices or into the local version.

## Sync across devices

Click **Sync** and paste a GitHub token that has only the `gist` scope ([create one here](https://github.com/settings/tokens/new?scopes=gist&description=Exotics%20Tracker%20sync)). Progress is stored in a private gist (`exotics-tracker.json`) on your account. Do this once on each device, either on the online version or when running locally. The first connect on a device merges its ticks with the gist; after that, the most recent change wins. Other devices pick up changes when you switch back to their tab, and every minute while it's open.

The token is kept in that browser's storage and only sent to `api.github.com`.

## Images

Item images are downloaded from [The Division wiki](https://thedivision.fandom.com) into `public/images`, with the mapping in `src/images.json`. To fetch any that are missing (for example after adding new exotics to `src/exotics.json`), run:

```bash
npm run fetch-images
```

Items without a wiki image show a placeholder. To use a specific wiki file for an item, add it to `FILE_OVERRIDES` in `scripts/fetch-images.ts`.
