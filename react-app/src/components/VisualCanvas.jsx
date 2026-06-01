import { useState, useEffect, useRef } from 'react';

export default function VisualCanvas({
  svgText,
  labels,
  onLabelUpdate,
  selectedLabelId,
  setSelectedLabelId,
  onProceedClick
}) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);

  const [zoomScale, setZoomScale] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

  const [overlapsEnabled, setOverlapsEnabled] = useState(false);
  const [globalScale, setGlobalScale] = useState(1.0);
  const [overlapCount, setOverlapCount] = useState(0);

  // Sync selected label data to sidebar form state
  const selectedLabel = labels.find(l => l.id === selectedLabelId);

  // ── 1. Apply Translations & Overrides directly to DOM ──
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // Ensure text-halo filter exists in the SVG defs
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      ensureHaloFilter(svgEl);
    }

    labels.forEach((label) => {
      const ts = container.querySelector(`[data-label-id="${label.id}"]`);
      if (!ts) return;

      // Update text
      const newText = label.translation || label.source;
      if (ts.textContent !== newText) {
        ts.textContent = newText;
      }

      // Update font size (multiply by global scale)
      const fs = label.fontSizeOverride !== undefined 
        ? label.fontSizeOverride 
        : label.baseFontSize;
      ts.style.fontSize = (fs * globalScale) + 'px';

      // Update dx/dy offsets
      if (label.dxOverride !== undefined) {
        ts.setAttribute('dx', label.dxOverride);
      } else {
        ts.removeAttribute('dx');
      }

      if (label.dyOverride !== undefined) {
        ts.setAttribute('dy', label.dyOverride);
      } else {
        ts.removeAttribute('dy');
      }

      // Update letter spacing
      if (label.letterSpacingOverride !== undefined) {
        ts.style.letterSpacing = label.letterSpacingOverride + 'px';
      } else {
        ts.style.letterSpacing = '';
      }

      // Update halo glow filter
      if (label.haloOverride) {
        ts.setAttribute('filter', 'url(#text-halo)');
      } else {
        ts.removeAttribute('filter');
      }
    });

    // Redraw bounding boxes
    updateHighlights();
  }, [labels, globalScale]);

  // ── 2. Handle Highlights & Overlaps ──
  const updateHighlights = () => {
    const container = contentRef.current;
    if (!container) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // A. Draw selection highlight
    let selGroup = svgEl.getElementById('selectionHighlight');
    if (selectedLabelId) {
      if (!selGroup) {
        selGroup = svgEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
        selGroup.setAttribute('id', 'selectionHighlight');
        selGroup.setAttribute('style', 'pointer-events: none;');
        svgEl.appendChild(selGroup);
      }
      selGroup.innerHTML = '';

      const targetEl = container.querySelector(`[data-label-id="${selectedLabelId}"]`);
      if (targetEl) {
        const textNode = targetEl.tagName.toLowerCase() === 'text' ? targetEl : targetEl.closest('text') || targetEl;
        const rect = textNode.getBoundingClientRect();
        const coords = getSvgCoordsForRect(svgEl, rect);

        const r = svgEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', coords.x - 3);
        r.setAttribute('y', coords.y - 3);
        r.setAttribute('width', coords.width + 6);
        r.setAttribute('height', coords.height + 6);
        r.setAttribute('fill', 'rgba(59, 130, 246, 0.15)');
        r.setAttribute('stroke', '#3b82f6');
        r.setAttribute('stroke-width', '1.5');
        r.setAttribute('rx', '3');
        r.setAttribute('ry', '3');
        selGroup.appendChild(r);
      }
    } else if (selGroup) {
      selGroup.remove();
    }

    // B. Draw overlaps
    const overlaps = detectOverlapsList();
    setOverlapCount(overlaps.length);

    let ovGroup = svgEl.getElementById('overlapHighlights');
    if (overlapsEnabled && overlaps.length > 0) {
      if (!ovGroup) {
        ovGroup = svgEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
        ovGroup.setAttribute('id', 'overlapHighlights');
        ovGroup.setAttribute('style', 'pointer-events: none;');
        svgEl.appendChild(ovGroup);
      }
      ovGroup.innerHTML = '';

      overlaps.forEach(ov => {
        [ov.el1, ov.el2].forEach(el => {
          const rect = el.getBoundingClientRect();
          const coords = getSvgCoordsForRect(svgEl, rect);

          const r = svgEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
          r.setAttribute('x', coords.x - 2);
          r.setAttribute('y', coords.y - 2);
          r.setAttribute('width', coords.width + 4);
          r.setAttribute('height', coords.height + 4);
          r.setAttribute('fill', 'rgba(239, 68, 68, 0.12)');
          r.setAttribute('stroke', '#ef4444');
          r.setAttribute('stroke-width', '1');
          r.setAttribute('stroke-dasharray', '3,3');
          r.setAttribute('rx', '2');
          r.setAttribute('ry', '2');
          ovGroup.appendChild(r);
        });
      });
    } else if (ovGroup) {
      ovGroup.remove();
    }
  };

  // Helper coordinate conversions
  const getSvgCoordsForRect = (svgEl, clientRect) => {
    const pt1 = svgEl.createSVGPoint();
    pt1.x = clientRect.left;
    pt1.y = clientRect.top;

    const pt2 = svgEl.createSVGPoint();
    pt2.x = clientRect.right;
    pt2.y = clientRect.bottom;

    const matrix = svgEl.getScreenCTM().inverse();
    const svgPt1 = pt1.matrixTransform(matrix);
    const svgPt2 = pt2.matrixTransform(matrix);

    return {
      x: svgPt1.x,
      y: svgPt1.y,
      width: svgPt2.x - svgPt1.x,
      height: svgPt2.y - svgPt1.y
    };
  };

  const ensureHaloFilter = (svgRoot) => {
    let defs = svgRoot.querySelector('defs');
    if (!defs) {
      defs = svgRoot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svgRoot.insertBefore(defs, svgRoot.firstChild);
    }
    if (!defs.querySelector('#text-halo')) {
      const filter = svgRoot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', 'text-halo');
      filter.setAttribute('x', '-15%');
      filter.setAttribute('y', '-15%');
      filter.setAttribute('width', '130%');
      filter.setAttribute('height', '130%');
      filter.innerHTML = `
        <feMorphology in="SourceAlpha" result="dilated" operator="dilate" radius="2" />
        <feFlood flood-color="#ffffff" flood-opacity="1" result="flooded" />
        <feComposite in="flooded" in2="dilated" operator="in" result="outline" />
        <feMerge>
          <feMergeNode in="outline" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      `;
      defs.appendChild(filter);
    }
  };

  const detectOverlapsList = () => {
    const container = contentRef.current;
    if (!container) return [];

    const elements = Array.from(container.querySelectorAll('[data-label-id]'));
    const textNodesMap = new Map();
    elements.forEach(el => {
      const parentText = el.tagName.toLowerCase() === 'text' ? el : el.closest('text');
      if (parentText) {
        if (!textNodesMap.has(parentText)) {
          textNodesMap.set(parentText, []);
        }
        textNodesMap.get(parentText).push(el);
      }
    });

    const rects = [];
    textNodesMap.forEach((tspans, parentText) => {
      let rect = parentText.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        rect = tspans[0].getBoundingClientRect();
      }
      if (rect.width > 0 && rect.height > 0) {
        rects.push({ el: parentText, rect });
      }
    });

    const overlaps = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const r1 = rects[i].rect;
        const r2 = rects[j].rect;
        const tolerance = 1;
        const intersects = !(
          r2.left + tolerance > r1.right - tolerance ||
          r2.right - tolerance < r1.left + tolerance ||
          r2.top + tolerance > r1.bottom - tolerance ||
          r2.bottom - tolerance < r1.top + tolerance
        );
        if (intersects) {
          overlaps.push({ el1: rects[i].el, el2: rects[j].el });
        }
      }
    }
    return overlaps;
  };

  // Wire highlights on selected ID changes
  useEffect(() => {
    updateHighlights();
  }, [selectedLabelId, overlapsEnabled]);

  // ── 3. Zoom & Pan Event math ──
  const handleMouseDown = (e) => {
    // Left-click on empty canvas starts panning
    const isTspanClick = e.target.closest('[data-label-id]');
    if (isTspanClick) {
      const lblId = isTspanClick.getAttribute('data-label-id');
      setSelectedLabelId(lblId);
      return;
    }

    setIsPanning(true);
    setStartDrag({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPanX(e.clientX - startDrag.x);
    setPanY(e.clientY - startDrag.y);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const contentX = (mouseX - panX) / zoomScale;
    const contentY = (mouseY - panY) / zoomScale;

    const newScale = Math.min(Math.max(zoomScale * zoomFactor, 0.15), 8);
    setZoomScale(newScale);
    setPanX(mouseX - contentX * newScale);
    setPanY(mouseY - contentY * newScale);
  };

  const zoomIn = () => {
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const contentX = (cx - panX) / zoomScale;
    const contentY = (cy - panY) / zoomScale;

    const newScale = Math.min(zoomScale * 1.25, 8);
    setZoomScale(newScale);
    setPanX(cx - contentX * newScale);
    setPanY(cy - contentY * newScale);
  };

  const zoomOut = () => {
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const contentX = (cx - panX) / zoomScale;
    const contentY = (cy - panY) / zoomScale;

    const newScale = Math.max(zoomScale / 1.25, 0.15);
    setZoomScale(newScale);
    setPanX(cx - contentX * newScale);
    setPanY(cy - contentY * newScale);
  };

  const zoomToFit = () => {
    const svgEl = contentRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgWidth = svgEl.viewBox.baseVal.width || svgEl.width.baseVal.value || svgEl.clientWidth || 800;
    const svgHeight = svgEl.viewBox.baseVal.height || svgEl.height.baseVal.value || svgEl.clientHeight || 600;

    const rect = viewportRef.current.getBoundingClientRect();
    const scaleX = rect.width / svgWidth;
    const scaleY = rect.height / svgHeight;
    const newScale = Math.min(scaleX, scaleY, 1.0) * 0.95;

    setZoomScale(newScale);
    setPanX((rect.width - svgWidth * newScale) / 2);
    setPanY((rect.height - svgHeight * newScale) / 2);
  };

  const resetZoom = () => {
    setZoomScale(1.0);
    setPanX(0);
    setPanY(0);
  };

  // Run ZoomToFit on initial load
  useEffect(() => {
    zoomToFit();
  }, [svgText]);

  // Sidebar controls modifier helper
  const updateSelectedLabel = (field, value) => {
    if (!selectedLabelId) return;
    onLabelUpdate(selectedLabelId, { [field]: value });
  };

  const clearOverrides = () => {
    if (!selectedLabelId) return;
    onLabelUpdate(selectedLabelId, {
      fontSizeOverride: undefined,
      letterSpacingOverride: undefined,
      dxOverride: undefined,
      dyOverride: undefined,
      haloOverride: false
    });
  };

  return (
    <div className="card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
      <div className="editor-layout">
        
        {/* Left Side: Visual Vector Canvas */}
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button className="toolbar-btn" onClick={zoomIn} title="Zoom In">➕</button>
              <button className="toolbar-btn" onClick={zoomOut} title="Zoom Out">➖</button>
              <button className="toolbar-btn" onClick={zoomToFit} title="Fit to Screen">🔍</button>
              <button className="toolbar-btn" onClick={resetZoom} title="Reset Scale">Reset</button>
              <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: '0.4rem', fontFamily: 'monospace' }}>
                {Math.round(zoomScale * 100)}%
              </span>
            </div>

            <div className="toolbar-group">
              <button 
                className={`toolbar-btn ${overlapsEnabled ? 'active' : ''}`} 
                onClick={() => setOverlapsEnabled(!overlapsEnabled)}
                style={{
                  background: overlapsEnabled ? '#ef4444' : '',
                  color: overlapsEnabled ? '#fff' : '',
                  borderColor: overlapsEnabled ? '#ef4444' : ''
                }}
              >
                ⚠️ Overlaps: {overlapCount}
              </button>

              <div className="control-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ whiteSpace: 'nowrap', marginBottom: '0', fontSize: '0.75rem', color: '#9ca3af' }}>Global Scale:</label>
                <input 
                  type="range" 
                  className="range-slider" 
                  style={{ width: '80px', margin: '0' }} 
                  min="0.5" 
                  max="1.5" 
                  step="0.05" 
                  value={globalScale}
                  onChange={(e) => setGlobalScale(parseFloat(e.target.value))}
                />
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#38bdf8', width: '30px' }}>
                  {globalScale.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          {/* Viewport for SVG vector rendering */}
          <div 
            ref={viewportRef}
            className="canvas-viewport"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            style={{
              flex: 1,
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
              cursor: isPanning ? 'grabbing' : 'grab',
              outline: 'none',
              background: '#0f1117'
            }}
          >
            <div 
              ref={contentRef}
              id="canvasContent"
              dangerouslySetInnerHTML={{ __html: svgText }}
              style={{
                position: 'absolute',
                transformOrigin: '0 0',
                transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`
              }}
            />
          </div>
        </div>

        {/* Right Side: Sidebar Controls */}
        <div className="controls-panel">
          {selectedLabel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="selected-label-title">
                <span>Selected Label</span>
                <span>ID: {selectedLabel.id}</span>
              </div>

              {/* Source (Read-only) */}
              <div className="control-group">
                <label>Original Text</label>
                <textarea 
                  readOnly 
                  value={selectedLabel.source} 
                  style={{
                    background: '#0f1117',
                    border: '1px solid #2d3748',
                    borderRadius: '8px',
                    color: '#9ca3af',
                    padding: '0.5rem',
                    fontSize: '0.78rem',
                    resize: 'none',
                    height: '50px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Translation input */}
              <div className="control-group">
                <label>Translation</label>
                <input 
                  type="text" 
                  value={selectedLabel.translation || ''} 
                  onChange={(e) => updateSelectedLabel('translation', e.target.value)}
                  placeholder="Enter translation..."
                  style={{
                    background: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              {/* Font Size slider */}
              <div className="control-group">
                <div className="control-slider-val">
                  <label>Font Size</label>
                  <span>{selectedLabel.fontSizeOverride !== undefined ? selectedLabel.fontSizeOverride : selectedLabel.baseFontSize}px</span>
                </div>
                <input 
                  type="range" 
                  className="range-slider"
                  min="4" 
                  max="72" 
                  value={selectedLabel.fontSizeOverride !== undefined ? selectedLabel.fontSizeOverride : selectedLabel.baseFontSize} 
                  onChange={(e) => updateSelectedLabel('fontSizeOverride', parseInt(e.target.value))}
                />
              </div>

              {/* Letter Spacing slider */}
              <div className="control-group">
                <div className="control-slider-val">
                  <label>Letter Spacing</label>
                  <span>{selectedLabel.letterSpacingOverride !== undefined ? selectedLabel.letterSpacingOverride : 0}px</span>
                </div>
                <input 
                  type="range" 
                  className="range-slider"
                  min="-3" 
                  max="15" 
                  step="0.5"
                  value={selectedLabel.letterSpacingOverride !== undefined ? selectedLabel.letterSpacingOverride : 0} 
                  onChange={(e) => updateSelectedLabel('letterSpacingOverride', parseFloat(e.target.value))}
                />
              </div>

              {/* Offset DX slider */}
              <div className="control-group">
                <div className="control-slider-val">
                  <label>Offset X (DX)</label>
                  <span>{selectedLabel.dxOverride !== undefined ? selectedLabel.dxOverride : 0}</span>
                </div>
                <input 
                  type="range" 
                  className="range-slider"
                  min="-80" 
                  max="80" 
                  value={selectedLabel.dxOverride !== undefined ? selectedLabel.dxOverride : 0} 
                  onChange={(e) => updateSelectedLabel('dxOverride', parseInt(e.target.value))}
                />
              </div>

              {/* Offset DY slider */}
              <div className="control-group">
                <div className="control-slider-val">
                  <label>Offset Y (DY)</label>
                  <span>{selectedLabel.dyOverride !== undefined ? selectedLabel.dyOverride : 0}</span>
                </div>
                <input 
                  type="range" 
                  className="range-slider"
                  min="-80" 
                  max="80" 
                  value={selectedLabel.dyOverride !== undefined ? selectedLabel.dyOverride : 0} 
                  onChange={(e) => updateSelectedLabel('dyOverride', parseInt(e.target.value))}
                />
              </div>

              {/* Text Halo Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <input 
                  type="checkbox" 
                  id="haloCheck"
                  checked={selectedLabel.haloOverride || false} 
                  onChange={(e) => updateSelectedLabel('haloOverride', e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="haloCheck" style={{ fontSize: '0.78rem', color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
                  Enable text outline (White Halo) 🛡️
                </label>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={clearOverrides} 
                  className="btn btn-ghost" 
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', border: '1px solid #374151', cursor: 'pointer' }}
                >
                  Clear Offsets
                </button>
                <button 
                  onClick={() => setSelectedLabelId(null)} 
                  className="btn btn-ghost" 
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem', border: '1px solid #374151', cursor: 'pointer' }}
                >
                  Deselect
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-selection-msg">
              🎯 Click any text in the vector drawing on the left, or select from the table, to edit values visually.
            </div>
          )}

          {/* Bottom section proceed */}
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #1f2937' }}>
            <button 
              className="btn btn-primary" 
              onClick={onProceedClick} 
              style={{ width: '100%', margin: '0', padding: '0.65rem', cursor: 'pointer' }}
            >
              Proceed to QA &amp; Export ▶
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
