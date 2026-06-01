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

          <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
              ⚙ Aura EPS Translation Tool
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.3rem' }}>
              Translate. Fine-tune Visually. Export.
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
