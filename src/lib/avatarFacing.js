export function normalizeFacingYawDegrees(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  let normalized = numericValue % 360

  if (normalized > 180) {
    normalized -= 360
  }

  if (normalized <= -180) {
    normalized += 360
  }

  return Number(normalized.toFixed(2))
}

export function deriveSavedFacingYawDegrees(currentFacingYaw, previewYaw) {
  return normalizeFacingYawDegrees(Number(currentFacingYaw || 0) - Number(previewYaw || 0))
}
