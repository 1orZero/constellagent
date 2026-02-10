import { mkdirSync, readdirSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc-channels'

const NOTIFY_DIR = '/tmp/constellagent-notify'
const POLL_INTERVAL = 500

export class NotificationWatcher {
  private timer: ReturnType<typeof setInterval> | null = null

  start(): void {
    mkdirSync(NOTIFY_DIR, { recursive: true })
    this.pollOnce()
    this.timer = setInterval(() => this.pollOnce(), POLL_INTERVAL)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private pollOnce(): void {
    try {
      const files = readdirSync(NOTIFY_DIR)
      for (const f of files) {
        this.processFile(join(NOTIFY_DIR, f))
      }
    } catch {
      // Directory may not exist yet
    }
  }

  private processFile(filePath: string): void {
    try {
      const wsId = readFileSync(filePath, 'utf-8').trim()
      unlinkSync(filePath)
      if (wsId) this.notifyRenderer(wsId)
    } catch {
      // File may have been already processed or deleted
    }
  }

  private notifyRenderer(workspaceId: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.CLAUDE_NOTIFY_WORKSPACE, workspaceId)
      }
    }
  }
}
