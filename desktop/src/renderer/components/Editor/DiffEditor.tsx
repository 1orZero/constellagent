import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react'
import { useAppStore } from '../../store/app-store'
import styles from './Editor.module.css'

interface FileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

interface DiffFileData {
  filePath: string
  original: string
  modified: string
  status: string
}

interface Props {
  tabId: string
  worktreePath: string
  active: boolean
}

const STATUS_LABELS: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript', jsx: 'javascriptreact',
    json: 'json', md: 'markdown', css: 'css',
    html: 'html', py: 'python', rs: 'rust', go: 'go',
  }
  return map[ext || ''] || 'plaintext'
}

/**
 * Reconstruct original file from current content + unified diff.
 */
function reconstructOriginal(current: string, diffText: string): string {
  const lines = current.split('\n')
  const diffLines = diffText.split('\n')
  const result: string[] = []

  let currentLineIdx = 0
  let i = 0

  while (i < diffLines.length && !diffLines[i].startsWith('@@')) i++
  if (i >= diffLines.length) return current

  while (i < diffLines.length) {
    const line = diffLines[i]

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        const newStart = parseInt(match[2], 10) - 1
        while (currentLineIdx < newStart && currentLineIdx < lines.length) {
          result.push(lines[currentLineIdx])
          currentLineIdx++
        }
      }
      i++
      continue
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentLineIdx++
      i++
      continue
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      result.push(line.slice(1))
      i++
      continue
    }

    if (line.startsWith(' ')) {
      result.push(lines[currentLineIdx])
      currentLineIdx++
      i++
      continue
    }

    i++
  }

  while (currentLineIdx < lines.length) {
    result.push(lines[currentLineIdx])
    currentLineIdx++
  }

  return result.join('\n')
}

// ── Per-file diff section ──

interface DiffFileSectionProps {
  data: DiffFileData
  inline: boolean
  worktreePath: string
  tabId: string
}

