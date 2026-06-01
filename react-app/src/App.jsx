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
import { parseSVGString } from './utils/svgParser';

export default function App() {
  // ── Authentication & View States ──
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('lockscreen'); // 'lockscreen' | 'dashboard' | 'aura-eps'
  
  // ── Translation Tool States ──
  const [step, setStep] = useState(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);
  const [filename, setFilename] = useState('');
  const [svgText, setSvgText] = useState('');
  const [labels, setLabels] = useState([]);
  const [uniqueSourceTexts, setUniqueSourceTexts] = useState([]);
  const [selectedLabelId, setSelectedLabelId] = useState(null);

  // ── 1. Restore sessions on mount ──
  useEffect(() => {
    // A. Restore User Session
    const loggedIn = localStorage.getItem('aura_logged_in') === 'true';
    const savedUser = localStorage.getItem('aura_user');
    const savedView = localStorage.getItem('aura_active_view');

    if (loggedIn && savedUser) {
      setUser(JSON.parse(savedUser));
      setActiveView(savedView || 'dashboard');
    }

    // B. Restore Uploaded File Session (Preserves progress on refresh)
    const cachedSvg = sessionStorage.getItem('aura_svg_text');
    const cachedFilename = sessionStorage.getItem('aura_filename');
    const cachedLabels = sessionStorage.getItem('aura_labels');
    const cachedStep = sessionStorage.getItem('aura_step');
    const cachedMaxStep = sessionStorage.getItem('aura_max_step');

    if (cachedSvg && cachedFilename && cachedLabels) {
      try {
        const parsedLabels = JSON.parse(cachedLabels);
        setSvgText(cachedSvg);
        setFilename(cachedFilename);
        setLabels(parsedLabels);
        setUniqueSourceTexts(Array.from(new Set(parsedLabels.map(l => l.source))));
        
        if (cachedStep) setStep(parseInt(cachedStep));
        if (cachedMaxStep) setMaxUnlockedStep(parseInt(cachedMaxStep));
      } catch (e) {
        console.error("Error restoring session cache:", e);
        sessionStorage.clear();
      }
    }
  }, []);

  // ── 2. Cache updates in sessionStorage ──
  useEffect(() => {
    if (activeView === 'aura-eps' && svgText && filename && labels.length > 0) {
      sessionStorage.setItem('aura_svg_text', svgText);
      sessionStorage.setItem('aura_filename', filename);
      sessionStorage.setItem('aura_labels', JSON.stringify(labels));
      sessionStorage.setItem('aura_step', step.toString());
      sessionStorage.setItem('aura_max_step', maxUnlockedStep.toString());
    }
  }, [activeView, svgText, filename, labels, step, maxUnlockedStep]);

  // ── 3. Handle auth transitions ──
  const handleLoginSuccess = (profile) => {
    setUser(profile);
    localStorage.setItem('aura_logged_in', 'true');
    localStorage.setItem('aura_user', JSON.stringify(profile));
    localStorage.setItem('aura_active_view', 'dashboard');
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setUser(null);
    setActiveView('lockscreen');
    handleStartOver();
  };

  const handleSelectTool = (toolId) => {
    if (toolId === 'aura-eps') {
      localStorage.setItem('aura_active_view', 'aura-eps');
      setActiveView('aura-eps');
    }
  };

  const handleBackToDashboard = () => {
    localStorage.setItem('aura_active_view', 'dashboard');
    setActiveView('dashboard');
  };

  // ── 4. Translation Tool handlers ──
  const handleConversionSuccess = (rawSvgText, uploadedFilename) => {
    try {
      const { updatedSvgString, parsedLabels } = parseSVGString(rawSvgText);
      
      setSvgText(updatedSvgString);
      setFilename(uploadedFilename);
      setLabels(parsedLabels);
      setUniqueSourceTexts(Array.from(new Set(parsedLabels.map(l => l.source))));
      
      setStep(2);
      setMaxUnlockedStep(2);
    } catch (err) {
      console.error(err);
      alert('Error parsing uploaded file. Please verify it is a valid vector file.');
    }
  };

  const handleTranslationChange = (id, value) => {
    setLabels(prev => prev.map(label => {
      if (label.id !== id) return label;

      // Smart overflow flag: if translation is longer than original text
      const isFlagged = value.trim().length > label.source.length;
      return {
        ...label,
        translation: value,
        is_flagged: isFlagged
      };
    }));
  };

  const handleLabelUpdate = (id, updates) => {
    setLabels(prev => prev.map(label => {
      if (label.id !== id) return label;
      return { ...label, ...updates };
    }));
  };

  const handleViewInCanvas = (id) => {
    setSelectedLabelId(id);
    setStep(4);
    setMaxUnlockedStep(prev => Math.max(prev, 4));
  };

  const handleAiTranslationSuccess = (translationsMap) => {
    setLabels(prev => prev.map(label => {
      const translation = translationsMap[label.source];
      if (!translation) return label;

      const isFlagged = translation.trim().length > label.source.length;
      return {
        ...label,
        translation,
        is_flagged: isFlagged
      };
    }));

    // Auto-advance to Step 3 (Table) so they can verify the AI translations
    setStep(3);
    setMaxUnlockedStep(prev => Math.max(prev, 3));
  };

  const handleStartOver = () => {
    sessionStorage.clear();
    setFilename('');
    setSvgText('');
    setLabels([]);
    setUniqueSourceTexts([]);
    setSelectedLabelId(null);
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
            />
          )}

          {step === 2 && (
            <Diagnosis
              filename={filename}
              uniqueSourceTexts={uniqueSourceTexts}
              onAiTranslationSuccess={handleAiTranslationSuccess}
              onManualTranslateClick={() => {
                setStep(3);
                setMaxUnlockedStep(prev => Math.max(prev, 3));
              }}
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
              selectedLabelId={selectedLabelId}
              setSelectedLabelId={setSelectedLabelId}
              onProceedClick={() => {
                setStep(5);
                setMaxUnlockedStep(prev => Math.max(prev, 5));
              }}
            />
          )}

          {step === 5 && (
            <QAReport
              filename={filename}
              labels={labels}
              svgText={svgText}
              globalScale={1.0}
              onStartOverClick={handleStartOver}
            />
          )}
        </div>
      )}
    </>
  );
}
