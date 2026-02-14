import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/app-store'
import { createDefaultShortcutSettings } from '../../store/types'
import type { Settings, ShortcutBinding, ShortcutSettings } from '../../store/types'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './SettingsPanel.module.css'

const SLOT_COUNT = 9

const FIXED_SHORTCUTS = [
  { action: 'Quick open file', keys: '⌘P' },
  { action: 'New terminal', keys: '⌘T' },
  { action: 'Close tab', keys: '⌘W' },
  { action: 'Close all tabs', keys: '⇧⌘W' },
  { action: 'Next tab', keys: '⇧⌘]' },
  { action: 'Previous tab', keys: '⇧⌘[' },
  { action: 'Next workspace', keys: '⇧⌘↓' },
  { action: 'Previous workspace', keys: '⇧⌘↑' },
  { action: 'New workspace', keys: '⌘N' },
  { action: 'Toggle sidebar', keys: '⌘B' },
  { action: 'Toggle right panel', keys: '⌥⌘B' },
  { action: 'Files panel', keys: '⇧⌘E' },
  { action: 'Changes panel', keys: '⇧⌘G' },
  { action: 'Focus terminal', keys: '⌘J' },
  { action: 'Zoom in', keys: '⌘+' },
  { action: 'Zoom out', keys: '⌘−' },
  { action: 'Reset zoom', keys: '⌘0' },
  { action: 'Settings', keys: '⌘,' },
]

const MODIFIER_CODES = new Set([
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
])

function isShortcutBinding(value: ShortcutBinding | null | undefined): value is ShortcutBinding {
  if (!value) return false
  return typeof value.code === 'string'
}

function normalizeShortcutSlots(shortcuts: Array<ShortcutBinding | null> | undefined): Array<ShortcutBinding | null> {
  const source = Array.isArray(shortcuts) ? shortcuts : []
  return Array.from({ length: SLOT_COUNT }, (_v, index) => {
    const binding = source[index]
    return isShortcutBinding(binding) ? binding : null
  })
}

function ensureShortcutSettings(settings: ShortcutSettings | undefined): ShortcutSettings {
  const defaults = createDefaultShortcutSettings()
  if (!settings) return defaults
  return {
    tabByIndex: normalizeShortcutSlots(settings.tabByIndex ?? defaults.tabByIndex),
    workspaceByIndex: normalizeShortcutSlots(settings.workspaceByIndex ?? defaults.workspaceByIndex),
  }
}

function formatCode(code: string): string {
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Key')) return code.slice(3)
  if (code === 'Comma') return ','
  if (code === 'BracketLeft') return '['
  if (code === 'BracketRight') return ']'
  if (code === 'Minus') return '-'
  if (code === 'Equal') return '='
  if (code === 'ArrowUp') return '↑'
  if (code === 'ArrowDown') return '↓'
  if (code === 'ArrowLeft') return '←'
  if (code === 'ArrowRight') return '→'
  if (code === 'Enter') return '↵'
  if (code === 'Space') return 'Space'
  return code
}

function formatShortcut(binding: ShortcutBinding | null): string {
  if (!binding) return 'Not set'
  return `${binding.ctrl ? '⌃' : ''}${binding.alt ? '⌥' : ''}${binding.shift ? '⇧' : ''}${binding.meta ? '⌘' : ''}${formatCode(binding.code)}`
}

function sameShortcut(a: ShortcutBinding | null, b: ShortcutBinding | null): boolean {
  if (!a || !b) return false
  return (
    a.code === b.code
    && a.meta === b.meta
    && a.ctrl === b.ctrl
    && a.shift === b.shift
    && a.alt === b.alt
  )
}

type ShortcutScope = 'tabByIndex' | 'workspaceByIndex'

interface RecordingTarget {
  scope: ShortcutScope
  index: number
}

function ToggleRow({ label, description, value, onChange }: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={styles.row} onClick={() => onChange(!value)}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDescription}>{description}</div>
      </div>
      <button
        className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
        onClick={(e) => { e.stopPropagation(); onChange(!value) }}
      >
        <span className={styles.toggleKnob} />
      </button>
    </div>
  )
}

function TextRow({ label, description, value, onChange, placeholder }: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDescription}>{description}</div>
      </div>
      <input
        className={styles.textInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function NumberRow({ label, description, value, onChange, min = 8, max = 32 }: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDescription}>{description}</div>
      </div>
      <div className={styles.stepper}>
        <button
          className={styles.stepperBtn}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          −
        </button>
        <span className={styles.stepperValue}>{value}</span>
        <button
          className={styles.stepperBtn}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  )
}

function ZoomRow({ label, description, value, onChange }: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
}) {
  const min = 0.5
  const max = 2
  const step = 0.1
  const display = `${Math.round(value * 100)}%`

  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDescription}>{description}</div>
      </div>
      <div className={styles.stepper}>
        <button
          className={styles.stepperBtn}
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          disabled={value <= min}
        >
          −
        </button>
        <span className={styles.stepperValue}>{display}</span>
        <button
          className={styles.stepperBtn}
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  )
}

