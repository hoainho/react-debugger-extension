const PAGE_SOURCE = 'REACT_DEBUGGER_PAGE';
const CONTENT_SOURCE = 'REACT_DEBUGGER_CONTENT';
const STORAGE_KEY = 'react_debugger_disabled_sites';

let isEnabled = true;
let isInitialized = false;
let extensionContextValid = true;

function sendToPage(type: string, payload?: unknown): void {
  if (!extensionContextValid) return;
  try {
    window.postMessage({ source: CONTENT_SOURCE, type, payload }, '*');
  } catch {
    extensionContextValid = false;
  }
}

function safeSendMessage(message: object): void {
  if (!extensionContextValid) return;
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      extensionContextValid = false;
    });
  } catch {
    extensionContextValid = false;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getSelector(element: Element | null): string {
  if (!element) return 'unknown';
  if (element.id) return `#${element.id}`;
  const tag = element.tagName.toLowerCase();
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(Boolean);
    if (classes.length > 0) return `${tag}.${classes.slice(0, 2).join('.')}`;
  }
  return tag;
}

function injectPageScript(): void {
  if (isInitialized) return;
  isInitialized = true;
  
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = () => script.remove();
  script.onerror = (e) => console.error('[React Debugger] Failed to inject script:', e);
  (document.head || document.documentElement).appendChild(script);
}

async function checkIfSiteEnabled(): Promise<boolean> {
  try {
    const hostname = window.location.hostname;
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const disabledSites: string[] = result[STORAGE_KEY] || [];
    return !disabledSites.includes(hostname);
  } catch {
    return true;
  }
}

async function init(): Promise<void> {
  isEnabled = await checkIfSiteEnabled();
  
  if (!isEnabled) {
    console.log('[React Debugger] Disabled for this site');
    return;
  }
  
  injectPageScript();
  
  window.addEventListener('message', (event) => {
    if (!extensionContextValid) return;
    if (event.source !== window) return;
    if (!event.data || event.data.source !== PAGE_SOURCE) return;
    
    safeSendMessage({
      type: event.data.type,
      payload: event.data.payload,
    });
  });
  
  chrome.runtime.onMessage.addListener((message) => {
    if (!extensionContextValid) return;
    sendToPage(message.type, message.payload);
  });
  
  initCLSObserver();
  
  console.log('[React Debugger] Content script loaded');
}

let clsValue = 0;

function initCLSObserver(): void {
  if (!('PerformanceObserver' in window)) return;
  
  const supportedTypes = (PerformanceObserver as any).supportedEntryTypes || [];
  if (!supportedTypes.includes('layout-shift')) return;
  
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const layoutShift = entry as any;
      
      if (layoutShift.hadRecentInput) continue;
      
      clsValue += layoutShift.value;
      
      const sources = (layoutShift.sources || []).map((source: any) => ({
        node: getSelector(source.node as Element),
        previousRect: source.previousRect,
        currentRect: source.currentRect,
      }));
      
      safeSendMessage({
        type: 'CLS_ENTRY',
        payload: {
          id: generateId(),
          timestamp: Date.now(),
          value: layoutShift.value,
          hadRecentInput: layoutShift.hadRecentInput,
          sources,
          cumulativeScore: clsValue,
        },
      });
    }
  });
  
  observer.observe({ type: 'layout-shift', buffered: true });
}

init();
