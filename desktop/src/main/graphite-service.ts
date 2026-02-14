import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { promisify } from 'util'
import type {
  GraphiteCurrentLayerFile,
  GraphiteCurrentStackSnapshot,
  GraphiteDiffStatus,
} from '../shared/graphite-types'
import { GitService } from './git-service'

const execFileAsync = promisify(execFile)

const ANSI_RE = /\x1b\[[0-9;]*m/g
const GRAPH_MARKER_RE = /[◉◯●○]/

interface ParsedGraphiteStack {
  branches: string[]
  currentBranch: string | null
  trunkBranch: string | null
}

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  })
  return stdout.trimEnd()
}

async function runGt(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('gt', args, {
    cwd,
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  })
  return stdout.trimEnd()
}

export function findCurrentParentBranch(
  branches: string[],
  currentBranch: string | null,
): string | null {
  if (!currentBranch) return null
  const idx = branches.indexOf(currentBranch)
  if (idx < 0) return null
  return branches[idx + 1] ?? null
}

export function parseGraphiteStackOutput(output: string): ParsedGraphiteStack {
  const branches: string[] = []
  let currentBranch: string | null = null
  let trunkBranch: string | null = null

  const lines = output.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.replace(ANSI_RE, '').trim()
    if (!line) continue
    if (line.startsWith('Untracked branches:')) break

    const markerIdx = line.search(GRAPH_MARKER_RE)
    if (markerIdx < 0) continue

    const marker = line[markerIdx]
    const afterMarker = line.slice(markerIdx + 1).trim()
    if (!afterMarker) continue

    const isCurrent = marker === '◉' || afterMarker.includes('(current)')
    const isTrunk = afterMarker.includes('(trunk)')
    const branchName = afterMarker.replace(/\s+\(current\)\s*$/, '').split(/\s+/)[0]?.trim()
    if (!branchName) continue

    branches.push(branchName)
    if (isCurrent) currentBranch = branchName
    if (isTrunk) trunkBranch = branchName
  }

  if (!trunkBranch) trunkBranch = branches[branches.length - 1] ?? null

  return { branches, currentBranch, trunkBranch }
}

function mapNameStatusCode(code: string): GraphiteDiffStatus {
  const c = code.toUpperCase()
  if (c.startsWith('A')) return 'added'
  if (c.startsWith('D')) return 'deleted'
  if (c.startsWith('R') || c.startsWith('C')) return 'renamed'
  return 'modified'
}

function parseNameStatus(output: string): GraphiteCurrentLayerFile[] {
  const files: GraphiteCurrentLayerFile[] = []
  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const statusCode = parts[0] ?? ''
    if (!statusCode) continue

    let path = parts[1] ?? ''
    if (statusCode.toUpperCase().startsWith('R') || statusCode.toUpperCase().startsWith('C')) {
      path = parts[2] ?? parts[1] ?? ''
    }
    if (!path) continue

    files.push({
      path,
      status: mapNameStatusCode(statusCode),
    })
  }
  return files
}

export class GraphiteService {
  private static gtAvailable: boolean | null = null

  private static async isGtAvailable(): Promise<boolean> {
    if (this.gtAvailable !== null) return this.gtAvailable
    try {
      await execFileAsync('gt', ['--version'], { timeout: 5000 })
      this.gtAvailable = true
    } catch {
      this.gtAvailable = false
    }
    return this.gtAvailable
  }

  private static async readGitdirPath(repoPath: string): Promise<string | null> {
    const dotGit = join(repoPath, '.git')
    try {
      if (!existsSync(dotGit)) return null
      const text = await readFile(dotGit, 'utf-8')
      const m = text.match(/^gitdir:\s*(.+)$/m)
      if (!m?.[1]) return null
      return resolve(repoPath, m[1].trim())
    } catch {
      return null
    }
  }

  private static async isGraphiteInitialized(repoPath: string): Promise<boolean> {
    const configInDotGitDir = join(repoPath, '.git', '.graphite_repo_config')
    if (existsSync(configInDotGitDir)) return true

    const gitdir = await this.readGitdirPath(repoPath)
    if (!gitdir) return false
    return existsSync(join(gitdir, '.graphite_repo_config'))
  }

