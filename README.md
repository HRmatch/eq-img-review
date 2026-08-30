# Horse–Rider Image Review — GitHub Pages + Google Sheets

Static web version of the Horse–Rider image validation workspace.

## Reviewer rules

- English only for this review round.
- No login/password.
- Evaluator must be selected from: **Luciana, Idejan, Laércio, Cláudia, Beto, Thierry**.
- `Agree` and `Remove` save immediately.
- `Change / replace` requires written details.
- Progress is stored in Google Sheets and can be recovered by selecting the same evaluator.

## Repository layout

- `docs/` — GitHub Pages site.
- `docs/review_assets.zip` — one optimized archive containing all 106 question records and all 157 referenced review images. This is the only binary asset that must be uploaded manually.
- `docs/config.js` — Google Apps Script `/exec` endpoint.
- `docs/app.js`, `docs/styles.css`, `docs/assets_bridge.js` — web application.
- `apps-script/Code.gs` — Google Sheets backend.
- `GOOGLE_SHEETS_SETUP.md` — backend deployment instructions.

## Publishing

After `docs/review_assets.zip` has been uploaded and `docs/config.js` contains the deployed Apps Script `/exec` URL, go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/docs`, and save.
