import { useState } from 'react';

export default function TranslationTable({
  labels,
  onTranslationChange,
  onViewInCanvas,
  onProceedClick
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'missing' | 'flagged'

  const filteredLabels = labels.filter((label) => {
    // 1. Apply search query filter
    const matchesSearch = label.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (label.translation && label.translation.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Apply category filters
    if (filterType === 'missing') {
      return !label.translation || label.translation.trim() === '';
    }
    if (filterType === 'flagged') {
      return label.is_flagged;
    }

    return true;
  });

  const getStats = () => {
    const total = labels.length;
    const translated = labels.filter(l => l.translation && l.translation.trim() !== '').length;
    const flagged = labels.filter(l => l.is_flagged).length;
    return { total, translated, flagged };
  };

  const { total, translated, flagged } = getStats();

  return (
    <div className="card" id="section-translate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <h2>Step 3 — Edit Translations</h2>
      
      {/* Realtime Stats chip row */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #c084fc', borderRadius: '100px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
          Total Segments: {total}
        </div>
        <div style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '100px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
          Translated: {translated} / {total}
        </div>
        {flagged > 0 && (
          <div style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '100px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>
            ⚠️ Overflows: {flagged}
          </div>
        )}
      </div>

      <div className="info-box" style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '0.75rem',
        fontSize: '0.78rem',
        color: '#334155',
        marginBottom: '1rem',
        lineHeight: 1.4
      }}>
        <strong style={{ color: '#7c3aed' }}>⚡ Smart overflow detection active</strong> — translations longer than their original bounding boxes are flagged. Use the visual editor in the next step to fit them.
      </div>

      {/* Filter Toolbar & Search */}
      <div className="filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
            style={{
              fontSize: '0.72rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '100px',
              border: '1px solid',
              borderColor: filterType === 'all' ? '#7c3aed' : '#cbd5e1',
              background: filterType === 'all' ? '#f5f3ff' : '#fff',
              color: filterType === 'all' ? '#7c3aed' : '#475569',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterType === 'missing' ? 'active' : ''}`}
            onClick={() => setFilterType('missing')}
            style={{
              fontSize: '0.72rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '100px',
              border: '1px solid',
              borderColor: filterType === 'missing' ? '#7c3aed' : '#cbd5e1',
              background: filterType === 'missing' ? '#f5f3ff' : '#fff',
              color: filterType === 'missing' ? '#7c3aed' : '#475569',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Untranslated
          </button>
          <button
            className={`filter-btn ${filterType === 'flagged' ? 'active' : ''}`}
            onClick={() => setFilterType('flagged')}
            style={{
              fontSize: '0.72rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '100px',
              border: '1px solid',
              borderColor: filterType === 'flagged' ? '#7c3aed' : '#cbd5e1',
              background: filterType === 'flagged' ? '#f5f3ff' : '#fff',
              color: filterType === 'flagged' ? '#7c3aed' : '#475569',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Flagged Overflows
          </button>
        </div>

        <input
          type="text"
          className="search-bar"
          placeholder="Search texts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: '#ffffff',
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

      {/* Translations Grid Table */}
      <div className="table-wrap" style={{ overflowX: 'auto', maxHeight: '420px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '1.25rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>ID</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>Source (English)</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' }}>Translation</th>
              <th style={{ padding: '0.6rem 0.8rem', color: '#475569', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLabels.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontStyle: 'italic' }}>
                  No text segments match the active search/filters.
                </td>
              </tr>
            ) : (
              filteredLabels.map((label) => (
                <tr
                  key={label.id}
                  className={label.is_flagged ? 'row-flagged' : ''}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: label.is_flagged ? '#fef2f2' : 'transparent',
                    transition: 'background-color 0.1s'
                  }}
                >
                  <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                    {label.id.substring(0, 5)}
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#0f172a', fontWeight: 500, maxWidth: '200px', wordBreak: 'break-word' }}>
                    {label.source}
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <input
                      type="text"
                      className={`trans-input ${label.translation ? 'filled' : ''}`}
                      value={label.translation || ''}
                      placeholder="Enter translation..."
                      onChange={(e) => onTranslationChange(label.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.8rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        background: label.translation ? '#f0fdf4' : '#fff',
                        borderColor: label.is_flagged ? '#ef4444' : label.translation ? '#10b981' : '#cbd5e1'
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
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
              ))
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
