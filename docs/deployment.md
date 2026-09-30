# Deployment and operations

Live target: https://hampton.brandonbryant.io
Cloudflare Worker: `hampton-ledger`

## Local preview

Node.js 22 or newer; no frontend install or build is required.

```sh
npm run dev
```

The local server binds only to 127.0.0.1:4178. Fonts and public assets are self-hosted.

## Validation

```sh
npm test
npm run validate
```

On this Mac, run full suites through the shared `codex-heavy` gate. GitHub Actions also runs the unit checks, provenance validation, and Playwright desktop/mobile flows. Browser screenshots and reports are retained as run artifacts.

## Collecting records

`npm run ingest` collects the explicit registry plus up to 12 recent Select Board/Budget Committee records. It preserves previous snapshots, retains prior valid records if retrieval fails, and exits nonzero with a collection-error list.

macOS uses built-in PDFKit. Linux needs Poppler's `pdftotext`. No TLS verification is disabled. A certificate-chain error in Node can use curl with the system trust store.

The weekly GitHub workflow saves a proposed collection as an artifact. It does not commit, publish, or send messages. Review the sources and privacy implications, then run validation and commit a reviewed update.

Finance excerpts can be reproduced on macOS with `node scripts/archive-finance.mjs`. The fixed page ranges must be reviewed if the official report changes. Financial metrics are deliberately maintained separately; the collector never silently changes the tax calculator or approved figures.

## Cloudflare deployment

The committed `wrangler.json` documents the Worker, assets, and custom domain. Change its account and domain when adapting the project.

The dependency-free deployment script uses Cloudflare's documented static-asset upload API. It requires a clean Git working tree and validates the dataset. Supply a valid Cloudflare token through environment variables. Do not paste credentials into commands, commit them, or put them in the public folder.

```sh
npm run deploy
```

Required environment: `CLOUDFLARE_API_TOKEN`; optionally override `CLOUDFLARE_ACCOUNT_ID`. Set `CLOUDFLARE_ATTACH_DOMAIN=1` for first-time custom-domain attachment. It refuses to replace another Worker's domain assignment.

Deployment returns a local receipt in ignored `artifacts/deployment.json`. Verify the public `/api/health` release SHA matches Git HEAD and the public records JSON SHA-256 matches the receipt. Then inspect live UI behavior. An upload response alone is not live release proof.

No deployment credential is stored in GitHub. Pushes run checks; deployment is an explicit authenticated step. Roll back by deploying a previously validated commit from a clean checkout.

## Publication boundaries

No runtime database, visitor tracking, external AI calls, or contact-form submissions are configured. The browser calculates tax illustrations locally. Planned records requests are downloads only. Source text is escaped before rendering and original HTML downloads are inert text.
