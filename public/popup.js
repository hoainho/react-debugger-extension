const STORAGE_KEY = 'react_debugger_disabled_sites';

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function getDisabledSites() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function setDisabledSites(sites) {
  await chrome.storage.local.set({ [STORAGE_KEY]: sites });
}

async function isSiteEnabled(hostname) {
  const disabledSites = await getDisabledSites();
  return !disabledSites.includes(hostname);
}

async function toggleSite(hostname, enabled) {
  const disabledSites = await getDisabledSites();
  
  if (enabled) {
    const index = disabledSites.indexOf(hostname);
    if (index > -1) {
      disabledSites.splice(index, 1);
    }
  } else {
    if (!disabledSites.includes(hostname)) {
      disabledSites.push(hostname);
    }
  }
  
  await setDisabledSites(disabledSites);
}

function updateUI(hostname, enabled) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const toggle = document.getElementById('siteToggle');
  
  toggle.checked = enabled;
  
  if (enabled) {
    statusEl.className = 'status enabled';
    statusText.textContent = 'Enabled for this site';
  } else {
    statusEl.className = 'status disabled';
    statusText.textContent = 'Disabled for this site';
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const hostname = getHostname(tab?.url);
  
  const siteNameEl = document.getElementById('siteName');
  const toggle = document.getElementById('siteToggle');
  const reloadBtn = document.getElementById('reloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  
  if (!hostname) {
    siteNameEl.textContent = 'Cannot detect site';
    toggle.disabled = true;
    return;
  }
  
  siteNameEl.textContent = hostname;
  
  const enabled = await isSiteEnabled(hostname);
  updateUI(hostname, enabled);
  
  toggle.addEventListener('change', async () => {
    const newEnabled = toggle.checked;
    await toggleSite(hostname, newEnabled);
    updateUI(hostname, newEnabled);
  });
  
  reloadBtn.addEventListener('click', () => {
    chrome.tabs.reload(tab.id);
    window.close();
  });
  
  clearBtn.addEventListener('click', async () => {
    await setDisabledSites([]);
    updateUI(hostname, true);
    toggle.checked = true;
  });
}

document.addEventListener('DOMContentLoaded', init);
