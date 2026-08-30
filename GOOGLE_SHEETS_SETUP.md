# Google Sheets backend setup

The public GitHub Pages site is static. It cannot write directly to a private Google Sheet, so this project uses a small **Google Apps Script Web App** as the bridge.

## 1. Create the destination spreadsheet

Create a new Google Sheet, for example:

**Horse-Rider Image Review — Responses**

You do not need to create any tabs manually.

## 2. Add the Apps Script backend

With that spreadsheet open:

1. Click **Extensions > Apps Script**.
2. Delete the sample code in `Code.gs`.
3. Copy all contents of this repository's `apps-script/Code.gs` into the editor.
4. Save the project.
5. In the function dropdown, choose **setup** and click **Run** once.
6. Google will ask you to authorize access to the spreadsheet. Approve it.
7. Return to the spreadsheet. The script creates the **Reviews** and **Progress** tabs.

## 3. Deploy as a Web App

In Apps Script:

1. Click **Deploy > New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me** (the account that owns the response sheet).
4. Set access to **Anyone** / **Anyone, even anonymous** (wording depends on the account). This is required because the reviewers are not logging in.
5. Click **Deploy**.
6. Copy the Web App URL ending in `/exec`.

Use the `/exec` URL, not the `/dev` testing URL.

## 4. Connect GitHub Pages to the Sheet

Open `docs/config.js` and replace:

```js
APPS_SCRIPT_URL: 'PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE'
```

with your `/exec` URL, for example:

```js
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec'
```

Commit the change.

## 5. Test before inviting reviewers

Open the GitHub Pages URL and select one evaluator. Make one `Agree`, one `Change / replace`, and one `Remove` decision. Check the **Reviews** tab. Refresh/reopen the site and confirm that the same evaluator's progress returns.

## Important security note

The site intentionally has **no authentication**. The Google Sheet itself remains private, but the deployed Apps Script endpoint must accept anonymous requests. The application restricts evaluator names to the six configured names, but that is workflow control rather than strong identity verification. Do not use this architecture for sensitive/confidential reviewer data without adding authentication.
