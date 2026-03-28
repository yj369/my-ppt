import { v4 as uuidv4 } from 'uuid'
import type { Project } from '../types/editor'
import {
  blobToDataUrl,
  dataUrlToBlob,
  getLocalImageBlob,
  restoreLocalImage,
} from './imageStorage'

const TRANSFER_FILE_FORMAT = 'tarot-project'
const TRANSFER_FILE_VERSION = 2
const LOCAL_IMAGE_URI_PATTERN = /idb:\/\/[a-f0-9-]+/gi

export type ProjectTransferAsset = {
  uri: string
  kind: 'image'
  dataUrl: string
  size: number
}

export type ProjectTransferFile = {
  format: typeof TRANSFER_FILE_FORMAT
  version: typeof TRANSFER_FILE_VERSION
  exportedAt: number
  project: Project
  assets: ProjectTransferAsset[]
}

export type BuildProjectTransferResult = {
  payload: ProjectTransferFile
  localAssetCount: number
  missingLocalAssetCount: number
}

export type ImportProjectTransferResult = {
  project: Project
  restoredLocalAssetCount: number
  missingLocalAssetCount: number
  source: 'bundle' | 'legacy'
}

function collectLocalImageUris(project: Project) {
  return [...new Set(JSON.stringify(project).match(LOCAL_IMAGE_URI_PATTERN) ?? [])]
}

function isProjectTransferFile(value: unknown): value is ProjectTransferFile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ProjectTransferFile>
  return (
    candidate.format === TRANSFER_FILE_FORMAT
    && candidate.version === TRANSFER_FILE_VERSION
    && Array.isArray(candidate.assets)
    && !!candidate.project
  )
}

function isProjectLike(value: unknown): value is Project {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<Project>
  return typeof candidate.name === 'string' && Array.isArray(candidate.slides)
}

function cloneImportedProject(project: Project) {
  const now = Date.now()
  return {
    ...project,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  }
}

export async function buildProjectTransferPayload(project: Project): Promise<BuildProjectTransferResult> {
  const uris = collectLocalImageUris(project)
  const assets: ProjectTransferAsset[] = []
  let missingLocalAssetCount = 0

  for (const uri of uris) {
    const blob = await getLocalImageBlob(uri)
    if (!blob) {
      missingLocalAssetCount += 1
      continue
    }

    assets.push({
      uri,
      kind: 'image',
      dataUrl: await blobToDataUrl(blob),
      size: blob.size,
    })
  }

  return {
    payload: {
      format: TRANSFER_FILE_FORMAT,
      version: TRANSFER_FILE_VERSION,
      exportedAt: Date.now(),
      project,
      assets,
    },
    localAssetCount: assets.length,
    missingLocalAssetCount,
  }
}

export async function parseImportedProjectFile(file: File): Promise<ImportProjectTransferResult> {
  const raw = await file.text()
  const parsed = JSON.parse(raw) as unknown

  if (isProjectTransferFile(parsed)) {
    const localUris = collectLocalImageUris(parsed.project)
    const restoredUris = new Set(parsed.assets.map((asset) => asset.uri))

    for (const asset of parsed.assets) {
      await restoreLocalImage(asset.uri, dataUrlToBlob(asset.dataUrl))
    }

    return {
      project: cloneImportedProject(parsed.project),
      restoredLocalAssetCount: parsed.assets.length,
      missingLocalAssetCount: Math.max(localUris.length - restoredUris.size, 0),
      source: 'bundle',
    }
  }

  if (isProjectLike(parsed)) {
    const missingLocalAssetCount = collectLocalImageUris(parsed).length

    return {
      project: cloneImportedProject(parsed),
      restoredLocalAssetCount: 0,
      missingLocalAssetCount,
      source: 'legacy',
    }
  }

  throw new Error('无法识别的项目文件格式')
}
