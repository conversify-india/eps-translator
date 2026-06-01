/**
 * Utility for parsing SVG files and extracting text metadata
 */

export function parseSVGString(text) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(text, 'image/svg+xml');
  const NS = 'http://www.w3.org/2000/svg';

  // 1. Wrap all direct text node children of <text> elements into <tspan> elements
  const texts = Array.from(svgDoc.getElementsByTagNameNS(NS, 'text'));
  texts.forEach(parentText => {
    const childNodes = Array.from(parentText.childNodes);
    childNodes.forEach(child => {
      if (child.nodeType === 3 && child.textContent.trim() !== '') {
        const tspan = svgDoc.createElementNS(NS, 'tspan');
        tspan.textContent = child.textContent;
        parentText.replaceChild(tspan, child);
      }
    });
  });

  // 2. Split <text> elements containing multiple <tspan> nodes
  const textsToSplit = Array.from(svgDoc.getElementsByTagNameNS(NS, 'text'));
  textsToSplit.forEach(parentText => {
    const children = Array.from(parentText.childNodes);
    const tspansInText = children.filter(c => c.nodeType === 1 && c.tagName.toLowerCase() === 'tspan');

    if (tspansInText.length > 1) {
      const parentNode = parentText.parentNode;
      if (!parentNode) return;

      const firstTspanIdx = children.findIndex(c => c.nodeType === 1 && c.tagName.toLowerCase() === 'tspan');
      if (firstTspanIdx === -1) return;

      let insertBeforeRef = parentText.nextSibling;

      for (let i = firstTspanIdx + 1; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1 && child.tagName.toLowerCase() === 'tspan') {
          const newText = parentText.cloneNode(false);
          newText.appendChild(child);
          parentNode.insertBefore(newText, insertBeforeRef);
        } else if (child.nodeType === 3 && child.textContent.trim() === '') {
          parentText.removeChild(child);
        }
      }
    }
  });

  // 3. Tag only leaf <tspan> elements and extract base styles
  const allTspans = Array.from(svgDoc.getElementsByTagNameNS(NS, 'tspan'));
  const allTexts  = Array.from(svgDoc.getElementsByTagNameNS(NS, 'text'));
  const pathsCount = svgDoc.getElementsByTagNameNS(NS, 'path').length;

  // DEBUG: log counts so we can spot differences between SVG and EPS uploads
  console.log('[svgParser] text elements:', allTexts.length, '| tspan elements:', allTspans.length, '| path elements:', pathsCount);

  const parsedLabels = [];
  let labelIndex = 1;

  // Build a unified list: all leaf tspans + any <text> with no tspan children
  // (covers SVG files from Illustrator/Figma that skip <tspan> entirely)
  const candidates = [];

  allTspans.forEach((ts) => {
    const hasChildElements = Array.from(ts.childNodes).some(c => c.nodeType === 1);
    if (!hasChildElements) candidates.push(ts); // leaf tspan
  });

  allTexts.forEach((textEl) => {
    const hasTspan = Array.from(textEl.childNodes).some(
      c => c.nodeType === 1 && c.tagName && c.tagName.toLowerCase() === 'tspan'
    );
    if (!hasTspan) {
      // Text element with no tspan children — treat as a candidate directly
      const txt = (textEl.textContent || '').trim();
      if (txt) candidates.push(textEl);
    }
  });

  console.log('[svgParser] label candidates (unique text nodes):', candidates.length);

  candidates.forEach((ts) => {
    const txt = (ts.textContent || '').trim();
    if (!txt) return;

    // Find inherited font size (check attribute AND inline style AND style block)
    let baseSize = null;
    let el = ts;
    while (el && el !== svgDoc) {
      // Check attribute
      const fsAttr = el.getAttribute('font-size');
      if (fsAttr) { baseSize = parseFloat(fsAttr); break; }
      // Check inline style
      if (el.style && el.style.fontSize) { baseSize = parseFloat(el.style.fontSize); break; }
      el = el.parentElement;
    }
    if (!baseSize || isNaN(baseSize)) baseSize = 12; // Fallback default

    // Detect if this element is styled as invisible
    const isOriginalInvisible = checkIsInvisible(ts, svgDoc);

    const lblId = String(labelIndex++);
    parsedLabels.push({
      id: lblId,
      source: txt,
      translation: '',
      alt_translation: '',
      origLen: txt.length,
      baseFontSize: baseSize,
      fontSizeOverride: undefined,
      letterSpacingOverride: undefined,
      dxOverride: undefined,
      dyOverride: undefined,
      haloOverride: isOriginalInvisible,
      isOriginalInvisible,
      is_flagged: false
    });
    
    // Set matching tracking attribute inside parsed XML tree
    ts.setAttribute('data-label-id', lblId);
  });

  console.log('[svgParser] parsed labels total:', parsedLabels.length, '| invisible:', parsedLabels.filter(l => l.isOriginalInvisible).length);

  // Convert updated XML back to a clean string
  const serializer = new XMLSerializer();
  const updatedSvgString = serializer.serializeToString(svgDoc);

  const invisibleTextCount = parsedLabels.filter(l => l.isOriginalInvisible).length;
  const hasVectorOutlines = invisibleTextCount > 0;

  return {
    updatedSvgString,
    parsedLabels,
    pathsCount,
    hasVectorOutlines
  };
}

// Helper to check if a text element or its parent group is styled as invisible
function checkIsInvisible(ts, svgDoc) {
  let el = ts;
  while (el && el !== svgDoc) {
    if (el.getAttribute) {
      const opacity = el.getAttribute('opacity') || (el.style && el.style.opacity);
      if (opacity !== null && parseFloat(opacity) === 0) {
        return true;
      }
      const fillOpacity = el.getAttribute('fill-opacity') || (el.style && el.style.fillOpacity);
      if (fillOpacity !== null && parseFloat(fillOpacity) === 0) {
        return true;
      }
      const fill = el.getAttribute('fill') || (el.style && el.style.fill);
      if (fill === 'none') {
        const stroke = el.getAttribute('stroke') || (el.style && el.style.stroke);
        if (!stroke || stroke === 'none') {
          return true;
        }
      }
      const display = el.getAttribute('display') || (el.style && el.style.display);
      if (display === 'none') {
        return true;
      }
      const visibility = el.getAttribute('visibility') || (el.style && el.style.visibility);
      if (visibility === 'hidden' || visibility === 'collapse') {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}
