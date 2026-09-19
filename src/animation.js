export function makePlan(points) {
  let distance = 0, time = 0;
  const segments = points.slice(1).map((b, i) => {
    const a = points[i], length = Math.hypot(b.x - a.x, b.y - a.y), horizontal = a.y === b.y;
    const weight = length * (horizontal ? 0.65 : 1);
    const segment = { a, b, length, horizontal, weight, distance, time };
    distance += length; time += weight; return segment;
  });
  return { points, segments, total: distance, time };
}
export function samplePlan(plan, progress) {
  if (progress >= 1) return { point: { ...plan.points.at(-1) }, distance: plan.total, horizontal: plan.segments.at(-1).horizontal, t: 1, index: plan.segments.length - 1 };
  const clock = Math.min(1, Math.max(0, progress)) * plan.time;
  const index = plan.segments.findIndex((s, i) => clock < s.time + s.weight || i === plan.segments.length - 1);
  const segment = plan.segments[index], t = segment.weight ? Math.min(1, Math.max(0, (clock - segment.time) / segment.weight)) : 1;
  return { point: { x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t }, distance: segment.distance + segment.length * t, horizontal: segment.horizontal, t, index };
}
export function animate(points, onFrame, onStep, reduced = false) {
  const plan = makePlan(points), duration = reduced ? 180 : Math.min(3900, 2500 + plan.total * 0.35);
  return new Promise((resolve, reject) => {
    let start, previous = -1;
    function frame(time) {
      try {
        start ??= time;
        const progress = Math.min(1, (time - start) / duration), sample = samplePlan(plan, progress);
        if (sample.index !== previous) { onStep(sample.horizontal, plan.segments[sample.index].b.x - plan.segments[sample.index].a.x); previous = sample.index; }
        const bounce = reduced || progress === 1 ? 1 : sample.horizontal ? 1 + 0.16 * Math.sin(sample.t * Math.PI) : 1 + 0.05 * Math.sin(time / 60);
        onFrame(sample.point, sample.distance / plan.total, plan.total, bounce, plan.segments[sample.index].a);
        if (progress < 1) requestAnimationFrame(frame); else resolve();
      } catch (error) { reject(error); }
    }
    requestAnimationFrame(frame);
  });
}
