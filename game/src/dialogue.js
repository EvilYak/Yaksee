// Contrôleur du bandeau de dialogue façon PS1 (voir style.css/#dialogue-box) :
// un PNJ actif à la fois, on avance ligne par ligne avec E/Entrée/Espace ou
// un tap direct sur le bandeau (jamais un clic ailleurs, pour ne pas entrer
// en conflit avec le clic qui verrouille le pointeur sur la scène).
export function createDialogue() {
  const box = document.getElementById('dialogue-box');
  const nameEl = document.getElementById('dialogue-name-text');
  const textEl = document.getElementById('dialogue-text');

  let activeNpc = null;
  let lineIndex = 0;

  function render() {
    nameEl.textContent = activeNpc.name;
    textEl.textContent = activeNpc.lines[lineIndex];
  }

  function open(npc) {
    if (activeNpc === npc) return;
    activeNpc = npc;
    lineIndex = 0;
    render();
    box.classList.remove('hidden');
  }

  function advance() {
    if (!activeNpc) return;
    lineIndex = Math.min(lineIndex + 1, activeNpc.lines.length - 1);
    render();
  }

  function close() {
    activeNpc = null;
    box.classList.add('hidden');
  }

  window.addEventListener('keydown', (e) => {
    if (!activeNpc) return;
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') advance();
  });
  box.addEventListener('click', advance);

  return {
    open,
    close,
    advance,
    isOpenFor: (npc) => activeNpc === npc,
    get isOpen() {
      return !!activeNpc;
    },
    get active() {
      return activeNpc;
    },
  };
}
