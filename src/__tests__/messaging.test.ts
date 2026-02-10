import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  sendToPage, 
  sendFromPage, 
  listenFromPage, 
  listenFromContent,
  generateId 
} from '../utils/messaging';

describe('messaging utilities', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendToPage', () => {
    it('posts message with CONTENT_SOURCE', () => {
      sendToPage('ENABLE_DEBUGGER', { test: true });
      
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          source: 'REACT_DEBUGGER_CONTENT',
          type: 'ENABLE_DEBUGGER',
          payload: { test: true },
        },
        '*'
      );
    });

    it('handles undefined payload', () => {
      sendToPage('DISABLE_DEBUGGER');
      
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          source: 'REACT_DEBUGGER_CONTENT',
          type: 'DISABLE_DEBUGGER',
          payload: undefined,
        },
        '*'
      );
    });
  });

  describe('sendFromPage', () => {
    it('posts message with PAGE_SOURCE', () => {
      sendFromPage('REACT_DETECTED', { version: '18.2.0' });
      
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          source: 'REACT_DEBUGGER_PAGE',
          type: 'REACT_DETECTED',
          payload: { version: '18.2.0' },
        },
        '*'
      );
    });
  });

  describe('listenFromPage', () => {
    it('adds message event listener', () => {
      const callback = vi.fn();
      listenFromPage(callback);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('returns cleanup function that removes listener', () => {
      const callback = vi.fn();
      const cleanup = listenFromPage(callback);
      
      cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('calls callback for valid PAGE_SOURCE messages', () => {
      const callback = vi.fn();
      listenFromPage(callback);
      
      const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
      const event = new MessageEvent('message', {
        source: window,
        data: {
          source: 'REACT_DEBUGGER_PAGE',
          type: 'TEST_MESSAGE',
          payload: { data: 'test' },
        },
      });
      
      handler(event);
      
      expect(callback).toHaveBeenCalledWith({
        type: 'TEST_MESSAGE',
        payload: { data: 'test' },
      });
    });

    it('ignores messages from other sources', () => {
      const callback = vi.fn();
      listenFromPage(callback);
      
      const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
      const event = new MessageEvent('message', {
        source: window,
        data: {
          source: 'OTHER_SOURCE',
          type: 'TEST_MESSAGE',
        },
      });
      
      handler(event);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores messages without data', () => {
      const callback = vi.fn();
      listenFromPage(callback);
      
      const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
      const event = new MessageEvent('message', {
        source: window,
        data: null,
      });
      
      handler(event);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('listenFromContent', () => {
    it('calls callback for valid CONTENT_SOURCE messages', () => {
      const callback = vi.fn();
      listenFromContent(callback);
      
      const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
      const event = new MessageEvent('message', {
        source: window,
        data: {
          source: 'REACT_DEBUGGER_CONTENT',
          type: 'ENABLE_DEBUGGER',
          payload: {},
        },
      });
      
      handler(event);
      
      expect(callback).toHaveBeenCalledWith({
        type: 'ENABLE_DEBUGGER',
        payload: {},
      });
    });

    it('ignores PAGE_SOURCE messages', () => {
      const callback = vi.fn();
      listenFromContent(callback);
      
      const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
      const event = new MessageEvent('message', {
        source: window,
        data: {
          source: 'REACT_DEBUGGER_PAGE',
          type: 'TEST_MESSAGE',
        },
      });
      
      handler(event);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('generateId', () => {
    it('returns a string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('includes timestamp', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();
      
      const timestamp = parseInt(id.split('-')[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('generates unique ids', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('has correct format', () => {
      const id = generateId();
      const parts = id.split('-');
      expect(parts.length).toBe(2);
      expect(parts[0]).toMatch(/^\d+$/);
      expect(parts[1]).toMatch(/^[a-z0-9]+$/);
    });
  });
});
