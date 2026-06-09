import { useState, useRef, useEffect, useCallback } from 'react';
import { showToast } from '../hooks/useToast';

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 100;
const LONG_PROCESSING_THRESHOLD_MS = 20000; // 20 seconds

const STAGES = [
  { id: 'upload',    label: 'Uploading & validating your file' },
  { id: 'analyse',  label: 'Analysing document structure' },
  { id: 'extract',  label: 'Extracting text, fonts & layout data' },
  { id: 'ocr',      label: 'Running OCR pass (scanned pages detected)' },
  { id: 'assemble', label: 'Assembling editable Word document' },
  { id: 'finalise', label: 'Finalising and preparing download' },
];

// Progress % range each stage covers
const STAGE_PROGRESS = [0, 15, 35, 55, 70, 90, 100];

const OCR_LANGUAGES = [
  { value: 'english',    label: 'English' },
  { value: 'german',     label: 'German' },
  { value: 'french',     label: 'French' },
  { value: 'spanish',    label: 'Spanish' },
  { value: 'italian',    label: 'Italian' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian',    label: 'Russian' },
  { value: 'chinese',    label: 'Chinese' },
  { value: 'japanese',   label: 'Japanese' },
  { value: 'korean',     label: 'Korean' },
  { value: 'dutch',      label: 'Dutch' },
  { value: 'swedish',    label: 'Swedish' },
  { value: 'polish',     label: 'Polish' },
  { value: 'turkish',    label: 'Turkish' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getApiUrl(action) {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost');
  const base = isLocal ? 'http://localhost:8000/api.php' : 'api.php';
  return `${base}?action=${action}`;
}

// Encode ArrayBuffer → base64 in chunks to avoid call-stack overflow on large files
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

// Decode base64 → Uint8Array
function base64ToUint8Array(b64) {
  const binaryString = window.atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

// Derive health score from issue count
function getHealthScore(fontMismatches, overflowWarnings) {
  const issues = (fontMismatches?.length ?? 0) + (overflowWarnings?.length ?? 0);
  if (issues === 0) return { label: 'Excellent', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '🟢' };
  if (issues <= 2) return { label: 'Good', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', dot: '🟡' };
  return { label: 'Acceptable', color: '#dc2626', bg: '#fff1f2', border: '#fecaca', dot: '🔴' };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PdfConverterWorkspace({ user, onStartOver }) {
  // UI stages: 'upload' | 'processing' | 'success' | 'error'
  const [stage, setStage] = useState('upload');

  // File state
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [fileSize, setFileSize] = useState(0);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);

  // OCR language
  const [sourceLanguage, setSourceLanguage] = useState('english');

  // Password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Progress state
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showLongWarning, setShowLongWarning] = useState(false);
  const [isOcrActive, setIsOcrActive] = useState(false);

  // Result state
  const [resultBase64, setResultBase64] = useState(null);
  const [resultFilename, setResultFilename] = useState('');
  const [resultSize, setResultSize] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorTitle, setErrorTitle] = useState('Conversion Failed');

  // Quality / watcher report state (new)
  const [documentType, setDocumentType] = useState(null);       // 'digital' | 'scanned'
  const [pageCount, setPageCount] = useState(null);             // number | null
  const [fontMismatches, setFontMismatches] = useState([]);     // string[]
  const [overflowWarnings, setOverflowWarnings] = useState([]); // string[]
  const [dismissedChips, setDismissedChips] = useState(new Set());

  // Refs
  const fileInputRef = useRef(null);
  const longWarningTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const rawBytesRef = useRef(null);
  const pdfJsLoadedRef = useRef(false);

  // ── Load pdfjs for client-side validation ─────────────────────────────
  useEffect(() => {
    if (window.pdfjsLib) {
      pdfJsLoadedRef.current = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfJsLoadedRef.current = true;
    };
    document.body.appendChild(script);
  }, []);

  // ── Prevent accidental navigation while processing ──────────────────
  useEffect(() => {
    if (stage !== 'processing') return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'PDF conversion is in progress. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [stage]);

  // ── Cleanup timers on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(longWarningTimerRef.current);
      clearInterval(progressTimerRef.current);
    };
  }, []);

  // ── File validation ──────────────────────────────────────────────────
  const validateAndSetFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;

    // 1. Extension/type check
    const name = selectedFile.name || '';
    const ext = name.toLowerCase().split('.').pop();
    if (ext !== 'pdf' || selectedFile.type !== 'application/pdf' && !name.endsWith('.pdf')) {
      if (ext !== 'pdf') {
        showError(
          'Unsupported File Type',
          'Only PDF files (.pdf) are supported. Please upload a valid PDF document.'
        );
        return;
      }
    }

    // 2. Size check
    const sizeMb = selectedFile.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      showError(
        'File Too Large',
        `Files larger than ${MAX_FILE_SIZE_MB} MB are not supported. Please compress your PDF or split it into smaller files before uploading.`
      );
      return;
    }

    // 3. Read bytes
    let buffer;
    try {
      buffer = await selectedFile.arrayBuffer();
    } catch {
      showError(
        'File Read Error',
        'Unable to read your file. Please check you have permission to access this file and try again.'
      );
      return;
    }

    // 4. Validate PDF signature (%PDF-)
    const header = new Uint8Array(buffer.slice(0, 5));
    const signature = String.fromCharCode(...header);
    if (!signature.startsWith('%PDF')) {
      showError(
        'Invalid PDF',
        'This file does not appear to be a valid PDF document. Please check the file and try again.'
      );
      return;
    }

    // 5. Detect password protection via pdfjs (async)
    rawBytesRef.current = buffer;
    setFile(selectedFile);
    setFileSize(selectedFile.size);
    setIsPasswordProtected(false);

    if (pdfJsLoadedRef.current && window.pdfjsLib) {
      try {
        await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
        // Loaded fine — not password-protected
      } catch (err) {
        if (err && err.name === 'PasswordException') {
          setIsPasswordProtected(true);
          setPasswordModalOpen(true);
        } else if (err && (err.message || '').toLowerCase().includes('invalid pdf')) {
          showError(
            'Corrupted PDF',
            'This PDF file appears to be corrupted or damaged. Please try a different file or repair the PDF and upload again.'
          );
          rawBytesRef.current = null;
          setFile(null);
          return;
        }
        // Other errors (worker not ready etc.) — continue anyway, let server handle it
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag-and-drop handlers ───────────────────────────────────────────
  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = () => setDragActive(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSetFile(dropped);
  };
  const onFileInputChange = (e) => {
    const chosen = e.target.files?.[0];
    if (chosen) validateAndSetFile(chosen);
    e.target.value = ''; // reset so same file can be reselected
  };

  // ── Remove selected file ─────────────────────────────────────────────
  const removeFile = () => {
    setFile(null);
    setFileSize(0);
    rawBytesRef.current = null;
    setIsPasswordProtected(false);
    setPasswordInput('');
    setPasswordError('');
  };

  // ── Password modal submit ────────────────────────────────────────────
  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Please enter the password.');
      return;
    }
    setPasswordError('');
    // Re-attempt pdfjs load with password
    try {
      const loadTask = window.pdfjsLib.getDocument({
        data: rawBytesRef.current.slice(0),
        password: passwordInput,
      });
      await loadTask.promise;
      setPasswordModalOpen(false);
    } catch (err) {
      if (err && err.name === 'PasswordException') {
        setPasswordError('Incorrect password. Please try again.');
      } else {
        setPasswordError('An error occurred verifying the password. Please try again.');
      }
    }
  };

  // ── Smooth progress animation helper ────────────────────────────────
  const animateProgressTo = (target, durationMs = 800) => {
    const start = Date.now();
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const fraction = Math.min(elapsed / durationMs, 1);
      setProgress(prev => {
        const next = prev + (target - prev) * fraction;
        if (Math.abs(next - target) < 0.5) {
          clearInterval(progressTimerRef.current);
          return target;
        }
        return next;
      });
      if (fraction >= 1) clearInterval(progressTimerRef.current);
    }, 30);
  };

  // ── Main conversion ──────────────────────────────────────────────────
  const handleConvert = async (passwordOverride) => {
    if (!rawBytesRef.current) {
      showToast('Please select a PDF file first.', 'warning');
      return;
    }

    setStage('processing');
    setProgress(0);
    setActiveStageIdx(0);
    setShowLongWarning(false);
    setIsOcrActive(false);

    // Start long-processing warning timer
    longWarningTimerRef.current = setTimeout(() => {
      setShowLongWarning(true);
    }, LONG_PROCESSING_THRESHOLD_MS);

    const advanceStage = (idx) => {
      setActiveStageIdx(idx);
      animateProgressTo(STAGE_PROGRESS[idx], 600);
    };

    try {
      // Stage 0 → Upload
      advanceStage(0);
      animateProgressTo(12, 400);

      const pdfBase64 = arrayBufferToBase64(rawBytesRef.current);

      // Stage 1 → Analyse
      advanceStage(1);
      animateProgressTo(30, 500);

      const payload = {
        originalPdfBase64: pdfBase64,
        filename: (file?.name || 'document').replace(/\.pdf$/i, ''),
        password: passwordOverride || (isPasswordProtected ? passwordInput : undefined),
        sourceLanguage,
      };

      // Stage 2 → Extract
      advanceStage(2);
      animateProgressTo(50, 600);

      // Stage 3 → OCR (will show if server detects scanned pages)
      advanceStage(3);
      animateProgressTo(65, 500);

      // Make the actual API call
      const response = await fetch(getApiUrl('pdf-convert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Stage 4 → Assemble
      advanceStage(4);
      animateProgressTo(85, 600);

      if (!response.ok) {
        let errMsg = `Server error (${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const resData = await response.json();

      if (!resData.success) {
        throw new Error(resData.error || 'Conversion failed. Please try again.');
      }

      if (resData.ocrUsed) {
        setIsOcrActive(true);
      }

      // Store watcher report data
      setDocumentType(resData.documentType ?? null);
      setPageCount(resData.pageCount ?? null);
      setFontMismatches(Array.isArray(resData.fontMismatches) ? resData.fontMismatches : []);
      setOverflowWarnings(Array.isArray(resData.overflowWarnings) ? resData.overflowWarnings : []);
      setDismissedChips(new Set());

      // Stage 5 → Finalise
      advanceStage(5);
      animateProgressTo(100, 400);

      // Decode result
      const docxBytes = base64ToUint8Array(resData.docxBase64);
      setResultBase64(resData.docxBase64);
      setResultFilename(resData.filename || `${(file?.name || 'document').replace(/\.pdf$/i, '')}.docx`);
      setResultSize(docxBytes.byteLength);

      clearTimeout(longWarningTimerRef.current);

      setTimeout(() => {
        setStage('success');
        showToast('Conversion complete! Your Word document is ready.', 'success');
      }, 500);

    } catch (err) {
      clearTimeout(longWarningTimerRef.current);
      console.error('PDF conversion error:', err);
      const msg = err.message || '';

      let title = 'Conversion Failed';
      let friendlyMsg = 'An unexpected error occurred while converting your file. Please try again.';

      if (msg.includes('CREDITS_EXCEEDED') || msg.includes('conversion credits') || msg.includes('402')) {
        title = 'Service Limit Reached';
        friendlyMsg = 'Our conversion service has reached its daily processing limit. Please try again tomorrow, or contact support for assistance.';
      } else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted')) {
        title = 'Password Protected';
        friendlyMsg = 'This PDF is password-protected. Please remove the password protection and try again.';
      } else if (msg.toLowerCase().includes('corrupt') || msg.toLowerCase().includes('invalid pdf')) {
        title = 'Corrupted File';
        friendlyMsg = 'This PDF file appears to be corrupted or damaged. Please try a different file or repair the PDF and upload again.';
      } else if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
        title = 'Request Timed Out';
        friendlyMsg = 'The conversion took too long and timed out. This can happen with very large or complex PDF files. Please try with a smaller file, or contact support.';
      } else if (msg.toLowerCase().includes('server error') && msg.includes('500')) {
        title = 'Server Error';
        friendlyMsg = 'Our conversion server encountered an unexpected error. Please try again in a moment. If the problem persists, contact support.';
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
        title = 'Connection Error';
        friendlyMsg = 'Unable to reach the conversion server. Please check your internet connection and try again.';
      } else if (msg.length > 0 && msg.length < 200) {
        friendlyMsg = msg;
      }

      setErrorTitle(title);
      setErrorMsg(friendlyMsg);
      setStage('error');
    }
  };

  // ── Download result ─────────────────────────────────────────────────
  const handleDownload = () => {
    if (!resultBase64) return;
    const bytes = base64ToUint8Array(resultBase64);
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Download started!', 'success');
    }, 150);
  };

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleReset = () => {
    clearTimeout(longWarningTimerRef.current);
    clearInterval(progressTimerRef.current);
    setStage('upload');
    setFile(null);
    setFileSize(0);
    rawBytesRef.current = null;
    setProgress(0);
    setActiveStageIdx(0);
    setShowLongWarning(false);
    setIsOcrActive(false);
    setResultBase64(null);
    setResultFilename('');
    setResultSize(0);
    setErrorMsg('');
    setErrorTitle('Conversion Failed');
    setIsPasswordProtected(false);
    setPasswordInput('');
    setPasswordError('');
    setPasswordModalOpen(false);
    // Clear quality state
    setDocumentType(null);
    setPageCount(null);
    setFontMismatches([]);
    setOverflowWarnings([]);
    setDismissedChips(new Set());
  };

  // ── showError helper ───────────────────────────────────────────────
  function showError(title, msg) {
    setErrorTitle(title);
    setErrorMsg(msg);
    setStage('error');
  }

  // ── Stage dot status helper ─────────────────────────────────────────
  const getStageStatus = (idx) => {
    if (idx < activeStageIdx) return 'done';
    if (idx === activeStageIdx) return 'active';
    return 'waiting';
  };

  // ── Dismiss a chip ──────────────────────────────────────────────────
  const dismissChip = (key) => {
    setDismissedChips(prev => new Set([...prev, key]));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Password Modal */}
      {passwordModalOpen && (
        <div className="pdf-conv-modal-overlay" onClick={(e) => e.target === e.currentTarget && setPasswordModalOpen(false)}>
          <div className="pdf-conv-modal">
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
            <div className="pdf-conv-modal-title">Password Required</div>
            <div className="pdf-conv-modal-sub">
              This PDF is password-protected. Enter the password to unlock it before converting.
            </div>
            <input
              id="pdf-password-input"
              type="password"
              className="pdf-conv-modal-input"
              placeholder="Enter PDF password..."
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              autoFocus
            />
            {passwordError && (
              <div style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: '0.75rem', fontWeight: 600 }}>
                ⚠ {passwordError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                id="pdf-password-cancel"
                className="pdf-conv-restart-btn"
                style={{ width: 'auto', flex: 1 }}
                onClick={() => { setPasswordModalOpen(false); removeFile(); }}
              >
                Cancel
              </button>
              <button
                id="pdf-password-confirm"
                className="pdf-conv-convert-btn"
                style={{ width: 'auto', flex: 2, margin: 0 }}
                onClick={handlePasswordSubmit}
              >
                Unlock PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pdf-converter-workspace">

        {/* ── Hero Header ─────────────────────────────────────────────── */}
        <div className="pdf-converter-hero">
          <div className="pdf-converter-hero-badge">
            ✦ PDF to Word Converter
          </div>
          <h1>Convert Any PDF to Editable Word</h1>
          <p>
            Upload any PDF — text, scanned, image-only, tables, forms, or multi-column layouts —
            and receive a fully editable <strong>.docx</strong> file with formatting faithfully preserved.
          </p>
        </div>

        {/* ══════════════════ UPLOAD STAGE ══════════════════ */}
        {stage === 'upload' && (
          <div className="card" style={{ borderRadius: '20px', padding: '1.75rem' }}>

            {/* Drop zone or file info */}
            {!file ? (
              <div
                id="pdf-conv-drop-zone"
                className={`pdf-conv-drop-zone${dragActive ? ' drag-active' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                aria-label="Upload PDF file"
              >
                <input
                  ref={fileInputRef}
                  id="pdf-file-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={onFileInputChange}
                />
                <div className="pdf-conv-drop-icon">📄</div>
                <div className="pdf-conv-drop-title">
                  Drag &amp; drop your PDF here
                </div>
                <div className="pdf-conv-drop-sub">
                  or click to browse — up to {MAX_FILE_SIZE_MB} MB
                </div>
                <button
                  id="pdf-conv-browse-btn"
                  className="pdf-conv-browse-btn"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  type="button"
                >
                  <span>📂</span> Browse Files
                </button>
              </div>
            ) : (
              <div className="pdf-conv-file-info">
                <div className="pdf-conv-file-icon">📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pdf-conv-file-name">{file.name}</div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span className="pdf-conv-file-size">{formatBytes(fileSize)}</span>
                    {isPasswordProtected && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '100px', padding: '0.15rem 0.55rem' }}>
                        🔒 Password Protected
                      </span>
                    )}
                  </div>
                </div>
                <button
                  id="pdf-conv-remove-file"
                  className="pdf-conv-file-remove"
                  onClick={removeFile}
                  title="Remove file"
                  type="button"
                >
                  ✕
                </button>
              </div>
            )}

            {/* OCR Language selector — shown once a file is selected */}
            {file && (
              <div className="pdf-conv-lang-row">
                <label htmlFor="pdf-conv-lang-select" className="pdf-conv-lang-label">
                  🌐 Document Language
                  <span className="pdf-conv-lang-hint">(used for OCR on scanned pages)</span>
                </label>
                <select
                  id="pdf-conv-lang-select"
                  className="pdf-conv-lang-select"
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                >
                  {OCR_LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Feature badges */}
            <div className="pdf-conv-feature-badges">
              {[
                '✓ Text-based PDFs',
                '✓ Scanned / image PDFs (OCR)',
                '✓ Tables & forms',
                '✓ Multi-column layouts',
                '✓ Headers & footers',
                '✓ Embedded images',
              ].map(badge => (
                <span key={badge} className="pdf-conv-badge">{badge}</span>
              ))}
            </div>

            {/* Convert button */}
            {file && (
              <button
                id="pdf-conv-start-btn"
                className="pdf-conv-convert-btn"
                onClick={() => handleConvert()}
                disabled={isPasswordProtected && !passwordInput}
                type="button"
              >
                <span>⚡</span>
                Convert to Word (.docx)
              </button>
            )}

            {file && isPasswordProtected && !passwordInput && (
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#d97706', marginTop: '0.5rem', fontWeight: 600 }}>
                ⚠ Please enter the PDF password to proceed.{' '}
                <button
                  id="pdf-conv-enter-pwd-link"
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#d97706', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit', fontFamily: 'inherit' }}
                  onClick={() => setPasswordModalOpen(true)}
                >
                  Enter password
                </button>
              </p>
            )}
          </div>
        )}

        {/* ══════════════════ PROCESSING STAGE ══════════════════ */}
        {stage === 'processing' && (
          <div className="pdf-conv-progress-card">
            <div className="pdf-conv-progress-title">Converting Your PDF…</div>
            <div className="pdf-conv-progress-sub">
              Please wait while we process{' '}
              <strong>{file?.name || 'your document'}</strong>
            </div>

            {/* Progress bar */}
            <div className="pdf-conv-bar-track">
              <div
                className="pdf-conv-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="pdf-conv-bar-pct">{Math.round(progress)}%</div>

            {/* Stage steps */}
            <div className="pdf-conv-stages">
              {STAGES.map((s, idx) => {
                // Skip OCR stage visually if OCR isn't active and it's not the active stage
                if (s.id === 'ocr' && !isOcrActive && idx > activeStageIdx) return null;
                const status = getStageStatus(idx);
                return (
                  <div key={s.id} className={`pdf-conv-stage ${status}`}>
                    <div className={`pdf-conv-stage-dot ${status}`}>
                      {status === 'done' ? '✓' : idx + 1}
                    </div>
                    <span className="pdf-conv-stage-label">
                      {s.id === 'ocr' && isOcrActive
                        ? 'Running OCR — scanned pages detected (this may take a moment)'
                        : s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Long-processing warning banner */}
            {showLongWarning && (
              <div className="pdf-conv-warning-banner" role="alert" aria-live="polite">
                <div className="pdf-conv-warning-icon">⏳</div>
                <div className="pdf-conv-warning-text">
                  Your file is being processed. <strong>Please do not close or refresh this page</strong> — your progress will be lost and you will need to start over.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ SUCCESS STAGE ══════════════════ */}
        {stage === 'success' && (() => {
          const health = getHealthScore(fontMismatches, overflowWarnings);
          const isScannedDoc = documentType === 'scanned';
          const activeChips = [
            ...fontMismatches.map((m, i) => ({ key: `fm-${i}`, text: m, type: 'font' })),
            ...overflowWarnings.map((w, i) => ({ key: `ow-${i}`, text: w, type: 'overflow' })),
          ].filter(c => !dismissedChips.has(c.key));

          return (
            <div className="pdf-conv-success-card">
              <div className="pdf-conv-success-icon">✓</div>
              <div className="pdf-conv-success-title">Conversion Complete!</div>
              <div className="pdf-conv-success-sub">
                Your PDF has been successfully converted to a fully editable Word document
                with formatting faithfully preserved.
              </div>

              {/* File meta pill */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div className="pdf-conv-success-meta">
                  ✓ &nbsp;{resultFilename}&nbsp; · &nbsp;{formatBytes(resultSize)}
                </div>
              </div>

              {/* ── Conversion Quality Panel ── */}
              <div className="pdf-conv-quality-panel">
                <div className="pdf-conv-quality-header">
                  <span className="pdf-conv-quality-title">Conversion Quality Report</span>
                  <span
                    className="pdf-conv-health-score"
                    style={{ color: health.color, background: health.bg, borderColor: health.border }}
                  >
                    {health.dot} {health.label}
                  </span>
                </div>

                {/* Document type badge + page count */}
                <div className="pdf-conv-quality-badges">
                  {/* Document type */}
                  <span className={`pdf-conv-doc-badge ${isScannedDoc ? 'scanned' : 'digital'}`}>
                    {isScannedDoc ? '🖨 Scanned PDF — OCR Applied' : '📄 Native Digital PDF'}
                  </span>

                  {/* Page count */}
                  {pageCount != null && (
                    <span className="pdf-conv-doc-badge digital" style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}>
                      📋 {pageCount} {pageCount === 1 ? 'page' : 'pages'} verified
                    </span>
                  )}
                </div>

                {/* Alert chips */}
                {activeChips.length > 0 && (
                  <div className="pdf-conv-chips-area">
                    {activeChips.map(chip => (
                      <div key={chip.key} className="pdf-conv-health-chip">
                        <span className="pdf-conv-chip-icon">
                          {chip.type === 'font' ? '⚠' : '⚠'}
                        </span>
                        <span className="pdf-conv-chip-text">{chip.text}</span>
                        <button
                          className="pdf-conv-chip-dismiss"
                          onClick={() => dismissChip(chip.key)}
                          title="Dismiss"
                          type="button"
                          aria-label="Dismiss alert"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* All-clear message */}
                {activeChips.length === 0 && (
                  <div className="pdf-conv-quality-allclear">
                    <span style={{ color: '#059669' }}>✓</span> No formatting issues detected. Your document is ready.
                  </div>
                )}
              </div>

              {/* Download & reset */}
              <div style={{ maxWidth: '380px', margin: '0 auto' }}>
                <button
                  id="pdf-conv-download-btn"
                  className="pdf-conv-download-btn"
                  onClick={handleDownload}
                  type="button"
                >
                  ⬇ Download {resultFilename}
                </button>
                <button
                  id="pdf-conv-another-btn"
                  className="pdf-conv-restart-btn"
                  onClick={handleReset}
                  type="button"
                >
                  ↩ Convert Another File
                </button>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════ ERROR STAGE ══════════════════ */}
        {stage === 'error' && (
          <div className="pdf-conv-error-card">
            <div className="pdf-conv-error-icon">✕</div>
            <div className="pdf-conv-error-title">{errorTitle}</div>
            <div className="pdf-conv-error-msg">{errorMsg}</div>

            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                id="pdf-conv-retry-btn"
                className="pdf-conv-convert-btn"
                style={{ margin: 0 }}
                onClick={handleReset}
                type="button"
              >
                ↩ Try Again
              </button>
              {onStartOver && (
                <button
                  id="pdf-conv-back-btn"
                  className="pdf-conv-restart-btn"
                  onClick={onStartOver}
                  type="button"
                >
                  ← Back to Dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
