import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { showToast } from '../hooks/useToast';

const LANGUAGES = [
  { c: "English", f: "🇬🇧" },
  { c: "Hindi", f: "🇮🇳" },
  { c: "French", f: "🇫🇷" },
  { c: "Spanish", f: "🇪🇸" },
  { c: "German", f: "🇩🇪" },
  { c: "Arabic", f: "🇸🇦" },
  { c: "Chinese (Simplified)", f: "🇨🇳" },
  { c: "Japanese", f: "🇯🇵" },
  { c: "Portuguese", f: "🇧🇷" },
  { c: "Russian", f: "🇷🇺" },
  { c: "Italian", f: "🇮🇹" },
  { c: "Korean", f: "🇰🇷" },
  { c: "Dutch", f: "🇳🇱" },
  { c: "Turkish", f: "🇹🇷" },
  { c: "Urdu", f: "🇵🇰" },
  { c: "Bengali", f: "🇮🇳" },
  { c: "Punjabi", f: "🇮🇳" },
  { c: "Marathi", f: "🇮🇳" },
  { c: "Tamil", f: "🇮🇳" },
  { c: "Telugu", f: "🇮🇳" },
  { c: "Gujarati", f: "🇮🇳" },
  { c: "Kannada", f: "🇮🇳" },
  { c: "Malayalam", f: "🇮🇳" }
];

const LANG_RATES = {
  'Hindi': 2, 'Urdu': 2, 'Bengali': 2, 'Punjabi': 2, 'Marathi': 2,
  'Tamil': 2, 'Telugu': 2, 'Gujarati': 2, 'Kannada': 2, 'Malayalam': 2,
  'French': 5, 'Spanish': 5, 'German': 5, 'Portuguese': 5, 'Russian': 5,
  'Italian': 5, 'Dutch': 5, 'Arabic': 5, 'Turkish': 5,
  'Chinese (Simplified)': 6, 'Japanese': 6, 'Korean': 6
};

