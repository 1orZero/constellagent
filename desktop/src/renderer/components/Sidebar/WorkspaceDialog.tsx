import { useState, useEffect, useCallback } from 'react'
import type { Project } from '../../store/types'
import styles from './WorkspaceDialog.module.css'

interface Props {
  project: Project
  onConfirm: (name: string, branch: string, newBranch: boolean) => void
  onCancel: () => void
}

export function WorkspaceDialog({ project, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(`ws-${Date.now().toString(36)}`)
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('main')
  const [isNewBranch, setIsNewBranch] = useState(true)
  const [newBranchName, setNewBranchName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.git.getBranches(project.repoPath).then((b) => {
      setBranches(b)
      if (b.length > 0 && !b.includes('main')) {
        setSelectedBranch(b[0])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [project.repoPath])

  const handleSubmit = useCallback(() => {
    const branch = isNewBranch ? (newBranchName || name) : selectedBranch
    onConfirm(name, branch, isNewBranch)
  }, [name, isNewBranch, newBranchName, selectedBranch, onConfirm])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onCancel()
  }, [handleSubmit, onCancel])

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className={styles.title}>New Workspace</div>

        <label className={styles.label}>Name</label>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="workspace-name"
        />

        <label className={styles.label}>Branch</label>
        <div className={styles.branchToggle}>
          <button
            className={`${styles.toggleBtn} ${isNewBranch ? styles.active : ''}`}
            onClick={() => setIsNewBranch(true)}
          >
            New branch
          </button>
          <button
            className={`${styles.toggleBtn} ${!isNewBranch ? styles.active : ''}`}
            onClick={() => setIsNewBranch(false)}
          >
            Existing
          </button>
        </div>

        {isNewBranch ? (
          <input
            className={styles.input}
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder={name || 'branch-name'}
          />
        ) : (
          <select
            className={styles.input}
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={loading}
          >
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.createBtn} onClick={handleSubmit} disabled={!name.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
