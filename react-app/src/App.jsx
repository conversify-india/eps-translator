import { useState, useEffect } from 'react';
import Lockscreen from './components/Lockscreen';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import StepsIndicator from './components/StepsIndicator';
import UploadZone from './components/UploadZone';
import Diagnosis from './components/Diagnosis';
import TranslationTable from './components/TranslationTable';
import VisualCanvas from './components/VisualCanvas';
import QAReport from './components/QAReport';
import DwgWorkspace from './components/DwgWorkspace';
import PdfConverterWorkspace from './components/PdfConverterWorkspace';
import LingoGenieWorkspace from './components/LingoGenieWorkspace';
import { parseSVGString, extractUniqueTexts, applyTranslationsToRawSvg, normalizeSvgFontStyles, shouldTranslateText } from './utils/svgParser';
import { showToast } from './hooks/useToast';

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

export default function App() {
  // ── Authentication & View States ──
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('aura_user');
      if (savedUser) return JSON.parse(savedUser);
      const loggedOut = localStorage.getItem('aura_logged_out') === 'true';
      if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) && !loggedOut) {
        return { name: 'Dev User', email: 'dev@localhost', picture: '' };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  const [activeView, setActiveView] = useState(() => {
    const loggedIn = localStorage.getItem('aura_logged_in') === 'true';
    const savedView = localStorage.getItem('aura_active_view');
    const loggedOut = localStorage.getItem('aura_logged_out') === 'true';
    const resolvedView = savedView === 'aura-pdf' ? 'dashboard' : savedView;
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('.localhost')) && !loggedOut) {
      return resolvedView || 'dashboard';
    }
    return loggedIn ? (resolvedView || 'dashboard') : 'lockscreen';
  });
  
  // ── Translation Tool States ──
  const [step, setStep] = useState(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);
  const [filename, setFilename] = useState('');
  const [svgText, setSvgText] = useState('');
  const [originalSvgText, setOriginalSvgText] = useState(''); // untouched source
  const [labels, setLabels] = useState([]);
  const [hasVectorOutlines, setHasVectorOutlines] = useState(false);
  const [uniqueSourceTexts, setUniqueSourceTexts] = useState([]);
  const [selectedLabelId, setSelectedLabelId] = useState(null);
  const [sourceLang, setSourceLang] = useState('English');
  const [targetLang, setTargetLang] = useState('French|30'); // Format: Language|ExpansionPct
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // ── 1. Restore sessions on mount ──
  useEffect(() => {
    // A. Restore language settings
    const cachedSourceLang = sessionStorage.getItem('aura_source_lang');
    const cachedTargetLang = sessionStorage.getItem('aura_target_lang');
    if (cachedSourceLang) setSourceLang(cachedSourceLang);
    if (cachedTargetLang) setTargetLang(cachedTargetLang);

    // B. Restore Uploaded File Session (Preserves progress on refresh)
    const cachedSvg = sessionStorage.getItem('aura_svg_text');
    const cachedFilename = sessionStorage.getItem('aura_filename');
    const cachedLabels = sessionStorage.getItem('aura_labels');
    const cachedStep = sessionStorage.getItem('aura_step');
    const cachedMaxStep = sessionStorage.getItem('aura_max_step');
    const cachedHasVectorOutlines = sessionStorage.getItem('aura_has_vector_outlines');
    const cachedPages = sessionStorage.getItem('aura_pages');
    const cachedPageIndex = sessionStorage.getItem('aura_page_index');

    if (cachedSvg && cachedFilename && cachedLabels) {
      try {
        const parsedLabels = JSON.parse(cachedLabels);
        setSvgText(cachedSvg);
        setFilename(cachedFilename);
        setLabels(parsedLabels);
        setUniqueSourceTexts(Array.from(new Set(parsedLabels.map(l => l.source))));
        if (cachedHasVectorOutlines) {
          setHasVectorOutlines(cachedHasVectorOutlines === 'true');
        }
        
        if (cachedStep) setStep(parseInt(cachedStep));
        if (cachedMaxStep) setMaxUnlockedStep(parseInt(cachedMaxStep));
      } catch (e) {
        console.error("Error restoring session cache:", e);
        sessionStorage.clear();
      }
    }

    if (cachedPages) {
      try {
        const parsedPages = JSON.parse(cachedPages);
        setPages(parsedPages);
        if (cachedPageIndex) {
          setCurrentPageIndex(parseInt(cachedPageIndex));
        }
      } catch (e) {
        console.error("Error restoring pages cache:", e);
      }
    }
  }, []);

  // Sync current active page state back to pages array
  useEffect(() => {
    if (pages.length > 0 && currentPageIndex >= 0 && currentPageIndex < pages.length) {
      setPages(prev => {
        const updated = [...prev];
        const page = updated[currentPageIndex];
        if (
          page.svgText !== svgText ||
          page.originalSvgText !== originalSvgText ||
          page.labels !== labels ||
          page.uniqueSourceTexts !== uniqueSourceTexts
        ) {
          updated[currentPageIndex] = {
            ...page,
            svgText,
            originalSvgText,
            labels,
            uniqueSourceTexts
          };
          return updated;
        }
        return prev;
      });
    }
  }, [svgText, originalSvgText, labels, uniqueSourceTexts, currentPageIndex, pages.length]);

  // ── 2. Cache updates in sessionStorage ──
  useEffect(() => {
    sessionStorage.setItem('aura_source_lang', sourceLang);
    sessionStorage.setItem('aura_target_lang', targetLang);

    if (activeView === 'aura-eps' && svgText && filename && labels.length > 0) {
      sessionStorage.setItem('aura_svg_text', svgText);
      sessionStorage.setItem('aura_filename', filename);
      sessionStorage.setItem('aura_labels', JSON.stringify(labels));
      sessionStorage.setItem('aura_step', step.toString());
      sessionStorage.setItem('aura_max_step', maxUnlockedStep.toString());
      sessionStorage.setItem('aura_has_vector_outlines', hasVectorOutlines.toString());
    }
    
    if (pages.length > 0) {
      sessionStorage.setItem('aura_pages', JSON.stringify(pages));
      sessionStorage.setItem('aura_page_index', String(currentPageIndex));
    }
  }, [activeView, svgText, filename, labels, step, maxUnlockedStep, hasVectorOutlines, sourceLang, targetLang, pages, currentPageIndex]);

  // ── 3. Handle auth transitions ──
  const handleLoginSuccess = (profile) => {
    setUser(profile);
    localStorage.setItem('aura_logged_in', 'true');
    localStorage.setItem('aura_user', JSON.stringify(profile));
    localStorage.setItem('aura_active_view', 'dashboard');
    localStorage.removeItem('aura_logged_out');
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('aura_logged_out', 'true');
    setUser(null);
    setActiveView('lockscreen');
    handleStartOver();
  };

  const handleSelectTool = (toolId) => {
    localStorage.setItem('aura_active_view', toolId);
    setActiveView(toolId);
  };

  const handleBackToDashboard = () => {
    handleStartOver();
    localStorage.setItem('aura_active_view', 'dashboard');
    setActiveView('dashboard');
  };

  const handlePageChange = (newIndex) => {
    if (newIndex < 0 || newIndex >= pages.length) return;
    
    const newPage = pages[newIndex];
    
    // Set index and sync active state variables
    setCurrentPageIndex(newIndex);
    setSvgText(newPage.svgText);
    setOriginalSvgText(newPage.originalSvgText);
    setLabels(newPage.labels);
    setUniqueSourceTexts(newPage.uniqueSourceTexts);
    setSelectedLabelId(null);
    showToast(`Switched to Page ${newIndex + 1}`, 'info');
  };

  // ── 4. Translation Tool handlers ──
  const handleConversionSuccess = (rawSvgText, uploadedFilename) => {
    try {
      const isMultiPage = Array.isArray(rawSvgText);
      const svgList = isMultiPage ? rawSvgText : [rawSvgText];

      const newPages = svgList.map((svg, pageIdx) => {
        const normalizedSvg = normalizeSvgFontStyles(svg);
        const allUniqueTexts = extractUniqueTexts(normalizedSvg);
        const parsedLabels = allUniqueTexts.map((txt, i) => ({
          id: `${pageIdx + 1}-${i + 1}`, // unique ID across pages
          source: txt,
          translation: '',
          is_flagged: false
        }));
        const translatableTexts = allUniqueTexts.filter(shouldTranslateText);

        return {
          svgText: normalizedSvg,
          originalSvgText: normalizedSvg,
          labels: parsedLabels,
          uniqueSourceTexts: translatableTexts
        };
      });

      setPages(newPages);
      setCurrentPageIndex(0);

      // Initialize active states with the first page
      const firstPage = newPages[0];
      setSvgText(firstPage.svgText);
      setOriginalSvgText(firstPage.originalSvgText);
      setLabels(firstPage.labels);
      setUniqueSourceTexts(firstPage.uniqueSourceTexts);
      
      setFilename(uploadedFilename);
      setHasVectorOutlines(false);

      setStep(2);
      setMaxUnlockedStep(2);
    } catch (err) {
      console.error(err);
      showToast('Error parsing uploaded file. Please verify it is a valid vector file.', 'error');
    }
  };

  const handleTranslationChange = (id, value) => {
    const targetLabel = labels.find(l => l.id === id);
    if (!targetLabel) return;

    const targetSource = targetLabel.source;
    const isFlagged = value.trim().length > targetSource.length;

    setLabels(prev => prev.map(label => {
      if (label.source !== targetSource) return label;
      return {
        ...label,
        translation: value,
        is_flagged: isFlagged
      };
    }));
  };

  const handleLabelUpdate = (idOrIds, updates) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    setLabels(prev => prev.map(label => {
      if (!ids.includes(label.id)) return label;
      return { ...label, ...updates };
    }));
  };

  // Bulk update: accepts an array of { id, ...fields } — each label gets its own set of updates
  const handleBulkLabelUpdate = (updatesArray) => {
    const updateMap = new Map(updatesArray.map(u => [u.id, u]));
    setLabels(prev => prev.map(label => {
      const upd = updateMap.get(label.id);
      if (!upd) return label;
      const { id: _id, ...fields } = upd;
      return { ...label, ...fields };
    }));
  };

  const handleViewInCanvas = (id) => {
    setSelectedLabelId(id);
    setStep(4);
    setMaxUnlockedStep(prev => Math.max(prev, 4));
  };

  const handleAiTranslationSuccess = (translationsMap) => {
    // Update labels state for Translation Table display (step 3)
    // We intentionally DO NOT update svgText with the translated strings here.
    // Keeping svgText as the original ensures VisualCanvas can correctly stamp
    // data-label-id attributes by matching against the original source text.
    // VisualCanvas will dynamically mutate the DOM to display translations.
    setLabels(prev => prev.map(label => {
      const translation = translationsMap[label.source];
      if (!translation) return label;
      return { ...label, translation, is_flagged: false };
    }));

    // Auto-advance to Step 3 (Table) so they can verify the AI translations
    setStep(3);
    setMaxUnlockedStep(prev => Math.max(prev, 3));
  };

  const handleOcrTranslationSuccess = (ocrResults) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const NS = 'http://www.w3.org/2000/svg';
      const svgEl = doc.documentElement;

      // Extract viewBox dimensions to map relative 0-1000 coordinates
      const dims = getSvgDimensions(svgEl);
      const w = dims.width;
      const h = dims.height;
      const vbx = dims.x;
      const vby = dims.y;

      // Create a group container for masks and texts
      const ocrGroup = doc.createElementNS(NS, 'g');
      ocrGroup.setAttribute('id', 'ocr-translations-layer');

      const newLabels = ocrResults.map((item, index) => {
        const id = String(index + 1);
        const box = item.box;

        // Convert 0-1000 coordinates to absolute SVG dimensions
        const x = vbx + (box.xmin / 1000) * w;
        const y = vby + (box.ymin / 1000) * h;
        const rectW = ((box.xmax - box.xmin) / 1000) * w;
        const rectH = ((box.ymax - box.ymin) / 1000) * h;

        // 1. Create mask rectangle to hide original German text
        const maskRect = doc.createElementNS(NS, 'rect');
        maskRect.setAttribute('x', String(x));
        maskRect.setAttribute('y', String(y));
        maskRect.setAttribute('width', String(rectW));
        maskRect.setAttribute('height', String(rectH));
        maskRect.setAttribute('fill', '#ffffff');
        maskRect.setAttribute('stroke', 'none');
        maskRect.setAttribute('rx', '2');
        maskRect.setAttribute('ry', '2');
        maskRect.setAttribute('data-label-id', id);
        ocrGroup.appendChild(maskRect);

        // 2. Compute constrained font-size (width-constrained to prevent huge letters)
        const textLen = (item.originalText || '').length || 1;
        let baseFontSize = rectH * 0.75;
        const widthConstraint = (rectW / textLen) * 1.5;
        baseFontSize = Math.min(baseFontSize, widthConstraint);
        baseFontSize = Math.max(6, Math.min(baseFontSize, 72));

        // 3. Create translated text element (stamping with original source initially)
        const textNode = doc.createElementNS(NS, 'text');
        
        // Add tiny horizontal padding
        const paddingX = Math.min(5, rectW * 0.05);
        textNode.setAttribute('x', String(x + paddingX));
        
        // Vertically center using dominant-baseline
        textNode.setAttribute('y', String(y + rectH / 2));
        textNode.setAttribute('dominant-baseline', 'central');
        textNode.setAttribute('font-size', String(baseFontSize));
        textNode.setAttribute('font-family', 'sans-serif');
        textNode.setAttribute('fill', '#000000');
        textNode.setAttribute('data-label-id', id);
        textNode.textContent = item.originalText;
        ocrGroup.appendChild(textNode);

        return {
          id,
          source: item.originalText,
          translation: item.translatedText,
          is_flagged: false,
          baseFontSize: baseFontSize
        };
      });

      svgEl.appendChild(ocrGroup);

      // Serialise updated SVG
      const serializer = new XMLSerializer();
      const modifiedSvg = serializer.serializeToString(doc);

      // Store in state
      setLabels(newLabels);
      setUniqueSourceTexts(Array.from(new Set(newLabels.map(l => l.source))));
      setOriginalSvgText(modifiedSvg);
      setSvgText(modifiedSvg);
      setHasVectorOutlines(false);

      // Transition to Step 3 (Table Review)
      setStep(3);
      setMaxUnlockedStep(prev => Math.max(prev, 3));
      showToast('Successfully overlaid OCR text layer!', 'success');
    } catch (e) {
      console.error('Error generating OCR layer:', e);
      showToast('Failed to generate OCR visual layer: ' + e.message, 'error');
    }
  };

  const handleStartOver = () => {
    sessionStorage.clear();
    setPages([]);
    setCurrentPageIndex(0);
    setFilename('');
    setSvgText('');
    setOriginalSvgText('');
    setLabels([]);
    setUniqueSourceTexts([]);
    setSelectedLabelId(null);
    setHasVectorOutlines(false);
    setStep(1);
    setMaxUnlockedStep(1);
  };

  return (
    <>
      {activeView === 'lockscreen' && (
        <Lockscreen onLoginSuccess={handleLoginSuccess} />
      )}

      {activeView === 'dashboard' && user && (
        <Dashboard user={user} onSelectTool={handleSelectTool} />
      )}

      {activeView === 'aura-eps' && user && (
        <div id="eps-tool-body">
          {/* Header toolbar */}
          <Header
            user={user}
            onBackToDashboard={handleBackToDashboard}
            onLogout={handleLogout}
          />

          {/* Stepper progress navigation */}
          <StepsIndicator
            currentStep={step}
            maxUnlockedStep={maxUnlockedStep}
            onStepClick={setStep}
          />

          {pages.length > 1 && step > 1 && (
            <div className="page-navigation-bar" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              margin: '10px 0 20px 0',
              padding: '8px 16px',
              background: '#1e293b',
              borderRadius: '12px',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              width: 'fit-content',
              marginLeft: 'auto',
              marginRight: 'auto',
              userSelect: 'none'
            }}>
              <button
                onClick={() => handlePageChange(currentPageIndex - 1)}
                disabled={currentPageIndex === 0}
                style={{
                  background: '#334155',
                  color: currentPageIndex === 0 ? '#64748b' : '#f8fafc',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: currentPageIndex === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                ◀ Prev Page
              </button>
              <span style={{
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                Page <strong style={{ color: '#818cf8' }}>{currentPageIndex + 1}</strong> of <strong>{pages.length}</strong>
              </span>
              <button
                onClick={() => handlePageChange(currentPageIndex + 1)}
                disabled={currentPageIndex === pages.length - 1}
                style={{
                  background: '#334155',
                  color: currentPageIndex === pages.length - 1 ? '#64748b' : '#f8fafc',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: currentPageIndex === pages.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Next Page ▶
              </button>
            </div>
          )}

          <header className="app-header">
            <div className="logo-badge">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '22px', height: '22px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <h1>Aura EPS Translation Tool</h1>
            <p>
              <span>Translate</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span>Fine-tune Visually</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span>Export</span>
            </p>
          </header>

          {/* Wizard step views */}
          {step === 1 && (
            <UploadZone
              user={user}
              onConversionSuccess={handleConversionSuccess}
              sourceLang={sourceLang}
              setSourceLang={setSourceLang}
              targetLang={targetLang}
              setTargetLang={setTargetLang}
              allowedFormat="vector"
            />
          )}

          {step === 2 && (
            <Diagnosis
              filename={filename}
              uniqueSourceTexts={uniqueSourceTexts}
              labels={labels}
              onAiTranslationSuccess={handleAiTranslationSuccess}
              onManualTranslateClick={() => {
                setStep(3);
                setMaxUnlockedStep(prev => Math.max(prev, 3));
              }}
              hasVectorOutlines={hasVectorOutlines}
              user={user}
              svgText={svgText}
              sourceLang={sourceLang}
              setSourceLang={setSourceLang}
              targetLang={targetLang}
              setTargetLang={setTargetLang}
              onOcrTranslationSuccess={handleOcrTranslationSuccess}
            />
          )}

          {step === 3 && (
            <TranslationTable
              labels={labels}
              onTranslationChange={handleTranslationChange}
              onViewInCanvas={handleViewInCanvas}
              onProceedClick={() => {
                setStep(4);
                setMaxUnlockedStep(prev => Math.max(prev, 4));
              }}
            />
          )}

          {step === 4 && (
            <VisualCanvas
              svgText={svgText}
              labels={labels}
              onLabelUpdate={handleLabelUpdate}
              onBulkLabelUpdate={handleBulkLabelUpdate}
              selectedLabelId={selectedLabelId}
              setSelectedLabelId={setSelectedLabelId}
              onProceedClick={() => {
                setStep(5);
                setMaxUnlockedStep(prev => Math.max(prev, 5));
              }}
              hasVectorOutlines={hasVectorOutlines}
            />
          )}

          {step === 5 && (
            <QAReport
              filename={filename}
              labels={labels}
              svgText={svgText}
              originalSvgText={originalSvgText}
              pages={pages}
              globalScale={1.0}
              onStartOverClick={handleStartOver}
            />
          )}
        </div>
      )}

      {activeView === 'aura-lingogenie' && user && (
        <div id="lingogenie-tool-body">
          <Header
            user={user}
            onBackToDashboard={handleBackToDashboard}
            onLogout={handleLogout}
          />
          <LingoGenieWorkspace user={user} onStartOver={handleBackToDashboard} />
        </div>
      )}

      {activeView === 'aura-dwg' && user && (
        <div id="dwg-tool-body">
          <Header
            user={user}
            onBackToDashboard={handleBackToDashboard}
            onLogout={handleLogout}
          />
          <DwgWorkspace user={user} onStartOver={handleBackToDashboard} />
        </div>
      )}

      {activeView === 'aura-pdf-converter' && user && (
        <div id="pdf-converter-body">
          <Header
            user={user}
            onBackToDashboard={handleBackToDashboard}
            onLogout={handleLogout}
          />
          <PdfConverterWorkspace user={user} onStartOver={handleBackToDashboard} />
        </div>
      )}
    </>
  );
}
