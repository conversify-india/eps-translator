/**
 * useToast — Shared non-intrusive toast notification utility.
 * Replaces all browser alert() calls so users never see jarring dialogs.
 *
 * Usage:
 *   import { showToast } from '../hooks/useToast';
 *   showToast('Translation complete!', 'success');
 *   showToast('Something went wrong.', 'error');
 *   showToast('Please upload a valid file.', 'warning');
 *   showToast('File processing started.', 'info');
 */

// Inject keyframe CSS once on first call
let _cssInjected = false;
function injectCss() {
  if (_cssInjected) return;
  _cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes _toastSlideIn {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    @keyframes _toastFadeOut {
      from { opacity: 1; }
      to   { opacity: 0; transform: translateY(8px); }
    }
  `;
  document.head.appendChild(style);
}

const PALETTE = {
  error:   { bg: '#ef4444', icon: '✕' },
  success: { bg: '#22c55e', icon: '✓' },
  warning: { bg: '#f59e0b', icon: '⚠' },
  info:    { bg: '#6366f1', icon: 'ℹ' },
};

/**
 * @param {string} message   — The text to display.
 * @param {'error'|'success'|'warning'|'info'} [type='error']
 * @param {number} [duration=4000]  — Auto-dismiss delay in ms.
 */
export function showToast(message, type = 'error', duration = 4000) {
  injectCss();
  const { bg, icon } = PALETTE[type] || PALETTE.error;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${bg};
    color: #fff;
    padding: 12px 16px 12px 14px;
    border-radius: 10px;
    font-size: 13.5px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    font-weight: 500;
    line-height: 1.45;
    z-index: 99999;
    max-width: 340px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12);
    animation: _toastSlideIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards;
    cursor: pointer;
  `;

  // Icon badge
  const badge = document.createElement('span');
  badge.textContent = icon;
  badge.style.cssText = `
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    background: rgba(255,255,255,0.25);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    margin-top: 1px;
  `;

  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(badge);
  toast.appendChild(text);
  document.body.appendChild(toast);

  const dismiss = () => {
    toast.style.animation = '_toastFadeOut 0.22s ease forwards';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  // Click to dismiss early
  toast.addEventListener('click', dismiss);

  // Auto-dismiss
  const timer = setTimeout(dismiss, duration);

  // Clear timer if manually dismissed
  toast.addEventListener('click', () => clearTimeout(timer), { once: true });
}