  private static async currentBranchFromGit(worktreePath: string): Promise<string | null> {
    try {
      const branch = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath)
      return branch || null
    } catch {
      return null
    }
  }

  private static async computeNeedsRestack(worktreePath: string, parent: string, branch: string): Promise<boolean> {
    try {
      await runGit(['merge-base', '--is-ancestor', parent, branch], worktreePath)
      return false
    } catch {
      return true
    }
  }

  private static async getCurrentLayerFiles(
    worktreePath: string,
    parentBranch: string | null,
    currentBranch: string | null,
  ): Promise<GraphiteCurrentLayerFile[]> {
    if (!parentBranch || !currentBranch) return []
    try {
      const output = await runGit(
        ['diff', '--name-status', `${parentBranch}...${currentBranch}`],
        worktreePath,
      )
      return parseNameStatus(output)
    } catch {
      return []
    }
  }

  static async getCurrentStackSnapshot(
    repoPath: string,
    worktreePath: string,
  ): Promise<GraphiteCurrentStackSnapshot> {
    if (!(await this.isGtAvailable())) {
      return {
        available: false,
        reason: 'gt_not_installed',
        branches: [],
        currentBranch: null,
        parentBranch: null,
        currentLayerFiles: [],
        uncommittedCount: 0,
      }
    }

    if (!(await this.isGraphiteInitialized(repoPath))) {
      return {
        available: false,
        reason: 'graphite_not_initialized',
        branches: [],
        currentBranch: null,
        parentBranch: null,
        currentLayerFiles: [],
        uncommittedCount: 0,
      }
    }

    let parsed = parseGraphiteStackOutput('')
    try {
      const output = await runGt(
        ['log', 'short', '--stack', '--show-untracked', '--no-interactive'],
        worktreePath,
      )
      parsed = parseGraphiteStackOutput(output)
    } catch {
      return {
        available: false,
        reason: 'graphite_log_failed',
        branches: [],
        currentBranch: null,
        parentBranch: null,
        currentLayerFiles: [],
        uncommittedCount: 0,
      }
    }

    const branches = parsed.branches
    if (branches.length === 0) {
      return {
        available: false,
        reason: 'empty_stack',
        branches: [],
        currentBranch: null,
        parentBranch: null,
        currentLayerFiles: [],
        uncommittedCount: 0,
      }
    }

    const trunkBranch = parsed.trunkBranch ?? branches[branches.length - 1]
    const nonTrunkBranches = branches.filter((branch) => branch !== trunkBranch)
    if (nonTrunkBranches.length === 0) {
      return {
        available: false,
        reason: 'no_stack_branches',
        branches: [],
        currentBranch: null,
        parentBranch: null,
        currentLayerFiles: [],
        uncommittedCount: 0,
      }
    }

    let currentBranch = parsed.currentBranch
    if (!currentBranch) {
      currentBranch = await this.currentBranchFromGit(worktreePath)
    }
    if (!currentBranch || !branches.includes(currentBranch)) {
      return {
        available: false,
        reason: 'current_branch_not_in_stack',
        branches: [],
        currentBranch: null,
        parentBranch: null,
        currentLayerFiles: [],
        uncommittedCount: 0,
      }
    }

    const parentBranch = findCurrentParentBranch(branches, currentBranch)
    const [currentLayerFiles, uncommittedCount] = await Promise.all([
      this.getCurrentLayerFiles(worktreePath, parentBranch, currentBranch),
      GitService.getStatus(worktreePath).then((items) => items.length).catch(() => 0),
    ])

    const branchRows = await Promise.all(
      branches.map(async (branchName, idx) => {
        const parent = branches[idx + 1] ?? null
        const needsRestack = parent
          ? await this.computeNeedsRestack(worktreePath, parent, branchName)
          : false
        return {
          name: branchName,
          isCurrent: branchName === currentBranch,
          isTrunk: branchName === trunkBranch,
          needsRestack,
        }
      }),
    )

    return {
      available: true,
      branches: branchRows,
      currentBranch,
      parentBranch,
      currentLayerFiles,
      uncommittedCount,
    }
  }
}
