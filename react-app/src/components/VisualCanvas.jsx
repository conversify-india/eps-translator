import { useState, useEffect, useRef } from 'react';

export default function VisualCanvas({
  svgText,
  labels,
  onLabelUpdate,
  onBulkLabelUpdate,
  selectedLabelId,
  setSelectedLabelId,
  onProceedClick,
  hasVectorOutlines,
  hideSidebar = false
}) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const wheelStateRef = useRef({ zoomScale: 1.0, panX: 0, panY: 0 });

  const [zoomScale, setZoomScale] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

  useEffect(() => {
    wheelStateRef.current = { zoomScale, panX, panY };
  }, [zoomScale, panX, panY]);

  const [overlapsEnabled, setOverlapsEnabled] = useState(false);
  const [globalScale, setGlobalScale] = useState(1.0);
  const [overlapCount, setOverlapCount] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [applyToAllSameSource, setApplyToAllSameSource] = useState(true);
  const [forceTextVisible, setForceTextVisible] = useState(true);

  // HTML overlay selection highlight bounds state
  const [highlightRect, setHighlightRect] = useState(null);

  const updateHighlightPosition = () => {
    if (!selectedLabelId) {
      setHighlightRect(null);
      return;
    }
    const container = contentRef.current;
    if (!container) return;

    const targetEl = container.querySelector(`[data-label-id="${selectedLabelId}"]`);
    if (targetEl) {
      const textNode = targetEl.tagName.toLowerCase() === 'text' ? targetEl : targetEl.closest('text') || targetEl;
      const targetRect = textNode.getBoundingClientRect();
      const contentRect = container.getBoundingClientRect();

      if (targetRect.width > 0 && targetRect.height > 0) {
        setHighlightRect({
          left: (targetRect.left - contentRect.left) / zoomScale,
          top: (targetRect.top - contentRect.top) / zoomScale,
          width: targetRect.width / zoomScale,
          height: targetRect.height / zoomScale
        });
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  };

  // Keep highlight box position and size synced with browser layout cycles
  useEffect(() => {
    let animFrame;
    const update = () => {
      updateHighlightPosition();
    };
    animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, [selectedLabelId, labels, globalScale, zoomScale]);

  // Sync selected label data to sidebar form state
  const selectedLabel = labels.find(l => l.id === selectedLabelId);

  // ── 0a. Inject SVG HTML into DOM ──
  // Only re-injects when the SVG source actually changes (new file upload).
  // Label-ID stamping is handled separately below so it runs independently.
  const svgInjectedRef = useRef('');
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !svgText) return;
    if (svgInjectedRef.current === svgText) return;
    svgInjectedRef.current = svgText;
    container.innerHTML = svgText;
  }, [svgText]);

  // ── 0b. Stamp data-label-id attributes into the live DOM ──
  // Runs whenever labels OR svgText changes so interactivity is always wired up,
  // including after navigating away and back to Step 4.
  // The exported SVG (built in QAReport from originalSvgText) never contains
  // these attributes — they only power the editor.
  useEffect(() => {
    const container = contentRef.current;
    if (!container || labels.length === 0) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Build lookup: source text -> label id (since labels has unique source texts, map source to label id directly)
    const sourceToId = new Map();
    labels.forEach(label => {
      const key = (label.source || '').trim();
      if (!key) return;
      sourceToId.set(key, label.id);
    });

    // Clear previously stamped IDs for a clean reassignment
    svgEl.querySelectorAll('[data-label-id]').forEach(el => {
      el.removeAttribute('data-label-id');
    });

    // Walk all leaf text/tspan nodes and stamp matching label IDs
    const walker = document.createTreeWalker(
      svgEl,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          const tag = node.tagName && node.tagName.toLowerCase();
          return (tag === 'text' || tag === 'tspan')
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      // Leaf nodes only — skip parent wrappers containing child elements
      const hasChildEl = Array.from(node.childNodes).some(c => c.nodeType === 1);
      if (hasChildEl) continue;

      const content = (node.textContent || '').trim();
      if (!content) continue;

      const labelId = sourceToId.get(content);
      if (labelId) {
        node.setAttribute('data-label-id', labelId);

        // Also stamp the parent <text> node if this is a <tspan>
        const parentText = node.tagName.toLowerCase() === 'text' ? node : node.closest('text');
        if (parentText) {
          parentText.setAttribute('data-label-id', labelId);
        }
      }
    }
  }, [svgText, labels]);

  // Run ZoomToFit on initial load
  useEffect(() => {
    zoomToFit();
  }, [svgText]);

  // ── 1. Apply Translations & Overrides directly to DOM ──

  // Helper: detect if text contains non-Latin scripts needing special fonts
  const needsNotoFont = (text) => {
    // Cyrillic, CJK, Hiragana, Katakana, Devanagari, Arabic, Hebrew, Korean
    return /[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0900-\u097F\u0600-\u06FF\u0590-\u05FF\uAC00-\uD7AF]/.test(text);
  };

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // Ensure text-halo filter exists in the SVG defs
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      ensureHaloFilter(svgEl);
    }

    labels.forEach((label) => {
      const targets = container.querySelectorAll(`[data-label-id="${label.id}"]`);
      if (targets.length === 0) {
        console.warn(`[VisualCanvas] Elements not found for ID: ${label.id}`);
        return;
      }

      targets.forEach(ts => {
        // Update text
        const newText = label.translation || label.source;
        if (ts.textContent !== newText) {
          console.log(`[VisualCanvas] Updating text node ID ${label.id} from "${ts.textContent}" to "${newText}"`);
          ts.textContent = newText;

          // Force browser layout reflow/redraw for SVG text element (fixes Chrome redraw bug)
          try {
            const parentText = ts.closest('text');
            if (parentText) {
              const currentY = parentText.getAttribute('y');
              if (currentY) {
                parentText.setAttribute('y', String(parseFloat(currentY) + 0.0001));
                setTimeout(() => {
                  if (parentText.isConnected) {
                    parentText.setAttribute('y', currentY);
                  }
                }, 0);
              }
            }
          } catch (e) {
            // ignore reflow errors
          }
        }

        // Determine base font size (fallback if baseFontSize is missing/NaN)
        let baseSize = label.baseFontSize;
        if (baseSize === undefined || isNaN(baseSize)) {
          const fsAttr = ts.getAttribute('font-size') || ts.style.fontSize;
          if (fsAttr) {
            baseSize = parseFloat(fsAttr);
          } else {
            const parentText = ts.closest('text');
            if (parentText) {
              const parentFs = parentText.getAttribute('font-size') || parentText.style.fontSize;
              if (parentFs) baseSize = parseFloat(parentFs);
            }
          }
        }
        if (!baseSize || isNaN(baseSize)) {
          baseSize = 12; // final fallback
        }

        // Update font size (multiply by global scale)
        const fs = label.fontSizeOverride !== undefined 
          ? label.fontSizeOverride 
          : baseSize;
        const renderedFs = fs * globalScale;
        ts.style.fontSize = renderedFs + 'px';

        // ── Smart font-family: ONLY switch to Noto for non-Latin scripts ──
        const translatedText = label.translation || label.source;
        if (needsNotoFont(translatedText)) {
          ts.style.fontFamily = "'Noto Sans', 'Noto Sans Devanagari', 'Noto Naskh Arabic', 'Noto Sans CJK SC', Arial, sans-serif";
        } else {
          ts.style.fontFamily = '';
        }

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

        // ── Halo filter: only apply to labels that explicitly need it ──
        const parentTextEl = ts.tagName.toLowerCase() === 'text' ? ts : ts.closest('text');
        const needsHalo = label.haloOverride || (forceTextVisible && label.isOriginalInvisible);
        if (needsHalo) {
          ts.setAttribute('filter', 'url(#text-halo)');
          if (parentTextEl && parentTextEl !== ts) {
            parentTextEl.setAttribute('filter', 'url(#text-halo)');
          }
        } else {
          ts.removeAttribute('filter');
          if (parentTextEl && parentTextEl !== ts) {
            parentTextEl.removeAttribute('filter');
          }
        }

        // Update visibility & color overrides for vectorized elements
        if (forceTextVisible) {
          ts.style.fill = label.textColorOverride || 'currentColor';
          ts.style.opacity = '1';
          ts.style.fillOpacity = '1';
          ts.style.visibility = 'visible';
          ts.style.display = 'inline';

          // ── CRITICAL FIX: Traverse ALL ancestor elements up to SVG root ──
          const svgRoot = ts.closest('svg');
          let ancestor = ts.parentElement;
          while (ancestor && ancestor !== svgRoot && ancestor !== container) {
            const tag = ancestor.tagName.toLowerCase();
            ancestor.style.opacity = '1';
            ancestor.style.visibility = 'visible';
            ancestor.style.display = tag === 'g' ? 'inline' : ancestor.style.display || '';
            if (tag === 'text') {
              if (ancestor.getAttribute('fill') === 'none' && !label.textColorOverride) {
                ancestor.style.fill = 'currentColor';
              } else {
                ancestor.style.fill = label.textColorOverride || ancestor.style.fill || '';
              }
            }
            ancestor = ancestor.parentElement;
          }
        } else {
          if (label.isOriginalInvisible) {
            ts.style.fill = 'none';
            ts.style.opacity = '0';
            ts.style.fillOpacity = '0';
            const parentText = ts.closest('text');
            if (parentText) {
              parentText.style.fill = 'none';
              parentText.style.opacity = '0';
              parentText.style.fillOpacity = '0';
            }
          } else {
            ts.style.fill = label.textColorOverride || '';
            ts.style.opacity = '';
            ts.style.fillOpacity = '';
            const parentText = ts.closest('text');
            if (parentText) {
              parentText.style.fill = label.textColorOverride || '';
              parentText.style.opacity = '';
              parentText.style.fillOpacity = '';
            }
          }
        }
      });
    });

    // ── Inject white mask rects for EPS mode ──
    const NS = 'http://www.w3.org/2000/svg';
    
    // First, always remove old sibling masks
    labels.forEach(label => {
      const targets = container.querySelectorAll(`[data-label-id="${label.id}"]`);
      targets.forEach(ts => {
        const textEl = ts.tagName.toLowerCase() === 'text' ? ts : ts.closest('text');
        if (!textEl || !textEl.parentNode) return;
        const oldMask = textEl.parentNode.querySelector(`rect[data-mask-for="${label.id}"]`);
        if (oldMask) oldMask.remove();
      });
    });

    if (svgEl && forceTextVisible) {
      labels.forEach(label => {
        const targets = container.querySelectorAll(`[data-label-id="${label.id}"]`);
        targets.forEach(ts => {
          const textEl = ts.tagName.toLowerCase() === 'text' ? ts : ts.closest('text');
          if (!textEl || !textEl.parentNode) return;
          try {
            const bbox = textEl.getBBox();
            if (bbox.width < 1 && bbox.height < 1) return;
            const pad = Math.max(bbox.height * 0.25, 2);
            const rect = svgEl.ownerDocument.createElementNS(NS, 'rect');
            rect.setAttribute('data-mask-for', label.id);
            rect.setAttribute('x',      (bbox.x - pad).toFixed(3));
            rect.setAttribute('y',      (bbox.y - pad).toFixed(3));
            rect.setAttribute('width',  (bbox.width  + pad * 2).toFixed(3));
            rect.setAttribute('height', (bbox.height + pad * 2).toFixed(3));
            rect.setAttribute('fill', 'white');
            rect.setAttribute('style', 'pointer-events: none;');
            
            textEl.parentNode.insertBefore(rect, textEl);
          } catch (_) {
            // ignore
          }
        });
      });
    }

    // Redraw bounding boxes
    updateHighlights();
  }, [labels, globalScale, forceTextVisible]);

  // ── 2. Handle Highlights & Overlaps ──
  const updateHighlights = () => {
    const container = contentRef.current;
    if (!container) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    // Clean up old selection highlight group if it exists in SVG
    const oldSelGroup = svgEl.getElementById('selectionHighlight');
    if (oldSelGroup) {
      oldSelGroup.remove();
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

    const ctm = svgEl.getScreenCTM();
    if (!ctm) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const matrix = ctm.inverse();
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
    // Remove stale filter so we always recreate with the correct radius
    const existing = defs.querySelector('#text-halo');
    if (existing) existing.remove();

    const filter = svgRoot.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'text-halo');
    filter.setAttribute('x', '-25%');
    filter.setAttribute('y', '-25%');
    filter.setAttribute('width', '150%');
    filter.setAttribute('height', '150%');
    // radius=6 gives a thick enough white background to cover typical EPS vector path strokes
    filter.innerHTML = `
      <feMorphology in="SourceAlpha" result="dilated" operator="dilate" radius="6" />
      <feFlood flood-color="#ffffff" flood-opacity="1" result="flooded" />
      <feComposite in="flooded" in2="dilated" operator="in" result="outline" />
      <feMerge>
        <feMergeNode in="outline" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    `;
    defs.appendChild(filter);
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
    const { zoomScale: currentScale, panX: currentPanX, panY: currentPanY } = wheelStateRef.current;
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const contentX = (mouseX - currentPanX) / currentScale;
    const contentY = (mouseY - currentPanY) / currentScale;

    const newScale = Math.min(Math.max(currentScale * zoomFactor, 0.15), 8);
    setZoomScale(newScale);
    setPanX(mouseX - contentX * newScale);
    setPanY(mouseY - contentY * newScale);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheelEvent = (e) => {
      handleWheel(e);
    };

    viewport.addEventListener('wheel', onWheelEvent, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', onWheelEvent);
    };
  }, []);

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

    let svgWidth = 800;
    let svgHeight = 600;

    if (svgEl.viewBox && svgEl.viewBox.baseVal) {
      svgWidth = svgEl.viewBox.baseVal.width || svgWidth;
      svgHeight = svgEl.viewBox.baseVal.height || svgHeight;
    } else {
      const wAttr = svgEl.getAttribute('width');
      const hAttr = svgEl.getAttribute('height');
      if (wAttr && hAttr) {
        svgWidth = parseFloat(wAttr) || svgWidth;
        svgHeight = parseFloat(hAttr) || svgHeight;
      } else {
        svgWidth = svgEl.clientWidth || svgWidth;
        svgHeight = svgEl.clientHeight || svgHeight;
      }
    }

    const rect = viewportRef.current.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const scaleX = rect.width / svgWidth;
    const scaleY = rect.height / svgHeight;
    const newScale = Math.min(scaleX, scaleY, 1.0) * 0.95;

    if (!isNaN(newScale) && isFinite(newScale)) {
      setZoomScale(newScale);
      setPanX((rect.width - svgWidth * newScale) / 2);
      setPanY((rect.height - svgHeight * newScale) / 2);
    }
  };

  const resetZoom = () => {
    setZoomScale(1.0);
    setPanX(0);
    setPanY(0);
  };



  // Sidebar controls modifier helper
  const updateSelectedLabel = (field, value) => {
    if (!selectedLabelId) return;
    if (applyToAllSameSource) {
      const targetSource = selectedLabel.source;
      const idsToUpdate = labels.filter(l => l.source === targetSource).map(l => l.id);
      onLabelUpdate(idsToUpdate, { [field]: value });
    } else {
      onLabelUpdate(selectedLabelId, { [field]: value });
    }
  };

  const clearOverrides = () => {
    if (!selectedLabelId) return;
    const overrides = {
      fontSizeOverride: undefined,
      letterSpacingOverride: undefined,
      dxOverride: undefined,
      dyOverride: undefined,
      haloOverride: false,
      textColorOverride: undefined
    };
    if (applyToAllSameSource) {
      const targetSource = selectedLabel.source;
      const idsToUpdate = labels.filter(l => l.source === targetSource).map(l => l.id);
      onLabelUpdate(idsToUpdate, overrides);
    } else {
      onLabelUpdate(selectedLabelId, overrides);
    }
  };

  // ── Auto-Fit: shrink overflowing labels to fit their original spatial allocation ──
  const [isAutoFitting, setIsAutoFitting] = useState(false);

  const handleAutoFit = () => {
    const container = contentRef.current;
    if (!container || !onBulkLabelUpdate) return;

    setIsAutoFitting(true);

    // Let the DOM fully settle with current translations before measuring
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const updates = [];

        labels.forEach(label => {
          const ts = container.querySelector(`[data-label-id="${label.id}"]`);
          if (!ts) return;
          const rect = ts.getBoundingClientRect();
          if (rect.width === 0) return; // invisible, skip

          const src = (label.source || '').trim();
          const trn = (label.translation || label.source || '').trim();

          if (!trn || src === trn) return; // unchanged — no scaling needed

          const srcLen = src.length;
          const trnLen = trn.length;
          if (trnLen === 0 || srcLen === 0) return;

          // Only shrink labels where translation is longer than source
          const lengthRatio = srcLen / trnLen;
          if (lengthRatio >= 1) return; // translated is same length or shorter — fits fine

          let baseFs = label.baseFontSize;
          if (baseFs === undefined || isNaN(baseFs)) {
            const fsAttr = ts.getAttribute('font-size') || ts.style.fontSize;
            if (fsAttr) {
              baseFs = parseFloat(fsAttr);
            } else {
              const parentText = ts.closest('text');
              if (parentText) {
                const parentFs = parentText.getAttribute('font-size') || parentText.style.fontSize;
                if (parentFs) baseFs = parseFloat(parentFs);
              }
            }
          }
          if (!baseFs || isNaN(baseFs)) {
            baseFs = 12; // fallback
          }

          const currentFs = label.fontSizeOverride !== undefined
            ? label.fontSizeOverride
            : baseFs;

          // Scale font down proportionally, floor at 40% of original baseFontSize
          const targetFs = Math.max(
            currentFs * lengthRatio,
            baseFs * 0.4
          );

          if (Math.abs(targetFs - currentFs) > 0.2) {
            updates.push({
              id: label.id,
              fontSizeOverride: parseFloat(targetFs.toFixed(2)),
              is_flagged: false
            });
          }
        });

        if (updates.length > 0) {
          onBulkLabelUpdate(updates);
        }

        setIsAutoFitting(false);
      });
    });
  };

  const handleResetFontSizes = () => {
    if (!onBulkLabelUpdate) return;
    const resets = labels.map(l => ({
      id: l.id,
      fontSizeOverride: undefined,
      is_flagged: (l.translation || '').trim().length > (l.source || '').trim().length
    }));
    onBulkLabelUpdate(resets);
  };

  const handleProceed = () => {
    const container = contentRef.current;
    if (container && onBulkLabelUpdate) {
      const updates = [];
      labels.forEach(label => {
        const ts = container.querySelector(`[data-label-id="${label.id}"]`);
        if (ts) {
          const textEl = ts.tagName.toLowerCase() === 'text' ? ts : ts.closest('text');
          if (textEl) {
            try {
              const bbox = textEl.getBBox();
              if (bbox.width > 0 && bbox.height > 0) {
                updates.push({
                  id: label.id,
                  bbox: {
                    x: parseFloat(bbox.x.toFixed(3)),
                    y: parseFloat(bbox.y.toFixed(3)),
                    width: parseFloat(bbox.width.toFixed(3)),
                    height: parseFloat(bbox.height.toFixed(3))
                  }
                });
              }
            } catch (e) {
              // ignore
            }
          }
        }
      });
      if (updates.length > 0) {
        onBulkLabelUpdate(updates);
      }
    }
    onProceedClick();
  };


  return (
    <div className="card" id="section-visual-canvas" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
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

            <div className="toolbar-group" style={{ gap: '0.4rem' }}>
              <button 
                className={`toolbar-btn ${forceTextVisible ? 'active' : ''}`} 
                onClick={() => setForceTextVisible(!forceTextVisible)}
                style={{
                  background: forceTextVisible ? '#7c3aed' : '',
                  color: forceTextVisible ? '#fff' : '',
                  borderColor: forceTextVisible ? '#7c3aed' : ''
                }}
                title="Force Vector Outline Texts to be Visible"
              >
                👁️ Force Text Visible
              </button>

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

              {/* Auto-Fit button */}
              <button
                className="toolbar-btn"
                onClick={handleAutoFit}
                disabled={isAutoFitting}
                title="Auto-shrink overflowing translated labels to fit their original space"
                style={{
                  background: isAutoFitting ? '#f3e8ff' : '#ecfdf5',
                  color: isAutoFitting ? '#7c3aed' : '#059669',
                  borderColor: isAutoFitting ? '#a78bfa' : '#6ee7b7',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {isAutoFitting ? '⏳ Fitting...' : '✨ Auto-Fit'}
              </button>

              {/* Reset font sizes button */}
              <button
                className="toolbar-btn"
                onClick={handleResetFontSizes}
                title="Reset all font size overrides back to original"
                style={{
                  background: '#fff7ed',
                  color: '#d97706',
                  borderColor: '#fcd34d',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                ↺ Reset Sizes
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
            style={{
              flex: 1,
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
              cursor: isPanning ? 'grabbing' : 'grab',
              outline: 'none'
            }}
          >
            <div 
              ref={contentRef}
              id="canvasContent"
              className="canvas-content"
              style={{
                position: 'absolute',
                transformOrigin: '0 0',
                transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`
              }}
            />
            {highlightRect && (
              <div 
                style={{
                  position: 'absolute',
                  transformOrigin: '0 0',
                  transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
                  left: `${highlightRect.left - 5}px`,
                  top: `${highlightRect.top - 2}px`,
                  width: `${highlightRect.width + 10}px`,
                  height: `${highlightRect.height + 4}px`,
                  border: '2px solid #3b82f6',
                  background: 'rgba(59, 130, 246, 0.14)',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
                  boxSizing: 'border-box',
                  transition: 'left 0.08s ease, top 0.08s ease, width 0.08s ease, height 0.08s ease'
                }}
              />
            )}
          </div>
        </div>

        {/* Right Side: Sidebar Controls */}
        {!hideSidebar && (
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

              {/* Batch edit identical labels checkbox */}
              {(() => {
                const identicalCount = labels.filter(l => l.source === selectedLabel.source).length;
                if (identicalCount <= 1) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '-0.25rem 0 0.25rem 0' }}>
                    <input 
                      type="checkbox" 
                      id="applyToAllCheck"
                      checked={applyToAllSameSource} 
                      onChange={(e) => setApplyToAllSameSource(e.target.checked)}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <label htmlFor="applyToAllCheck" style={{ fontSize: '0.76rem', color: '#a78bfa', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                      Apply edits to all {identicalCount} identical labels
                    </label>
                  </div>
                );
              })()}

              {/* Font Size slider */}
              <div className="control-group">
                <div className="control-slider-val">
                  <label>Font Size</label>
                  <span>{Number(selectedLabel.fontSizeOverride !== undefined ? selectedLabel.fontSizeOverride : (selectedLabel.baseFontSize || 12)).toFixed(1)}px</span>
                </div>
                <input 
                  type="range" 
                  className="range-slider"
                  min="0.5" 
                  max="72" 
                  step="0.1"
                  value={selectedLabel.fontSizeOverride !== undefined ? selectedLabel.fontSizeOverride : (selectedLabel.baseFontSize || 12)} 
                  onChange={(e) => updateSelectedLabel('fontSizeOverride', parseFloat(e.target.value))}
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

              {/* Text Color Selector */}
              <div className="control-group">
                <div className="control-slider-val">
                  <label>Text Color</label>
                </div>
                <select 
                  value={selectedLabel.textColorOverride || 'currentColor'} 
                  onChange={(e) => updateSelectedLabel('textColorOverride', e.target.value)}
                  style={{
                    background: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    width: '100%',
                    outline: 'none'
                  }}
                >
                  <option value="currentColor">Auto (Current Color)</option>
                  <option value="#000000">⬛ Black</option>
                  <option value="#ffffff">⬜ White</option>
                  <option value="#1e3a8a">🟦 Dark Blue</option>
                  <option value="#b91c1c">🟥 Red</option>
                  <option value="#15803d">🟩 Green</option>
                  <option value="#b45309">🟨 Amber</option>
                </select>
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
              onClick={handleProceed} 
              style={{ width: '100%', margin: '0', padding: '0.65rem', cursor: 'pointer' }}
            >
              Proceed to QA &amp; Export ▶
            </button>
          </div>
          </div>
        )}
      </div>

      {/* Collapsible User Guide Card */}
      <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setIsGuideOpen(!isGuideOpen)}
        >
          <h2 style={{ margin: 0, fontSize: '0.85rem', color: '#1e293b' }}>📖 Interactive User Guide &amp; Workflow Instructions</h2>
          <span style={{ color: '#7c3aed', fontSize: '0.8rem', fontWeight: 600 }}>{isGuideOpen ? '▲ Hide' : '▼ Show'}</span>
        </div>
        
        {isGuideOpen && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#7c3aed', marginBottom: '0.75rem', fontWeight: 700 }}>
              🎨 Live Visual Editor Guide (Primary Workflow)
            </h3>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.6' }}>
              Our <b>Live Visual Editor</b> lets you adjust translations and fix overlaps directly in the browser. You do not need to open Inkscape for layout fixes!
            </div>

            <div className="guide-step">
              <div className="guide-num">A</div>
              <div>
                <div className="guide-title">Selecting &amp; Translating Text</div>
                <div className="guide-body">
                  Click any text block directly on the vector diagram, or select a row in the Translation Table. In the sidebar panel on the right, you can type a custom translation to update it instantly.
                </div>
              </div>
            </div>

            <div className="guide-step">
              <div className="guide-num">B</div>
              <div>
                <div className="guide-title">Screen-Aligned Nudging (Move Text)</div>
                <div className="guide-body">
                  Click a label and use your keyboard <b>Arrow keys</b> (hold <code>Shift</code> for larger steps) or slide the <b>Offset X (DX)</b> and <b>Offset Y (DY)</b> controls to adjust its position. Because nudging is screen-aligned, the text always slides in the direction you push it, even if it is rotated!
                </div>
              </div>
            </div>

            <div className="guide-step">
              <div className="guide-num">C</div>
              <div>
                <div className="guide-title">Background Masking (Clear Wires &amp; Circles)</div>
                <div className="guide-body">
                  If text crosses over lines, wires, or circles in the diagram, check <b>Enable text outline (White Halo)</b> in the sidebar controls. This puts a clean white background halo behind the letters to block out underlying vector lines and make the text readable.
                </div>
              </div>
            </div>

            <div className="guide-step">
              <div className="guide-num">D</div>
              <div>
                <div className="guide-title">Individual &amp; Global Resizing</div>
                <div className="guide-body">
                  Adjust the <b>Font Size</b> and <b>Letter Spacing</b> sliders in the sidebar to resize a single text label, or slide the <b>Global Scale</b> slider in the top toolbar to shrink or enlarge all texts across the diagram to fix overall layout density.
                </div>
              </div>
            </div>

            <div className="guide-step" style={{ borderBottom: 'none' }}>
              <div className="guide-num">E</div>
              <div>
                <div className="guide-title">Overlap Highlighting &amp; Resets</div>
                <div className="guide-body">
                  Toggle <b>⚠️ Highlight Overlaps</b> in the top toolbar to outline colliding text blocks in red. Click <b>Clear Offsets</b> to restore default style overrides, or click <b>Deselect</b> to clear your current selection.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
