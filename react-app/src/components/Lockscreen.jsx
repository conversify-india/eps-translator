import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import PlexusCanvas from './PlexusCanvas';
import { saveUserToFirebase } from '../firebase';
import { apiService } from '../services/api';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
};

export default function Lockscreen({ onLoginSuccess }) {
  const [step, setStep] = useState(1); // 1: Google Login, 2: Captcha
  const [userPayload, setUserPayload] = useState(null);
  const [googleCredential, setGoogleCredential] = useState(null);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse.credential;
    
    let userInfo;
    if (credential === 'mock_development_credential_jwt_token') {
      userInfo = { name: 'Dev User', email: 'dev@localhost', picture: '' };
    } else {
      const payload = decodeJwt(credential);
      if (!payload) {
        setErrorMsg('Failed to process Google sign-in payload.');
        return;
      }
      userInfo = {
        name: payload.name || 'User',
        email: payload.email || '',
        picture: payload.picture || ''
      };
    }

    setUserPayload(userInfo);
    setGoogleCredential(credential);

    // Save to Firebase silently in the background
    if (credential !== 'mock_development_credential_jwt_token') {
      saveUserToFirebase(credential, userInfo);
    }

    // Log login to Google Sheets silently via our proxy
    apiService.logLogin(userInfo.name, userInfo.email);

    setErrorMsg('');
    setStep(2); // Proceed to Captcha step
  };

  const handleGoogleError = () => {
    setErrorMsg('Google Sign-In failed. Please try again.');
  };

  const handleCaptchaClick = () => {
    if (captchaChecked) return;
    setCaptchaChecked(true);

    // Simulate validation and trigger unlocking animation
    setTimeout(() => {
      onLoginSuccess(userPayload);
    }, 900);
  };

  return (
    <div id="auth-lockscreen" className={`lockscreen-overlay ${captchaChecked ? 'unlocked' : ''}`}>
      {/* Left side constellation animation */}
      <PlexusCanvas />

      {/* Right side login form */}
      <div className="split-right">
        <div className="login-panel">
          <div className="login-brand"><span>✦</span> AURA</div>
          <div className="login-brand-sub">Intelligent Suite</div>

          <h2>Sign In to Your Account</h2>
          <p className="sub">Verify credentials to unlock the visual vector editor and translation dashboard.</p>

          {/* Step 1: Google Login */}
          {step === 1 && (
            <div id="auth-step-1" className="login-step">
              <div className="step-title" style={{ marginBottom: '1.25rem' }}>Step 1: Sign in with Google</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                  shape="rectangular"
                  logo_alignment="left"
                  width="100%"
                />
              </div>

              {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) && (
                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      handleGoogleSuccess({
                        credential: 'mock_development_credential_jwt_token'
                      });
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.65rem 1.2rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                      width: '100%',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; }}
                  >
                    ⚡ Dev Login (Bypass OAuth)
                  </button>
                </div>
              )}

              {errorMsg && (
                <p id="auth-error-msg" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.6rem', textAlign: 'center' }}>
                  {errorMsg}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Captcha Verification */}
          {step === 2 && userPayload && (
            <div id="auth-step-2" className="login-step">
              {/* Signed-in user card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: '#f0fdf4',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                marginBottom: '1.5rem'
              }}>
                {userPayload.picture && (
                  <img
                    src={userPayload.picture}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #10b981' }}
                    alt=""
                  />
                )}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46' }}>✓ Signed in as</div>
                  <div style={{ fontSize: '0.78rem', color: '#047857' }}>{userPayload.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{userPayload.email}</div>
                </div>
              </div>

              <div className="step-title">Step 2: Security Verification</div>
              <div className="mock-captcha" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#ffffff', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '6px', padding: '0.9rem 1rem', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)' }}>
                <div
                  id="captcha-box"
                  className={`mock-captcha-checkbox ${captchaChecked ? 'checked' : ''}`}
                  onClick={handleCaptchaClick}
                  style={{
                    width: '26px',
                    height: '26px',
                    border: '2px solid #cbd5e1',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    transition: 'all 0.1s'
                  }}
                >
                  {captchaChecked && <span style={{ color: '#059669', fontSize: '20px', fontWeight: 'bold' }}>✓</span>}
                </div>
                <div className="mock-captcha-label" style={{ fontFamily: "'Plus Jakarta Sans', Roboto, sans-serif", fontSize: '13px', fontWeight: '600', color: '#334155', flexGrow: 1 }}>
                  I'm not a robot
                </div>
                <div className="mock-captcha-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '8px', color: '#64748b' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/a/ad/RecaptchaLogo.svg" alt="reCAPTCHA" style={{ width: '20px', height: '20px', marginBottom: '2px' }} />
                  <span>reCAPTCHA</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
