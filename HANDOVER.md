# EPS Translator Tool — Technical Handover Document

> [!IMPORTANT]
> **The final, complete, production-ready file is `index.html`.**
> The `convert.php` file is **no longer needed** and has been deleted.

---

## 1. Hosting & Deployment Architecture

The tool is hosted directly on the Hostinger server running the WordPress site, but it operates independently of the WordPress theme architecture to ensure maximum performance and avoid plugin conflicts.

**Deployment Location:**
The files are uploaded via the **WP File Manager** plugin (accessible from the WordPress Dashboard at `wp-admin`).
*   **Directory:** `public_html/eps-tool/`
*   **Live URL:** `https://lingochaps.com/eps-tool/`

### Core Files
| File | Purpose |
|---|---|
| `index.html` | The **sole main file** — contains all HTML, CSS, JavaScript, Google Auth, tools dashboard, CloudConvert logic, watermarking, and login tracking |
| `HANDOVER.md` | This document |

---

## 2. Complete User Journey & Flow

The full end-to-end flow a user experiences from opening the URL to using the tool:

```
1. User opens: https://lingochaps.com/eps-tool/
        ↓
2. LOCKSCREEN appears (animated neural globe on left, login panel on right)
        ↓
3. User clicks "Continue with Google" → signs in with their Google account
        ↓
4. User ticks the CAPTCHA checkbox ("I'm not a robot")
        ↓
5. TOOLS DASHBOARD appears — "Choose Your Tool"
        ↓
      ┌─────────────────────┬────────────────────────────────┐
      │  Click "LingoGenie" │  Click "Aura EPS Tool"         │
      │  → Opens            │  → Dashboard hides             │
      │    lingochaps.com   │  → EPS Translation Tool opens  │
      │    in a new tab     │                                │
      └─────────────────────┴────────────────────────────────┘
```

> [!NOTE]
> The EPS Tool body is completely hidden (`display:none`) until the user explicitly clicks "Aura EPS Tool" on the dashboard. This prevents any flash of content appearing before the lockscreen fully loads.

---

## 3. Tools Dashboard

After successful login, the user lands on a clean "Choose Your Tool" dashboard. It contains:

| Card | Status | Action |
|---|---|---|
| **LingoGenie** 🌐 | Live (placeholder URL) | Opens `https://lingochaps.com` in a new tab. Update the URL in `launchTool()` when the real LingoGenie tool is ready. |
| **Aura EPS Tool** ⚙️ | Live | Hides the dashboard and shows the full EPS Translation Tool |
| **New Tool** 🔜 | Coming Soon | Static display card — no click action |
| **New Tool** 🔜 | Coming Soon | Static display card — no click action |

**To update the LingoGenie URL:** Find `launchTool()` in `index.html` (around line 3480) and update:
```javascript
window.open('https://lingochaps.com', '_blank'); // ← Replace this URL
```

---

## 4. Google Authentication & Session Persistence

**How it works:**
1. The lockscreen loads with the Google Sign-In button rendered by the GSI library.
2. **Client ID:** `366085231938-v2dajqpl5u86o5sneoqhggv6u6hlmfpr.apps.googleusercontent.com`
3. After sign-in, `handleGoogleSignIn()` is triggered — it decodes the JWT token, stores the user's name/email/picture in `window._loggedInUser`, silently logs to Google Sheets, saves the credentials to `localStorage`, and shows Step 2 (Captcha).
4. After the captcha is ticked, `simulateCaptchaCheck()` runs the unlock animation, saves captcha completion to `localStorage`, and reveals the Tools Dashboard.

**Session Persistence on Refresh:**
*   **User Login Session:** Login state and captcha verification are stored in the browser's `localStorage` (keys: `aura_logged_in`, `aura_user`, `aura_captcha_passed`, `aura_active_view`). On page refresh, if a session exists, the lockscreen is bypassed entirely and the user is returned to their last active view (either the **Tools Dashboard** or **Aura EPS Tool**).
*   **Active File Session:** The currently uploaded file (SVG content), the filename, the current translation states, visual editor coordinates, and font sizes are saved in `sessionStorage` (keys: `aura_svg_text`, `aura_filename`, `aura_labels`, `aura_step`). If a user refreshes the page while inside the **Aura EPS Tool**, their progress is restored instantly to the exact step they were on **without having to upload the file again or consume another CloudConvert API credit**. Clicking "Start Over" or "Sign Out" clears this session cache.

**Navigation & Account Controls:**
*   **Tools Dashboard Top Bar:** Includes user profile info (name + avatar) and a **"Sign Out"** button.
*   **Aura EPS Tool Top Bar:** Added a dedicated dark-themed top bar containing a **"← Back to Dashboard"** button (to return to tool selection), user profile info, and a **"Sign Out"** button.
*   **Sign Out Action:** Clicking "Sign Out" in either view clears all session keys from `localStorage` and reloads the page to return the user to the Google Auth lockscreen.

