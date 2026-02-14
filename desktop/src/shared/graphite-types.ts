export type GraphiteDiffStatus = 'modified' | 'added' | 'deleted' | 'renamed'

export interface GraphiteStackBranch {
  name: string
  isCurrent: boolean
  isTrunk: boolean
  needsRestack: boolean
}

export interface GraphiteCurrentLayerFile {
  path: string
  status: GraphiteDiffStatus
}

export interface GraphiteCurrentStackSnapshot {
  available: boolean
  reason?: string
  branches: GraphiteStackBranch[]
  currentBranch: string | null
  parentBranch: string | null
  currentLayerFiles: GraphiteCurrentLayerFile[]
  uncommittedCount: number
}
