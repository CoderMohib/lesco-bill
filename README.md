# LESCO Bill Estimator

Static HTML/CSS/JS estimate of a LESCO electricity bill using GoP applicable rates from **S.R.O. 279(I)/2026**.

**Not an official LESCO bill.** Rates and FCA/QTA change; always trust your printed / PITC bill.

## Features

- **A-1 Domestic:** Protected (progressive), Unprotected (single-band), Lifeline
- Meter readings (previous + current) or direct units
- Commercial A-2, General A-3, Industrial B-1 / B-2
- ToU / prepaid modes
- QTA, FCA (with override), FC surcharge, Punjab ED, GST 18%, Sec. 235
- Optional arrears / rent / LPS lines
- Mobile-friendly layout for GitHub Pages

## Protected vs unprotected

| Status | How energy is charged |
|---|---|
| **Protected** | Progressive: first 100 @ Rs.10.54, rest to 200 @ Rs.13.01 |
| **Unprotected** | All units at the rate of the total-consumption band |
| **Lifeline** | Band rate for the whole month; no previous-slab split |

Protected eligibility also depends on history (typically ≤200 units for prior months). The calculator lets you choose the status shown on your bill; it does not look up your LESCO account.

## Run locally

Serve over HTTP (needed so `data/rates.json` loads):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Auto-updating FCA / QTA (weekly)

Monthly fuel (FCA) and quarterly (QTA) charges change. Base slabs stay in code; adjustments live in `data/rates.json`.

| Piece | Role |
|---|---|
| `data/rates.json` | Live FCA/QTA by bill month + status labels |
| `scripts/update-rates.mjs` | Fetches NEPRA LESCO index + news, follows FCA/QTA PDFs, extracts rates |
| `.github/workflows/update-rates.yml` | Runs every Sunday (and on manual dispatch), commits rate changes |

Manual refresh:

```bash
node scripts/update-rates.mjs
```

**Safety rule:** hearing/request figures stay `NEEDS_REVIEW` / provisional and are **not** auto-applied. Only PDF-extracted / notified rates get `NOTIFIED` and enter the estimate. Use **FCA override** from your bill when a month is still under review.

Sources match `LESCO_Bill_Calculator_AI_Implementation_Spec.md` (NEPRA LESCO page, news, S.R.O. PDFs).

## GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Deploy from branch → `main` / root.
3. Actions must be allowed to write (default `contents: write` on the workflow) so weekly rate commits publish.
4. Site URL: `https://<user>.github.io/<repo>/`.
