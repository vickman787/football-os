# Football OS · public assets

Drop the master logo here as **`logo.png`**.

The whole app references `/logo.png` (navbar, footer, loading screen,
OG fallback). All other branded assets — favicons, OG image, apple-touch-icon,
PWA icons — are generated from this single file by the asset script:

```bash
cd frontend
npm install     # adds `sharp` as a devDependency
npm run gen:assets
```

That script writes the following files into `public/`:

- `favicon.ico`            — 16×16 + 32×32 + 48×48 multi-resolution
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-192.png`        — PWA
- `favicon-512.png`        — PWA
- `apple-touch-icon.png`   — 180×180
- `og-image.png`           — 1200×630, black background, logo centered

Re-run `npm run gen:assets` whenever you replace `logo.png`.

## Notes

- `logo.png` should be square or near-square; the script centers it on a
  black canvas for the OG image.
- Keep the source PNG transparent if possible — the favicon and OG image
  composite cleanly that way.
- The icons and OG image are checked in so Vercel deployments don't need to
  run sharp at build time.