const DiffFileSection = memo(function DiffFileSection({
  data,
  inline,
  worktreePath,
  tabId,
}: DiffFileSectionProps) {
  const [height, setHeight] = useState(200)
  const editorRef = useRef<any>(null)
  const initialModified = useRef(data.modified)
  const [unsaved, setUnsaved] = useState(false)
  const [currentOriginal, setCurrentOriginal] = useState(data.original)
  const { setDiffFileUnsaved, notifyTabSaved, settings: { editorFontSize } } = useAppStore()

  // Update original if parent re-fetches (but only if we haven't edited)
  useEffect(() => {
    if (!unsaved) {
      setCurrentOriginal(data.original)
      initialModified.current = data.modified
    }
  }, [data.original, data.modified, unsaved])

  const handleMount = useCallback(
    (editor: any) => {
      editorRef.current = editor
      const modifiedEditor = editor.getModifiedEditor()
      const originalEditor = editor.getOriginalEditor()

      const updateHeight = () => {
        const modH = modifiedEditor.getContentHeight()
        const origH = originalEditor.getContentHeight()
        // Size to full content — no cap. Outer container scrolls.
        setHeight(Math.max(modH, origH, 60))
      }
      updateHeight()
      modifiedEditor.onDidContentSizeChange(updateHeight)
      originalEditor.onDidContentSizeChange(updateHeight)

      // Track unsaved state
      modifiedEditor.onDidChangeModelContent(() => {
        const current = modifiedEditor.getValue()
        const isDirty = current !== initialModified.current
        setUnsaved(isDirty)
        setDiffFileUnsaved(tabId, data.filePath, isDirty)
      })

      // Cmd+S save handler
      // eslint-disable-next-line no-bitwise
      modifiedEditor.addCommand(2048 | 49, async () => {
        const content = modifiedEditor.getValue()
        const fullPath = data.filePath.startsWith('/')
          ? data.filePath
          : `${worktreePath}/${data.filePath}`
        try {
          await window.api.fs.writeFile(fullPath, content)
          initialModified.current = content

          // Re-fetch diff to update original side
          const diffText = await window.api.git.getFileDiff(worktreePath, data.filePath)
          const newOriginal = diffText ? reconstructOriginal(content, diffText) : content
          setCurrentOriginal(newOriginal)

          setUnsaved(false)
          setDiffFileUnsaved(tabId, data.filePath, false)
          notifyTabSaved(tabId)
        } catch (err) {
          console.error('Failed to save from diff view:', err)
        }
      })
    },
    [data.filePath, worktreePath, tabId, setDiffFileUnsaved, notifyTabSaved],
  )

  const parts = data.filePath.split('/')
  const fileName = parts.pop()
  const dir = parts.length > 0 ? parts.join('/') + '/' : ''

  return (
    <div className={styles.diffFileSection} id={`diff-${data.filePath}`}>
      <div className={styles.fileHeader}>
        <span className={`${styles.fileHeaderBadge} ${styles[data.status] || ''}`}>
          {STATUS_LABELS[data.status] || '?'}
        </span>
        <span className={styles.fileHeaderPath}>
          {dir && <span className={styles.fileHeaderDir}>{dir}</span>}
          {fileName}
        </span>
        {unsaved && <span className={styles.fileHeaderUnsaved} />}
      </div>
      <div style={{ height }}>
        <MonacoDiffEditor
          key={inline ? 'inline' : 'sbs'}
          height="100%"
          language={getLanguage(data.filePath)}
          original={currentOriginal}
          modified={data.modified}
          theme="vs-dark"
          onMount={handleMount}
          options={{
            fontFamily: "'SF Mono', Menlo, 'Cascadia Code', monospace",
            fontSize: editorFontSize,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'auto',
              alwaysConsumeMouseWheel: false,
              verticalScrollbarSize: 0,
            },
            readOnly: false,
            originalEditable: false,
            renderSideBySide: !inline,
            useInlineViewWhenSpaceIsLimited: false,
            renderOverviewRuler: false,
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
})

// ── File strip (jump nav) ──

function FileStrip({
  files,
  activeFile,
}: {
  files: DiffFileData[]
  activeFile: string | null
}) {
  const scrollTo = (filePath: string) => {
    const el = document.getElementById(`diff-${filePath}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.fileStrip}>
      {files.map((f) => (
        <button
          key={f.filePath}
          className={`${styles.fileStripItem} ${f.filePath === activeFile ? styles.active : ''}`}
          onClick={() => scrollTo(f.filePath)}
        >
          {f.filePath.split('/').pop()}
        </button>
      ))}
    </div>
  )
}

// ── Main DiffViewer ──

export function DiffViewer({ tabId, worktreePath, active }: Props) {
  const [files, setFiles] = useState<DiffFileData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { settings, updateSettings } = useAppStore()
  const inline = settings.diffInline

  // Load all changed files
  const loadFiles = useCallback(async () => {
    try {
      const statuses: FileStatus[] = await window.api.git.getStatus(worktreePath)
      const results = await Promise.all(
        statuses.map(async (file) => {
          const fullPath = file.path.startsWith('/')
            ? file.path
            : `${worktreePath}/${file.path}`
          const current =
            file.status === 'deleted' ? '' : await window.api.fs.readFile(fullPath)
          const diffText = await window.api.git.getFileDiff(worktreePath, file.path)
          const original = diffText ? reconstructOriginal(current, diffText) : ''
          return {
            filePath: file.path,
            original,
            modified: current,
            status: file.status,
          }
        }),
      )
      setFiles(results)
    } catch (err) {
      console.error('Failed to load diffs:', err)
    } finally {
      setLoading(false)
    }
  }, [worktreePath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Auto-refresh on filesystem changes
  useEffect(() => {
    window.api.fs.watchDir(worktreePath)
    const unsub = window.api.fs.onDirChanged((changedDir: string) => {
      if (changedDir === worktreePath) loadFiles()
    })
    return () => {
      unsub()
      window.api.fs.unwatchDir(worktreePath)
    }
  }, [worktreePath, loadFiles])

  // Listen for scroll-to-file events from ChangedFiles panel
  useEffect(() => {
    const handler = (e: Event) => {
      const filePath = (e as CustomEvent<string>).detail
      // Small delay to let tab render if newly created
      requestAnimationFrame(() => {
        const el = document.getElementById(`diff-${filePath}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    window.addEventListener('diff:scrollToFile', handler)
    return () => window.removeEventListener('diff:scrollToFile', handler)
  }, [])

  // IntersectionObserver to highlight active file in strip
  useEffect(() => {
    if (!scrollAreaRef.current || files.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            if (id.startsWith('diff-')) {
              setActiveFile(id.slice(5))
            }
          }
        }
      },
      { root: scrollAreaRef.current, threshold: 0.3 },
    )

    for (const f of files) {
      const el = document.getElementById(`diff-${f.filePath}`)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [files])

  if (loading) {
    return (
      <div className={styles.diffViewerContainer}>
        <div className={styles.diffEmpty}>
          <span className={styles.diffEmptyText}>Loading changes...</span>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className={styles.diffViewerContainer}>
        <div className={styles.diffEmpty}>
          <span className={styles.diffEmptyIcon}>✓</span>
          <span className={styles.diffEmptyText}>No changes</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.diffViewerContainer}>
      {/* Toolbar */}
      <div className={styles.diffToolbar}>
        <span className={styles.diffFileCount}>
          {files.length} changed file{files.length !== 1 ? 's' : ''}
        </span>
        <div className={styles.diffToggle}>
          <button
            className={`${styles.diffToggleOption} ${!inline ? styles.active : ''}`}
            onClick={() => updateSettings({ diffInline: false })}
          >
            Side by side
          </button>
          <button
            className={`${styles.diffToggleOption} ${inline ? styles.active : ''}`}
            onClick={() => updateSettings({ diffInline: true })}
          >
            Inline
          </button>
        </div>
      </div>

      {/* File strip */}
      <FileStrip files={files} activeFile={activeFile} />

      {/* Stacked diffs */}
      <div ref={scrollAreaRef} className={styles.diffScrollArea}>
        {files.map((f) => (
          <DiffFileSection
            key={f.filePath}
            data={f}
            inline={inline}
            worktreePath={worktreePath}
            tabId={tabId}
          />
        ))}
      </div>
    </div>
  )
}
