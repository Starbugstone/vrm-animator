import { apiRequest, buildApiUrl } from './client'

export function listSharedAvatarAssets() {
  return apiRequest('/api/library/avatars', { cache: 'no-store' }).then((data) => data.items || [])
}

export function listSharedAnimationAssets() {
  return apiRequest('/api/library/animations', { cache: 'no-store' }).then((data) => data.items || [])
}

export async function downloadSharedAssetFile(asset) {
  const downloadUrl = new URL(buildApiUrl(asset.downloadUrl))
  if (asset.assetVersion) {
    downloadUrl.searchParams.set('v', String(asset.assetVersion))
  }

  const response = await fetch(downloadUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Shared asset download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  return new File([blob], asset.name, { type: blob.type || 'application/octet-stream' })
}
