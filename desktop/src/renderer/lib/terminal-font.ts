import { DEFAULT_TERMINAL_FONT_FAMILY } from '../store/types'

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'math',
  'emoji',
  'fangsong',
])

const SYMBOLS_NERD_FONT_MONO = "'Symbols Nerd Font Mono'"

function stripQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function normalizeFamilyPart(part: string): string {
  const trimmed = part.trim()
  if (!trimmed) return ''

  const quoted =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))

  if (quoted || !/\s/.test(trimmed)) return trimmed
  return `'${trimmed.replace(/'/g, "\\'")}'`
}

function hasGenericFamily(parts: string[]): boolean {
  return parts.some((part) => GENERIC_FONT_FAMILIES.has(stripQuotes(part).toLowerCase()))
}

function hasSymbolsFallback(parts: string[]): boolean {
  return parts.some((part) => {
    const family = stripQuotes(part).toLowerCase()
    return family === 'symbols nerd font mono' || family === 'symbols nerd font'
  })
}

function firstGenericFamilyIndex(parts: string[]): number {
  return parts.findIndex((part) => GENERIC_FONT_FAMILIES.has(stripQuotes(part).toLowerCase()))
}

export function normalizeTerminalFontFamily(value: string): string {
  const raw = value.trim()
  if (!raw) return DEFAULT_TERMINAL_FONT_FAMILY

  const parts = raw
    .split(',')
    .map(normalizeFamilyPart)
    .filter((part) => part.length > 0)

  if (parts.length === 0) return DEFAULT_TERMINAL_FONT_FAMILY
  if (!hasSymbolsFallback(parts)) {
    const genericIndex = firstGenericFamilyIndex(parts)
    if (genericIndex === -1) {
      parts.push(SYMBOLS_NERD_FONT_MONO)
    } else {
      parts.splice(genericIndex, 0, SYMBOLS_NERD_FONT_MONO)
    }
  }
  if (!hasGenericFamily(parts)) parts.push('monospace')

  return parts.join(', ')
}
