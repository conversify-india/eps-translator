import { useState, useRef, useEffect } from 'react';
import { showToast } from '../hooks/useToast';

const LANGUAGES = [
  'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Russian',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Dutch',
  'Swedish', 'Polish', 'Turkish', 'Vietnamese', 'English', 'Danish',
  'Finnish', 'Norwegian', 'Czech', 'Greek', 'Romanian', 'Hungarian', 'Indonesian',
  'Thai', 'Ukrainian'
];

export default function DwgWorkspace({ user, onStartOver }) {
  const [step, setStep] = useState(1); // 1 (Upload/Progress) | 3 (Success)
  const [selectedLanguage, setSelectedLanguage] = useState('French');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Uploading drawing file to server...');
  const [downloadUrl, setDownloadUrl] = useState(null);

  const loadingMessages = [
    "Uploading drawing file to server...",
    "Scanning drawing annotations...",
    "Translating annotations with Aura AI...",
    "Injecting translations into drawing...",
    "Compiling final translated AutoCAD file...",
    "Generating secure download link..."
  ];

  // Restore session on mount to save CloudConvert credits
  useEffect(() => {
    const cachedUrl = sessionStorage.getItem('aura_dwg_download_url');
    const cachedFilename = sessionStorage.getItem('aura_dwg_filename');
    const cachedLanguage = sessionStorage.getItem('aura_dwg_language');
    
    if (cachedUrl && cachedFilename) {
      setDownloadUrl(cachedUrl);
      setUploadedFilename(cachedFilename);
      if (cachedLanguage) setSelectedLanguage(cachedLanguage);
      setStep(3);
    }
  }, []);

  useEffect(() => {
    if (!loading) return;
    let messageIdx = 0;
    const interval = setInterval(() => {
      setLoadingText(loadingMessages[messageIdx % loadingMessages.length]);
      messageIdx++;
    }, 3000);

    return () => clearInterval(interval);
  }, [loading]);

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.name.match(/\.dwg$/i)) {
      showToast('Please upload a valid AutoCAD .dwg file', 'warning');
      return;
    }

    const MAX_SIZE_MB = 100;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast('DWG file exceeds the 100MB premium processing limit', 'error');
      return;
    }

    setUploadedFilename(file.name);
    setLoading(true);
    setLoadingText('Uploading drawing file to server...');

    const formData = new FormData();
    formData.append('dwg_file', file);
    formData.append('targetLanguage', selectedLanguage);

    const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000/api.php'
      : 'api.php';

    try {
      // Direct DWG to PDF translation request
      const res = await fetch(`${baseUrl}?action=translate-dwg`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server processing error');
      }

      const data = await res.json();
      if (data.success && data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        // Cache results in session storage to prevent extra CloudConvert costs on refresh
        sessionStorage.setItem('aura_dwg_download_url', data.downloadUrl);
        sessionStorage.setItem('aura_dwg_filename', file.name);
        sessionStorage.setItem('aura_dwg_language', selectedLanguage);
        setStep(3);
      } else {
        throw new Error('Drawing translation failed.');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Drawing translation failed.', 'error');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    sessionStorage.removeItem('aura_dwg_download_url');
    sessionStorage.removeItem('aura_dwg_filename');
    sessionStorage.removeItem('aura_dwg_language');
    setStep(1);
    setDownloadUrl(null);
    setUploadedFilename('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="dwg-workspace" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* Title Panel */}
      {step === 1 && !loading && (
        <div style={{ maxWidth: '850px', margin: '2.5rem auto 0', padding: '0 1.5rem', textAlign: 'center' }}>
          <span style={{
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.25rem 0.75rem',
            borderRadius: '100px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
          }}>
            AURA CAD TRANSLATION
          </span>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: 800, marginTop: '0.8rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            AutoCAD DWG Translator
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto 2rem', lineHeight: 1.5 }}>
            Upload your AutoCAD `.dwg` file to automatically translate all text annotations and download the completed file.
          </p>
        </div>
      )}

      {/* STEP 1: Upload Panel */}
      {step === 1 && !loading && (
        <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', padding: '0 1.5rem' }}>
          <div className="card">
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Select Target Language
              </h2>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b', fontSize: '0.8rem' }}>▼</div>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Upload AutoCAD Drawing
              </h2>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className="drop-zone"
                style={{
                  border: isDragOver ? '2px dashed #2563eb' : '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? '#eff6ff' : '#ffffff',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".dwg"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                />
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 10px rgba(37, 99, 235, 0.2))' }}>📐</div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: '0 0 0.3rem 0' }}>
                  Drag &amp; drop your <span style={{ color: '#2563eb' }}>.dwg</span> drawing here
                </p>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                  Supports files up to 100MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOADING STATE: Shows during Upload -> Translate -> Compile process */}
      {loading && (
        <div style={{ maxWidth: '450px', width: '100%', margin: '4rem auto 0', padding: '0 1.5rem', textAlign: 'center' }}>
          <div className="card" style={{ padding: '3.5rem 2rem' }}>
            <div style={{ display: 'inline-block', position: 'relative', width: '45px', height: '45px', marginBottom: '1.5rem' }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '4px solid rgba(37, 99, 235, 0.1)',
                borderTopColor: '#2563eb',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            
            <h3 style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Translating &amp; Compiling CAD file...
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>{loadingText}</p>
            
            <p style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, margin: 0, opacity: 0.9 }}>
              ⚠️ Please keep this page open. Translation processing takes about 15-20 seconds.
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: Success & Download Card */}
      {step === 3 && !loading && downloadUrl && (
        <div style={{ maxWidth: '450px', width: '100%', margin: '4rem auto 0', padding: '0 1.5rem', textAlign: 'center' }}>
          <div className="card" style={{
            border: '1px solid #10b981',
            padding: '3rem 2rem',
            boxShadow: '0 12px 30px rgba(16, 185, 129, 0.08)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              margin: '0 auto 1.5rem',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
              color: '#10b981'
            }}>
              ✓
            </div>
            
            <h2 style={{ color: '#0f172a', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em', textTransform: 'none' }}>
              Drawing Translated!
            </h2>
            
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.5 }}>
              Successfully translated annotations in <strong style={{ color: '#0f172a' }}>{uploadedFilename}</strong> into <strong style={{ color: '#0f172a' }}>{selectedLanguage}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '300px', margin: '0 auto' }}>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer'
                }}
              >
                <span>📥</span> Download Translated PDF
              </a>

              <button
                onClick={handleReset}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Translate Another Drawing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
