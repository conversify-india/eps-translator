import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { showToast } from '../hooks/useToast';

// Helper to reliably extract SVG viewbox or width/height coordinate system
export function getSvgDimensions(svgEl) {
  const viewBox = svgEl.getAttribute('viewBox');
  let x = 0, y = 0, width = 800, height = 1100;
  
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(num => !isNaN(num))) {
      return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
        hasViewBox: true
      };
    }
  }
  
  const wAttr = svgEl.getAttribute('width');
  const hAttr = svgEl.getAttribute('height');
  
  if (wAttr) {
    const parsedW = parseFloat(wAttr);
    if (!isNaN(parsedW) && !wAttr.includes('%')) {
      width = parsedW;
    }
  }
  
  if (hAttr) {
    const parsedH = parseFloat(hAttr);
    if (!isNaN(parsedH) && !hAttr.includes('%')) {
      height = parsedH;
    }
  }
  
  return { x, y, width, height, hasViewBox: false };
}

export default function Diagnosis({
  filename,
  uniqueSourceTexts,
  labels = [],
  onAiTranslationSuccess,
  onManualTranslateClick,
  hasVectorOutlines,
  user,
  svgText,
  sourceLang,
  setSourceLang,
  targetLang,
  setTargetLang,
  onOcrTranslationSuccess
}) {
  const [translating, setTranslating] = useState(false);
  const [ocrTranslating, setOcrTranslating] = useState(false);

  const convertSvgToJpeg = () => {
    return new Promise((resolve, reject) => {
      try {
        if (!svgText) {
          reject(new Error('No SVG text content to process.'));
          return;
        }

        // Parse SVG to manipulate elements
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const NS = 'http://www.w3.org/2000/svg';

        // Find remote images and redirect them through our proxy to prevent CORS canvas tainting
        const images = doc.getElementsByTagNameNS(NS, 'image');
        for (let i = 0; i < images.length; i++) {
          const href = images[i].getAttribute('href') || images[i].getAttribute('xlink:href');
          if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
            const proxyUrl = apiService.getProxyImageUrl(href);
            images[i].setAttribute('href', proxyUrl);
            images[i].removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
          }
        }

        // Serialise modified SVG back to string
        const serializer = new XMLSerializer();
        const modifiedSvgText = serializer.serializeToString(doc);

        // Convert SVG string to base64 Data URL
        const svgBlob = new Blob([modifiedSvgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.crossOrigin = 'anonymous'; // request CORS access
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const svgEl = doc.documentElement;
            
            // Align canvas size exactly with true SVG viewBox/dimensions
            const dims = getSvgDimensions(svgEl);
            canvas.width = dims.width || 800;
            canvas.height = dims.height || 1100;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; // draw background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const base64Image = canvas.toDataURL('image/jpeg', 0.85);
            URL.revokeObjectURL(url);
            resolve(base64Image);
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(new Error('Canvas drawing failed: ' + e.message));
          }
        };

        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG into Image object: ' + err.message));
        };

        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleOcrTranslate = async () => {
    setOcrTranslating(true);
    showToast('Converting document layers to OCR snapshot...', 'info');

    try {
      // 1. Generate JPEG image of SVG
      const base64Image = await convertSvgToJpeg();

      showToast('Running Gemini Vision OCR Translation...', 'info');
      
      // 2. Call backend OCR API
      const selectedLanguage = targetLang.split('|')[0];
      const ocrResults = await apiService.ocrTranslate(base64Image, sourceLang, selectedLanguage);

      if (!ocrResults || ocrResults.length === 0) {
        showToast('No translatable text recognized by Gemini OCR.', 'warning');
        return;
      }

      showToast(`OCR detected and translated ${ocrResults.length} text segments!`, 'success');
      
      // 3. Callback to parent App component
      onOcrTranslationSuccess(ocrResults);
    } catch (err) {
      console.error('OCR translation failed:', err);
      showToast('OCR Translation failed: ' + err.message, 'error');
    } finally {
      setOcrTranslating(false);
    }
  };

  // Proposal states
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [proposalMessage, setProposalMessage] = useState('');

  useEffect(() => {
    if (user) {
      setCustomerName(user.name || '');
      setCustomerEmail(user.email || '');
    }
  }, [user]);

  const getFirstName = () => {
    return filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
  };

  const handleAiTranslate = async () => {
    if (uniqueSourceTexts.length === 0) {
      showToast('No text segments found to translate.', 'warning');
      return;
    }

    setTranslating(true);
    const selectedLanguage = targetLang.split('|')[0];

    try {
      // Call secure backend proxy to translate texts via Gemini, passing source language
      const translationsMap = await apiService.translateText(uniqueSourceTexts, selectedLanguage, sourceLang);
      
      // Pass the translations map back to the App parent component
      onAiTranslationSuccess(translationsMap);
      showToast('Translation completed successfully!', 'success');
    } catch (err) {
      console.error('AI translation failed:', err);
      showToast('AI Translation failed: ' + err.message, 'error');
    } finally {
      setTranslating(false);
    }
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendProposal = async () => {
    if (!customerName.trim()) {
      showToast('Please enter your name.', 'warning');
      return;
    }
    if (!customerEmail.trim() || !validateEmail(customerEmail)) {
      showToast('Please enter a valid email address.', 'warning');
      return;
    }

    setSendingProposal(true);
    const selectedLanguage = targetLang.split('|')[0];

    try {
      await apiService.sendProposalEmail({
        name: customerName.trim(),
        email: customerEmail.trim(),
        filename,
        targetLanguage: selectedLanguage,
        sourceLanguage: sourceLang,
        svgText,
        message: proposalMessage.trim()
      });

      setProposalSent(true);
      setProposalMessage('');
      showToast('Email sent with your work requested', 'success');
    } catch (err) {
      console.error('Failed to send proposal:', err);
      showToast('Failed to send proposal request: ' + err.message, 'error');
    } finally {
      setSendingProposal(false);
    }
  };

  const getFileSize = () => {
    if (!svgText) return '0 KB';
    const bytes = svgText.length;
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const handleDownloadTextList = () => {
    if (labels.length === 0) return;
    const fileContent = labels.map(l => l.source).join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing'}_text_list.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    showToast('Text list downloaded successfully!', 'success');
  };

  const convertSvgToPngBytes = () => {
    return new Promise((resolve, reject) => {
      try {
        if (!svgText) {
          reject(new Error('No SVG text content to process.'));
          return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const NS = 'http://www.w3.org/2000/svg';

        const images = doc.getElementsByTagNameNS(NS, 'image');
        for (let i = 0; i < images.length; i++) {
          const href = images[i].getAttribute('href') || images[i].getAttribute('xlink:href');
          if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
            const proxyUrl = apiService.getProxyImageUrl(href);
            images[i].setAttribute('href', proxyUrl);
            images[i].removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
          }
        }

        const serializer = new XMLSerializer();
        const modifiedSvgText = serializer.serializeToString(doc);
        const svgBlob = new Blob([modifiedSvgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const svgEl = doc.documentElement;
            const dims = getSvgDimensions(svgEl);
            
            const svgWidth = dims.width || 800;
            const svgHeight = dims.height || 1100;

            const canvasWidth = 2480;
            const canvasHeight = Math.round(canvasWidth * (svgHeight / svgWidth));

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const b64Data = canvas.toDataURL('image/png').split(',')[1];
            const binaryString = window.atob(b64Data);
            const len = binaryString.length;
            const pngBytes = new Uint8Array(len);
            for (let k = 0; k < len; k++) {
              pngBytes[k] = binaryString.charCodeAt(k);
            }

            URL.revokeObjectURL(url);
            resolve({ pngBytes, svgWidth, svgHeight });
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG into image: ' + err.message));
        };
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleDownloadWordDoc = async () => {
    if (labels.length === 0) return;
    try {
      showToast('Preparing Word document...', 'info');
      
      // Load docx library if not loaded
      if (!window.docx) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const { Document, Paragraph, ImageRun, Packer } = window.docx;
      
      const { pngBytes, svgWidth, svgHeight } = await convertSvgToPngBytes();

      const a4WidthTwips = 11906;
      const a4HeightTwips = 16838;
      const marginTwips = 720;
      const usableWidthTwips = a4WidthTwips - 2 * marginTwips;
      const usableHeightTwips = a4HeightTwips - 2 * marginTwips;

      const usableWidthEmu = usableWidthTwips * 635;
      const usableHeightEmu = usableHeightTwips * 635;

      const aspectRatio = svgHeight / svgWidth;
      let imgWidthEmu = usableWidthEmu;
      let imgHeightEmu = Math.round(imgWidthEmu * aspectRatio);

      if (imgHeightEmu > usableHeightEmu) {
        imgHeightEmu = usableHeightEmu;
        imgWidthEmu = Math.round(imgHeightEmu / aspectRatio);
      }

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: a4WidthTwips, height: a4HeightTwips },
              margin: { top: marginTwips, bottom: marginTwips, left: marginTwips, right: marginTwips }
            }
          },
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: pngBytes,
                  transformation: {
                    width: imgWidthEmu / 9525,
                    height: imgHeightEmu / 9525
                  }
                })
              ]
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanStem = filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
      a.download = `${cleanStem}_translated.docx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      showToast('Word document downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('DOCX export failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="card" id="section-extract" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        .proposal-form-container {
          background: rgba(124, 58, 237, 0.015) !important;
          border: 1px dashed rgba(124, 58, 237, 0.3) !important;
          border-radius: 12px !important;
          padding: 1.5rem !important;
          width: 100%;
          box-sizing: border-box;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .proposal-input {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 8px !important;
          color: #334155 !important;
          padding: 0.65rem 0.85rem !important;
          font-size: 0.82rem !important;
          font-weight: 500 !important;
          outline: none !important;
          width: 100%;
          box-sizing: border-box;
          transition: all 0.2s ease !important;
          margin-top: 0.35rem !important;
        }
        .proposal-input:focus {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12) !important;
        }
        .proposal-input::placeholder {
          color: #94a3b8 !important;
        }
        .proposal-label {
          font-size: 0.68rem !important;
          color: #475569 !important;
          font-weight: 800 !important;
          letter-spacing: 0.05em !important;
          text-transform: uppercase !important;
          display: block;
        }
        .attachment-box {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          padding: 0.75rem 1rem !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.02) !important;
          transition: border-color 0.2s ease !important;
        }
        .attachment-box:hover {
          border-color: #cbd5e1 !important;
        }
      `}</style>
      <h2>Step 2 — Diagnosis</h2>
      <div id="diagnosisResult">
        <div id="diagBadge" className="diag-badge" style={{
          display: 'inline-block',
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.25rem 0.6rem',
          borderRadius: '100px',
          marginBottom: '0.75rem',
          background: hasVectorOutlines ? '#2e220f' : '#0d1f1a',
          color: hasVectorOutlines ? '#fbbf24' : '#34d399'
        }}>
          {hasVectorOutlines ? '⚠️ VECTOR OUTLINES (SHADOWED)' : 'EDITABLE VECTOR'}
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

        {hasVectorOutlines && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.78rem',
            color: '#fbbf24',
            lineHeight: 1.45
          }}>
            <strong>⚠️ Vector outlines detected in drawing:</strong> The text in this drawing has been converted into curves (paths) with invisible searchable text nodes on top. To ensure your translations render correctly, the editor will automatically activate the <strong>Force Vector Text Visible</strong> override and recommend <strong>White Halo Masking</strong> to cover original English outlines.
          </div>
        )}

        {/* Stats Grid */}
        <div className="diag-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.25rem'
        }}>
          <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed' }}>
              {labels.length}
            </div>
            <div className="lbl" style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.2rem' }}>
              total strings found
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

        {labels.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <button 
              className="btn btn-ghost" 
              onClick={handleDownloadWordDoc}
              style={{
                fontSize: '0.75rem',
                padding: '0.45rem 1.25rem',
                borderColor: '#cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                margin: 0
              }}
            >
              📄 Download Word Document (.docx)
            </button>
          </div>
        )}

        {labels.length === 0 && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#f87171',
            lineHeight: 1.55,
            textAlign: 'left',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            <h4 style={{ fontSize: '0.9rem', color: '#f87171', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              ⚠️ No Text Elements Detected
            </h4>
            <p style={{ margin: '0 0 0.75rem 0' }}>
              We scanned the document but found <strong>0 text strings</strong>. This typically happens for one of the following reasons:
            </p>
            <ul style={{ paddingLeft: '1.25rem', margin: '0 0 1rem 0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li><strong>Scanned Document:</strong> The file is a scan, photograph, or screenshot of text. The computer sees it as a flat picture, not editable letters.</li>
              <li><strong>Text-to-Curves / Outlines:</strong> The text was converted into vector outlines (lines and curves) during export to preserve font styling, which deletes the actual characters.</li>
            </ul>
            <h5 style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
              Recommended Next Steps:
            </h5>
            <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li><strong>Re-export the file:</strong> If exporting from AutoCAD, MS Word, or Illustrator, choose settings like <em>"Embed Fonts"</em> or <em>"Save Text as Text"</em> rather than converting text to shapes.</li>
              <li><strong>Use Option B below:</strong> Click "Contact Our Team &amp; Get Quote" to have our professional translators manually recreate and translate the document layout for you.</li>
            </ol>
          </div>
        )}

        {labels.length > 0 ? (
          <p id="diagAction" style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            All texts inside the vector file are editable. Select one of the translation methods below to translate the blueprint:
          </p>
        ) : (
          <p id="diagAction" style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            No editable text detected. Select Option B below to contact our professional translation team:
          </p>
        )}

        {/* Option A: Direct AI Translation (Instant) */}
        {labels.length > 0 ? (
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
              
              {/* Language Selectors */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Source Language Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
        ) : (
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
                <h3 style={{ fontSize: '0.88rem', color: '#a78bfa', fontWeight: 700, marginBottom: '0.25rem', textAlign: 'left' }}>
                  Option A: Scanned Document OCR Translation ⚡
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0, lineHeight: 1.4, textAlign: 'left' }}>
                  Use Gemini Vision OCR to scan the drawing layout, recognize original words, and translate them dynamically.
                </p>
              </div>
              
              {/* Language Selectors */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Source Language Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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

            <button 
              className="btn btn-primary" 
              onClick={handleOcrTranslate}
              disabled={ocrTranslating}
              style={{ 
                margin: 0, 
                padding: '0.65rem 1.5rem', 
                width: '100%', 
                cursor: ocrTranslating ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              }}
            >
              {ocrTranslating ? (
                <>
                  <span className="spinner" style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'epsSpin 1s linear infinite'
                  }}></span>
                  Running OCR Visual Translation...
                </>
              ) : 'Translate Scanned Document with OCR ⚡'}
            </button>
          </div>
        )}

        {/* Option B: Contact Our Team (Professional Service) */}
        {proposalSent ? (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '1.75rem',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#d1fae5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              margin: '0 auto 1rem auto',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
            }}>
              ✓
            </div>
            <h3 style={{ fontSize: '1.05rem', color: '#065f46', fontWeight: 800, marginBottom: '0.5rem' }}>
              Proposal Request Sent Successfully!
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#374151', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: 1.55 }}>
              Your original file <strong>{filename}</strong> ({getFileSize()}) has been attached and sent. We've received your request and our team will get in touch with you at <strong>{customerEmail}</strong> shortly.
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => window.open('https://lingochaps.com/contact/', '_blank')}
              style={{
                margin: 0,
                padding: '0.55rem 1.25rem',
                fontSize: '0.8rem',
                borderColor: '#cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Contact Us
            </button>
          </div>
        ) : showProposalForm ? (
          <div className="proposal-form-container">
            <h3 style={{ fontSize: '0.95rem', color: '#6d28d9', fontWeight: 800, marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              ✉️ Request Professional Translation Proposal
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.45 }}>
              Our professional translators will review your blueprint and prepare a certified proposal. The uploaded file is attached below.
            </p>

            {/* Attachment Showcase */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="proposal-label">Attached Document</span>
              <div className="attachment-box" style={{ marginTop: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="#7c3aed" style={{ width: '20px', height: '20px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b', wordBreak: 'break-all' }}>
                      {filename}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                      SVG Vector Layer • {getFileSize()}
                    </div>
                  </div>
                </div>
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  borderRadius: '100px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '10px' }}>●</span> Attached
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="proposal-label">Your Name</label>
                <input 
                  type="text" 
                  className="proposal-input"
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="proposal-label">Email Address</label>
                <input 
                  type="email" 
                  className="proposal-input"
                  value={customerEmail} 
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. john@company.com"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span className="proposal-label">Source Language</span>
                <div style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  marginTop: '0.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  🌐 {sourceLang}
                </div>
              </div>
              <div>
                <span className="proposal-label">Target Language</span>
                <div style={{
                  background: '#f3e8ff',
                  color: '#7c3aed',
                  border: '1px solid #e9d5ff',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  marginTop: '0.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  🌐 {targetLang.split('|')[0]}
                </div>
              </div>
              <div>
                <span className="proposal-label">Total Text Segments</span>
                <div style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  marginTop: '0.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  📊 {labels.length} segments
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1.5rem' }}>
              <label className="proposal-label">Special Instructions or Notes (Optional)</label>
              <textarea 
                value={proposalMessage} 
                onChange={(e) => setProposalMessage(e.target.value)}
                placeholder="Describe any custom requirements (e.g. layout adjustments, certifications needed, specific terminology constraints...)"
                rows={3}
                className="proposal-input"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setShowProposalForm(false)}
                disabled={sendingProposal}
                style={{ margin: 0, padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSendProposal}
                disabled={sendingProposal || !customerName.trim() || !customerEmail.trim()}
                style={{ 
                  margin: 0, 
                  padding: '0.55rem 1.5rem', 
                  borderRadius: '8px', 
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: (sendingProposal || !customerName.trim() || !customerEmail.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {sendingProposal ? (
                  <>
                    <span className="spinner" style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'epsSpin 1s linear infinite'
                    }}></span>
                    Sending Request...
                  </>
                ) : 'Send Proposal Request ✉️'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1.25rem',
              width: '100%',
              boxSizing: 'border-box'
            }}
            className="diagnosis-option-card"
          >
            <div style={{ flex: 1, minWidth: '250px' }}>
              <h3 style={{ fontSize: '0.92rem', color: '#1e293b', fontWeight: 800, marginBottom: '0.35rem' }}>
                Option B: Professional Translation Service ✉️
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Need technical certification, dynamic layout resizing, or help with highly complex blueprint details? Contact our professional team.
              </p>
            </div>
            <button 
              className="btn btn-ghost" 
              onClick={() => setShowProposalForm(true)}
              style={{ 
                margin: 0, 
                padding: '0.65rem 1.5rem', 
                borderColor: '#cbd5e1', 
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              Contact Our Team &amp; Get Quote
            </button>
          </div>
        )}

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
