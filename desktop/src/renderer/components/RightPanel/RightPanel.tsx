import { useAppStore } from '../../store/app-store'
import { FileTree } from './FileTree'
import { ChangedFiles } from './ChangedFiles'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './RightPanel.module.css'

export function RightPanel() {
  const { rightPanelMode, setRightPanelMode, activeWorkspaceId, workspaces } = useAppStore()

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId)

  return (
    <div className={styles.rightPanel}>
      <div className={styles.header}>
        <div className={styles.modeToggle}>
          <Tooltip label="Files" shortcut="⇧⌘E">
            <button
              className={`${styles.modeButton} ${rightPanelMode === 'files' ? styles.active : ''}`}
              onClick={() => setRightPanelMode('files')}
            >
              Files
            </button>
          </Tooltip>
          <Tooltip label="Changes" shortcut="⇧⌘G">
            <button
              className={`${styles.modeButton} ${rightPanelMode === 'changes' ? styles.active : ''}`}
              onClick={() => setRightPanelMode('changes')}
            >
              Changes
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.content}>
        {!workspace ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📁</span>
            <span className={styles.emptyText}>
              Select a workspace to browse files
            </span>
          </div>
        ) : rightPanelMode === 'files' ? (
          <FileTree worktreePath={workspace.worktreePath} />
        ) : (
          <ChangedFiles
            worktreePath={workspace.worktreePath}
            workspaceId={workspace.id}
          />
        )}
      </div>
    </div>
  )
}
