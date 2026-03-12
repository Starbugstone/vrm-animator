import { apiRequest, buildApiUrl } from './client'

export function listSharedAvatarAssets() {
  return apiRequest('/api/library/avatars').then((data) => data.items || [])
}

export function listSharedAnimationAssets() {
  return apiRequest('/api/library/animations').then((data) => data.items || [])
}

export async function downloadSharedAssetFile(asset) {
  const response = await fetch(buildApiUrl(asset.downloadUrl))
  if (!response.ok) {
    throw new Error(`Shared asset download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  return new File([blob], asset.name, { type: blob.type || 'application/octet-stream' })
}
