export function choose(title, description, options) {
  const dialog = document.getElementById('choice'), actions = document.getElementById('choice-actions');
  document.getElementById('choice-title').textContent = title;
  document.getElementById('choice-description').textContent = description; actions.replaceChildren();
  return new Promise(resolve => {
    let answer = null;
    for (const { label, value } of options) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = () => { answer = value; dialog.close(); }; actions.append(button);
    }
    document.getElementById('choice-cancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => resolve(answer), { once: true });
    dialog.showModal(); document.getElementById('choice-cancel').focus();
  });
}
