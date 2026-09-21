// Panneau de réglages : sensibilité de visée + inversion de l'axe Y,
// mémorisés en localStorage pour la prochaine session.

const SETTINGS_KEY = 'plantshop-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { sensitivity: parsed.sensitivity ?? 1, invertY: !!parsed.invertY };
  } catch {
    return { sensitivity: 1, invertY: false };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible (navigation privée...) : le réglage reste actif
    // pour la session en cours, simplement pas mémorisé pour la prochaine.
  }
}

export function createSettingsPanel({ controls }) {
  const settingsBtn = document.getElementById('toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');
  const sensSlider = document.getElementById('sens-slider');
  const sensValue = document.getElementById('sens-value');
  const invertYBtn = document.getElementById('invert-y-toggle');

  const settings = loadSettings();
  controls.setSensitivity(settings.sensitivity);
  controls.setInvertY(settings.invertY);
  sensSlider.value = String(settings.sensitivity);
  sensValue.textContent = `${settings.sensitivity.toFixed(2)}×`;
  invertYBtn.textContent = settings.invertY ? 'OUI' : 'NON';
  invertYBtn.classList.toggle('active', settings.invertY);

  settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
  settingsClose.addEventListener('click', () => settingsPanel.classList.add('hidden'));

  sensSlider.addEventListener('input', () => {
    const mult = parseFloat(sensSlider.value);
    settings.sensitivity = mult;
    sensValue.textContent = `${mult.toFixed(2)}×`;
    controls.setSensitivity(mult);
    saveSettings(settings);
  });

  invertYBtn.addEventListener('click', () => {
    settings.invertY = !settings.invertY;
    invertYBtn.textContent = settings.invertY ? 'OUI' : 'NON';
    invertYBtn.classList.toggle('active', settings.invertY);
    controls.setInvertY(settings.invertY);
    saveSettings(settings);
  });
}
