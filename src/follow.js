// Follow within a generous dead zone, then ease the viewport instead of jumping columns.
export function makeFollower(scroller, svg, start, reduced) {
  const maxX = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  let targetX = Math.min(maxX(), Math.max(0, start.x - scroller.clientWidth / 2));
  scroller.scrollLeft = targetX;
  const startY = svg.getBoundingClientRect().top + start.y;
  if (startY < 80 || startY > innerHeight - 120) window.scrollBy({ top: startY - innerHeight / 2, behavior: 'instant' });
  let targetY = window.scrollY;
  return point => {
    if (reduced) return;
    const margin = Math.min(90, scroller.clientWidth / 3), localX = point.x - scroller.scrollLeft;
    if (localX < margin || localX > scroller.clientWidth - margin) targetX = Math.min(maxX(), Math.max(0, point.x - scroller.clientWidth / 2));
    scroller.scrollLeft += (targetX - scroller.scrollLeft) * 0.2;
    const y = svg.getBoundingClientRect().top + point.y;
    if (y < 100 || y > innerHeight - 130) targetY = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, window.scrollY + y - innerHeight / 2));
    if (Math.abs(targetY - window.scrollY) > 1) window.scrollBy({ top: (targetY - window.scrollY) * 0.14, behavior: 'instant' });
  };
}
