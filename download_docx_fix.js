/**
 * DOCX DOWNLOAD FIX
 * =================
 * Replace the existing "Download Word Document (.doc)" button logic with this.
 *
 * This sends the translated SVG to the new `svg-to-docx` PHP endpoint which:
 *  1. Rasterises the SVG to a high-res PNG (via rsvg-convert / Inkscape / Imagick)
 *  2. Builds a proper .docx (Open XML ZIP) with the image embedded at full A4 width
 *  3. Streams the binary .docx back to the browser
 *
 * Result: a Word document that opens with correct alignment, logo, and layout.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1.  API helper – add this to your `th` (API service) object
// ─────────────────────────────────────────────────────────────────────────────

async function downloadSvgAsDocx(svgText, filenameWithoutExt) {
  const apiUrl =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000/api.php?action=svg-to-docx'
      : 'api.php?action=svg-to-docx';

  // Parse SVG dimensions for correct aspect-ratio calculation in PHP
  let svgWidth = 0, svgHeight = 0;
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl  = svgDoc.documentElement;
    const vb     = svgEl.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/);
      if (parts.length === 4) { svgWidth = parseFloat(parts[2]); svgHeight = parseFloat(parts[3]); }
    }
    if (!svgWidth)  svgWidth  = parseFloat(svgEl.getAttribute('width'))  || 800;
    if (!svgHeight) svgHeight = parseFloat(svgEl.getAttribute('height')) || 1100;
  } catch (_) { svgWidth = 800; svgHeight = 1100; }

  const body = JSON.stringify({
    svgBase64: btoa(unescape(encodeURIComponent(svgText))),   // UTF-8 safe base64
    filename:  filenameWithoutExt || 'translated_document',
    width:     svgWidth,
    height:    svgHeight,
  });

  const response = await fetch(apiUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    // Try to extract JSON error message
    let msg = `Server error (${response.status})`;
    try {
      const j = await response.json();
      if (j && j.error) msg = j.error;
    } catch (_) {}
    throw new Error(msg);
  }

  // Stream blob → download
  const blob     = await response.blob();
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = (filenameWithoutExt || 'translated_document') + '_translated.docx';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  React button — replace the existing "Download Word Document (.doc)" button
//     inside the `fh` / DiagnosisStep component with this snippet:
// ─────────────────────────────────────────────────────────────────────────────

/*
  <button
    onClick={async () => {
      try {
        await downloadSvgAsDocx(svgText, filename?.replace(/\.(eps|svg|pdf)$/i, '') || 'document');
        showToast('Word document downloaded successfully!', 'success');
      } catch (err) {
        showToast('DOCX export failed: ' + err.message, 'error');
      }
    }}
    style={{
      fontSize: '0.75rem',
      padding: '0.45rem 1.25rem',
      borderColor: '#cbd5e1',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      margin: 0,
    }}
  >
    📄 Download Word Document (.docx)
  </button>
*/

// ─────────────────────────────────────────────────────────────────────────────
// 3.  QA & Export — add a "Download DOCX" button in the ChComponent (QA Report)
//     alongside the existing SVG / EPS / PDF buttons.
//     Insert this button inside the flex row where other download buttons live:
// ─────────────────────────────────────────────────────────────────────────────

/*
  <button
    className="btn btn-ghost"
    onClick={async () => {
      try {
        const stem = filename?.replace(/\.(eps|svg|pdf)$/i, '') || 'drawing';
        // Build the export SVG exactly the same way the SVG download does
        const exportedSvg = buildExportSvg(); // call your existing ne() / te() helper
        await downloadSvgAsDocx(exportedSvg, stem);
        showToast('Word document (.docx) downloaded!', 'success');
      } catch (err) {
        showToast('DOCX export failed: ' + err.message, 'error');
      }
    }}
    style={{
      flex: 1,
      minWidth: '160px',
      margin: 0,
      padding: '0.65rem 1.25rem',
      cursor: 'pointer',
      borderColor: '#7c3aed',
      color: '#7c3aed',
      background: '#f5f3ff',
    }}
  >
    📝 Download DOCX
  </button>
*/
