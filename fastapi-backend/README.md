# EPS Translator — Python FastAPI Backend

This directory contains the production-ready Python FastAPI backend for the EPS Translator Tool. It consolidates layout analysis, OCR, translation, and high-fidelity Word (`.docx`) layout reconstruction under a secure, scalable Python environment.

---

## 🚀 Features

* **Drop-in Compatibility:** Provides a `/api.php` route that mirrors the query-based actions of the PHP proxy, allowing you to use it with zero modifications to the compiled React build.
* **Unified Stack:** Direct integration with python libraries like `pdf2docx`, `python-docx`, and `ezdxf`.
* **Layout Safeguards:** Programmatic dynamic font shrinking (to fit translations within boundaries) and recursive table row height adjusting (preventing text cut-off).
* **Easy Containerization:** Pre-configured `Dockerfile` for seamless one-click cloud deployment.

---

## 🛠️ Local Setup

1. **Navigate to the Backend Directory:**
   ```bash
   cd fastapi-backend
   ```

2. **Install Python Dependencies:**
   Ensure you have Python 3.10+ installed:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Development Server:**
   ```bash
   python main.py
   ```
   *The FastAPI server will boot and listen at **`http://localhost:8000`**.*

---

## ⚙️ Environment Variables (Optional)

Configure these variables in your deployment environment (Render/Railway settings) or via a `.env` file to customize API keys:

| Variable | Description | Default / Fallback |
|---|---|---|
| `GEMINI_API_KEY` | Gemini AI API key for Vision OCR / translation. | (Uses default developer key) |
| `CLOUDCONVERT_API_KEY` | CloudConvert API key for DOCX conversions. | (Uses default developer key) |
| `GOOGLE_SHEETS_URL` | Google script URL for user logins spreadsheet. | (Uses default developer spreadsheet) |
| `PROPOSAL_DESTINATION_EMAIL` | Email to receive customer translation requests. | `adobelingo@gmail.com` |
| `SMTP_HOST` | Hostname of SMTP server (e.g. `smtp.gmail.com`). | `smtp.gmail.com` |
| `SMTP_PORT` | Port of SMTP server (e.g. `465`). | `465` |
| `SMTP_USER` | SMTP Username for email auth. | (Empty) |
| `SMTP_PASS` | SMTP Password (use App Password for Gmail). | (Empty) |

---

## 🌐 Connecting the React Frontend

To test your new Python backend with the React frontend:

1. Open the EPS Translator dashboard and click **"PDF to Word Converter"**.
2. Upload any document or image.
3. In **Step 2 (Source Language)**, look for the **CUSTOM BACKEND API URL (OPTIONAL)** input field.
4. Input your backend URL (e.g. `http://localhost:8000` for local testing, or `https://your-backend.onrender.com` for a deployed instance) and select your source language.
5. Click **"Start Layout OCR & Analysis"** to process your document using the Python server!

---

## 📦 Cloud Deployment

### Railway (Recommended)
1. Push this workspace folder to a GitHub repository.
2. Log in to [Railway.app](https://railway.app) and create a **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Select your repository.
4. Under **Settings** $\rightarrow$ **Root Directory**, set it to `fastapi-backend`.
5. Under **Variables**, add your custom keys (e.g., `GEMINI_API_KEY`, `CLOUDCONVERT_API_KEY`).
6. Railway will automatically detect the `Dockerfile` and deploy the service.

### Render
1. Create a free account at [Render.com](https://render.com).
2. Click **New** $\rightarrow$ **Web Service** and link your GitHub repository.
3. Set **Root Directory** to `fastapi-backend`.
4. Set **Runtime** to `Docker`.
5. Under **Environment Variables**, configure your keys.
6. Click **Deploy Web Service**.
