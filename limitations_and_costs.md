# Aura EPS Tool: API Quotas, Credit Consumption & System Limitations

This document outlines the operational limits, cost structures, credit consumption rules, and technical boundaries of the **Aura EPS Translation Tool** for management and stakeholders.

---

## 1. CloudConvert API Costs & Credit Consumption

Because web browsers cannot parse or compile raw binary vector drawings (`.eps`) natively, the tool uses **CloudConvert** (a secure, cloud-based file conversion engine) to handle format conversions.

### Credit Rules:
*   **Per-File Cost**: A complete translation cycle consumes exactly **2 conversion credits**:
    1.  **1 Credit** on File Upload: Converts the uploaded `EPS` file to `SVG` (so it can be edited on-screen).
    2.  **1 Credit** on File Export: Converts the edited `SVG` back to `EPS` (for final download).
*   **Refresh Protection (Zero-Cost Refresh)**: The tool uses local session caching (`sessionStorage`). If a user refreshes their tab mid-translation, their layout, file data, and translation progress are restored instantly **without uploading the file again**, consuming **0 additional credits**.

### Account Tiers & Capacity:
*   **Free Developer Account**: Provides **10 conversion credits per day**. This allows for **5 complete file translations per day** (10 credits / 2 credits per file).
*   **Paid Packages (One-Time Purchases)**:
    *   $9.00 for 500 credits (processes **250 files**) — *3.6¢ per file*
    *   $39.00 for 5,000 credits (processes **2,500 files**) — *1.5¢ per file*
*   **Paid Subscriptions (Monthly)**:
    *   $8.00/month for 1,000 credits (processes **500 files/month**)
    *   $39.00/month for 10,000 credits (processes **5,000 files/month**)

---

## 2. Platform Safeguards & Quotas

To prevent a single user from running up costs or exhausting the shared daily API credits, the tool enforces several defensive rules:

### A. Per-User Daily Limit
*   **Restriction**: Enforces a strict limit of **1 file conversion per user per day**.
*   **Behavior**: Once a user successfully translates and downloads one EPS file, their browser marks the session. Any subsequent EPS uploads today will show a *"Daily Limit Reached"* notice and be blocked.
*   **Developer Exemption**: This limit is automatically bypassed when running on local environments (`localhost` or `127.0.0.1`) so developers can test files continuously.

### B. File Size Boundary
*   **Restriction**: A maximum file size limit of **50 MB** per drawing.
*   **Reasoning**: EPS files larger than 50MB consume excessive browser memory and can cause conversion timeouts over standard office internet connections.

### C. Google Sheets Auditing Quotas
*   **Quota**: Logs up to **20,000 user login records per day**.
*   **Cost**: **100% Free** (uses Google Apps Script web apps hooked to a Google Sheet in your Google Drive).

### D. Google Client ID & reCAPTCHA Domains
*   **Restriction**: Google login and CAPTCHA credentials are locked to specific authorized web domains.
*   **Authorized Domains**: `localhost` (development testing) and `lingochaps.com` (production website).
*   *Note: If the application index file is moved to a different domain name in the future, these features will block users until the new domain is added in the Google Developer Console.*

---

## 3. Graphical & Vector Translation Limitations

Because vector files contain complex geometric math, there are standard technical constraints on what can be translated visually:

### A. Outlined Text (Non-Editable Curves)
*   **Restriction**: The tool can only translate text layers that are saved as **editable fonts** (`<text>` or `<tspan>` nodes).
*   **Boundary**: If an EPS drawing has had its text "converted to outlines" or "converted to paths" (where the letters are flat drawing shapes instead of typed font characters), the tool will detect **0 unique labels** and display a warning. These files require manual re-creation or OCR pre-processing.

### B. Font Rendering Fallbacks
*   **Restriction**: Standard web layout engines rely on standard web-accessible fonts (e.g., Arial, Helvetica, Google Fonts).
*   **Boundary**: If your input EPS drawing uses proprietary, specialized desktop drawing fonts (such as unique CAD fonts), the browser will display them using default clean sans-serif fonts. The alignment will remain accurate, but the font family will fall back to default rendering.
