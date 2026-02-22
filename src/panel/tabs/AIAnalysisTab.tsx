import { useState, useCallback, useRef, useEffect } from 'react';
import type { TabState, AIAnalysisResult, AIAnalysisItem, AIAnalysisSeverity, AIConfig } from '@/types';
import { DEFAULT_AI_CONFIG } from '@/types';
import { buildSnapshot } from '@/services/snapshot-builder';
import { analyzeSnapshot, AIAnalysisError, loadAIConfig, saveAIConfig } from '@/services/ai-client';
import { tokenOptimizer } from '@/services/token-optimizer';

interface AIAnalysisTabProps {
  state: TabState;
}

const SEVERITY_STYLES: Record<AIAnalysisSeverity, { iconClass: string; color: string; bg: string }> = {
  critical: { iconClass: 'indicator-dot indicator-dot--critical', color: '#ff4444', bg: 'rgba(255, 68, 68, 0.08)' },
  warning: { iconClass: 'indicator-dot indicator-dot--warning', color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.08)' },
  info: { iconClass: 'indicator-dot indicator-dot--info', color: '#4488ff', bg: 'rgba(68, 136, 255, 0.08)' },
  success: { iconClass: 'indicator-dot indicator-dot--success', color: '#44bb44', bg: 'rgba(68, 187, 68, 0.08)' },
};

const SECTION_CONFIG = [
  { key: 'security' as const, label: 'Security', iconClass: 'section-badge section-badge--security' },
  { key: 'crashRisks' as const, label: 'Crash Risks', iconClass: 'indicator-dot indicator-dot--critical' },
  { key: 'performance' as const, label: 'Performance', iconClass: 'section-badge section-badge--performance' },
  { key: 'rootCauses' as const, label: 'Root Causes', iconClass: 'action-badge action-badge--search' },
  { key: 'suggestions' as const, label: 'Suggestions', iconClass: 'action-badge action-badge--suggestion' },
];

