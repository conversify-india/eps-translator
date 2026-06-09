export default function Dashboard({ user, onSelectTool }) {

  const getFirstName = (fullName) => {
    if (!fullName) return 'User';
    return fullName.split(' ')[0];
  };

  return (
    <div id="tools-dashboard" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 998,
      background: 'radial-gradient(circle at 15% 25%, #f5f3ff 0%, #e2e8f0 45%, #f8fafc 100%)',
      overflowY: 'auto',
      fontFamily: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif"
    }}>
      {/* Background Orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {/* Top Bar inside Dashboard */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 2.5rem',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }} className="dashboard-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #7c3aed, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>✦ AURA</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Intelligent Suite
          </span>
        </div>
        <div id="dashboard-user" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#475569', position: 'relative', zIndex: 11 }}>
          {user.picture && (
            <img
              src={user.picture}
              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid #a78bfa' }}
              alt=""
            />
          )}
          <span>Welcome, <strong>{getFirstName(user.name)}</strong></span>
        </div>
      </div>

      {/* Hero Welcome Section */}
      <div style={{ textAlign: 'center', padding: '3.5rem 2rem 2rem', position: 'relative', zIndex: 2 }} className="dashboard-hero">
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#a78bfa',
          marginBottom: '0.75rem'
        }}>
          Welcome to your workspace
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: '0.6rem' }}>
          Choose Your Tool
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '420px', margin: '0 auto' }}>
          All your language and localization tools in one place. Select a tool to get started.
        </p>
      </div>

      {/* Grid containing Tool Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '1rem 2.5rem 4rem',
        position: 'relative',
        zIndex: 2
      }} className="dashboard-grid">

        {/* LingoGenie Card */}
        <div
          onClick={() => onSelectTool('aura-lingogenie')}
          className="tool-card purple-theme"
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(167, 139, 250, 0.12), transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(20px, -20px)'
          }} />
          <div className="icon-wrapper" style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
          }}>
            🌐
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: '0.4rem' }}>
            Translation
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>LingoGenie</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.25rem', flex: 1 }}>
            AI-powered multilingual translation engine. Translate content across 50+ languages instantly.
          </p>
          <div className="launch-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
            Launch tool <span style={{ fontSize: '1rem' }}>→</span>
          </div>
        </div>

        {/* Aura EPS Tool Card */}
        <div
          onClick={() => onSelectTool('aura-eps')}
          className="tool-card green-theme"
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(52, 211, 153, 0.12), transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(20px, -20px)'
          }} />
          <div className="icon-wrapper" style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #059669, #34d399)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
          }}>
            ⚙️
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#059669', marginBottom: '0.4rem' }}>
            Localization
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Aura EPS Tool</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.25rem', flex: 1 }}>
            Visual EPS translation editor. Diagnose, translate and fine-tune vector graphics live.
          </p>
          <div className="launch-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>
            Launch tool <span style={{ fontSize: '1rem' }}>→</span>
          </div>
        </div>

        {/* DWG Conversion */}
        <div
          onClick={() => onSelectTool('aura-dwg')}
          className="tool-card blue-theme"
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12), transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(20px, -20px)'
          }} />
          <div className="icon-wrapper" style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}>
            📐
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2563eb', marginBottom: '0.4rem' }}>
            Localization
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Aura DWG Tool</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.25rem', flex: 1 }}>
            AutoCAD (.dwg) translation workflow. Preserves all CAD coordinates, blocks, text attributes, and layers.
          </p>
          <div className="launch-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>
            Launch tool <span style={{ fontSize: '1rem' }}>→</span>
          </div>
        </div>

        {/* PDF to Word Converter */}
          <div
            onClick={() => onSelectTool('aura-pdf-converter')}
            className="tool-card amber-theme"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(251, 191, 36, 0.14), transparent 70%)',
              borderRadius: '50%',
              transform: 'translate(20px, -20px)'
            }} />
            <div className="icon-wrapper" style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #d97706, #fbbf24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              marginBottom: '1.25rem',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
            }}>
              📝
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d97706', marginBottom: '0.4rem' }}>
              Conversion
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>PDF to Word Converter</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.25rem', flex: 1 }}>
              Convert any PDF into a perfectly formatted, fully editable Word (.docx) file. Handles text, scanned, tables, forms, and image-only PDFs with OCR.
            </p>
            <div className="launch-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>
              Launch tool <span style={{ fontSize: '1rem' }}>→</span>
            </div>
          </div>

        {/* Coming Soon: CDR Conversion */}
        <div
          className="tool-card disabled-card"
          style={{
            background: 'rgba(250, 250, 250, 0.4)',
            border: '1.5px dashed #cbd5e1',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'not-allowed'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            marginBottom: '1.25rem'
          }}>
            🎨
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.4rem' }}>
            Coming Soon
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem' }}>Aura CDR Tool</h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '1.25rem', flex: 1 }}>
            Visual CorelDraw (.cdr) design translation system. Keep layers, graphic paths, and margins locked.
          </p>
          <div style={{
            display: 'inline-block',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#94a3b8',
            background: '#f1f5f9',
            padding: '0.25rem 0.7rem',
            borderRadius: '100px',
            alignSelf: 'flex-start'
          }}>
            In development
          </div>
        </div>

      </div>
    </div>
  );
}
