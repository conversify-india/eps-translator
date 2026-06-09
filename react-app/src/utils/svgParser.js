/**
 * Utility for parsing SVG files and extracting text metadata
 */

// ─────────────────────────────────────────────────────────────────────
// NEW: Clean raw-string approach — zero DOM manipulation, zero overlays
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns true if the text string should be sent for translation.
 * Skips purely numeric values, measurements, and single characters.
 */
export function shouldTranslateText(text) {
  if (!text || !text.trim()) return false;
  const t = text.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return false;                            // pure number
  if (/^\d+(\.\d+)?\s*(A|V|W|Hz|rpm|mm|cm|m|kg|°|%|psi)$/i.test(t)) return false; // measurement
  if (t.length <= 1) return false;                                       // single char
  if (/^[A-Z0-9+\-/\\().,_:;#@!?*=[\]{}|^~`'"&%$]+$/i.test(t) && t.length <= 3) return false; // short codes like "NC", "NO", "B+"
  return true;
}

/**
 * Extracts all unique text strings from a raw SVG string
 * by scanning for text content between XML tags.
 * Returns an array of unique strings.
 */
export function extractUniqueTexts(svgRawText) {
  const seen = new Set();
  // Match any text between a closing > and opening < that doesn't contain markup
  const regex = />([^<>\r\n]+)</g;
  let match;
  while ((match = regex.exec(svgRawText)) !== null) {
    const raw = match[1];
    // Decode common HTML entities
    const text = raw
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text) {
      seen.add(text);
    }
  }
  return [...seen];
}

/**
 * Applies a translation map to a raw SVG string by doing direct
 * text-content string replacement. Positions, transforms, fonts,
 * colors, and all graphical elements are byte-for-byte identical.
 *
 * @param {string} svgRawText  - Original SVG source string
 * @param {Object} translationMap - { "ORIGINAL TEXT": "TRANSLATED TEXT" }
 * @returns {string} Modified SVG with translated text strings
 */
/**
 * Scans SVG source for text/tspan elements whose font-family name implies
 * bold or italic styling (e.g. "Arial-BoldMT", "Calibri-Bold", "Helvetica-Oblique")
 * and injects explicit font-weight / font-style SVG attributes so that browser
 * fallback fonts still render with the correct visual weight/style.
 *
 * This is a raw-string pass that works without DOM parsing, so it is safe
 * to call immediately after EPS→SVG conversion before any labels are extracted.
 *
 * @param {string} svgRawText - Raw SVG source string
 * @returns {string} SVG source with normalised font-weight / font-style attributes
 */
export function normalizeSvgFontStyles(svgRawText) {
  // Regex: match opening <text …> or <tspan …> tags so we can inspect / mutate them
  return svgRawText.replace(/<(text|tspan)(\s[^>]*)?>/gi, (match, tag, attrs) => {
    if (!attrs) return match; // no attributes — nothing to inspect

    // Extract the font-family value (attribute or style property)
    const familyAttrMatch  = attrs.match(/font-family\s*=\s*["']([^"']+)["']/i);
    const familyStyleMatch = attrs.match(/style\s*=\s*["'][^"']*font-family\s*:\s*([^;'"]+)/i);
    const fontFamily = (familyAttrMatch?.[1] || familyStyleMatch?.[1] || '').toLowerCase();

    if (!fontFamily) return match; // no font-family found

    // Determine whether the font name encodes bold / italic styling
    const impliesBold   = /bold|heavy|black|demibold|semibold|extrabold|ultrabold/i.test(fontFamily);
    const impliesItalic = /italic|oblique|slant/i.test(fontFamily);

    // Check whether explicit font-weight / font-style attributes already exist
    const hasWeightAttr  = /font-weight\s*=/i.test(attrs) || /style\s*=\s*["'][^"']*font-weight\s*:/i.test(attrs);
    const hasStyleAttr   = /font-style\s*=/i.test(attrs)  || /style\s*=\s*["'][^"']*font-style\s*:/i.test(attrs);

    let newAttrs = attrs;

    if (impliesBold && !hasWeightAttr) {
      newAttrs += ' font-weight="bold"';
    }
    if (impliesItalic && !hasStyleAttr) {
      newAttrs += ' font-style="italic"';
    }

    return `<${tag}${newAttrs}>`;
  });
}

export function applyTranslationsToRawSvg(svgRawText, translationMap) {
  let result = svgRawText;

  // Sort entries by descending source length to prevent partial replacements
  // (e.g. replace "FRONT WORK LAMP" before "LAMP")
  const sortedEntries = Object.entries(translationMap)
    .filter(([src, tgt]) => {
      if (!src || !tgt) return false;
      if (src.trim() === tgt.trim()) return false; // skip unchanged (technical codes)
      return true;
    })
    .sort((a, b) => b[0].length - a[0].length);

  for (const [source, translation] of sortedEntries) {
    // Escape all regex special characters in the source string
    const escaped = source.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the text between > and < allowing surrounding whitespace
    // Use a regex that only replaces text CONTENT, never attribute values
    const regex = new RegExp(`(>\\s*)${escaped}(\\s*<)`, 'g');
    result = result.replace(regex, `$1${translation}$2`);
  }

  return result;
}


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

  // 2. Split <text> elements containing multiple <tspan> nodes (only if they are on different lines and not a vertical word)
  const textsToSplit = Array.from(svgDoc.getElementsByTagNameNS(NS, 'text'));
  textsToSplit.forEach(parentText => {
    const children = Array.from(parentText.childNodes);
    const tspansInText = children.filter(c => c.nodeType === 1 && c.tagName.toLowerCase() === 'tspan');

    if (tspansInText.length > 1) {
      // Check if they are on different lines (different y coordinates)
      const yCoords = new Set();
      tspansInText.forEach(ts => {
        const y = ts.getAttribute('y');
        if (y !== null) yCoords.add(y);
      });

      if (yCoords.size > 1 && !isVerticalWord(tspansInText)) {
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
    }
  });

  // 3. Tag text elements and extract base styles (group same-line tspans together)
  const allTspans = Array.from(svgDoc.getElementsByTagNameNS(NS, 'tspan'));
  const allTexts  = Array.from(svgDoc.getElementsByTagNameNS(NS, 'text'));
  const pathsCount = svgDoc.getElementsByTagNameNS(NS, 'path').length;

  // DEBUG: log counts so we can spot differences between SVG and EPS uploads
  console.log('[svgParser] text elements:', allTexts.length, '| tspan elements:', allTspans.length, '| path elements:', pathsCount);

  const parsedLabels = [];
  let labelIndex = 1;

  // Build a unified list: group by parent text elements, keeping same-line tspans together
  const candidates = [];

  allTexts.forEach((textEl) => {
    const children = Array.from(textEl.childNodes);
    const tspans = children.filter(c => c.nodeType === 1 && c.tagName.toLowerCase() === 'tspan');
    
    if (tspans.length === 0) {
      const txt = (textEl.textContent || '').trim();
      if (txt) candidates.push(textEl);
    } else {
      const yCoords = new Set();
      tspans.forEach(ts => {
        const y = ts.getAttribute('y');
        if (y !== null) yCoords.add(y);
      });
      
      const isVert = isVerticalWord(tspans);
      
      if (yCoords.size > 1 && !isVert) {
        // Different lines: treat each leaf tspan as a candidate
        tspans.forEach(ts => {
          const hasChildElements = Array.from(ts.childNodes).some(c => c.nodeType === 1);
          if (!hasChildElements) {
            const txt = (ts.textContent || '').trim();
            if (txt) candidates.push(ts);
          }
        });
      } else {
        // Same line or vertical word: treat parent <text> node as a single candidate
        const firstTspan = tspans[0];
        if (firstTspan) {
          ['x', 'y', 'dx', 'dy'].forEach(attrName => {
            const tspanVal = firstTspan.getAttribute(attrName);
            if (tspanVal) {
              textEl.setAttribute(attrName, tspanVal);
            }
          });
        }
        const txt = (textEl.textContent || '').trim();
        if (txt) candidates.push(textEl);
      }
    }
  });

  console.log('[svgParser] label candidates (unique text nodes):', candidates.length);

  candidates.forEach((ts) => {
    const txt = (ts.textContent || '').trim();
    if (!txt) return;

    // Clean up coordinate list attributes on the element if they exist (prevents stacked letters)
    if (ts.tagName.toLowerCase() === 'text') {
      ['x', 'y', 'dx', 'dy'].forEach(attrName => {
        const val = ts.getAttribute(attrName);
        if (val && val.trim().split(/[\s,]+/).length > 1) {
          const firstVal = val.trim().split(/[\s,]+/)[0];
          ts.setAttribute(attrName, firstVal);
        }
      });
    }

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

// Helper to check if a list of tspans represents a vertical word
function isVerticalWord(tspans) {
  if (!tspans || tspans.length <= 1) return false;
  let totalLength = 0;
  tspans.forEach(ts => {
    totalLength += (ts.textContent || '').trim().length;
  });
  const avgLength = totalLength / tspans.length;
  return avgLength <= 2;
}
