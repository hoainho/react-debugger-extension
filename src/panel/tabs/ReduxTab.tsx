import { useState, useCallback } from 'react';
import type { ReduxAction } from '@/types';

interface ReduxTabProps {
  detected: boolean;
  state: unknown;
  actions: ReduxAction[];
  tabId: number;
}

interface EditingStateData {
  path: string[];
  value: string;
  type: 'string' | 'number' | 'boolean' | 'null' | 'json';
}

type EditingState = EditingStateData | null;

export function ReduxTab({ detected, state, actions, tabId }: ReduxTabProps) {
  const [actionType, setActionType] = useState('');
  const [actionPayload, setActionPayload] = useState('{}');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']));
  const [editingState, setEditingState] = useState<EditingState>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshState = useCallback(() => {
    chrome.runtime.sendMessage({
      type: 'REFRESH_REDUX_STATE',
      tabId,
    });
  }, [tabId]);

  const clearOverrides = useCallback(() => {
    chrome.runtime.sendMessage({
      type: 'CLEAR_REDUX_OVERRIDES',
      tabId,
    });
    setTimeout(refreshState, 100);
  }, [tabId, refreshState]);

  if (!detected) {
    return (
      <div className="tab-panel">
        <div className="tab-header">
          <h2>🗄️ Redux DevTools</h2>
        </div>
        <div className="empty-state">
          <span className="empty-icon">🗄️</span>
          <p>Redux not detected</p>
          <p className="hint">
            Make sure your app uses Redux and the store is accessible via one of the methods below.
          </p>
        </div>
        <div className="redux-setup-guide">
          <h3>Setup Guide</h3>
          <p className="setup-intro">
            To enable Redux debugging, expose your store using one of these methods:
          </p>
          
          <div className="setup-method">
            <h4>Option 1: window.store (Recommended)</h4>
            <pre className="code-snippet">{`// In your store configuration file
const store = configureStore({ reducer: rootReducer });

// Expose for debugging (development only)
if (process.env.NODE_ENV === 'development') {
  window.store = store;
}

export default store;`}</pre>
          </div>
          
          <div className="setup-method">
            <h4>Option 2: window.__REDUX_STORE__</h4>
            <pre className="code-snippet">{`// Alternative naming convention
if (process.env.NODE_ENV === 'development') {
  window.__REDUX_STORE__ = store;
}`}</pre>
          </div>
          
          <div className="setup-method">
            <h4>Option 3: Redux DevTools Extension</h4>
            <p className="method-desc">
              If you have the Redux DevTools browser extension installed, this debugger will automatically detect it.
            </p>
          </div>
          
          <div className="detection-status">
            <h4>Detection Methods Checked:</h4>
            <ul className="detection-checklist">
              <li><span className="check-icon">✗</span> window.store</li>
              <li><span className="check-icon">✗</span> window.__REDUX_STORE__</li>
              <li><span className="check-icon">✗</span> Redux DevTools Extension</li>
              <li><span className="check-icon">✗</span> React-Redux Provider context</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const dispatchAction = () => {
    if (!actionType.trim()) return;
    
    try {
      const payload = JSON.parse(actionPayload);
      chrome.runtime.sendMessage({
        type: 'DISPATCH_REDUX_ACTION',
        tabId,
        payload: { type: actionType, ...payload },
      });
      setActionType('');
      setActionPayload('{}');
    } catch {
      alert('Invalid JSON payload');
    }
  };

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const paths = new Set<string>(['root']);
    const collectPaths = (value: unknown, currentPath: string) => {
      if (value && typeof value === 'object') {
        paths.add(currentPath);
        if (Array.isArray(value)) {
          value.forEach((_, i) => collectPaths(value[i], `${currentPath}[${i}]`));
        } else {
          Object.keys(value as object).forEach(key => {
            collectPaths((value as Record<string, unknown>)[key], `${currentPath}.${key}`);
          });
        }
      }
    };
    collectPaths(state, 'root');
    setExpandedPaths(paths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['root']));
  };

  const startEditing = (path: string[], value: unknown) => {
    let type: EditingStateData['type'] = 'json';
    let strValue = '';
    
    if (value === null) {
      type = 'null';
      strValue = 'null';
    } else if (typeof value === 'string') {
      type = 'string';
      strValue = value;
    } else if (typeof value === 'number') {
      type = 'number';
      strValue = String(value);
    } else if (typeof value === 'boolean') {
      type = 'boolean';
      strValue = String(value);
    } else {
      type = 'json';
      strValue = JSON.stringify(value, null, 2);
    }
    
    setEditingState({ path, value: strValue, type });
  };

  const saveEdit = () => {
    if (!editingState) return;
    
    let parsedValue: unknown;
    
    switch (editingState.type) {
      case 'null':
        parsedValue = null;
        break;
      case 'string':
        parsedValue = editingState.value;
        break;
      case 'number': {
        const num = Number(editingState.value);
        if (isNaN(num)) {
          alert('Invalid number: ' + editingState.value);
          return;
        }
        parsedValue = num;
        break;
      }
      case 'boolean':
        parsedValue = editingState.value === 'true';
        break;
      case 'json':
        try {
          parsedValue = JSON.parse(editingState.value);
        } catch (e) {
          alert('Invalid JSON: ' + (e as Error).message);
          return;
        }
        break;
      default:
        parsedValue = editingState.value;
    }
    
    console.log('[Redux Edit] Saving:', { path: editingState.path, value: parsedValue, type: editingState.type });
    
    chrome.runtime.sendMessage({
      type: 'SET_REDUX_STATE',
      tabId,
      payload: { 
        path: editingState.path, 
        value: parsedValue 
      },
    });
    
    setEditingState(null);
    setTimeout(refreshState, 150);
  };

  const cancelEdit = () => {
    setEditingState(null);
  };

  const deleteArrayItem = (arrayPath: string[], index: number) => {
    chrome.runtime.sendMessage({
      type: 'DELETE_ARRAY_ITEM',
      tabId,
      payload: { path: arrayPath, index },
    });
    setTimeout(refreshState, 150);
  };

  const moveArrayItem = (arrayPath: string[], fromIndex: number, toIndex: number) => {
    if (toIndex < 0) return;
    chrome.runtime.sendMessage({
      type: 'MOVE_ARRAY_ITEM',
      tabId,
      payload: { path: arrayPath, fromIndex, toIndex },
    });
    setTimeout(refreshState, 150);
  };

  const pathToArray = (pathStr: string): string[] => {
    if (pathStr === 'root') return [];
    return pathStr
      .replace(/^root\.?/, '')
      .split(/\.|\[|\]/)
      .filter(Boolean);
  };

  const renderValue = (value: unknown, path: string, depth: number = 0): React.ReactNode => {
    const pathArray = pathToArray(path);
    const isEditing = editingState && 
      JSON.stringify(editingState.path) === JSON.stringify(pathArray);

    if (isEditing) {
      return (
        <span className="editing-container">
          {editingState!.type === 'json' ? (
            <textarea
              className="edit-input json-edit"
              value={editingState!.value}
              onChange={e => setEditingState({ ...editingState!, value: e.target.value })}
              rows={5}
              autoFocus
            />
          ) : editingState!.type === 'boolean' ? (
            <select
              className="edit-input"
              value={editingState!.value}
              onChange={e => setEditingState({ ...editingState!, value: e.target.value })}
              autoFocus
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              className="edit-input"
              type={editingState!.type === 'number' ? 'number' : 'text'}
              value={editingState!.value}
              onChange={e => setEditingState({ ...editingState!, value: e.target.value })}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                } else if (e.key === 'Escape') {
                  cancelEdit();
                }
              }}
            />
          )}
          <div className="edit-actions">
            <button className="edit-btn save" onClick={saveEdit} title="Save (Enter)">✓</button>
            <button className="edit-btn cancel" onClick={cancelEdit} title="Cancel (Esc)">✗</button>
          </div>
        </span>
      );
    }

    if (value === null) {
      return (
        <span className="json-null editable" onClick={() => startEditing(pathArray, null)}>
          null
        </span>
      );
    }
    if (value === undefined) return <span className="json-undefined">undefined</span>;
    
    const type = typeof value;
    
    if (type === 'string') {
      const strValue = String(value);
      const displayValue = strValue.length > 100 ? strValue.slice(0, 100) + '...' : strValue;
      return (
        <span className="json-string editable" onClick={() => startEditing(pathArray, value)}>
          "{displayValue}"
        </span>
      );
    }
    if (type === 'number') {
      return (
        <span className="json-number editable" onClick={() => startEditing(pathArray, value)}>
          {String(value)}
        </span>
      );
    }
    if (type === 'boolean') {
      return (
        <span className="json-boolean editable" onClick={() => startEditing(pathArray, value)}>
          {String(value)}
        </span>
      );
    }
    
    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      const arrayPathArr = pathToArray(path);
      return (
        <span className="json-array">
          <button className="expand-btn" onClick={() => togglePath(path)}>
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="bracket">[</span>
          <span className="type-hint">Array({value.length})</span>
          {isExpanded ? (
            <div className="json-children">
              {value.map((item, i) => (
                <div key={i} className="json-item array-item-row">
                  <span className="json-index">{i}: </span>
                  {renderValue(item, `${path}[${i}]`, depth + 1)}
                  <span className="array-item-actions">
                    <button 
                      className="array-action-btn" 
                      onClick={() => moveArrayItem(arrayPathArr, i, i - 1)}
                      disabled={i === 0}
                      title="Move up"
                    >↑</button>
                    <button 
                      className="array-action-btn" 
                      onClick={() => moveArrayItem(arrayPathArr, i, i + 1)}
                      disabled={i === value.length - 1}
                      title="Move down"
                    >↓</button>
                    <button 
                      className="array-action-btn delete" 
                      onClick={() => deleteArrayItem(arrayPathArr, i)}
                      title="Delete item"
                    >×</button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <span className="bracket">]</span>
        </span>
      );
    }
    
    if (type === 'object') {
      const obj = value as Record<string, unknown>;
      
      if (obj.__type === 'Date') {
        return <span className="json-date">{String(obj.value)}</span>;
      }
      if (obj.__type === 'Map') {
        return <span className="json-special">[Map({String(obj.size)})]</span>;
      }
      if (obj.__type === 'Set') {
        return <span className="json-special">[Set({String(obj.size)})]</span>;
      }
      
      const keys = Object.keys(obj);
      const isExpanded = expandedPaths.has(path);
      
      const filteredKeys = searchQuery && depth === 0
        ? keys.filter(key => 
            key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            JSON.stringify(obj[key]).toLowerCase().includes(searchQuery.toLowerCase())
          )
        : keys;
      
      return (
        <span className="json-object">
          <button className="expand-btn" onClick={() => togglePath(path)}>
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="bracket">{'{'}</span>
          <span className="type-hint">{keys.length} keys</span>
          {isExpanded ? (
            <div className="json-children">
              {filteredKeys.map(key => (
                <div key={key} className="json-item">
                  <span className="json-key">{key}: </span>
                  {renderValue(obj[key], `${path}.${key}`, depth + 1)}
                </div>
              ))}
            </div>
          ) : null}
          <span className="bracket">{'}'}</span>
        </span>
      );
    }
    
    return <span className="json-unknown">{String(value)}</span>;
  };

  const selectedActionData = selectedAction 
    ? actions.find(a => a.id === selectedAction)
    : null;

  return (
    <div className="tab-panel redux-panel">
      <div className="tab-header">
        <h2>🗄️ Redux DevTools</h2>
        <div className="header-actions">
          <button className="icon-btn" onClick={refreshState} title="Refresh State">
            🔄
          </button>
        </div>
      </div>

      <div className="redux-layout">
        <div className="redux-actions-panel">
          <h3>Action History ({actions.length})</h3>
          <div className="actions-list">
            {actions.length === 0 ? (
              <p className="no-actions">No actions dispatched yet</p>
            ) : (
              actions.slice().reverse().map(action => (
                <div
                  key={action.id}
                  className={`action-item ${selectedAction === action.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAction(
                    selectedAction === action.id ? null : action.id
                  )}
                >
                  <span className="action-time">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="action-type">{action.type}</span>
                </div>
              ))
            )}
          </div>
          
          {selectedActionData && (
            <div className="action-detail">
              <h4>Action: {selectedActionData.type}</h4>
              <div className="action-payload">
                <strong>Payload:</strong>
                <pre>{JSON.stringify(selectedActionData.payload, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="redux-state-panel">
          <div className="state-header">
            <h3>State Tree</h3>
            <div className="state-controls">
              <input
                type="text"
                className="search-input"
                placeholder="Search state..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button className="small-btn" onClick={expandAll} title="Expand All">+</button>
              <button className="small-btn" onClick={collapseAll} title="Collapse All">−</button>
              <button className="small-btn danger" onClick={clearOverrides} title="Reset all edited values">⟲</button>
            </div>
          </div>
          <div className="state-tree">
            {state ? renderValue(state, 'root') : (
              <p className="no-state">No state available</p>
            )}
          </div>
          <p className="edit-hint">💡 Click on any value to edit it directly</p>
        </div>
      </div>

      <section className="section dispatch-section">
        <h3>Dispatch Action</h3>
        <div className="dispatch-form">
          <div className="form-row">
            <label>Type:</label>
            <input
              type="text"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              placeholder="e.g., INCREMENT"
            />
          </div>
          <div className="form-row">
            <label>Payload (JSON):</label>
            <textarea
              value={actionPayload}
              onChange={e => setActionPayload(e.target.value)}
              placeholder='{ "key": "value" }'
              rows={3}
            />
          </div>
          <button className="dispatch-btn" onClick={dispatchAction}>
            Dispatch Action
          </button>
        </div>
      </section>

      <section className="section info-section">
        <h3>💡 State Editing</h3>
        <p className="section-desc">
          Click any value in the state tree to edit it directly. Changes are applied immediately via Redux.
          Use the ⟲ button to reset all edited values.
        </p>
      </section>
    </div>
  );
}
