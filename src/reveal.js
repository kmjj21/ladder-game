export function resultVisible(mode, revealed, slot) {
  return mode === 'reverse' || [...revealed.values()].includes(slot);
}
export function resultLabel(mode, revealed, slot, results) {
  return resultVisible(mode, revealed, slot) ? results[slot] : '?';
}
