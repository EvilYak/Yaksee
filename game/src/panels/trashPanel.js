import { ITEMS } from '../economy.js';
import { prepareOpen } from './shared.js';

// Panneau poubelle : jette 1 unité d'un objet en stock.
export function createTrashPanel({ stock }) {
  const panel = document.getElementById('trash-panel');
  const closeBtn = document.getElementById('trash-close');
  const listEl = document.getElementById('trash-list');

  let open = false;

  function render() {
    listEl.innerHTML = '';
    ITEMS.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      row.innerHTML = `<span>${item.icon} ${item.label} : ${stock.stock[item.id]}</span>`;
      const btn = document.createElement('button');
      btn.className = 'recipe-craft-btn';
      btn.type = 'button';
      btn.textContent = 'Jeter';
      btn.disabled = !stock.has(item.id);
      btn.addEventListener('click', () => {
        if (stock.discard(item.id)) render();
      });
      row.appendChild(btn);
      listEl.appendChild(row);
    });
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
