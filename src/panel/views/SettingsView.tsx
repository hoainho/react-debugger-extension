import { MCPPairingPanel } from '../components/MCPPairingPanel';

/**
 * Settings view of the redesigned 5-view shell (S4-5). Mounts the existing
 * MCPPairingPanel so pairing lives inside the new Settings surface (the classic
 * layout kept it on a separate pane). Detector toggles (SettingsTab) compose
 * here too in the full shell; this view owns the MCP wiring.
 */
export function SettingsView() {
  return (
    <div className="settings-view">
      <MCPPairingPanel />
    </div>
  );
}
