import { useState } from 'react';
import { apiService } from '../services/api';

export default function Diagnosis({
  filename,
  uniqueSourceTexts,
  onAiTranslationSuccess,
  onManualTranslateClick
}) {
  const [targetLang, setTargetLang] = useState('French|30'); // Format: Language|ExpansionPct
  const [translating, setTranslating] = useState(false);

  const getFirstName = () => {
    return filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
  };

  const handleAiTranslate = async () => {
    if (uniqueSourceTexts.length === 0) {
      alert('No text segments found to translate.');
      return;
    }

    setTranslating(true);
    const selectedLanguage = targetLang.split('|')[0];

    try {
      // Call secure backend proxy to translate texts via Gemini
      const translationsMap = await apiService.translateText(uniqueSourceTexts, selectedLanguage);
      
      // Pass the translations map back to the App parent component
      onAiTranslationSuccess(translationsMap);
    } catch (err) {
      console.error('AI translation failed:', err);
      alert('AI Translation failed: ' + err.message + '\n\nYou can still translate manually or try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleContactClick = () => {
    window.open('https://lingochaps.com/contact/', '_blank');
  };

  return (
    <div className="card" id="section-extract" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <h2>Step 2 — Diagnosis</h2>
      <div id="diagnosisResult">
        <div id="diagBadge" className="diag-badge" style={{
          display: 'inline-block',
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.25rem 0.6rem',
          borderRadius: '100px',
          marginBottom: '0.75rem',
          background: '#0d1f1a',
          color: '#34d399'
        }}>
          EDITABLE VECTOR
        </div>
        <div id="filenameChip" className="filename-chip" style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          background: '#f3e8ff',
          color: '#7c3aed',
          border: '1px solid #c084fc',
          borderRadius: '6px',
          padding: '0.35rem 0.6rem',
          display: 'inline-block',
          marginLeft: '0.5rem',
          marginBottom: '0.75rem'
        }}>
          {filename}
        </div>

        {/* Stats Grid */}
        <div className="diag-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.25rem'
        }}>
          <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed' }}>
              {uniqueSourceTexts.length}
            </div>
            <div className="lbl" style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.2rem' }}>
              unique strings found
            </div>
          </div>
          <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>
              100%
            </div>
            <div className="lbl" style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.2rem' }}>
              vector layers editable
            </div>
          </div>
        </div>

        <p id="diagAction" style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          All texts inside the vector file are editable. Select one of the translation methods below to translate the blueprint:
        </p>

        {/* Option A: Direct AI Translation (Instant) */}
        <div
          style={{
            background: 'rgba(124, 58, 237, 0.03)',
            border: '1px solid rgba(124, 58, 237, 0.15)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.25rem'
          }}
          className="diagnosis-option-card"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <h3 style={{ fontSize: '0.88rem', color: '#a78bfa', fontWeight: 700, marginBottom: '0.25rem' }}>
                Option A: Instant AI Translation ⚡
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                Translate all text inside your drawing instantly using our secure neural translator API.
              </p>
            </div>
            
            {/* Language Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 800, letterSpacing: '0.05em' }}>SELECT TARGET LANGUAGE</span>
              <select 
                id="targetLang" 
                className="lang-select" 
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                style={{
                  background: '#0f1117',
                  border: '1px solid #2d3748',
                  borderRadius: '8px',
                  color: '#e8e8f0',
                  padding: '0.5rem 0.7rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  height: '38px'
                }}
              >
                <option value="French|30">French</option>
                <option value="German|35">German</option>
                <option value="Spanish|30">Spanish</option>
                <option value="Italian|25">Italian</option>
                <option value="Portuguese|30">Portuguese</option>
                <option value="Dutch|25">Dutch</option>
                <option value="Hindi|40">Hindi</option>
                <option value="Arabic|25">Arabic</option>
                <option value="Japanese|0">Japanese</option>
                <option value="Chinese (Simplified)|0">Chinese (Simplified)</option>
                <option value="Russian|15">Russian</option>
                <option value="Turkish|20">Turkish</option>
                <option value="Korean|0">Korean</option>
                <option value="Polish|30">Polish</option>
                <option value="Swedish|25">Swedish</option>
              </select>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleAiTranslate}
            disabled={translating}
            style={{ 
              margin: 0, 
              padding: '0.65rem 1.5rem', 
              width: '100%', 
              cursor: translating ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {translating ? (
              <>
                <span className="spinner" style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'epsSpin 1s linear infinite'
                }}></span>
                Translating Drawing...
              </>
            ) : 'Translate with AI ⚡'}
          </button>
        </div>

        {/* Option B: Contact Our Team (Professional Service) */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid #1f2937',
            borderRadius: '10px',
            padding: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
          className="diagnosis-option-card"
        >
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h3 style={{ fontSize: '0.88rem', color: '#9ca3af', fontWeight: 700, marginBottom: '0.25rem' }}>
              Option B: Professional Translation Service ✉️
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0, lineHeight: 1.45 }}>
              Need technical certification, dynamic layout resizing, or help with highly complex blueprint details? Contact our professional team.
            </p>
          </div>
          <button 
            className="btn btn-ghost" 
            onClick={handleContactClick}
            style={{ 
              margin: 0, 
              padding: '0.6rem 1.25rem', 
              borderColor: '#1f2937', 
              cursor: 'pointer',
              borderRadius: '8px'
            }}
          >
            Contact Our Team &amp; Get Quote
          </button>
        </div>

        {/* Fallback link to edit manually */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <span 
            onClick={onManualTranslateClick}
            style={{ fontSize: '0.75rem', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#a78bfa'}
            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
          >
            Or, skip and edit translations manually ✏️
          </span>
        </div>
      </div>
    </div>
  );
}
