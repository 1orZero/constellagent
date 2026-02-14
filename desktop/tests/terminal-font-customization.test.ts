import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { DEFAULT_SETTINGS } from '../src/renderer/store/types'

describe('terminal font customization', () => {
  test('provides a default terminal font family in settings', () => {
    expect(DEFAULT_SETTINGS.terminalFontFamily).toBe("'SF Mono', Menlo, 'Cascadia Code', monospace")
  })

  test('applies updated font family to live terminals', () => {
    const source = readFileSync('src/renderer/components/Terminal/TerminalPanel.tsx', 'utf-8')
    expect(/term\.options\.fontFamily\s*=/.test(source)).toBe(true)
  })
})
