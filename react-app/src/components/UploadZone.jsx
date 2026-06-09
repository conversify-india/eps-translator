import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import { showToast } from '../hooks/useToast';

export default function UploadZone({ user, onConversionSuccess, sourceLang, setSourceLang, targetLang, setTargetLang, allowedFormat = 'vector' }) {
  const isPdfOnly = allowedFormat === 'pdf';
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Optimising your file...');
  const [loadingSubtext, setLoadingSubtext] = useState('This may take a few seconds');
  const [showWarning, setShowWarning] = useState(false);
  const [limitModalType, setLimitModalType] = useState(null); // 'daily' | 'filesize' | 'capacity'
  const fileInputRef = useRef(null);

  const loadingMessages = [
    "Uploading vector blocks...",
    "Processing paths & elements...",
    "Analyzing layers...",
    "Aligning text labels...",
    "Please do not close or reload...",
    "Preparing visual workspace...",
    "Almost ready..."
  ];

  // Rotate loading text sub-messages during conversion
  useEffect(() => {
    if (!loading) return;
    let messageIdx = 0;
    const interval = setInterval(() => {
      setLoadingSubtext(loadingMessages[messageIdx % loadingMessages.length]);
      messageIdx++;
      // Show warning after 6 seconds of processing
      if (messageIdx >= 3) {
        setShowWarning(true);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [loading]);

  const getUserConversionKey = () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const userEmail = user?.email || 'guest';
    return 'aura_conv_' + userEmail + '_' + today;
  };

  const hasUsedConversionToday = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) {
      return false;
    }
    return localStorage.getItem(getUserConversionKey()) === 'used';
  };

  const markConversionUsedToday = () => {
    localStorage.setItem(getUserConversionKey(), 'used');
  };

  const handleFile = async (file) => {
    if (!file) return;

    if (isPdfOnly) {
      if (!file.name.match(/\.pdf$/i)) {
        showToast('Please upload a .pdf file', 'warning');
        return;
      }
    } else {
      if (!file.name.match(/\.(eps|svg)$/i)) {
        showToast('Please upload a .svg or .eps file', 'warning');
        return;
      }
    }

    if (file.name.match(/\.(eps|pdf)$/i)) {
      // 1. File Size Check (50MB)
      const MAX_SIZE_MB = 50;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setLimitModalType('filesize');
        return;
      }

      // 2. Daily Limit Check
      if (hasUsedConversionToday()) {
        setLimitModalType('daily');
        return;
      }

      // 3. Start CloudConvert Job (EPS/PDF -> SVG)
      const isPdf = file.name.match(/\.pdf$/i);
      setLoading(true);
      setLoadingText('Uploading your file...');
      setLoadingSubtext('Establishing secure connection...');
      setShowWarning(false);

      try {
        const job = await apiService.createJob({
          'import-file': { operation: 'import/upload' },
          'convert-file': { operation: 'convert', input: 'import-file', input_format: isPdf ? 'pdf' : 'eps', output_format: 'svg' },
          'export-file': { operation: 'export/url', input: 'convert-file' }
        });

        if (!job?.data) throw new Error('Job creation failed.');

        // Step A: Upload the file to S3 storage returned by CloudConvert
        setLoadingText('Uploading your file...');
        const uploadTask = job.data.tasks.find(t => t.name === 'import-file');
        const uploadUrl = uploadTask.result.form.url;
        const uploadParams = uploadTask.result.form.parameters;

        const formData = new FormData();
        Object.entries(uploadParams).forEach(([k, v]) => formData.append(k, v));
        formData.append('file', file);

        await fetch(uploadUrl, { method: 'POST', body: formData });

        // Step B: Poll for completion
        setLoadingText('Processing...');
        const jobId = job.data.id;
        let conversionResult = null;

        for (let i = 0; i < 30; i++) {
          await new Promise(res => setTimeout(res, 2000));
          const statusData = await apiService.checkJobStatus(jobId);
          const status = statusData?.data?.status;

          if (status === 'finished') {
            const exportTask = statusData.data.tasks.find(t => t.operation === 'export/url');
            const files = exportTask.result?.files || [];
            
            if (files.length === 0) {
              throw new Error('No output files returned from conversion');
            }
            
            setLoadingText('Almost done...');
            if (files.length > 1) {
              // Multi-page PDF: fetch all page SVGs in parallel
              const fetchPromises = files.map(async (f) => {
                const res = await fetch(f.url);
                return await res.text();
              });
              conversionResult = await Promise.all(fetchPromises);
            } else {
              // Single page EPS/PDF/SVG
              const res = await fetch(files[0].url);
              conversionResult = await res.text();
            }
            break;
          }
          if (status === 'error') throw new Error('Conversion error on server');
        }

        if (!conversionResult) throw new Error('Conversion timed out');

        setLoading(false);
        markConversionUsedToday();
        onConversionSuccess(conversionResult, file.name);

      } catch (err) {
        setLoading(false);
        console.error("Conversion failed:", err);
        if (err.message && err.message.includes('429')) {
          setLimitModalType('capacity');
        } else {
          showToast('File processing failed: ' + err.message, 'error');
        }
      }
      return;
    }

    // Standard SVG files are read locally (free)
    if (file.name.match(/\.svg$/i)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onConversionSuccess(ev.target.result, file.name);
      };
      reader.readAsText(file);
      return;
    }

    showToast('Please upload a valid file', 'warning');
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="card" id="section-upload">
      <h2>Step 1 — Upload File</h2>
      
      {/* Language Selectors */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid #2d3748',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{ flex: 1, minWidth: '200px', textAlign: 'left' }}>
          <h3 style={{ fontSize: '0.88rem', color: '#a78bfa', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Translation Direction
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
            Select the language of your drawing and the target language before uploading.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Source Language Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 800, letterSpacing: '0.05em' }}>SOURCE LANGUAGE</span>
            <select 
              id="sourceLang" 
              className="lang-select" 
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              style={{
                background: '#0f1117',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                color: '#e8e8f0',
                padding: '0.5rem 0.7rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                height: '38px',
                minWidth: '130px'
              }}
            >
              <option value="English">English</option>
              <option value="German">German</option>
              <option value="French">French</option>
              <option value="Spanish">Spanish</option>
              <option value="Italian">Italian</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Dutch">Dutch</option>
              <option value="Russian">Russian</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Arabic">Arabic</option>
              <option value="Hindi">Hindi</option>
              <option value="Turkish">Turkish</option>
              <option value="Polish">Polish</option>
              <option value="Swedish">Swedish</option>
              <option value="Greek">Greek</option>
              <option value="Romanian">Romanian</option>
            </select>
          </div>

          {/* Target Language Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 800, letterSpacing: '0.05em' }}>TARGET LANGUAGE</span>
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
                height: '38px',
                minWidth: '130px'
              }}
            >
              <option value="English|0">English</option>
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
              <option value="Greek|25">Greek</option>
              <option value="Romanian|25">Romanian</option>
            </select>
          </div>
        </div>
      </div>

      <div
        className={`drop-zone ${isDragOver ? 'dragover' : ''}`}
        id="dropZone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={triggerFileInput}
        style={{
          border: isDragOver ? '2px dashed #7c3aed' : '2px dashed #2d3748',
          borderRadius: '10px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragOver ? '#f5f3ff' : '#161820',
          transition: 'all 0.2s',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}
      >
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept={isPdfOnly ? ".pdf" : ".svg,.eps"}
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
        <div className="drop-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📂</div>
        <p style={{ fontSize: '0.88rem', color: '#9ca3af' }}>
          {isPdfOnly ? (
            <>Drag &amp; drop your <span style={{ color: '#60a5fa', fontWeight: 600 }}>.pdf</span> file here</>
          ) : (
            <>Drag &amp; drop your <span style={{ color: '#a78bfa', fontWeight: 600 }}>.eps</span> or <span style={{ color: '#34d399', fontWeight: 600 }}>.svg</span> file here</>
          )}
        </p>
      </div>

      {/* Loading Overlay spinner */}
      {loading && (
        <div
          id="epsLoadingOverlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 24, 32, 0.95)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          <svg
            style={{ width: '40px', height: '40px', animation: 'epsSpin 1s linear infinite', marginBottom: '1rem', color: '#a78bfa' }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{ opacity: 0.75 }}></path>
          </svg>
          <p id="epsLoadingText" style={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
            {loadingText}
          </p>
          <p id="epsLoadingSubtext" style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: '0.3rem' }}>
            {loadingSubtext}
          </p>
          {showWarning && (
            <p id="epsLoadingWarning" style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '0.6rem', maxWidth: '260px', textAlign: 'center', lineHeight: 1.4, fontWeight: 500 }}>
              ⚠️ Please do not refresh. Refreshing will consume another conversion credit.
            </p>
          )}
        </div>
      )}

      {/* Render local limit models */}
      {limitModalType && (
        <div className="limit-modal-backdrop" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 5, 13, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', background: '#161820', border: '1px solid #1f2937', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              {limitModalType === 'filesize' ? '📁' : limitModalType === 'daily' ? '⏳' : '⚡'}
            </div>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '0.75rem', textTransform: 'none', letterSpacing: 'normal' }}>
              {limitModalType === 'filesize' ? 'File Size Exceeded' : limitModalType === 'daily' ? 'Daily Free Limit Reached' : 'API Capacity Reached'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {limitModalType === 'filesize' 
                ? 'Your file exceeds the 50MB conversion limit. Please compress your vector file and try again.'
                : limitModalType === 'daily'
                ? `Hello ${user?.name ? user.name.split(' ')[0] : 'there'}, you have reached your free daily allocation (5 drawing processes per day) on this test server.`
                : 'Our conversion API is currently handling high volume. Please wait a few minutes and try again.'
              }
            </p>
            <button className="btn btn-primary" onClick={() => setLimitModalType(null)} style={{ margin: 0, padding: '0.6rem 1.5rem', width: '100%', cursor: 'pointer' }}>
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
