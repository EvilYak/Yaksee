// Boîte de dialogue générique (PNJ ou appel téléphonique) : une liste de
// lignes affichées une à la fois, avancée manuellement (touche/clic), sans
// ouverture automatique par proximité — c'est toujours le joueur qui décide
// de lancer l'échange (E sur le PNJ ou le téléphone).

export function createDialogue() {
  const box = document.getElementById('dialogue-box');
  const nameEl = document.getElementById('dialogue-name-text');
  const iconEl = document.getElementById('dialogue-icon');
  const textEl = document.getElementById('dialogue-text');

  let lines = [];
  let index = 0;
  let open = false;

  function render() {
    textEl.textContent = lines[index] || '';
  }

  function start(name, newLines, icon = '💬') {
    lines = newLines;
    index = 0;
    open = true;
    nameEl.textContent = name;
    iconEl.textContent = icon;
    box.classList.remove('hidden');
    render();
  }

  function advance() {
    if (!open) return;
    index += 1;
    if (index >= lines.length) {
      close();
      return;
    }
    render();
  }

  function close() {
    open = false;
    box.classList.add('hidden');
  }

  box.addEventListener('click', advance);

  return {
    start,
    advance,
    close,
    get isOpen() {
      return open;
    },
  };
}
