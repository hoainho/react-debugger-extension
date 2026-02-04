import '@testing-library/jest-dom';
import { vi } from 'vitest';

const chromeMock = {
  runtime: {
    sendMessage: vi.fn().mockImplementation((_message, callback) => {
      if (callback) {
        callback({ success: true, state: {} });
      }
      return Promise.resolve({ success: true, state: {} });
    }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getManifest: vi.fn().mockReturnValue({ version: '1.0.0' }),
  },
  devtools: {
    inspectedWindow: {
      tabId: 1,
      reload: vi.fn(),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);

export { chromeMock };
