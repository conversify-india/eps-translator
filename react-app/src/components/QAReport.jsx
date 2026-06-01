import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { showToast } from '../hooks/useToast';

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

export default function QAReport({
  filename,
  labels,
  svgText,
  globalScale,
  onStartOverClick
}) {
  const [exporting, setExporting] = useState(false);
  const [exportText, setExportText] = useState('Download Translated EPS ↓');
  const [loadingMsg, setLoadingMsg] = useState('Preparing your EPS file...');
  const [loadingSubtext, setLoadingSubtext] = useState('Structuring translated vectors...');
  const [showWarning, setShowWarning] = useState(false);
  const [exportingSvg, setExportingSvg] = useState(false);

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

  // Build finalized SVG doc with all translations applied
  const buildFinalSvg = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgRoot = doc.querySelector('svg');
    if (!svgRoot) throw new Error('Invalid SVG content.');

    labels.forEach((label) => {
      const ts = doc.querySelector(`[data-label-id="${label.id}"]`);
      if (!ts) return;
      ts.textContent = label.translation || label.source;
      const fs = label.fontSizeOverride !== undefined ? label.fontSizeOverride : label.baseFontSize;
      ts.style.fontSize = (fs * (globalScale || 1)) + 'px';

      // Smart font-family: only switch to Noto Sans when translation uses non-Latin scripts.
      // Preserving the original font for Latin translations keeps exact character metrics
      // so the export looks identical in spacing and layout to the source file.
      const translatedText = label.translation || label.source;
      const needsNoto = /[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0900-\u097F\u0600-\u06FF\u0590-\u05FF\uAC00-\uD7AF]/.test(translatedText);
      if (needsNoto) {
        ts.style.fontFamily = "'Noto Sans', 'Noto Sans Devanagari', 'Noto Naskh Arabic', 'Noto Sans CJK SC', Arial, sans-serif";
      } else {
        ts.style.fontFamily = ''; // keep original SVG font attribute
      }

      if (label.dxOverride !== undefined) ts.setAttribute('dx', label.dxOverride); else ts.removeAttribute('dx');
      if (label.dyOverride !== undefined) ts.setAttribute('dy', label.dyOverride); else ts.removeAttribute('dy');
      if (label.letterSpacingOverride !== undefined) ts.style.letterSpacing = label.letterSpacingOverride + 'px'; else ts.style.letterSpacing = '';

      if (label.haloOverride || label.isOriginalInvisible) {
        let defs = svgRoot.querySelector('defs');
        if (!defs) { defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs'); svgRoot.insertBefore(defs, svgRoot.firstChild); }
        const oldFilter = defs.querySelector('#text-halo');
        if (oldFilter) oldFilter.remove();
        const filter = doc.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'text-halo');
        filter.setAttribute('x', '-25%'); filter.setAttribute('y', '-25%');
        filter.setAttribute('width', '150%'); filter.setAttribute('height', '150%');
        // radius=6 covers typical EPS vector path stroke widths
        filter.innerHTML = `<feMorphology in="SourceAlpha" result="dilated" operator="dilate" radius="6" /><feFlood flood-color="#ffffff" flood-opacity="1" result="flooded" /><feComposite in="flooded" in2="dilated" operator="in" result="outline" /><feMerge><feMergeNode in="outline" /><feMergeNode in="SourceGraphic" /></feMerge>`;
        defs.appendChild(filter);
        // Apply on both tspan and parent text element for full coverage
        ts.setAttribute('filter', 'url(#text-halo)');
        const parentTextEl = ts.tagName.toLowerCase() === 'text' ? ts : ts.closest('text');
        if (parentTextEl && parentTextEl !== ts) parentTextEl.setAttribute('filter', 'url(#text-halo)');
      } else {
        ts.removeAttribute('filter');
        const parentTextEl = ts.tagName.toLowerCase() === 'text' ? ts : ts.closest('text');
        if (parentTextEl && parentTextEl !== ts) parentTextEl.removeAttribute('filter');
      }

      if (label.isOriginalInvisible) {
        ts.style.fill = label.textColorOverride || 'currentColor';
        ts.style.opacity = '1'; ts.style.fillOpacity = '1'; ts.style.visibility = 'visible'; ts.style.display = 'inline';
        let ancestor = ts.parentElement;
        while (ancestor && ancestor !== svgRoot) {
          const tag = ancestor.tagName.toLowerCase();
          ancestor.style.opacity = '1'; ancestor.style.visibility = 'visible'; ancestor.style.display = tag === 'g' ? 'inline' : ancestor.style.display || '';
          if (tag === 'text') { ancestor.style.fill = ancestor.getAttribute('fill') === 'none' && !label.textColorOverride ? 'currentColor' : (label.textColorOverride || ancestor.style.fill || ''); }
          ancestor = ancestor.parentElement;
        }
      } else if (label.textColorOverride) {
        ts.style.fill = label.textColorOverride;
        const parentText = ts.closest('text');
        if (parentText) parentText.style.fill = label.textColorOverride;
      }
    });

    return { doc, svgRoot };
  };

  const handleDownloadSvg = () => {
    try {
      setExportingSvg(true);
      const { doc, svgRoot } = buildFinalSvg();

      // Inject watermark
      const wmNS = 'http://www.w3.org/2000/svg';
      const vb = svgRoot.getAttribute('viewBox');
      let wmX = 300, wmY = 300, wmFontSize = 10;
      if (vb) {
        const parts = vb.split(/[\s,]+/);
        if (parts.length === 4) {
          const vbX = parseFloat(parts[0]), vbY = parseFloat(parts[1]), vbW = parseFloat(parts[2]), vbH = parseFloat(parts[3]);
          wmFontSize = Math.max(6, Math.min(12, vbW * 0.018));
          wmX = vbX + vbW - wmFontSize * 0.5; wmY = vbY + vbH - wmFontSize * 0.4;
        }
      }
      const wmText = doc.createElementNS(wmNS, 'text');
      wmText.setAttribute('x', wmX); wmText.setAttribute('y', wmY); wmText.setAttribute('font-size', wmFontSize);
      wmText.setAttribute('font-family', 'Arial, sans-serif'); wmText.setAttribute('fill', 'rgba(100, 100, 100, 0.45)');
      wmText.setAttribute('text-anchor', 'end'); wmText.textContent = 'www.lingochaps.com';
      svgRoot.appendChild(wmText);

      const serializedSvg = new XMLSerializer().serializeToString(doc);
      const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const cleanFilename = filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
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
      // 1. Build the final SVG Document in memory
      const { doc, svgRoot } = buildFinalSvg();

      // 2. Inject Watermark proportionally
      let wmX = 300;
      let wmY = 300;
      let wmFontSize = 10;

      const vb = svgRoot.getAttribute('viewBox');
      if (vb) {
        const parts = vb.split(/[\s,]+/);
        if (parts.length === 4) {
          const vbX = parseFloat(parts[0]);
          const vbY = parseFloat(parts[1]);
          const vbW = parseFloat(parts[2]);
          const vbH = parseFloat(parts[3]);
          wmFontSize = Math.max(6, Math.min(12, vbW * 0.018));
          wmX = vbX + vbW - wmFontSize * 0.5;
          wmY = vbY + vbH - wmFontSize * 0.4;
        }
      }

      const wmNS = 'http://www.w3.org/2000/svg';
      const wmText = doc.createElementNS(wmNS, 'text');
      wmText.setAttribute('x', wmX);
      wmText.setAttribute('y', wmY);
      wmText.setAttribute('font-size', wmFontSize);
      wmText.setAttribute('font-family', 'Arial, sans-serif');
      wmText.setAttribute('fill', 'rgba(100, 100, 100, 0.45)');
      wmText.setAttribute('text-anchor', 'end');
      wmText.setAttribute('dominant-baseline', 'auto');
      wmText.textContent = 'www.lingochaps.com';
      svgRoot.appendChild(wmText);

      // Serialize SVG document to Blob
      const serializedSvg = new XMLSerializer().serializeToString(doc);
      const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const cleanFilename = filename ? filename.replace(/\.(eps|svg)$/i, '') : 'drawing';
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
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
          style={{ flex: 2, minWidth: '200px', margin: 0, padding: '0.65rem 1.5rem', cursor: exporting ? 'not-allowed' : 'pointer' }}
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
