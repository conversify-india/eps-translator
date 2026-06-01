# EPS Translator — Complete Setup & Testing Guide

This guide provides step-by-step instructions for setting up, running, testing, and deploying the **EPS Translator Tool** (modular React + Vite application). 

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Local Setup & Testing (Quick Start)](#2-local-setup--testing-quick-start)
3. [Under the Hood: Zero-Configuration Sandbox](#3-under-the-hood-zero-configuration-sandbox)
4. [Step-by-Step Manual Verification Checklist](#4-step-by-step-manual-verification-checklist)
5. [Production Compilation & Deployment](#5-production-compilation--deployment)
6. [Troubleshooting & FAQs](#6-troubleshooting--faqs)
7. [How to Export/Save this Document Forever](#7-how-to-exportsave-this-document-forever)

---

## 1. Prerequisites

Before starting, ensure the following are installed on your local machine:
* **Node.js** (v18.0.0 or higher recommended)
* **NPM** (typically pre-packaged with Node.js)

To verify installation, run the following commands in your terminal:
```bash
node -v
npm -v
```

---

## 2. Local Setup & Testing (Quick Start)

The React application is fully self-contained inside the `react-app` directory. Follow these steps to boot it locally:

### Step 1: Open the Terminal and Navigate to the React App
```bash
cd /Users/snigdha/Desktop/eps-translator/react-app
```

### Step 2: Install Package Dependencies
Download and install the required modules (React, Vite, Firebase, Google OAuth client):
```bash
npm install
```

### Step 3: Run the Development Server
Spin up the local development instance:
```bash
npm run dev
```

### Step 4: Open in Web Browser
By default, the server will host the application at:
👉 **[http://localhost:5173](http://localhost:5173)**

*Open this URL in Google Chrome, Safari, or Microsoft Edge to begin testing.*

---

## 3. Under the Hood: Zero-Configuration Sandbox

The codebase is engineered with smart environment auto-detection so that local testing works immediately without manually setting up environment keys, PHP servers, or databases.

### A. Dynamic API Proxying
In [api.js](file:///Users/snigdha/Desktop/eps-translator/react-app/src/services/api.js):
```javascript
const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000/api.php'
  : 'api.php';
```
* **Localhost Mode:** All backend requests (CloudConvert conversion, Gemini AI Translation, Google Sheets logging) are automatically proxied to your local PHP server at `http://localhost:8000/api.php` so you can test changes to your backend securely.
* **Production Mode:** Requests use relative pathing to call the adjacent `api.php` on the server hosting the app.

To start your local PHP server, run this in your root folder:
```bash
php -S localhost:8000
```


### B. Free Sandbox Bypasses
In [UploadZone.jsx](file:///Users/snigdha/Desktop/eps-translator/react-app/src/components/UploadZone.jsx):
```javascript
const hasUsedConversionToday = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return false;
  }
  return localStorage.getItem(getUserConversionKey()) === 'used';
};
```
* **Localhost Mode:** The daily rate limit of 5 file translations is completely deactivated for developers, enabling unlimited test runs.
* **Production Mode:** The rate-limiting is enforced to prevent excessive API costs.

---

## 4. Step-by-Step Manual Verification Checklist

Since the application has no automated UI test runners, testing is done manually by running through the following functional flows:

### Test Case 1: Google Sign-In & Lockscreen Bypass
1. Visit **`http://localhost:5173`** in your browser.
2. The initial Lockscreen overlay should block access.
3. Click the **Google Login button**.
4. Log in using any valid Google Account.
5. **Success Criteria:** The popup closes, you are logged into the workspace dashboard, and the terminal console shows:
   `User saved securely to Firebase: <your-email>`

> [!NOTE]
> Google Client authentication works out of the box on `http://localhost:5173` because this address is already registered inside the Google Cloud Console credentials under **Authorized JavaScript Origins**.

### Test Case 2: Upload Zone & Vector Processing
1. Prepare a sample `.eps` file (vector artwork containing text blocks) or a standard `.svg` file.
2. Drag and drop the file into the upload zone or click the box to select it.
3. **Success Criteria for SVG:** The file is processed instantly and the editor workspace appears.
4. **Success Criteria for EPS:** 
   * A dark processing overlay shows: *"Uploading your file..."*
   * The file is securely converted to SVG via CloudConvert.
   * After completion (typically 5-15 seconds), the loading screen disappears, showing the translation workspace.

### Test Case 3: Interactive Translation Canvas
1. In the left panel, locate the extracted texts from the vector image.
2. Select a target translation language (e.g., French, Spanish, German) from the dropdown.
3. Click **AI Translate**.
4. **Success Criteria:** The translation requests are forwarded to the Gemini 2.5 Flash API. Within 3-6 seconds, the text nodes on the live canvas update to reflect the translated strings.

### Test Case 4: QA Preview, Watermark & Download
1. Click **Preview & Adjust** in the main navigation.
2. Examine the rendering canvas for overlay alignments, overlaps, or text formatting.
3. Adjust text size or position manually if necessary.
4. Check the bottom right of the canvas for the translucent **QA Watermark** overlay.
5. Click **Download SVG** or **Export EPS**.
6. **Success Criteria:** The file download triggers in the browser, providing the finished translated file.

---

## 5. Production Compilation & Deployment

Once local testing is complete, follow this deployment protocol to push changes live:

### Step A: Build Static Assets
In the `react-app` directory, run:
```bash
npm run build
```
This compiles, optimizes, and bundles the frontend. The production-ready outputs are saved in the `react-app/dist/` directory.

### Step B: Package the Deployment Zip
1. Open the [react-app/dist/](file:///Users/snigdha/Desktop/eps-translator/react-app/dist/) directory.
2. Copy the [api.php](file:///Users/snigdha/Desktop/eps-translator/api.php) proxy script from the root workspace directory directly into `react-app/dist/`.
3. Select all items *inside* the `dist` directory and zip them together (e.g. `eps-tool-deploy.zip`).

### Step C: Deploy to WordPress / Hostinger Server
1. Connect via an FTP client (like FileZilla) or log into WordPress ➔ **WP File Manager**.
2. Navigate to your website's root hosting directory `public_html/`.
3. Locate or create your staging or production target directory:
   * **Staging:** `public_html/eps-tool-staging/` (Accessible at `https://lingochaps.com/eps-tool-staging/`)
   * **Production:** `public_html/eps-tool/` (Accessible at `https://lingochaps.com/eps-tool/`)
4. Upload `eps-tool-deploy.zip` into the chosen directory.
5. Right-click and **Extract** the zip file inside the directory.
6. Delete the `.zip` file from the server.
7. Test the deployment live in the browser using the public URL.

---

## 6. Troubleshooting & FAQs

#### Q1: I get a `400 origin_mismatch` error when clicking Google Sign-In.
* **Cause:** The port or URL hostname you are accessing does not match the configured OAuth origins.
* **Fix:** Verify you are running on port `http://localhost:5173` or `http://localhost:8000`. If you have deployed the site to a new domain name (e.g. `anotherdomain.com`), you must log in to the [Google Cloud Console](https://console.cloud.google.com/), find your Client ID, and add `https://anotherdomain.com` under **Authorized JavaScript Origins**.

#### Q2: The translation step throws a "Gemini API Key is not configured" error.
* **Cause:** The `GEMINI_API_KEY` constant in `api.php` is empty or using placeholder values.
* **Fix:** Open `api.php` on the server or in the workspace and locate the define statement on line 23:
  ```php
  define('GEMINI_API_KEY', 'your_actual_api_key_from_google_ai_studio');
  ```
  Ensure a valid key from Google AI Studio is specified.

#### Q3: Firebase authentication logs console errors.
* **Cause:** The Firebase credentials in `firebase.js` may have been modified, or the domain has not been added to Authorized Domains in the Firebase console.
* **Fix:** If the domain is changing from `lingochaps.com`, open the **Firebase Console** -> **Authentication** -> **Settings** -> **Authorized Domains**, and whitelist the new domain name.

---

## 7. How to Export/Save this Document Forever

To convert this Markdown file into a portable PDF or Microsoft Word document to share with team members:

### Option A: Export to PDF via VS Code (Recommended)
1. Install the **Markdown PDF** extension in VS Code.
2. Open this `SETUP_AND_TESTING.md` file.
3. Right-click anywhere in the editor window.
4. Select **Markdown PDF: Export (pdf)**.
5. A beautifully formatted PDF file will be generated in the same directory.

### Option B: Export via Google Chrome / Web Browser
1. Drag and drop this `SETUP_AND_TESTING.md` file into a browser window, or open the preview inside your project management workspace (e.g., GitHub, GitLab).
2. Right-click the page and select **Print** (or press `Ctrl+P` / `Cmd+P`).
3. Set the printer destination to **Save as PDF**.
4. Click **Save**.