function AnalysisItemCard({ item }: { item: AIAnalysisItem }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[item.severity];

  return (
    <div
      className="ai-item-card"
      style={{ borderLeftColor: style.color, backgroundColor: style.bg }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="ai-item-header">
        <span className={`ai-item-icon ${style.iconClass}`} />
        <span className="ai-item-title">{item.title}</span>
        <span className="ai-item-severity" style={{ color: style.color }}>
          {item.severity}
        </span>
        <span className="ai-item-expand">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="ai-item-body">
          <p className="ai-item-desc">{item.description}</p>
          {item.suggestion && (
            <div className="ai-item-suggestion">
              <strong>Fix:</strong> {item.suggestion}
            </div>
          )}
          {item.affectedComponents && item.affectedComponents.length > 0 && (
            <div className="ai-item-components">
              <strong>Affected:</strong> {item.affectedComponents.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  config,
  onSave,
  onClose,
  isSubscribed,
  onValidateKey,
}: {
  config: AIConfig;
  onSave: (config: Partial<AIConfig>) => void;
  onClose: () => void;
  isSubscribed: boolean;
  onValidateKey: (key: string) => Promise<boolean>;
}) {
  const [model, setModel] = useState(config.model);
  const [subscriptionKey, setSubscriptionKey] = useState(config.subscriptionKey);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>(
    isSubscribed ? 'valid' : 'idle'
  );

  const handleValidateKey = async () => {
    if (!subscriptionKey.trim()) return;
    setKeyStatus('validating');
    const valid = await onValidateKey(subscriptionKey);
    setKeyStatus(valid ? 'valid' : 'invalid');
  };

  const handleSave = () => {
    onSave({ model, subscriptionKey: subscriptionKey.trim() });
    onClose();
  };

  return (
    <div className="ai-settings-panel">
      <div className="ai-settings-header">
        <h3>AI Settings</h3>
        <button className="ai-settings-close" onClick={onClose}>✕</button>
      </div>
      <div className="ai-settings-body">
        <label className="ai-settings-field">
          <span>Model</span>
          <select value={model} onChange={e => setModel(e.target.value)}>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fast)</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5.1-codex-mini">GPT-5.1 Codex Mini</option>
          </select>
        </label>
        <label className="ai-settings-field">
          <span>
            API Key
            {keyStatus === 'valid' && <span className="ai-key-status ai-key-status--valid">Active</span>}
            {keyStatus === 'invalid' && <span className="ai-key-status ai-key-status--invalid">Invalid</span>}
          </span>
          <div className="ai-key-input-row">
            <input
              type="password"
              value={subscriptionKey}
              onChange={e => {
                setSubscriptionKey(e.target.value);
                if (keyStatus !== 'idle') setKeyStatus('idle');
              }}
              placeholder="Enter subscription key"
            />
            <button
              className="ai-btn ai-btn-small"
              onClick={handleValidateKey}
              disabled={!subscriptionKey.trim() || keyStatus === 'validating'}
            >
              {keyStatus === 'validating' ? '...' : 'Verify'}
            </button>
          </div>
          <span className="ai-key-hint">
            Subscription key unlocks unlimited AI analysis calls.
          </span>
        </label>
        <div className="ai-settings-contact">
          <p>Need more quota or premium features?</p>
          <a href="mailto:hoainho.work@gmail.com" className="ai-settings-contact-link">
            hoainho.work@gmail.com
          </a>
        </div>
        <div className="ai-settings-actions">
          <button className="ai-btn ai-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="ai-btn ai-btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function RateLimitPaywall({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="ai-paywall">
      <div className="ai-paywall-icon">
        <span className="empty-state-icon empty-state-icon--lock" />
      </div>
      <h3>Free Analysis Limit Reached</h3>
      <p>You've used all 3 free AI analysis calls for this session.</p>
      <p className="ai-paywall-unlock">Enter your subscription API Key in Settings to unlock unlimited access.</p>
      <div className="ai-paywall-actions">
        <button className="ai-btn ai-btn-primary" onClick={onOpenSettings}>
          Enter API Key
        </button>
        <a href="mailto:hoainho.work@gmail.com" className="ai-btn ai-btn-secondary ai-btn-link">
          Get a Key
        </a>
      </div>
    </div>
  );
}

export function AIAnalysisTab({ state }: AIAnalysisTabProps) {
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadAIConfig().then(async (loaded) => {
      setConfig(loaded);
      if (loaded.subscriptionKey) {
        const valid = await tokenOptimizer.validateSubscriptionKey(loaded.subscriptionKey);
        setIsSubscribed(valid);
      }
    });
  }, []);

  const handleValidateKey = useCallback(async (key: string): Promise<boolean> => {
    const valid = await tokenOptimizer.validateSubscriptionKey(key);
    setIsSubscribed(valid);
    return valid;
  }, []);

  const handleAnalyze = useCallback(async () => {
    setError(null);
    setIsAnalyzing(true);

    abortRef.current = new AbortController();

    try {
      const snapshot = buildSnapshot(state);
      const analysisResult = await analyzeSnapshot(snapshot, {
        config,
        signal: abortRef.current.signal,
      });
      setResult(analysisResult);
    } catch (err) {
      if (err instanceof AIAnalysisError) {
        if (err.code === 'ABORTED') return;
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    } finally {
      setIsAnalyzing(false);
      abortRef.current = null;
    }
  }, [state, config]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsAnalyzing(false);
  }, []);

  const handleSaveConfig = useCallback((partial: Partial<AIConfig>) => {
    const newConfig = { ...config, ...partial };
    setConfig(newConfig);
    saveAIConfig(partial);
  }, [config]);

  const rateInfo = tokenOptimizer.checkRateLimit();
  const cacheSize = tokenOptimizer.getCacheSize();
  const totalTokens = tokenOptimizer.getTotalTokensUsed();

  const hasData = state.issues.length > 0
    || state.components.length > 0
    || (state.memoryReport?.crashes?.length ?? 0) > 0
    || state.memoryReport?.current !== null
    || state.memoryReport?.current !== undefined;

  const totalFindings = result
    ? result.security.length + result.crashRisks.length + result.performance.length + result.rootCauses.length + result.suggestions.length
    : 0;

  const showPaywall = !rateInfo.allowed && !isSubscribed && !isAnalyzing;

  return (
    <div className="tab-panel ai-panel">
      <div className="tab-header">
        <h2><span className="section-badge section-badge--ai" /> AI Analysis</h2>
        <div className="tab-header-actions">
          {isSubscribed && <span className="ai-pro-badge">PRO</span>}
          <button
            className="ai-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="AI Settings"
          >
            <span className="action-badge action-badge--settings" />
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
          isSubscribed={isSubscribed}
          onValidateKey={handleValidateKey}
        />
      )}

      <div className="ai-status-bar">
        <span className="ai-status-item" title="Remaining API calls">
          <span className="ai-status-icon ai-status-icon--chart" />{' '}
          {rateInfo.unlimited ? 'Unlimited' : `${rateInfo.remainingCalls}/3 calls`}
        </span>
        <span className="ai-status-item" title="Cached analyses">
          <span className="ai-status-icon ai-status-icon--cache" /> {cacheSize} cached
        </span>
        <span className="ai-status-item" title="Total tokens used this session">
          <span className="ai-status-icon ai-status-icon--tokens" /> {totalTokens.toLocaleString()} tokens
        </span>
        <span className="ai-status-item" title="AI model">
          <span className="ai-status-icon ai-status-icon--model" /> {config.model}
        </span>
      </div>

      {showPaywall && (
        <RateLimitPaywall onOpenSettings={() => setShowSettings(true)} />
      )}

      {!showPaywall && (
        <div className="ai-action-bar">
          {isAnalyzing ? (
            <button className="ai-btn ai-btn-cancel" onClick={handleCancel}>
              <span className="action-badge action-badge--cancel" /> Cancel Analysis
            </button>
          ) : (
            <button
              className="ai-btn ai-btn-primary ai-analyze-btn"
              onClick={handleAnalyze}
              disabled={!hasData || !rateInfo.allowed}
            >
              <span className="action-badge action-badge--analyze" /> Analyze Snapshot
            </button>
          )}
          {!rateInfo.allowed && !showPaywall && (
            <span className="ai-rate-warning">
              Rate limited. Try again in {Math.ceil(rateInfo.resetInMs / 1000)}s
            </span>
          )}
        </div>
      )}

      {isAnalyzing && (
        <div className="ai-loading">
          <div className="ai-loading-spinner" />
          <p>Analyzing snapshot with {config.model}...</p>
          <p className="ai-loading-hint">This typically takes 5-15 seconds</p>
        </div>
      )}

      {error && (
        <div className="ai-error">
          <span className="ai-error-icon indicator-dot indicator-dot--error" />
          <span className="ai-error-msg">{error}</span>
        </div>
      )}

      {result && !isAnalyzing && (
        <div className="ai-results">
          <div className="ai-summary">
            <div className="ai-summary-header">
              <h3>Summary</h3>
              <div className="ai-summary-meta">
                <span>{result.model}</span>
                <span>{result.latencyMs}ms</span>
                <span>{result.tokenUsage.total} tokens</span>
                <span>{totalFindings} findings</span>
              </div>
            </div>
            <p className="ai-summary-text">{result.summary}</p>
          </div>

          {SECTION_CONFIG.map(section => {
            const items: AIAnalysisItem[] = result[section.key];
            if (items.length === 0) return null;

            const criticalCount = items.filter(i => i.severity === 'critical').length;
            const warningCount = items.filter(i => i.severity === 'warning').length;

            return (
              <section key={section.key} className="ai-section">
                <h3 className="ai-section-title">
                  <span><span className={section.iconClass} /> {section.label}</span>
                  <span className="ai-section-badges">
                    {criticalCount > 0 && (
                      <span className="ai-badge ai-badge-critical">{criticalCount} critical</span>
                    )}
                    {warningCount > 0 && (
                      <span className="ai-badge ai-badge-warning">{warningCount} warning</span>
                    )}
                    <span className="ai-badge">{items.length} total</span>
                  </span>
                </h3>
                <div className="ai-items-list">
                  {items.map((item, idx) => (
                    <AnalysisItemCard key={`${section.key}-${idx}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="ai-disclaimer">
            <span className="disclaimer-badge" /> AI analysis may contain inaccuracies. Always verify suggestions before implementing.
          </div>
        </div>
      )}

      {!result && !isAnalyzing && !error && !showPaywall && (
        <div className="empty-state">
          <span className="empty-state-icon empty-state-icon--robot" />
          <h2>AI-Powered Analysis</h2>
          <p>Click "Analyze Snapshot" to get AI-powered insights about your React application.</p>
          <p className="hint">
            Analysis includes: security warnings, crash risk detection, performance bottlenecks, root cause explanations, and suggested fixes.
          </p>
        </div>
      )}
    </div>
  );
}
