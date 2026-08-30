# Horse–Rider Image Review — GitHub Pages + Google Sheets

Production-oriented static build based on the working local v4/v5 interface.

## Reviewer rules

- English only.
- No login/password.
- Evaluator must be selected from: **Luciana, Idejan, Laércio, Cláudia, Beto, Thierry**.
- `Agree` and `Remove` save immediately.
- `Change / replace` requires written details.
- Progress is stored in Google Sheets and can be recovered from another browser/computer by selecting the same evaluator.

## Repository layout

- `docs/` — the only folder that should be published by GitHub Pages.
- `docs/media/` — the referenced image/GIF set.
- `docs/question_bank.json` — normalized 106-question bank.
- `docs/config.js` — contains the Google Apps Script `/exec` endpoint.
- `apps-script/Code.gs` — backend to paste into Apps Script.
- `GOOGLE_SHEETS_SETUP.md` — setup instructions.

## GitHub Pages

Recommended repository setup:

1. Create a new repository, e.g. `horse-rider-image-review`.
2. Upload/push this package to the `main` branch.
3. Go to **Settings > Pages**.
4. Choose **Deploy from a branch**.
5. Select branch `main` and folder `/docs`.
6. Save.

The static site will then be published from `docs/`. Configure `docs/config.js` with the Apps Script `/exec` URL before reviewer testing.
