import { TOOL_LABELS } from '../toolRuntime.js';
import { prepareOpen } from './shared.js';

// Panneau du placard "Staff Only" : équiper/ranger le balai ou le
// débouche-chiotte. L'état de l'outil tenu vit dans toolRuntime, ce panneau
// ne fait que l'afficher et proposer les boutons pour le changer.
export function createClosetPanel({ toolRuntime }) {
  const panel = document.getElementById('closet-panel');
  const closeBtn = document.getElementById('closet-close');
  const currentEl = document.getElementById('closet-current');
  const listEl = document.getElementById('closet-list');

  let open = false;

  function render() {
    const heldTool = toolRuntime.getHeldTool();
    currentEl.textContent = heldTool ? `En main : ${TOOL_LABELS[heldTool]}` : 'Rien en main.';
    listEl.innerHTML = '';

    Object.entries(TOOL_LABELS).forEach(([id, label]) => {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      row.innerHTML = `<span>${label}</span>`;
      const btn = document.createElement('button');
      btn.className = 'recipe-craft-btn';
      btn.type = 'button';
      btn.textContent = 'Prendre';
      btn.disabled = heldTool === id;
      btn.addEventListener('click', () => {
        toolRuntime.setHeldTool(id);
        render();
      });
      row.appendChild(btn);
      listEl.appendChild(row);
    });

    const putAwayRow = document.createElement('div');
    putAwayRow.className = 'recipe-row';
    putAwayRow.innerHTML = '<span>Ranger l\'outil en main</span>';
    const putAwayBtn = document.createElement('button');
    putAwayBtn.className = 'recipe-craft-btn';
    putAwayBtn.type = 'button';
    putAwayBtn.textContent = 'Ranger';
    putAwayBtn.disabled = !heldTool;
    putAwayBtn.addEventListener('click', () => {
      toolRuntime.setHeldTool(null);
      render();
    });
    putAwayRow.appendChild(putAwayBtn);
    listEl.appendChild(putAwayRow);
  }

  function openPanel() {
    open = true;
    panel.classList.remove('hidden');
    prepareOpen();
    render();
  }
  function closePanel() {
    open = false;
    panel.classList.add('hidden');
  }
  closeBtn.addEventListener('click', closePanel);

  return {
    open: openPanel,
    close: closePanel,
    get isOpen() {
      return open;
    },
  };
}
