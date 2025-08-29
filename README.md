# FIATCOIN Website

Vite + React + Tailwind single-page app for the FIATCOIN XRP tribute + presale.

## Scripts

- `npm run dev` – start dev server
- `npm run build` – production build (outputs to `dist/`)
- `npm run preview` – preview production build
- `npm run icons` – generate `public/favicon.ico`, `public/apple-touch-icon.png`, `public/fiatcoin.png` from `assets/logo-source.png`

## Configure

Edit `src/App.tsx` constants:
- `FIATCOIN_ISSUER`
- `FIATCOIN_CURRENCY`
- `PRESALE_XNS`
- `PRESALE_ADDRESS`
- `PRESALE_TARGET_XRP`

## Deploy

Any static host (Netlify, Vercel, Cloudflare Pages). Serve the `dist/` folder.