function ShortcutBindingRow({
  label,
  description,
  value,
  recording,
  onStartRecording,
  onCapture,
  onClear,
}: {
  label: string
  description: string
  value: ShortcutBinding | null
  recording: boolean
  onStartRecording: () => void
  onCapture: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  onClear: () => void
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDescription}>{description}</div>
      </div>
      <div className={styles.shortcutControls}>
        <button
          className={`${styles.shortcutCaptureBtn} ${recording ? styles.shortcutCaptureBtnRecording : ''}`}
          data-shortcut-recorder="true"
          onClick={onStartRecording}
          onKeyDown={onCapture}
        >
          {recording ? 'Press shortcut...' : formatShortcut(value)}
        </button>
        <button
          className={styles.shortcutClearBtn}
          data-shortcut-recorder="true"
          onClick={onClear}
          disabled={!value}
        >
          Clear
        </button>
      </div>
    </div>
  )
}

function ClaudeHooksSection() {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    window.api.claude.checkHooks().then((result: { installed: boolean }) => {
      setInstalled(result.installed)
    }).catch(() => setInstalled(false))
  }, [])

  const handleInstall = async () => {
    setInstalling(true)
    try {
      await window.api.claude.installHooks()
      setInstalled(true)
    } catch {
      setInstalled(false)
    } finally {
      setInstalling(false)
    }
  }

  const handleUninstall = async () => {
    setInstalling(true)
    try {
      await window.api.claude.uninstallHooks()
      setInstalled(false)
    } catch {
      // keep current state
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>Claude Code hooks</div>
        <div className={styles.rowDescription}>
          Show an unread indicator when Claude Code finishes responding in a workspace
        </div>
      </div>
      {installed === true ? (
        <button
          className={styles.actionBtnDanger}
          onClick={handleUninstall}
          disabled={installing}
        >
          {installing ? 'Removing...' : 'Uninstall'}
        </button>
      ) : (
        <button
          className={styles.actionBtn}
          onClick={handleInstall}
          disabled={installing || installed === null}
        >
          {installing ? 'Installing...' : 'Install'}
        </button>
      )}
    </div>
  )
}

