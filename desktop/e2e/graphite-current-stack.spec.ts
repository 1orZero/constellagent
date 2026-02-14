import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { resolve, join } from 'path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const appPath = resolve(__dirname, '../out/main/index.js')

const hasGraphiteCli = (() => {
  try {
    execSync('gt --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const { ELECTRON_RENDERER_URL: _ignoredRendererUrl, ...env } = process.env
  const app = await electron.launch({ args: [appPath], env: { ...env, CI_TEST: '1' } })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.waitForSelector('#root', { timeout: 10000 })
  await window.waitForTimeout(1500)
  return { app, window }
}

function createGraphiteTrackedRepo(name: string): string {
  const repoPath = join('/tmp', `test-repo-graphite-current-stack-${name}-${Date.now()}`)
  mkdirSync(repoPath, { recursive: true })

  execSync('git init', { cwd: repoPath })
  execSync('git checkout -b main', { cwd: repoPath })
  execSync('git config user.email "test@test.com"', { cwd: repoPath })
  execSync('git config user.name "Test"', { cwd: repoPath })

  writeFileSync(join(repoPath, 'README.md'), '# Test Repo\n')
  execSync('git add .', { cwd: repoPath })
  execSync('git commit -m "initial commit"', { cwd: repoPath })

  execSync('gt init --trunk main --no-interactive', { cwd: repoPath })

  execSync('git checkout -b stack-1', { cwd: repoPath })
  writeFileSync(join(repoPath, 'L1.txt'), 'layer-1\n')
  execSync('git add L1.txt', { cwd: repoPath })
  execSync('git commit -m "stack 1"', { cwd: repoPath })

  execSync('git checkout -b stack-2', { cwd: repoPath })
  writeFileSync(join(repoPath, 'L2.txt'), 'layer-2\n')
  execSync('git add L2.txt', { cwd: repoPath })
  execSync('git commit -m "stack 2"', { cwd: repoPath })

  execSync('git checkout -b stack-3', { cwd: repoPath })
  writeFileSync(join(repoPath, 'L3.txt'), 'layer-3\n')
  execSync('git add L3.txt', { cwd: repoPath })
  execSync('git commit -m "stack 3"', { cwd: repoPath })

  execSync('gt track stack-1 --parent main --no-interactive', { cwd: repoPath })
  execSync('gt track stack-2 --parent stack-1 --no-interactive', { cwd: repoPath })
  execSync('gt track stack-3 --parent stack-2 --no-interactive', { cwd: repoPath })

  execSync('git checkout stack-2', { cwd: repoPath })
  writeFileSync(join(repoPath, 'UNCOMMITTED.txt'), 'working-tree-change\n')

  return repoPath
}

function createGraphiteBaseOnlyRepo(name: string): string {
  const repoPath = join('/tmp', `test-repo-graphite-base-only-${name}-${Date.now()}`)
  mkdirSync(repoPath, { recursive: true })

  execSync('git init', { cwd: repoPath })
  execSync('git checkout -b main', { cwd: repoPath })
  execSync('git config user.email "test@test.com"', { cwd: repoPath })
  execSync('git config user.name "Test"', { cwd: repoPath })
  writeFileSync(join(repoPath, 'README.md'), '# Base Only\n')
  execSync('git add .', { cwd: repoPath })
  execSync('git commit -m "initial commit"', { cwd: repoPath })

  execSync('gt init --trunk main --no-interactive', { cwd: repoPath })
  return repoPath
}

function cleanupPath(path: string): void {
  try {
    if (existsSync(path)) rmSync(path, { recursive: true, force: true })
  } catch {
    // best effort
  }
}

test.describe('Graphite current-stack changes panel', () => {
  test.skip(!hasGraphiteCli, 'Graphite CLI not installed')

  test('shows current stack and only current layer files', async () => {
    const repoPath = createGraphiteTrackedRepo('middle-layer')
    const { app, window } = await launchApp()

    try {
      await window.evaluate((repo: string) => {
        const store = (window as any).__store.getState()
        store.hydrateState({ projects: [], workspaces: [] })

        const projectId = crypto.randomUUID()
        const workspaceId = crypto.randomUUID()
        store.addProject({
          id: projectId,
          name: 'graphite-current-stack',
          repoPath: repo,
          prLinkProvider: 'graphite',
        })
        store.addWorkspace({
          id: workspaceId,
          name: 'graphite-ws',
          branch: 'stack-2',
          worktreePath: repo,
          projectId,
        })
      }, repoPath)

      await window.locator('button', { hasText: 'Changes' }).click()

      await expect(window.locator('button', { hasText: 'All files' })).toHaveCount(0)
      await expect(window.locator('button', { hasText: 'Changes 1' })).toHaveCount(0)
      await expect(window.locator('[class*="sectionLabel"]', { hasText: 'Changes' })).toBeVisible({ timeout: 10000 })
      await expect(window.locator('[class*="graphiteCurrentBranch"]', { hasText: 'stack-2' })).toBeVisible({ timeout: 5000 })
      await expect(window.locator('[class*="graphiteChildFile"]', { hasText: 'UNCOMMITTED.txt' })).toBeVisible({ timeout: 5000 })
    } finally {
      await app.close()
      cleanupPath(repoPath)
    }
  })

  test('shows stack even when project has no prLinkProvider configured', async () => {
    const repoPath = createGraphiteTrackedRepo('provider-optional')
    const { app, window } = await launchApp()

    try {
      await window.evaluate((repo: string) => {
        const store = (window as any).__store.getState()
        store.hydrateState({ projects: [], workspaces: [] })

        const projectId = crypto.randomUUID()
        const workspaceId = crypto.randomUUID()
        store.addProject({
          id: projectId,
          name: 'graphite-provider-optional',
          repoPath: repo,
        })
        store.addWorkspace({
          id: workspaceId,
          name: 'graphite-ws',
          branch: 'stack-2',
          worktreePath: repo,
          projectId,
        })
      }, repoPath)

      await window.locator('button', { hasText: 'Changes' }).click()
      await expect(window.locator('button', { hasText: 'All files' })).toHaveCount(0)
      await expect(window.locator('[class*="graphiteCurrentBranch"]', { hasText: 'stack-2' })).toBeVisible({ timeout: 10000 })
    } finally {
      await app.close()
      cleanupPath(repoPath)
    }
  })

  test('falls back to original changes view when stack only has trunk', async () => {
    const repoPath = createGraphiteBaseOnlyRepo('main-only')
    const { app, window } = await launchApp()

    try {
      await window.evaluate((repo: string) => {
        const store = (window as any).__store.getState()
        store.hydrateState({ projects: [], workspaces: [] })

        const projectId = crypto.randomUUID()
        const workspaceId = crypto.randomUUID()
        store.addProject({
          id: projectId,
          name: 'graphite-base-only',
          repoPath: repo,
        })
        store.addWorkspace({
          id: workspaceId,
          name: 'graphite-base-only-ws',
          branch: 'main',
          worktreePath: repo,
          projectId,
        })
      }, repoPath)

      await window.locator('button', { hasText: 'Changes' }).click()

      await expect(window.locator('text=No changes')).toBeVisible({ timeout: 10000 })
      await expect(window.locator('text=0 branches stacked')).toHaveCount(0)
      await expect(window.locator('button', { hasText: 'All files' })).toHaveCount(0)
    } finally {
      await app.close()
      cleanupPath(repoPath)
    }
  })
})
