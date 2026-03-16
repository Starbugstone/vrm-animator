import { downloadAnimationFile } from '../api/animations.js'
import { downloadAvatarFile } from '../api/avatars.js'
import { downloadSharedAssetFile } from '../api/library.js'
import { normalizeFacingYawDegrees } from './avatarFacing.js'

export function createPersistedAvatarAsset(record, authToken) {
  return {
    id: `avatar:user:${record.id}`,
    remoteId: record.id,
    type: 'avatar',
    name: record.filename,
    label: record.name,
    source: 'user',
    authToken,
    defaultFacingYaw: normalizeFacingYawDegrees(record.defaultFacingYaw),
  }
}

export function createPersistedAnimationAsset(record, authToken) {
  return {
    id: `${record.kind}:user:${record.id}`,
    remoteId: record.id,
    type: record.kind,
    kind: record.kind,
    name: record.filename,
    label: record.name,
    source: 'user',
    authToken,
    description: record.description || '',
    keywords: Array.isArray(record.keywords) ? record.keywords : [],
    emotionTags: Array.isArray(record.emotionTags) ? record.emotionTags : [],
    tags: Array.isArray(record.tags) ? record.tags : [],
    channels: Array.isArray(record.channels) ? record.channels : [],
    weight: Number.isFinite(Number(record.weight)) ? Number(record.weight) : 0,
  }
}

export async function assetToFile(asset) {
  if (!asset) return null

  if (asset.source === 'user') {
    if (asset.type === 'avatar') {
      return downloadAvatarFile(asset.authToken, asset.remoteId, asset.name)
    }

    return downloadAnimationFile(asset.authToken, asset.remoteId, asset.name)
  }

  if (asset.downloadUrl) {
    return downloadSharedAssetFile(asset)
  }

  return null
}