function CodexNotifySection() {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    window.api.codex.checkNotify().then((result: { installed: boolean }) => {
      setInstalled(result.installed)
    }).catch(() => setInstalled(false))
  }, [])

  const handleInstall = async () => {
    setInstalling(true)
    try {
      await window.api.codex.installNotify()
      setInstalled(true)
    } catch {
      setInstalled(false)
    } finally {
      setInstalling(false)
    }
  }

  const handleUninstall = async () => {
    setInstalling(true)
    try {
      await window.api.codex.uninstallNotify()
      setInstalled(false)
    } catch {
      // keep current state
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>Codex notify hook</div>
        <div className={styles.rowDescription}>
          Show done/unread state for Codex turns and clear active state when a turn completes
        </div>
      </div>
      {installed === true ? (
        <button
          className={styles.actionBtnDanger}
          onClick={handleUninstall}
          disabled={installing}
        >
          {installing ? 'Removing...' : 'Uninstall'}
        </button>
      ) : (
        <button
          className={styles.actionBtn}
          onClick={handleInstall}
          disabled={installing || installed === null}
        >
          {installing ? 'Installing...' : 'Install'}
        </button>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const addToast = useAppStore((s) => s.addToast)
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null)

  const shortcutSettings = ensureShortcutSettings(settings.shortcuts)

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    updateSettings({ [key]: value })
  }

  const updateShortcut = (scope: ShortcutScope, index: number, binding: ShortcutBinding | null) => {
    const next = ensureShortcutSettings(settings.shortcuts)
    const slots = [...next[scope]]
    slots[index] = binding
    update('shortcuts', {
      ...next,
      [scope]: slots,
    })
  }

  const findShortcutConflict = (scope: ShortcutScope, index: number, candidate: ShortcutBinding) => {
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      if (!(scope === 'tabByIndex' && slot === index) && sameShortcut(shortcutSettings.tabByIndex[slot], candidate)) {
        return `Tab ${slot + 1}`
      }
      if (!(scope === 'workspaceByIndex' && slot === index) && sameShortcut(shortcutSettings.workspaceByIndex[slot], candidate)) {
        return `Workspace ${slot + 1}`
      }
    }
    return null
  }

  const captureShortcut = (scope: ShortcutScope, index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      setRecordingTarget(null)
      return
    }

    if (MODIFIER_CODES.has(event.code)) return

    const binding: ShortcutBinding = {
      code: event.code,
      meta: event.metaKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    }

    if (!binding.meta && !binding.ctrl) {
      addToast({
        id: crypto.randomUUID(),
        message: 'Shortcut must include Command or Control.',
        type: 'error',
      })
      return
    }

    const conflict = findShortcutConflict(scope, index, binding)
    if (conflict) {
      addToast({
        id: crypto.randomUUID(),
        message: `Shortcut already used by ${conflict}.`,
        type: 'error',
      })
      return
    }

    updateShortcut(scope, index, binding)
    setRecordingTarget(null)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettings()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSettings])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <Tooltip label="Back" shortcut="⌘,">
              <button className={styles.backBtn} onClick={toggleSettings}>‹</button>
            </Tooltip>
            <h2 className={styles.title}>Settings</h2>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.inner}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Appearance</div>

          <ZoomRow
            label="Interface zoom"
            description="Scale the entire app interface"
            value={settings.uiZoomFactor}
            onChange={(v) => update('uiZoomFactor', v)}
          />

          <NumberRow
            label="Terminal font size"
            description="Font size in pixels for terminal tabs"
            value={settings.terminalFontSize}
            onChange={(v) => update('terminalFontSize', v)}
          />

          <TextRow
            label="Terminal font family"
            description="Comma-separated font list; names with spaces are auto-quoted"
            value={settings.terminalFontFamily}
            onChange={(v) => update('terminalFontFamily', v)}
            placeholder="'SF Mono', Menlo, 'Cascadia Code', monospace"
          />

          <NumberRow
            label="Editor font size"
            description="Font size in pixels for file and diff editors"
            value={settings.editorFontSize}
            onChange={(v) => update('editorFontSize', v)}
          />
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>General</div>

          <ToggleRow
            label="Confirm on close"
            description="Show confirmation when closing tabs with unsaved changes"
            value={settings.confirmOnClose}
            onChange={(v) => update('confirmOnClose', v)}
          />

          <ToggleRow
            label="Auto-save on blur"
            description="Automatically save files when switching away from a tab"
            value={settings.autoSaveOnBlur}
            onChange={(v) => update('autoSaveOnBlur', v)}
          />

          <ToggleRow
            label="Restore workspace"
            description="Restore the last active workspace when the app starts"
            value={settings.restoreWorkspace}
            onChange={(v) => update('restoreWorkspace', v)}
          />

          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>New workspace mode</div>
              <div className={styles.rowDescription}>
                Default creation mode for new workspaces.
              </div>
            </div>
            <select
              className={styles.selectInput}
              value={settings.workspaceCreationMode}
              onChange={(e) =>
                update('workspaceCreationMode', e.target.value as Settings['workspaceCreationMode'])
              }
            >
              <option value="worktree">Worktree</option>
              <option value="clone">Multiple clone</option>
            </select>
          </div>

          <ToggleRow
            label="Inline diffs"
            description="Show diffs inline instead of side-by-side"
            value={settings.diffInline}
            onChange={(v) => update('diffInline', v)}
          />

          <TextRow
            label="Default shell"
            description="Path to shell executable (leave empty for system default)"
            value={settings.defaultShell}
            onChange={(v) => update('defaultShell', v)}
            placeholder="/bin/zsh"
          />

          <ToggleRow
            label="Use login shell"
            description="Start terminal as a login shell to load profile PATH"
            value={settings.useLoginShell}
            onChange={(v) => update('useLoginShell', v)}
          />

          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>PR link provider</div>
              <div className={styles.rowDescription}>
                Set per project in Project Settings (gear icon in the sidebar).
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Agent Integrations</div>
          <ClaudeHooksSection />
          <CodexNotifySection />
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Keyboard Shortcuts</div>

          <div className={styles.shortcutSubTitle}>Configurable</div>

          {Array.from({ length: SLOT_COUNT }, (_v, index) => (
            <ShortcutBindingRow
              key={`tab-shortcut-${index}`}
              label={`Tab ${index + 1}`}
              description="Switch to tab by position"
              value={shortcutSettings.tabByIndex[index]}
              recording={recordingTarget?.scope === 'tabByIndex' && recordingTarget.index === index}
              onStartRecording={() => setRecordingTarget({ scope: 'tabByIndex', index })}
              onCapture={(event) => captureShortcut('tabByIndex', index, event)}
              onClear={() => updateShortcut('tabByIndex', index, null)}
            />
          ))}

          {Array.from({ length: SLOT_COUNT }, (_v, index) => (
            <ShortcutBindingRow
              key={`workspace-shortcut-${index}`}
              label={`Workspace ${index + 1}`}
              description="Switch to workspace by sidebar order"
              value={shortcutSettings.workspaceByIndex[index]}
              recording={recordingTarget?.scope === 'workspaceByIndex' && recordingTarget.index === index}
              onStartRecording={() => setRecordingTarget({ scope: 'workspaceByIndex', index })}
              onCapture={(event) => captureShortcut('workspaceByIndex', index, event)}
              onClear={() => updateShortcut('workspaceByIndex', index, null)}
            />
          ))}

          <div className={styles.shortcutSubTitle}>Fixed</div>

          {FIXED_SHORTCUTS.map((s) => (
            <div key={s.action} className={styles.shortcutRow}>
              <span className={styles.shortcutAction}>{s.action}</span>
              <kbd className={styles.kbd}>{s.keys}</kbd>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
