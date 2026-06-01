/**
 * Utility for parsing SVG files and extracting text metadata
 */

export function parseSVGString(text) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(text, 'image/svg+xml');
  const NS = 'http://www.w3.org/2000/svg';

  // 1. Split <text> elements containing multiple <tspan> nodes
  const texts = Array.from(svgDoc.getElementsByTagNameNS(NS, 'text'));
  texts.forEach(parentText => {
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

  const tspans = Array.from(svgDoc.getElementsByTagNameNS(NS, 'tspan'));
  const pathsCount = svgDoc.getElementsByTagNameNS(NS, 'path').length;

  // 2. Tag elements and extract base styles
  const parsedLabels = [];
  tspans.forEach((ts, index) => {
    const txt = (ts.textContent || '').trim();
    if (!txt) return;

    // Find inherited font size
    let baseSize = null;
    let el = ts;
    while (el && el !== svgDoc) {
      const fs = el.getAttribute('font-size') || (el.style && el.style.fontSize);
      if (fs) {
        baseSize = parseFloat(fs);
        break;
      }
      el = el.parentElement;
    }
    if (!baseSize) baseSize = 12; // Fallback default

    const lblId = String(index + 1);
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
      haloOverride: false,
      is_flagged: false
    });
    
    // Set matching tracking attribute inside parsed XML tree
    ts.setAttribute('data-label-id', lblId);
  });

  // Convert updated XML back to a clean string
  const serializer = new XMLSerializer();
  const updatedSvgString = serializer.serializeToString(svgDoc);

  return {
    updatedSvgString,
    parsedLabels,
    pathsCount
  };
}
