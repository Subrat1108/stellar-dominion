// Settings menu (the persistence slice) — a small gear button exposing the
// explicit, confirm-guarded "New Game" reset (must never be one-click-
// accidental, since it erases the save) and surfacing a "couldn't load your
// save" notice when boot fell back to a fresh game. The offline-progression
// pause toggle joins this panel in a later commit.

import { useState, type CSSProperties } from "react";
import { clearGame } from "../app/persistence.ts";
import { loadSettings, saveSettings, type GameSettings } from "../app/settings.ts";

interface SettingsMenuProps {
  /** Set when boot failed to load an existing save and started fresh instead. */
  loadNotice?: string | null;
}

export default function SettingsMenu({ loadNotice = null }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(!!loadNotice);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  async function newGame(): Promise<void> {
    await clearGame();
    location.reload();
  }

  function togglePauseOffline(): void {
    const next: GameSettings = {
      ...settings,
      offlineProgressionPaused: !settings.offlineProgressionPaused,
    };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <>
      {noticeVisible && loadNotice && (
        <div style={noticeStyle}>
          <span>{loadNotice}</span>
          <button onClick={() => setNoticeVisible(false)} style={dismissBtn} aria-label="dismiss">×</button>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} style={gearBtn} title="Settings">⚙</button>

      {open && (
        <div className="interactive" style={panelStyle}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#585b70", marginBottom: 10 }}>
            SETTINGS
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#cdd6f4",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={settings.offlineProgressionPaused}
              onChange={togglePauseOffline}
            />
            Pause offline progression
          </label>
          <div style={{ fontSize: 10, color: "#585b70", marginTop: 4, lineHeight: 1.4 }}>
            When paused, no time is credited while you're away — you resume exactly
            where you left off.
          </div>

          <div style={{ borderTop: "1px solid #2a2c3f", marginTop: 14, paddingTop: 10 }}>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} style={dangerBtn}>
                NEW GAME…
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: "#f38ba8", marginBottom: 8, lineHeight: 1.4 }}>
                  This erases your save and starts over. Are you sure?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={newGame} style={dangerBtn}>YES, ERASE</button>
                  <button onClick={() => setConfirmReset(false)} style={secondaryBtn}>CANCEL</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const gearBtn: CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 28,
  height: 28,
  fontSize: 14,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "rgba(5,6,10,0.85)",
  color: "#a6adc8",
  border: "1px solid #2a2c3f",
  borderRadius: 4,
  zIndex: 90,
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 44,
  right: 10,
  width: 240,
  padding: "12px 14px",
  background: "rgba(5,6,10,0.95)",
  border: "1px solid #2a2c3f",
  borderRadius: 6,
  color: "#cdd6f4",
  font: "12px/1.5 ui-monospace, monospace",
  boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  zIndex: 90,
};

const noticeStyle: CSSProperties = {
  position: "absolute",
  top: 10,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: 460,
  padding: "8px 14px",
  background: "rgba(40,28,8,0.9)",
  border: "1px solid #5c4a1e",
  borderRadius: 4,
  font: "11px/1.4 ui-monospace, monospace",
  color: "#f9e2af",
  display: "flex",
  alignItems: "center",
  gap: 10,
  zIndex: 95,
};

const dismissBtn: CSSProperties = {
  padding: "1px 7px",
  fontSize: 11,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "transparent",
  color: "#f9e2af",
  border: "1px solid #5c4a1e",
  borderRadius: 3,
};

const dangerBtn: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#3a1e24",
  color: "#f38ba8",
  border: "1px solid #5c2a34",
  borderRadius: 4,
  letterSpacing: 0.5,
};

const secondaryBtn: CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#1e2030",
  color: "#a6adc8",
  border: "1px solid #313244",
  borderRadius: 4,
  letterSpacing: 0.5,
};
