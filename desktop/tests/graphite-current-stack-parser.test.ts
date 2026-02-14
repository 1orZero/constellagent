import { describe, expect, test } from 'bun:test'
import { findCurrentParentBranch, parseGraphiteStackOutput } from '../src/main/graphite-service'

describe('parseGraphiteStackOutput', () => {
  test('parses ordered branches and current marker', () => {
    const output = [
      '◯  feature/stack-3',
      '◉  feature/stack-2',
      '◯  feature/stack-1',
      '◯  main',
    ].join('\n')

    const parsed = parseGraphiteStackOutput(output)

    expect(parsed.branches).toEqual([
      'feature/stack-3',
      'feature/stack-2',
      'feature/stack-1',
      'main',
    ])
    expect(parsed.currentBranch).toBe('feature/stack-2')
    expect(parsed.trunkBranch).toBe('main')
  })

  test('ignores untracked branches section', () => {
    const output = [
      '◉  feature/stack-2',
      '◯  feature/stack-1',
      '◯  main',
      '',
      'Untracked branches:',
      'tmp-scratch',
    ].join('\n')

    const parsed = parseGraphiteStackOutput(output)
    expect(parsed.branches).toEqual(['feature/stack-2', 'feature/stack-1', 'main'])
  })

  test('handles ansi-colored output lines', () => {
    const output = '\u001b[33m◉  feature/stack-2\u001b[39m\n\u001b[32m◯  main\u001b[39m'
    const parsed = parseGraphiteStackOutput(output)

    expect(parsed.branches).toEqual(['feature/stack-2', 'main'])
    expect(parsed.currentBranch).toBe('feature/stack-2')
    expect(parsed.trunkBranch).toBe('main')
  })
})

describe('findCurrentParentBranch', () => {
  test('finds the immediate parent branch toward trunk', () => {
    const parent = findCurrentParentBranch(
      ['feature/stack-3', 'feature/stack-2', 'feature/stack-1', 'main'],
      'feature/stack-2',
    )

    expect(parent).toBe('feature/stack-1')
  })

  test('returns null for trunk branch', () => {
    const parent = findCurrentParentBranch(['feature/stack-1', 'main'], 'main')
    expect(parent).toBeNull()
  })
})
