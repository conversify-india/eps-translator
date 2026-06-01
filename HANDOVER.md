# EPS Translator Tool — Technical Handover Document

> [!IMPORTANT]
> **The monolithic codebase has been migrated to a modern, modular Vite + React application.**
> *   **React source code folder:** [react-app/](file:///Users/snigdha/Desktop/eps-translator/react-app)
> *   **Production-ready compiled static files:** [react-app/dist/](file:///Users/snigdha/Desktop/eps-translator/react-app/dist) (which contains the entry `index.html`, visual asset assets, and styles).

---

## 1. Hosting & Deployment Architecture

The tool is hosted directly on the Hostinger server running the WordPress site, but operates independently of the WordPress theme architecture to ensure maximum performance, isolation, and avoid plugin conflicts.

**Deployment Location:**
The files are uploaded via FTP, cPanel, or the **WP File Manager** plugin (accessible from the WordPress Dashboard at `wp-admin`).
*   **Staging Directory:** `public_html/eps-tool-staging/` (Accessible at `https://lingochaps.com/eps-tool-staging/`)
*   **Production Directory:** `public_html/eps-tool/` (Accessible at `https://lingochaps.com/eps-tool/`)

### Deployed Folder File List
To launch the tool, the following files from the compiled `react-app/dist/` directory and the root workspace must be uploaded into the target subdirectory on the server:

| File / Folder | Origin Location | Purpose |
|---|---|---|
| `index.html` | `react-app/dist/index.html` | Frontend entry point. It coordinates state mounting and includes references to the CSS/JS bundles. |
| `favicon.svg` | `react-app/dist/favicon.svg` | Browser tab icon. |
| `icons.svg` | `react-app/dist/icons.svg` | Global SVG icons used throughout the UI. |
| `api.php` | Root directory `/api.php` | Secure server-side proxy handling private keys for CloudConvert, Google Sheets logging, and Gemini AI. |
| `assets/` | `react-app/dist/assets/` | Folder containing the compiled JS and CSS bundles. |

---

## 2. Zero-Configuration Environment Setup

The application features smart environment auto-detection built directly into the source code. Your team member **does not need to modify any code or configure environment variables** to deploy to different directories.

### A. Dynamic API Resolution (in [api.js](file:///Users/snigdha/Desktop/eps-translator/react-app/src/services/api.js))
*   **Localhost (`localhost`/`127.0.0.1`):** The app automatically directs its backend requests to the production backend: `https://lingochaps.com/eps-tool/api.php` to enable full testing on your laptop without hosting a local PHP server.
*   **Live Web (Staging or Production):** The app automatically resolves calls using the relative path `api.php`. If you upload files to `/eps-tool-staging/`, it calls the staging backend; if uploaded to `/eps-tool/`, it calls the production backend.

### B. Daily Free Limits Bypass (in [UploadZone.jsx](file:///Users/snigdha/Desktop/eps-translator/react-app/src/components/UploadZone.jsx))
*   **Localhost:** Bypasses rate-limits completely for developers, letting you run test conversions indefinitely.
*   **Staging / Production:** Activates the local storage-based conversion limit (5 complete file processes per day) to protect CloudConvert usage and costs.

### C. Secure Server-Side AI Translation
In the root [api.php](file:///Users/snigdha/Desktop/eps-translator/api.php), we added the `ai-translate` action. It connects securely to the **Gemini 2.5 Flash API** using cURL. To protect your keys, it uses strict JSON schema formats so that translations are returned as a validated map.

### D. Separate Keys for Staging vs. Production (in [api.php](file:///Users/snigdha/Desktop/eps-translator/api.php))
If your team member ever wants staging test logs to write to a separate spreadsheet, or wants to test with a different Gemini key, they only need to open the staging `api.php` on the server and edit the values at the top of the file:
```php
define('CLOUDCONVERT_API_KEY', 'your_key');
define('GOOGLE_SHEETS_URL', 'your_google_sheets_url');
define('GEMINI_API_KEY', 'your_api_key');
```
*Note: If they do not need separate environments, they can leave the keys exactly as they are. They will work perfectly in both directories.*

---

## 3. Deployment Guide (WordPress / Hostinger)

Since the app compiles into standard static assets, your WordPress administrator **does not need to install React or Node.js**. They just need to upload the static folder.

### Step-by-Step Upload Instructions
1.  **Build the Project:** Run `npm run build` inside the `react-app/` directory (Vite is pre-configured with `base: './'` to ensure relative path compatibility).
2.  **Create a Deployable Package:** 
    *   Open `react-app/dist/`.
    *   Copy [api.php](file:///Users/snigdha/Desktop/eps-translator/api.php) from the root folder into `react-app/dist/`.
    *   Zip all contents inside `react-app/dist/` (e.g. `eps-tool.zip`).
3.  **Upload to Server:** 
    *   Open **WP File Manager** or connect via FTP.
    *   Create a subfolder under `public_html/` (e.g. `eps-tool` or `eps-tool-staging`).
    *   Upload and extract `eps-tool.zip` in that folder.
    *   Delete the `.zip` file from the server.

---

## 4. Google Authentication & Session Persistence

*   **Client ID:** `366085231938-v2dajqpl5u86o5sneoqhggv6u6hlmfpr.apps.googleusercontent.com`
*   **Authorized JavaScript Origins** (Configured in Google Cloud Console):
    *   `http://localhost:5173` (Local Dev)
    *   `http://localhost:8000` (Local Alternate)
    *   `https://lingochaps.com` (Live Production and Staging)

> [!WARNING]
> If your site domain changes in the future, you must add the new domain to the Google Cloud Console credentials under **Authorized JavaScript Origins**, or logging in will trigger a `400 origin_mismatch` error.

---

## 5. Security & Masking Credentials
*   The Gemini API Key, CloudConvert Credentials, and Google Sheets URL are saved exclusively inside `api.php`.
*   Because PHP is parsed on the server side, **no user can inspect the source code to view the keys**.
*   **Git warning:** The root [.gitignore](file:///Users/snigdha/Desktop/eps-translator/.gitignore) is set to ignore `api.php` to prevent accidental credential uploads. Do not publish `api.php` to any public code repositories.

---

## 6. Maintenance & Future Updates

*   **Updating UI Layouts:** Edit components inside `react-app/src/components/` ➔ run `npm run build` in `react-app/` ➔ upload the updated assets folder to the server.
*   **Rotate Gemini Key:** Open `api.php` on the server and update `GEMINI_API_KEY` with the new value from Google AI Studio.
*   **Change Watermark Text:** Open [QAReport.jsx](file:///Users/snigdha/Desktop/eps-translator/react-app/src/components/QAReport.jsx) and edit the text rendering parameter before compiling.

