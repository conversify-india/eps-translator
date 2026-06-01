import { useState } from 'react';

// Detect if a label is a pure technical code that intentionally stayed unchanged
function isTechnicalCode(source, translation) {
  if (!source || source !== translation) return false;
  const s = source.trim();
  // Pure number
  if (/^\d+$/.test(s)) return true;
  // Fuse/current rating: 10A, 15A, 5A, 30A, etc.
  if (/^\d+(\.\d+)?\s*[AaVvWwΩ]$/.test(s)) return true;
  // Alphanumeric pin / connector IDs: 49a, 3015, C1, X2, P3 etc.
  if (/^[A-Z]?\d+[a-zA-Z]?$/.test(s)) return true;
  // Known universal electrical abbreviations
  const universalCodes = new Set([
    'GND', 'VCC', 'VDD', 'ECU', 'ECM', 'ABS', 'CAN', 'PWM', 'LED',
    'AC', 'DC', 'IC', 'PCB', 'CPU', 'USB', 'IN', 'OUT', 'COM', 'NC',
    'NO', 'N', 'S', 'E', 'W', 'B', 'R', 'Y', 'G'
  ]);
  if (universalCodes.has(s.toUpperCase())) return true;
  // Single letter / single digit
  if (/^[A-Za-z]$/.test(s)) return true;
  return false;
}

// Returns the display status for a label row
function getLabelStatus(label) {
  const src = (label.source || '').trim();
  const trn = (label.translation || '').trim();

  if (!trn) return 'missing';
  if (label.is_flagged) return 'overflow';
  if (isTechnicalCode(src, trn)) return 'techcode';
  if (src === trn) return 'unchanged';
  return 'translated';
}

const STATUS_CONFIG = {
  translated: { label: 'TRANSLATED', bg: '#ecfdf5', border: '#10b981', text: '#059669', badge: '#d1fae5', badgeText: '#065f46' },
  overflow:   { label: 'OVERFLOW',   bg: '#fef2f2', border: '#ef4444', text: '#ef4444', badge: '#fee2e2', badgeText: '#991b1b' },
  unchanged:  { label: 'UNCHANGED',  bg: '#fff7ed', border: '#f59e0b', text: '#d97706', badge: '#fef3c7', badgeText: '#92400e' },
  techcode:   { label: 'TECH CODE',  bg: '#eff6ff', border: '#3b82f6', text: '#2563eb', badge: '#dbeafe', badgeText: '#1e40af' },
  missing:    { label: 'MISSING',    bg: '#fdf4ff', border: '#a855f7', text: '#9333ea', badge: '#f3e8ff', badgeText: '#6b21a8' },
};

