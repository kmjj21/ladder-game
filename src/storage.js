const KEY = 'ladder-game:v1';
export function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function save(value) { try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; } }
