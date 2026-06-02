# Google Sign-In & reCAPTCHA Integration Guide
This guide provides step-by-step instructions for configuring Google Sign-In, Google reCAPTCHA, and storing authenticated user emails.

---

## 1. Key Questions & Fundamentals

### Why is it called "Next Project" in the Cloud Console?
When you create a Google Cloud account, Google automatically generates a default project name (like `My First Project` or `Next Project`). You do not need to worry about this name; you can build your login credentials directly inside this project.

### Is it Free?
* **Google Sign-In**: **100% Free** forever. There are no fees or limits on how many users can sign in using their Google account.
* **Google reCAPTCHA v2**: The current implementation uses a **simulated client-side mock checkbox** to provide a fast and zero-configuration bot check, meaning **no API keys or external Google reCAPTCHA server setup is active in the current code**. If you wish to implement live verification in the future, you can configure Google reCAPTCHA v2 (free for up to 10,000 assessments/month).
* **Firebase (User Database)**: **Free** (Spark Plan) up to **50,000 monthly active users** and 1 GB of database storage, which is perfect for keeping track of your users.

### How do we record who is using the site (User Emails)?
The easiest, free, and most secure way to store user emails is **Firebase Authentication & Firestore**. When a user logs in, Firebase securely stores their email, name, and profile photo. You can view all registered users in a clean table on the Firebase Admin Web Console, and export them later to contact them.

---

## 2. Configuration Credentials (Save Here)

*   **Google Client ID**: `366085231938-v2dajqpl5u86o5sneoqhggv6u6hlmfpr.apps.googleusercontent.com`
*   **reCAPTCHA Site Key (Client)**: *Not required (using simulated mock captcha)*
*   **reCAPTCHA Secret Key (Server)**: *Not required (using simulated mock captcha)*

---

## 3. Step-by-Step Configuration Steps

### Step A: Generate Google Sign-In Credentials
1. Click the **APIs & Services** card on your Google Cloud Console home screen.
2. Select **OAuth consent screen** on the left sidebar:
   * Select **External** and click **Create**.
   * Fill out the **App name** (e.g. `Aura Translator`), **User support email** (your email), and **Developer contact email** (your email).
   * Click **Save and Continue** on the next screens without editing anything else until you click **Back to Dashboard**.
3. Select **Credentials** on the left sidebar:
   * Click **+ Create Credentials** at the top -> **OAuth client ID**.
   * Set **Application type** to **Web application**.
   * Under **Authorized JavaScript origins**, click **+ Add URI** and type: `http://localhost:8000`.
   * Click **Create**.
   * Copy the **Client ID** from the popup and paste it into the credentials section above.

### Step B: Generate reCAPTCHA v2 Keys (Optional / Future Reference)
*Note: This step is only necessary if you decide to replace the current simulated mock captcha with live Google verification.*
1. Go to the [Google reCAPTCHA Console](https://www.google.com/recaptcha/admin).
2. Register a new site:
   * **Label**: `Aura Translator`
   * **reCAPTCHA type**: Select **reCAPTCHA v2** -> **"I'm not a robot" checkbox**.
   * **Domains**: Add `localhost` (for testing) and your website domain (once you deploy it online).
3. Click **Submit**.
4. Copy the **Site Key** and **Secret Key** and save them for when you integrate a live recaptcha library.

### Step C: Set up Firebase to Store Emails (Free)
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and select your existing Google Cloud project (`snigdha-next-project-2026` / "Next Project") from the dropdown. Click **Continue**.
3. Click **Build** -> **Authentication** on the left sidebar:
   * Click **Get Started**.
   * In the **Sign-in method** tab, click **Google** -> click **Enable**.
   * Select your support email and click **Save**.
4. Go to **Project Settings** (gear icon next to "Project Overview"):
   * Scroll down to **Your apps** and click the **Web icon `</>`**.
   * Register your app name (e.g., `Aura Web`) and click **Register app**.
   * Copy the `firebaseConfig` code block that appears. It will look like this:
     ```javascript
     const firebaseConfig = {
       apiKey: "...",
       authDomain: "...",
       projectId: "...",
       storageBucket: "...",
       messagingSenderId: "...",
       appId: "..."
     };
     ```

---

## 4. Lifelong Maintenance & Operations

To ensure this setup works forever without issues:
1. **Domain Changes**: If you deploy your app to a new hosting provider or domain (e.g., your own domain like `mytranslator.com`), you **must** update:
   * **Google Cloud Console**: Add the new domain to **Authorized JavaScript origins**.
   * **Firebase Console**: Add the new domain to **Authorized domains** under Authentication settings.
2. **Security Checks**: Never share your Firebase Config credentials or your Firebase **Private Admin keys** publicly.
3. **No Coding Required to Manage Users**: You can view, search, delete, or manage registered user emails simply by logging into the [Firebase Authentication Dashboard](https://console.firebase.google.com/).