export default function TranslationTable({
  labels,
  onTranslationChange,
  onViewInCanvas,
  onProceedClick
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const getStats = () => {
    const total = labels.length;
    const missing = labels.filter(l => !l.translation || l.translation.trim() === '').length;
    const overflow = labels.filter(l => l.is_flagged).length;
    const techcode = labels.filter(l => isTechnicalCode((l.source || '').trim(), (l.translation || '').trim())).length;
    const unchanged = labels.filter(l => {
      const s = (l.source || '').trim();
      const t = (l.translation || '').trim();
      return t && s === t && !isTechnicalCode(s, t);
    }).length;
    const translated = total - missing - overflow - unchanged - techcode;
    return { total, missing, overflow, techcode, unchanged, translated: Math.max(0, translated) };
  };

  const stats = getStats();

  const filteredLabels = labels.filter((label) => {
    const matchesSearch =
      label.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (label.translation && label.translation.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    const status = getLabelStatus(label);
    if (filterType === 'missing')   return status === 'missing';
    if (filterType === 'overflow')  return status === 'overflow';
    if (filterType === 'unchanged') return status === 'unchanged';
    if (filterType === 'techcode')  return status === 'techcode';
    return true;
  });

  const filters = [
    { key: 'all',       label: 'All',           count: stats.total },
    { key: 'missing',   label: '❌ Missing',     count: stats.missing,   color: '#a855f7' },
    { key: 'unchanged', label: '⚠️ Unchanged',   count: stats.unchanged, color: '#f59e0b' },
    { key: 'overflow',  label: '📏 Overflows',   count: stats.overflow,  color: '#ef4444' },
    { key: 'techcode',  label: '🔌 Tech Codes',  count: stats.techcode,  color: '#3b82f6' },
  ];

  return (
    <div className="card" id="section-translate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <h2>Step 3 — Edit Translations</h2>

      {/* Premium Stats Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #c084fc', borderRadius: '100px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
          Total: {stats.total}
        </div>
        <div style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '100px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
          ✅ Translated: {stats.translated}
        </div>
        {stats.unchanged > 0 && (
          <div style={{ background: '#fff7ed', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '100px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
            ⚠️ Unchanged: {stats.unchanged}
          </div>
        )}
        {stats.overflow > 0 && (
          <div style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '100px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
            📏 Overflows: {stats.overflow}
          </div>
        )}
        {stats.techcode > 0 && (
          <div style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: '100px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
            🔌 Tech Codes: {stats.techcode}
          </div>
        )}
        {stats.missing > 0 && (
          <div style={{ background: '#fdf4ff', color: '#9333ea', border: '1px solid #d8b4fe', borderRadius: '100px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
            ❌ Missing: {stats.missing}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#334155', marginBottom: '1rem', lineHeight: 1.45 }}>
        <strong style={{ color: '#7c3aed' }}>⚡ Smart quality detection active</strong> — translations are classified as{' '}
        <span style={{ color: '#059669', fontWeight: 600 }}>Translated</span>,{' '}
        <span style={{ color: '#d97706', fontWeight: 600 }}>Unchanged</span> (same as source — needs review),{' '}
        <span style={{ color: '#2563eb', fontWeight: 600 }}>Tech Code</span> (kept intentionally), or{' '}
        <span style={{ color: '#ef4444', fontWeight: 600 }}>Overflow</span> (too long for bounding box).
      </div>

      {/* Filter Toolbar */}
      <div className="filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              style={{
                fontSize: '0.72rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '100px',
                border: '1px solid',
                borderColor: filterType === f.key ? (f.color || '#7c3aed') : '#cbd5e1',
                background: filterType === f.key ? (f.color ? f.color + '18' : '#f5f3ff') : '#fff',
                color: filterType === f.key ? (f.color || '#7c3aed') : '#475569',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              {f.label}{f.count !== undefined && f.key !== 'all' ? ` (${f.count})` : ''}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search texts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            color: '#334155',
            padding: '0.45rem 0.75rem',
            fontSize: '0.8rem',
            width: '100%',
            maxWidth: '240px'
          }}
        />
      </div>

      {/* Translations Table */}
      <div className="table-wrap" style={{ overflowX: 'auto', maxHeight: '420px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.25rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ID</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}>Source</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }}>Translation</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLabels.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontStyle: 'italic' }}>
                  No text segments match the active search/filters.
                </td>
              </tr>
            ) : (
              filteredLabels.map((label) => {
                const status = getLabelStatus(label);
                const cfg = STATUS_CONFIG[status];
                return (
                  <tr
                    key={label.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: cfg.bg,
                      transition: 'background-color 0.1s'
                    }}
                  >
                    <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      {label.id.substring(0, 5)}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', color: '#0f172a', fontWeight: 600, maxWidth: '180px', wordBreak: 'break-word' }}>
                      {label.source}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', minWidth: '200px' }}>
                      <input
                        type="text"
                        value={label.translation || ''}
                        placeholder="Enter translation..."
                        onChange={(e) => onTranslationChange(label.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.8rem',
                          border: `1.5px solid ${cfg.border}`,
                          borderRadius: '6px',
                          background: '#fff',
                          color: '#0f172a',
                          outline: 'none'
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block',
                        background: cfg.badge,
                        color: cfg.badgeText,
                        border: `1px solid ${cfg.border}`,
                        borderRadius: '4px',
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => onViewInCanvas(label.id)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.72rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: 'transparent'
                        }}
                      >
                        View 👁️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={onProceedClick}
          style={{ margin: 0, padding: '0.6rem 1.5rem', cursor: 'pointer' }}
        >
          Proceed to Visual Editor ▶
        </button>
      </div>
    </div>
  );
}
