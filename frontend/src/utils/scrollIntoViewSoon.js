// utils/scrollIntoViewSoon.js
// Scrolls an element into view after giving React a chance to commit and
// paint a just-triggered state update (e.g. opening a form). Two nested
// requestAnimationFrame calls reliably land after that paint, unlike a
// setTimeout(fn, 100) guess that can fire before the DOM updates on a slow
// render, or leave a needless pause on a fast one.
export function scrollIntoViewSoon(getElement) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      getElement()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
