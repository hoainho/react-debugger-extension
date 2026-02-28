const PAGE_SOURCE = 'REACT_DEBUGGER_PAGE';
const CONTENT_SOURCE = 'REACT_DEBUGGER_CONTENT';
const STORAGE_KEY = 'react_debugger_disabled_sites';

let isEnabled = true;
let isInitialized = false;
let extensionContextValid = true;
let debuggerEnabled = false;
let clsObserver: PerformanceObserver | null = null;

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

function injectPageScript(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  isInitialized = true;
  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = (e) => {
      console.error('[React Debugger] Failed to inject script:', e);
      resolve(); // Resolve anyway to not block the flow
    };
    (document.head || document.documentElement).appendChild(script);
  });
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

let pageMessageHandler: ((event: MessageEvent) => void) | null = null;

function setupPageMessageListener(): void {
  if (pageMessageHandler) return;
  pageMessageHandler = (event: MessageEvent) => {
    if (!extensionContextValid) return;
    if (event.source !== window) return;
    if (!event.data || event.data.source !== PAGE_SOURCE) return;
    
    safeSendMessage({
      type: event.data.type,
      payload: event.data.payload,
    });
  };
  window.addEventListener('message', pageMessageHandler);
}

function removePageMessageListener(): void {
  if (pageMessageHandler) {
    window.removeEventListener('message', pageMessageHandler);
    pageMessageHandler = null;
  }
}

let enableInProgress = false;

async function handleEnableDebugger(message: { type: string; payload?: unknown }): Promise<void> {
  // Guard: skip if already enabled or enable is in progress
  if (debuggerEnabled || enableInProgress) {
    // If already enabled, just forward the message to re-sync state
    if (debuggerEnabled && isInitialized) {
      sendToPage(message.type, message.payload);
    }
    return;
  }
  enableInProgress = true;
  try {
    isEnabled = await checkIfSiteEnabled();
    if (!isEnabled) return;
    debuggerEnabled = true;
    setupPageMessageListener();
    await injectPageScript();
    sendToPage(message.type, message.payload);
    initCLSObserver();
    capturePageLoadMetrics();
  } finally {
    enableInProgress = false;
  }
}

function handleDisableDebugger(message: { type: string; payload?: unknown }): void {
  debuggerEnabled = false;
  sendToPage(message.type, message.payload);
  stopCLSObserver();
  removePageMessageListener();
}

function init(): void {
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (!extensionContextValid) return;
      
      try {
        if (message.type === 'ENABLE_DEBUGGER') {
          handleEnableDebugger(message);
          return;
        }
        
        if (message.type === 'DISABLE_DEBUGGER') {
          handleDisableDebugger(message);
          return;
        }
        
        if (debuggerEnabled && isInitialized) {
          sendToPage(message.type, message.payload);
        }
      } catch {
      }
    });
  } catch {
    extensionContextValid = false;
  }
}

let clsValue = 0;
let pageMetricsSent = false;

function capturePageLoadMetrics(): void {
  if (pageMetricsSent) return;
  
  const collectAndSend = () => {
    if (pageMetricsSent) return;
    pageMetricsSent = true;
    
    const metrics: {
      fcp: number | null;
      lcp: number | null;
      ttfb: number | null;
      domContentLoaded: number | null;
      loadComplete: number | null;
      timestamp: number;
    } = {
      fcp: null,
      lcp: null,
      ttfb: null,
      domContentLoaded: null,
      loadComplete: null,
      timestamp: Date.now(),
    };

    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      metrics.ttfb = Math.round(nav.responseStart - nav.requestStart);
      metrics.domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      metrics.loadComplete = Math.round(nav.loadEventEnd - nav.startTime);
    }

    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
    if (fcpEntry) {
      metrics.fcp = Math.round(fcpEntry.startTime);
    }

    safeSendMessage({ type: 'PAGE_LOAD_METRICS', payload: metrics });

    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
            metrics.lcp = Math.round(lastEntry.startTime);
            safeSendMessage({ type: 'PAGE_LOAD_METRICS', payload: metrics });
            lcpObserver.disconnect();
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        
        setTimeout(() => lcpObserver.disconnect(), 10000);
      } catch {
      }
    }
  };

  if (document.readyState === 'complete') {
    setTimeout(collectAndSend, 100);
  } else {
    window.addEventListener('load', () => setTimeout(collectAndSend, 100), { once: true });
  }
}

function initCLSObserver(): void {
  if (!debuggerEnabled) return;
  if (!('PerformanceObserver' in window)) return;
  if (clsObserver) return;
  
  const supportedTypes = (PerformanceObserver as any).supportedEntryTypes || [];
  if (!supportedTypes.includes('layout-shift')) return;
  
  clsObserver = new PerformanceObserver((list) => {
    if (!debuggerEnabled) return;
    
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
  
  clsObserver.observe({ type: 'layout-shift', buffered: true });
}

function stopCLSObserver(): void {
  if (clsObserver) {
    clsObserver.disconnect();
    clsObserver = null;
  }
}

init();
