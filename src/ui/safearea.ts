/** iPhone notch/home-bar insets, converted to logical game pixels. */
export function safeInsets(gameW: number): { left: number; right: number; bottom: number; top: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
    'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const k = gameW / Math.max(1, window.innerWidth);
  const v = (s: string) => (parseFloat(s) || 0) * k;
  const out = {
    left: v(cs.paddingLeft),
    right: v(cs.paddingRight),
    top: v(cs.paddingTop),
    bottom: v(cs.paddingBottom),
  };
  probe.remove();
  return out;
}