**Google Cloud Console Configuration:**
*   **Project Name:** Aura Translator
*   **Console URL:** `console.cloud.google.com`
*   **Credentials:** APIs & Services → Credentials → "Aura Translator" OAuth 2.0 Client
*   **Authorized JavaScript Origins** (must match exactly, no trailing slash):
    *   `https://lingochaps.com`

> [!WARNING]
> If the domain changes or a staging URL is added, the new URL must be added to the Authorized JavaScript Origins list in Google Cloud Console, or a `400 origin_mismatch` error will occur. After saving, wait up to 30 minutes for Google's servers to propagate the change.

**App Publishing Status:**
*   **Testing mode:** Only manually added Test Users can log in.
*   **In Production mode:** Any Google account can log in freely. *(Recommended for public use.)*

---

## 5. CloudConvert API Integration

Both conversion operations are handled entirely inside `index.html` using native JavaScript `fetch` — no server-side PHP is involved.

**API Key Location:** Line ~1320 in `index.html`
```javascript
const CLOUDCONVERT_API_KEY = 'eyJ0eXAiOiJKV1Qi...';
```

### Operation A: EPS → SVG (On File Upload)
When a user uploads an `.eps` file:
1. A loading spinner appears (no text shown to the user).
2. JavaScript creates a 3-task CloudConvert job: **Upload → Convert EPS→SVG → Export URL**.
3. The script polls CloudConvert every 2 seconds until the SVG is ready.
4. The SVG is silently loaded into the tool for translation.

### Operation B: SVG → EPS (On Download)
When a user clicks **"Download Translated EPS ↓"**:
1. The button shows live progress: `⏳ Converting to EPS...` → `⏳ Uploading...` → `⏳ Processing...`
2. JavaScript creates a new CloudConvert job: **Upload SVG → Convert SVG→EPS → Export URL**.
3. The final `.eps` file is downloaded to the user's computer.
4. Button resets to normal after download. Shows `✅ EPS downloaded successfully!`

> [!IMPORTANT]
> Every file uses **2 conversion credits** (one for EPS→SVG on upload, one for SVG→EPS on download). The free daily limit of 10 credits effectively supports **5 complete file workflows per day**. To increase this, upgrade at [cloudconvert.com/pricing](https://cloudconvert.com/pricing).

---

## 6. Watermark

Every exported EPS file automatically contains a subtle, semi-transparent watermark in the **bottom-right corner**:

`www.lingochaps.com`

The font size scales automatically based on the diagram's `viewBox` dimensions so it is always proportional. The watermark is injected as an SVG `<text>` element just before the download is triggered.

**To change the watermark text:** Find this line (~line 3252) in `index.html`:
```javascript
wmText.textContent = 'www.lingochaps.com';
```

---

## 7. User Login Tracking (Google Sheets)

Every successful Google sign-in is silently recorded in a private Google Sheet in your Google Drive.

**How it works:**
1. `handleGoogleSignIn()` fires a silent `POST` request to a Google Apps Script Web App.
2. The Apps Script automatically creates a Google Sheet named **"LingoChaps Tool Users"** on the very first login, and appends a new row for every subsequent sign-in.

**Google Apps Script Details:**
*   **Script Name:** LingoChaps Login Logger
*   **Edit URL:** [script.google.com](https://script.google.com) → "LingoChaps Login Logger"
*   **Web App URL:** `https://script.google.com/macros/s/AKfycbwNmYFt1K-lEx5HUcDUgwp7_5_9FzjfldfW0L-P6CyXqb7DER2z0YtCJWzyGv6rywl_Ig/exec`

**Google Sheet columns:**
| Column A | Column B | Column C |
|---|---|---|
| Timestamp (IST) | Name | Email |

> [!NOTE]
> The logging is completely silent — if it ever fails, it will never interrupt the user's experience.

---

## 8. Maintenance & Future Updates

| Task | How To Do It |
|---|---|
| **Update the tool UI or logic** | Edit `index.html` locally → re-upload to `eps-tool/` via WP File Manager |
| **Check remaining CloudConvert credits** | Log in at [cloudconvert.com/dashboard](https://cloudconvert.com/dashboard) *(Production dashboard — not Sandbox)* |
| **View who has logged in** | Open Google Drive → look for **"LingoChaps Tool Users"** spreadsheet |
| **Add a new test user (Testing mode)** | Google Cloud Console → OAuth Consent Screen → Add Test User |
| **Publish to Production (allow all users)** | Google Cloud Console → OAuth Consent Screen → Publish App |
| **Update LingoGenie URL when ready** | Find `launchTool()` (~line 3480) → update `window.open(...)` URL |
| **Change watermark text** | Find `wmText.textContent` (~line 3252) → update the string |
| **Rotate CloudConvert API Key** | cloudconvert.com → API → Keys. Update line ~1320 in `index.html` |

> [!NOTE]
> Updating WordPress core, themes, or plugins will **not** affect this tool as it lives in its own isolated directory (`/eps-tool/`).