export default function LingoGenieWorkspace({ user, onStartOver }) {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('German');
  const [targetLang, setTargetLang] = useState('English');
  const [loading, setLoading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);

  const WORD_LIMIT = 250;

  useEffect(() => {
    // Generate static invoice ID and date on mount
    const randId = 'LG-' + String(Math.floor(Math.random() * 900000) + 100000);
    setInvoiceId(randId);
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    setInvoiceDate(formattedDate);
  }, []);

  const getWordCount = (text) => {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  };

  const wordCount = getWordCount(inputText);

  const handleInput = (val) => {
    setInputText(val);
    if (val.trim() === '') {
      setTranslatedText('');
      setShowInvoice(false);
    }
  };

  const handleSwap = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    setTranslatedText('');
    setShowInvoice(false);
  };

  const handleTranslate = async () => {
    if (sourceLang === targetLang) {
      showToast('Source and target languages must be different.', 'warning');
      return;
    }

    if (inputText.trim() === '') {
      showToast('Please enter some text to translate.', 'warning');
      return;
    }

    setLoading(true);
    setShowInvoice(false);

    try {
      // Direct call to the secure backend proxy
      // The API resolves fallback translation engines (MyMemory, DeepL, Gemini) in sequence
      const resMap = await apiService.translateText([inputText], targetLang, sourceLang);
      const result = resMap[inputText];

      if (result) {
        setTranslatedText(result);
        const wc = getWordCount(inputText);
        if (wc > WORD_LIMIT) {
          const rate = LANG_RATES[sourceLang] || 5;
          setInvoiceAmount(Math.ceil(wc * rate));
          setShowInvoice(true);
        } else {
          showToast('Translation completed!', 'success');
        }
      } else {
        throw new Error('No translation returned from server.');
      }
    } catch (err) {
      console.error(err);
      showToast('Translation failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText).then(() => {
      showToast('Copied to clipboard!', 'success');
    });
  };

  return (
    <div className="lingogenie-workspace" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 120px)',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2rem 1.5rem 4rem'
    }}>
      
      {/* Hero Welcome Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <span style={{
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
          color: '#fff',
          fontSize: '0.65rem',
          fontWeight: 700,
          padding: '0.25rem 0.75rem',
          borderRadius: '100px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
        }}>
          🌐 LINGOGENIE TEXT TRANSLATOR
        </span>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: 800, marginTop: '0.8rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Real-time AI Text Translator
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.5 }}>
          Translate phrases, paragraphs, or technical instructions instantly between 20+ global languages.
        </p>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        {/* Language Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '10px 15px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>From</span>
          <select
            value={sourceLang}
            onChange={(e) => { setSourceLang(e.target.value); setTranslatedText(''); }}
            style={{
              flex: 1,
              minWidth: '130px',
              padding: '0.55rem 0.85rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: '#0f172a',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {LANGUAGES.map(l => (
              <option key={l.c} value={l.c}>{l.f} {l.c}</option>
            ))}
          </select>

          <button
            onClick={handleSwap}
            type="button"
            title="Swap languages"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
              color: '#475569'
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 17H3M3 17L7 21M3 17L7 13M7 7h14M21 7l-4-4M21 7l-4 4" />
            </svg>
          </button>

          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>To</span>
          <select
            value={targetLang}
            onChange={(e) => { setTargetLang(e.target.value); setTranslatedText(''); }}
            style={{
              flex: 1,
              minWidth: '130px',
              padding: '0.55rem 0.85rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: '#0f172a',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {LANGUAGES.map(l => (
              <option key={l.c} value={l.c}>{l.f} {l.c}</option>
            ))}
          </select>
        </div>

        {/* Text Area Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.25rem',
          marginBottom: '1.25rem'
        }} className="editor-grid-responsive">
          <style>{`
            @media (max-width: 600px) {
              .editor-grid-responsive { grid-template-columns: 1fr !important; }
            }
          `}</style>
          
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>
              Your Text
            </label>
            <textarea
              value={inputText}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Type or paste text here..."
              style={{
                width: '100%',
                minHeight: '220px',
                padding: '0.9rem 1rem',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: '#0f172a',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                outline: 'none',
                resize: 'vertical',
                transition: 'border-color 0.15s'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px', fontWeight: 600 }}>
              {wordCount} words
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>
              Translation Output
            </label>
            <textarea
              value={translatedText}
              readOnly
              placeholder="Translation will appear here..."
              style={{
                width: '100%',
                minHeight: '220px',
                padding: '0.9rem 1rem',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: '#0f172a',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>
        </div>

        {/* Buttons Row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleTranslate}
            disabled={loading || inputText.trim() === ''}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.75rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(124,58,237,0.2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.18s'
            }}
          >
            {loading && (
              <span style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: '#fff',
                animation: 'spin 0.6s linear infinite',
                display: 'inline-block'
              }} />
            )}
            Translate Text
          </button>
          
          {translatedText && (
            <button
              onClick={handleCopy}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              📋 Copy Translation
            </button>
          )}

          <button
            onClick={onStartOver}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '8px',
              padding: '0.75rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Quote Quote Card for > 250 words */}
      {showInvoice && (
        <div className="invoice-section show" style={{ marginTop: '2rem' }}>
          <div className="invoice-card" style={{ border: '1.5px solid #cbd5e1', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
            <div className="inv-header" style={{ background: '#1e1b4b', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>🧞 LingoGenie Translation Quote</h3>
                <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Generated instantly for your project</p>
              </div>
              <div style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', padding: '4px 10px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700 }}>
                {invoiceId}
              </div>
            </div>

            <div style={{ background: '#fff', padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>From</label>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                    <strong>LingoChaps</strong><br />
                    ISO 17100:2015 Certified<br />
                    info@lingochaps.com<br />
                    +91-9319666453
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Project details</label>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                    <strong>Text Translation Quote</strong><br />
                    {sourceLang} ➔ {targetLang}<br />
                    {wordCount} words · {invoiceDate}
                  </p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', padding: '8px 10px' }}>Service</th>
                    <th style={{ textAlign: 'left', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', padding: '8px 10px' }}>Details</th>
                    <th style={{ textAlign: 'left', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', padding: '8px 10px' }}>Unit rate</th>
                    <th style={{ textAlign: 'right', fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', padding: '8px 10px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>Professional Translation</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#475569' }}>{sourceLang} ➔ {targetLang} ({wordCount} words)</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#475569' }}>₹{LANG_RATES[sourceLang] || 5}/word</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: '#1e293b', fontWeight: 700, textAlign: 'right' }}>₹{invoiceAmount}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>Human Expert Review</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#475569' }}>Native linguist QA verification</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#475569' }}>Included</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: '#16a34a', fontWeight: 700, textAlign: 'right' }}>Free</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>Formatting Preservation</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#475569' }}>Structural layout integrity check</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#475569' }}>Included</td>
                    <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: '#16a34a', fontWeight: 700, textAlign: 'right' }}>Free</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Estimated Total</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>₹{invoiceAmount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>+ GST</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '1.25rem', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <strong style={{ display: 'block', fontSize: '0.88rem', color: '#78350f', fontWeight: 700 }}>Need a certified/notarised copy of this translation?</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#b45309', lineHeight: 1.45 }}>
                    Our team of native professional translators can review, certify, stamp, and notarise your project for embassy and official use.
                  </p>
                </div>
                <a
                  href="https://lingochaps.com/contact"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                    cursor: 'pointer'
                  }}
                >
                  Connect with Expert
                </a>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap', gap: '10px' }}>
              <div>Quote valid for 7 days · <a href="mailto:info@lingochaps.com" style={{ color: '#2563eb', textDecoration: 'none' }}>info@lingochaps.com</a> · <a href="tel:+919319666453" style={{ color: '#2563eb', textDecoration: 'none' }}>+91-9319666453</a></div>
              <div style={{ color: '#16a34a', fontWeight: 700 }}>✓ ISO 17100:2015 &amp; ISO 9001:2015 Certified</div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Spin style helper */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
