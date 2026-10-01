const KEY = 'ladder-game:preferences:v1';
const LEGACY_KEY = 'ladder-game:v1';
function get(key) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
// Only preferences cross page loads. Legacy game data never reaches the editor.
export function read() {
  const current = get(KEY), legacy = get(LEGACY_KEY);
  const preferences = { sound: typeof current.sound === 'boolean' ? current.sound : legacy.sound !== false };
  // Preserve the old sound choice before removing the mixed game/preference key.
  if (save(preferences)) { try { localStorage.removeItem(LEGACY_KEY); } catch { /* Storage can be blocked. Never restore game data. */ } }
  return preferences;
}
export function save(value) {
  try { localStorage.setItem(KEY, JSON.stringify({ sound: value.sound !== false })); return true; }
  catch { return false; }
}
