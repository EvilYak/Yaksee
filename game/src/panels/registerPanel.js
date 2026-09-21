import { ITEMS } from '../economy.js';
import { FRAME_PRICE, FRAME_COUNT } from '../decor.js';
import { makeFrameMaterial } from '../materials/index.js';
import { prepareOpen } from './shared.js';

// Panneau de caisse : commande du client en cours, stock restant, et achat
// de décoration (cadres muraux). Tout ce qui touche à l'écran de l'ordi.
export function createRegisterPanel({ stock, customers, shift, audio, decorState, shopFrames }) {
  const panel = document.getElementById('register-panel');
  const closeBtn = document.getElementById('register-close');
  const moneyEl = document.getElementById('register-money-value');
  const orderEl = document.getElementById('register-order');
  const stockEl = document.getElementById('register-stock');
  const decorEl = document.getElementById('register-decor');

  let open = false;

  function render() {
    moneyEl.textContent = stock.stock.argent;

    orderEl.innerHTML = '';
    const order = customers.current;
    if (order) {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      row.innerHTML = `<span>${order.icon} ${order.label} — ${order.price} €</span>`;
      const btn = document.createElement('button');
      btn.className = 'recipe-craft-btn';
      btn.type = 'button';
      btn.textContent = 'Encaisser';
      btn.disabled = !stock.has(order.id);
      btn.addEventListener('click', () => {
        if (customers.serve()) {
          shift.recordSale();
          audio.registerBeep();
          render();
        }
      });
      row.appendChild(btn);
      orderEl.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      row.innerHTML = '<span>Aucun client pour le moment.</span>';
      orderEl.appendChild(row);
    }

    stockEl.innerHTML = ITEMS.map((item) => `<span>${item.icon} ${item.label} : ${stock.stock[item.id]}</span>`).join('');

    decorEl.innerHTML = '';
    const decorRow = document.createElement('div');
    decorRow.className = 'recipe-row';
    decorRow.innerHTML = `<span>🖼️ Cadre magicien — ${FRAME_PRICE} € (${decorState.filled}/${FRAME_COUNT})</span>`;
    const decorBtn = document.createElement('button');
    decorBtn.className = 'recipe-craft-btn';
    decorBtn.type = 'button';
    decorBtn.textContent = 'Acheter';
    decorBtn.disabled = !decorState.canBuy();
    decorBtn.addEventListener('click', () => {
      const index = decorState.buy();
      if (index >= 0) {
        shopFrames[index].material.dispose();
        shopFrames[index].material = makeFrameMaterial(index % 3);
        audio.registerBeep();
        render();
      }
    });
    decorRow.appendChild(decorBtn);
    decorEl.appendChild(decorRow);
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
