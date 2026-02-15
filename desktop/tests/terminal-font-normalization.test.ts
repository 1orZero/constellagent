import { describe, expect, test } from 'bun:test'
import { normalizeTerminalFontFamily } from '../src/renderer/lib/terminal-font'
import { DEFAULT_TERMINAL_FONT_FAMILY } from '../src/renderer/store/types'

describe('normalizeTerminalFontFamily', () => {
  test('falls back to default when empty', () => {
    expect(normalizeTerminalFontFamily('')).toBe(DEFAULT_TERMINAL_FONT_FAMILY)
  })

  test('quotes a single family with spaces and appends monospace fallback', () => {
    expect(normalizeTerminalFontFamily('JetBrains Mono Nerd Font'))
      .toBe("'JetBrains Mono Nerd Font', 'Symbols Nerd Font Mono', monospace")
  })

  test('keeps existing comma-separated values and injects symbols fallback', () => {
    expect(normalizeTerminalFontFamily("JetBrainsMono Nerd Font, 'SF Mono', monospace"))
      .toBe("'JetBrainsMono Nerd Font', 'SF Mono', 'Symbols Nerd Font Mono', monospace")
  })

  test('does not duplicate symbols fallback when already provided', () => {
    expect(normalizeTerminalFontFamily("CaskaydiaCove Nerd Font Mono, 'Symbols Nerd Font Mono', monospace"))
      .toBe("'CaskaydiaCove Nerd Font Mono', 'Symbols Nerd Font Mono', monospace")
  })
})
