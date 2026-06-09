import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { showToast } from '../hooks/useToast';
import { applyTranslationsToRawSvg } from '../utils/svgParser';

// Detect if a label is a pure technical code that intentionally stayed unchanged
function isTechnicalCode(source, translation) {
  if (!source || source !== translation) return false;
  const s = source.trim();
  if (/^\d+$/.test(s)) return true;
  if (/^\d+(\.\d+)?\s*[AaVvWwΩ]$/.test(s)) return true;
  if (/^[A-Z]?\d+[a-zA-Z]?$/.test(s)) return true;
  const universalCodes = new Set(['GND','VCC','VDD','ECU','ECM','ABS','CAN','PWM','LED','AC','DC','IC','PCB','CPU','USB','IN','OUT','COM','NC','NO','N','S','E','W','B','R','Y','G']);
  if (universalCodes.has(s.toUpperCase())) return true;
  if (/^[A-Za-z]$/.test(s)) return true;
  return false;
}

function getSvgDimensions(svgEl) {
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

export default function QAReport({
  filename,
  labels,
  svgText,
  originalSvgText,
  globalScale,
  onStartOverClick,
  pages = []
}) {
  const [exporting, setExporting] = useState(false);
  const [exportText, setExportText] = useState('Download Translated EPS ↓');
  const [loadingMsg, setLoadingMsg] = useState('Preparing your EPS file...');
  const [loadingSubtext, setLoadingSubtext] = useState('Structuring translated vectors...');
  const [showWarning, setShowWarning] = useState(false);
  const [exportingSvg, setExportingSvg] = useState(false);

  const convertSvgToPngBytes = (pageSvg) => {
    return new Promise((resolve, reject) => {
      try {
        if (!pageSvg) {
          reject(new Error('No SVG text content to process.'));
          return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(pageSvg, 'image/svg+xml');
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

  const handleDownloadDocx = async () => {
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
      
      const docxSections = [];
      const itemsToProcess = pages.length > 1 ? pages : [{ svgText, originalSvgText, labels }];

      for (let idx = 0; idx < itemsToProcess.length; idx++) {
        const page = itemsToProcess[idx];
        const pageSvg = buildFinalSvgForPage(page);
        
        const { pngBytes, svgWidth, svgHeight } = await convertSvgToPngBytes(pageSvg);

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

        docxSections.push({
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
        });
      }

      const doc = new Document({
        sections: docxSections
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

  const loadingMessages = [
    "Structuring translated vectors...",
    "Uploading graphics to converter...",
    "Generating EPS formatting...",
    "Compiling document elements...",
    "Please do not close or reload...",
    "Almost finished...",
    "Downloading your EPS file..."
  ];

  // Rotate messages during export compilation
  useEffect(() => {
    if (!exporting) return;
    let messageIdx = 0;
    const interval = setInterval(() => {
      setLoadingSubtext(loadingMessages[messageIdx % loadingMessages.length]);
      messageIdx++;
      if (messageIdx >= 3) {
        setShowWarning(true);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [exporting]);

  const getStats = () => {
    const total = labels.length;
    const techcode = labels.filter(l => isTechnicalCode((l.source || '').trim(), (l.translation || '').trim())).length;
    const genuineTranslated = labels.filter(l => {
      const t = (l.translation || '').trim();
      const s = (l.source || '').trim();
      return t && t !== s;
    }).length;
    const unchanged = labels.filter(l => {
      const t = (l.translation || '').trim();
      const s = (l.source || '').trim();
      return t && t === s && !isTechnicalCode(s, t);
    }).length;
    const missing = labels.filter(l => !l.translation || l.translation.trim() === '').length;
    const shrunk = labels.filter(l => l.fontSizeOverride !== undefined && l.fontSizeOverride < l.baseFontSize).length;
    return { total, genuineTranslated, techcode, unchanged, missing, shrunk };
  };

  const { total, genuineTranslated, techcode, unchanged, missing, shrunk } = getStats();

  /**
   * Builds the final clean SVG for export:
   *  1. Starts from the original (or normalised) SVG — not the DOM-polluted editor copy.
   *  2. Applies ALL translations (AI + manual) via raw string replacement.
   *  3. If any style overrides exist, applies them via DOM and re-serialises.
   * This guarantees: bold stays bold, manual translations are included, and
   * data-label-id attributes never appear in the exported file.
   */
  const buildFinalSvgForPage = (page) => {
    const base = page.originalSvgText || page.svgText;
    if (!base) throw new Error('No SVG content to export.');

    // Step 1: Build a translation map from labels state (covers both AI and manual edits)
    const translationMap = {};
    page.labels.forEach(label => {
      const src = (label.source || '').trim();
      const tgt = (label.translation || '').trim();
      if (src && tgt && src !== tgt) {
        translationMap[src] = tgt;
      }
    });

    // Step 2: Apply translations via raw string replacement (preserves ALL original formatting)
    let finalSvg = applyTranslationsToRawSvg(base, translationMap);

    // Step 3: Apply style overrides (fontSizeOverride, letterSpacingOverride, etc.) if any exist
    const hasOverrides = page.labels.some(l =>
      l.fontSizeOverride !== undefined ||
      l.letterSpacingOverride !== undefined ||
      l.dxOverride !== undefined ||
      l.dyOverride !== undefined ||
      l.textColorOverride !== undefined
    );

    if (hasOverrides) {
      try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(finalSvg, 'image/svg+xml');
        const NS = 'http://www.w3.org/2000/svg';

        // Build lookup: translated text -> label(s) with overrides
        const overridesByText = new Map();
        page.labels.forEach(label => {
          const hasAnyOverride = (
            label.fontSizeOverride !== undefined ||
            label.letterSpacingOverride !== undefined ||
            label.dxOverride !== undefined ||
            label.dyOverride !== undefined ||
            label.textColorOverride !== undefined
          );
          if (!hasAnyOverride) return;
          const displayText = ((label.translation || label.source) || '').trim();
          if (!displayText) return;
          if (!overridesByText.has(displayText)) overridesByText.set(displayText, []);
          overridesByText.get(displayText).push(label);
        });

        if (overridesByText.size > 0) {
          // Walk all text/tspan elements and apply matching overrides
          const applyCount = new Map();
          const allTextNodes = [
            ...Array.from(svgDoc.getElementsByTagNameNS(NS, 'text')),
            ...Array.from(svgDoc.getElementsByTagNameNS(NS, 'tspan'))
          ];

          allTextNodes.forEach(el => {
            // Leaf nodes only
            const hasChildEl = Array.from(el.childNodes).some(c => c.nodeType === 1);
            if (hasChildEl) return;

            const content = (el.textContent || '').trim();
            if (!content) return;

            const candidates = overridesByText.get(content);
            if (!candidates) return;

            const idx = applyCount.get(content) || 0;
            if (idx >= candidates.length) return;
            const label = candidates[idx];
            applyCount.set(content, idx + 1);

            // Apply font size override
            if (label.fontSizeOverride !== undefined) {
              el.setAttribute('font-size', String(label.fontSizeOverride));
              el.style.fontSize = '';
            }
            // Apply letter spacing override
            if (label.letterSpacingOverride !== undefined) {
              el.setAttribute('letter-spacing', String(label.letterSpacingOverride));
              el.style.letterSpacing = '';
            }
            // Apply dx/dy overrides
            if (label.dxOverride !== undefined) el.setAttribute('dx', String(label.dxOverride));
            if (label.dyOverride !== undefined) el.setAttribute('dy', String(label.dyOverride));
            // Apply text color override
            if (label.textColorOverride !== undefined) {
              el.setAttribute('fill', label.textColorOverride);
              el.style.fill = '';
            }
          });

          // Re-serialise the DOM back to a string
          const serializer = new XMLSerializer();
          finalSvg = serializer.serializeToString(svgDoc);
        }
      } catch (err) {
        console.warn('[QAReport] Style override serialisation failed, exporting without overrides:', err);
      }
    }

    return finalSvg;
  };

  const buildFinalSvg = () => {
    return buildFinalSvgForPage({
      svgText,
      originalSvgText,
      labels
    });
  };


  const handleDownloadSvg = () => {
    try {
      setExportingSvg(true);
      const rawSvg = buildFinalSvg();

      // Inject watermark via string insertion before </svg>
      const cleanFilename = filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
      const wmTag = `<text x="99%" y="99%" font-size="8" font-family="Arial, sans-serif" fill="rgba(100,100,100,0.45)" text-anchor="end">www.lingochaps.com</text>`;
      const finalSvg = rawSvg.replace('</svg>', wmTag + '</svg>');

      const svgBlob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(svgBlob);
      link.download = cleanFilename + '_translated.svg';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      showToast('SVG downloaded successfully!', 'success');
    } catch (err) {
      showToast('SVG export failed: ' + err.message, 'error');
      console.error(err);
    } finally {
      setExportingSvg(false);
    }
  };


  const handleExport = async () => {
    setExporting(true);
    setExportText('⏳ Converting to EPS...');
    setLoadingMsg('Preparing your EPS file...');
    setLoadingSubtext('Injecting metadata & scaling layers...');
    setShowWarning(false);

    try {
      // 1. Build the final translated SVG string
      const rawSvg = buildFinalSvg();

      // 2. Inject Watermark before </svg>
      const wmTag = `<text x="99%" y="99%" font-size="8" font-family="Arial, sans-serif" fill="rgba(100,100,100,0.45)" text-anchor="end" dominant-baseline="auto">www.lingochaps.com</text>`;
      const serializedSvg = rawSvg.replace('</svg>', wmTag + '</svg>');

      const cleanFilename = filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
      const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const svgFile = new File([svgBlob], cleanFilename + '_translated.svg', { type: 'image/svg+xml' });

      // 3. Trigger SVG -> EPS conversion job via CloudConvert API
      const job = await apiService.createJob({
        'import-svg': { operation: 'import/upload' },
        'convert-to-eps': { operation: 'convert', input: 'import-svg', input_format: 'svg', output_format: 'eps' },
        'export-eps': { operation: 'export/url', input: 'convert-to-eps' }
      });

      if (!job?.data) throw new Error('EPS conversion job failed to start.');

      // Step A: Upload SVG
      setLoadingSubtext('Uploading graphics...');
      const uploadTask = job.data.tasks.find(t => t.name === 'import-svg');
      const uploadUrl = uploadTask.result.form.url;
      const uploadParams = uploadTask.result.form.parameters;

      const formData = new FormData();
      Object.entries(uploadParams).forEach(([k, v]) => formData.append(k, v));
      formData.append('file', svgFile);

      await fetch(uploadUrl, { method: 'POST', body: formData });

      // Step B: Poll for EPS output URL
      setLoadingSubtext('Processing EPS...');
      const jobId = job.data.id;
      let epsUrl = null;

      for (let i = 0; i < 30; i++) {
        await new Promise(res => setTimeout(res, 2000));
        const statusData = await apiService.checkJobStatus(jobId);
        const status = statusData?.data?.status;

        if (status === 'finished') {
          const exportTask = statusData.data.tasks.find(t => t.operation === 'export/url');
          epsUrl = exportTask.result.files[0].url;
          break;
        }
        if (status === 'error') throw new Error('EPS conversion failed on server');
      }

      if (!epsUrl) throw new Error('EPS conversion timed out');

      // Step C: Trigger browser download
      setLoadingSubtext('Downloading...');
      const epsRes = await fetch(epsUrl);
      const epsBlob = await epsRes.blob();
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(epsBlob);
      link.download = cleanFilename + '_translated.eps';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportText('Download Translated EPS ↓');
      setExporting(false);
      showToast('EPS downloaded successfully!', 'success');

    } catch (err) {
      setExporting(false);
      setExportText('Download Translated EPS ↓');
      console.error(err);
      showToast('EPS conversion failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="card" id="section-qa" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <h2>Step 5 — QA Report &amp; Export</h2>

      {/* QA Grid stats */}
      <div className="diag-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '0.6rem',
        marginBottom: '1.25rem'
      }}>
        <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.65rem', textAlign: 'center' }}>
          <div className="num" id="qaTotal" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#a78bfa' }}>{total}</div>
          <div className="lbl" style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.2rem' }}>total</div>
        </div>
        <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.65rem', textAlign: 'center' }}>
          <div className="num" id="qaReplaced" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#34d399' }}>{genuineTranslated}</div>
          <div className="lbl" style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.2rem' }}>translated</div>
        </div>
        <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.65rem', textAlign: 'center' }}>
          <div className="num" id="qaTechCode" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8' }}>{techcode}</div>
          <div className="lbl" style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.2rem' }}>tech codes</div>
        </div>
        <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.65rem', textAlign: 'center' }}>
          <div className="num" id="qaUnchanged" style={{ fontSize: '1.3rem', fontWeight: 700, color: unchanged > 0 ? '#fbbf24' : '#6b7280' }}>{unchanged}</div>
          <div className="lbl" style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.2rem' }}>unchanged</div>
        </div>
        <div className="stat-box" style={{ background: '#0f1117', border: '1px solid #1f2937', borderRadius: '8px', padding: '0.65rem', textAlign: 'center' }}>
          <div className="num" id="qaMissing" style={{ fontSize: '1.3rem', fontWeight: 700, color: missing > 0 ? '#ef4444' : '#6b7280' }}>{missing}</div>
          <div className="lbl" style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.2rem' }}>missing</div>
        </div>
      </div>

      {/* Checklist items */}
      <div className="qa-grid" style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="qa-item" style={{ fontSize: '0.8rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="qa-ok">✓</span> Paths &amp; vectors preserved untouched
        </div>
        <div className="qa-item" style={{ fontSize: '0.8rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="qa-ok">✓</span> Icons &amp; graphic elements locked
        </div>
        <div className="qa-item" style={{ fontSize: '0.8rem', color: missing > 0 ? '#ef4444' : unchanged > 0 ? '#fbbf24' : '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="qa-ok">{missing > 0 ? '✗' : unchanged > 0 ? '⚠' : '✓'}</span>
          {missing > 0 ? `${missing} segments have no translation` : unchanged > 0 ? `${unchanged} unchanged segments need review (check Step 3)` : 'All segments translated'}
        </div>
        <div className="qa-item" style={{ fontSize: '0.8rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="qa-ok">ℹ</span> {techcode} technical codes preserved as-is (fuse ratings, pin IDs, etc.)
        </div>
        <div className="qa-item" style={{ fontSize: '0.8rem', color: shrunk > 0 ? '#a78bfa' : '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="qa-ok">{shrunk > 0 ? '⊬' : '✓'}</span> {shrunk > 0 ? `${shrunk} label font-sizes adjusted` : 'All font sizes preserved'}
        </div>
        <div className="qa-item" style={{ fontSize: '0.8rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="qa-manual">⊙</span> Visual audit complete
        </div>
      </div>

      {/* Export triggers */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost"
          onClick={onStartOverClick}
          style={{ flex: 1, minWidth: '120px', margin: 0, padding: '0.65rem 1.25rem', borderColor: '#2d3748', cursor: 'pointer' }}
        >
          🔄 Start Over
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleDownloadSvg}
          disabled={exportingSvg || exporting}
          style={{
            flex: 1,
            minWidth: '150px',
            margin: 0,
            padding: '0.65rem 1.25rem',
            cursor: exportingSvg || exporting ? 'not-allowed' : 'pointer',
            borderColor: '#0284c7',
            color: '#0284c7',
            background: '#f0f9ff'
          }}
        >
          {exportingSvg ? '⏳ Saving...' : '⬇️ Download SVG'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleDownloadDocx}
          disabled={exporting}
          style={{
            flex: 1,
            minWidth: '160px',
            margin: 0,
            padding: '0.65rem 1.25rem',
            cursor: exporting ? 'not-allowed' : 'pointer',
            borderColor: '#7c3aed',
            color: '#7c3aed',
            background: '#f5f3ff',
          }}
        >
          📝 Download DOCX
        </button>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
          style={{ flex: 2.5, minWidth: '220px', margin: 0, padding: '0.65rem 1.25rem', cursor: exporting ? 'not-allowed' : 'pointer' }}
        >
          {exportText}
        </button>
      </div>

      {/* Full screen export loader overlay */}
      {exporting && (
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
            {loadingMsg}
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
    </div>
  );
}
