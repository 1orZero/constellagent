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

export function normalizeTerminalFontFamily(value: string): string {
  const raw = value.trim()
  if (!raw) return DEFAULT_TERMINAL_FONT_FAMILY

  const parts = raw
    .split(',')
    .map(normalizeFamilyPart)
    .filter((part) => part.length > 0)

  if (parts.length === 0) return DEFAULT_TERMINAL_FONT_FAMILY
  if (!hasGenericFamily(parts)) parts.push('monospace')

  return parts.join(', ')
}
