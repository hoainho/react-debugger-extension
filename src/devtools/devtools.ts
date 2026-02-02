chrome.devtools.panels.create(
  'React Debugger',
  'icons/icon16.png',
  'panel.html',
  (panel) => {
    panel.onShown.addListener(() => {
      chrome.runtime.sendMessage({
        type: 'PANEL_READY',
        tabId: chrome.devtools.inspectedWindow.tabId,
      });
    });
  }
);
