import type { Message, MessageType } from '@/types';

const EXTENSION_SOURCE = 'REACT_DEBUGGER_EXTENSION';
const PAGE_SOURCE = 'REACT_DEBUGGER_PAGE';
const CONTENT_SOURCE = 'REACT_DEBUGGER_CONTENT';

export function sendToBackground<T>(type: MessageType, payload?: T): Promise<unknown> {
  return chrome.runtime.sendMessage({ type, payload });
}

export function sendToTab<T>(tabId: number, type: MessageType, payload?: T): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, { type, payload });
}

export function sendToPage<T>(type: MessageType, payload?: T): void {
  window.postMessage(
    {
      source: CONTENT_SOURCE,
      type,
      payload,
    },
    '*'
  );
}

export function sendFromPage<T>(type: MessageType, payload?: T): void {
  window.postMessage(
    {
      source: PAGE_SOURCE,
      type,
      payload,
    },
    '*'
  );
}

export function listenFromPage(callback: (message: Message) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== PAGE_SOURCE) return;
    callback({ type: event.data.type, payload: event.data.payload });
  };
  
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

export function listenFromContent(callback: (message: Message) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== CONTENT_SOURCE) return;
    callback({ type: event.data.type, payload: event.data.payload });
  };
  
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

export function listenFromBackground(
  callback: (message: Message, sender: chrome.runtime.MessageSender) => void | Promise<unknown>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = callback(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse);
      return true;
    }
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
