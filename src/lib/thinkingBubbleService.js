import * as THREE from 'three'

const THINKING_BUBBLE_CYCLE_SECONDS = 3.6
const THINKING_BUBBLE_OFFSET_RIGHT = 0.42
const THINKING_BUBBLE_OFFSET_UP = 0.4
const THINKING_BUBBLE_OFFSET_FORWARD = 0.14
const THINKING_BUBBLE_BOB_SPEED = 2.2
const THINKING_BUBBLE_BOB_AMOUNT = 0.03
const WORLD_UP = new THREE.Vector3(0, 1, 0)
export const THINKING_CLOUD_DEPTH = 0.16

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1)
}

function envelope(progress, appearStart, appearEnd, disappearStart, disappearEnd) {
  if (progress <= appearStart || progress >= disappearEnd) {
    return 0
  }

  if (progress < appearEnd) {
    return clamp01((progress - appearStart) / Math.max(0.0001, appearEnd - appearStart))
  }

  if (progress <= disappearStart) {
    return 1
  }

  return 1 - clamp01((progress - disappearStart) / Math.max(0.0001, disappearEnd - disappearStart))
}

function dotPulse(progress, start, end) {
  if (progress < start || progress > end) {
    return 0.2
  }

  const local = clamp01((progress - start) / Math.max(0.0001, end - start))
  return 0.2 + Math.sin(local * Math.PI) * 0.8
}

export function computeThinkingBubbleState(progress) {
  const normalized = ((progress % 1) + 1) % 1
  const trail = [
    envelope(normalized, 0.02, 0.12, 0.78, 0.88),
    envelope(normalized, 0.10, 0.20, 0.82, 0.92),
    envelope(normalized, 0.18, 0.28, 0.86, 0.96),
  ]
  const cloud = envelope(normalized, 0.26, 0.40, 0.72, 0.94)
  const dots = [
    dotPulse(normalized, 0.44, 0.58) * cloud,
    dotPulse(normalized, 0.54, 0.68) * cloud,
    dotPulse(normalized, 0.64, 0.78) * cloud,
  ]

  return {
    trail,
    cloud,
    dots,
  }
}

export function computeThinkingBubbleAnchor(headPosition, headQuaternion, bobOffset = 0) {
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(headQuaternion)
  forward.y = 0

  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, 1)
  } else {
    forward.normalize()
  }

  const right = new THREE.Vector3().crossVectors(WORLD_UP, forward).normalize()
  const up = new THREE.Vector3().crossVectors(forward, right).normalize()

  const position = headPosition.clone()
  position.addScaledVector(right, THINKING_BUBBLE_OFFSET_RIGHT)
  position.addScaledVector(up, THINKING_BUBBLE_OFFSET_UP + bobOffset)
  position.addScaledVector(forward, THINKING_BUBBLE_OFFSET_FORWARD)

  const basis = new THREE.Matrix4().makeBasis(right, up, forward)
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis)

  return {
    position,
    quaternion,
  }
}

function createBubbleMaterial(color, emissive, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.55,
    metalness: 0.05,
    roughness: 0.35,
    transparent: true,
    opacity,
  })
}

function createBubblePart(geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(position)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

function createCloudGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.44, -0.02)
  shape.bezierCurveTo(-0.52, 0.12, -0.42, 0.26, -0.24, 0.24)
  shape.bezierCurveTo(-0.18, 0.38, 0.02, 0.42, 0.14, 0.32)
  shape.bezierCurveTo(0.28, 0.40, 0.48, 0.30, 0.48, 0.12)
  shape.bezierCurveTo(0.62, 0.06, 0.60, -0.16, 0.42, -0.18)
  shape.bezierCurveTo(0.34, -0.30, 0.12, -0.34, 0.00, -0.24)
  shape.bezierCurveTo(-0.12, -0.34, -0.34, -0.28, -0.38, -0.14)
  shape.bezierCurveTo(-0.48, -0.16, -0.52, -0.08, -0.44, -0.02)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: THINKING_CLOUD_DEPTH,
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize: 0.024,
    bevelThickness: 0.03,
    curveSegments: 28,
    steps: 1,
  })
  geometry.center()
  return geometry
}

function setMeshVisibility(mesh, scale, opacity) {
  const clampedScale = Math.max(0.0001, scale)
  mesh.visible = opacity > 0.001
  mesh.scale.setScalar(clampedScale)
  mesh.material.opacity = opacity
}

export function createThinkingBubbleService({ scene }) {
  const root = new THREE.Group()
  root.visible = false
  scene.add(root)

  const tempHead = new THREE.Vector3()
  const tempHeadQuaternion = new THREE.Quaternion()

  const dotGeometry = new THREE.SphereGeometry(0.045, 16, 16)
  const trailGeometry = new THREE.SphereGeometry(0.06, 18, 18)
  const cloudGeometry = createCloudGeometry()

  const trailBubbles = [
    createBubblePart(trailGeometry, createBubbleMaterial(0xffffff, 0x6feaff, 0), new THREE.Vector3(-0.20, -0.18, 0)),
    createBubblePart(trailGeometry, createBubbleMaterial(0xffffff, 0x6feaff, 0), new THREE.Vector3(-0.04, -0.06, 0)),
    createBubblePart(trailGeometry, createBubbleMaterial(0xffffff, 0x6feaff, 0), new THREE.Vector3(0.12, 0.04, 0)),
  ]

  const cloudGroup = new THREE.Group()
  cloudGroup.position.set(0.22, 0.18, 0)
  root.add(cloudGroup)

  const cloudMeshes = [
    createBubblePart(cloudGeometry, createBubbleMaterial(0xcffaff, 0x5deeff, 0), new THREE.Vector3(0, 0, -0.03)),
    createBubblePart(cloudGeometry, createBubbleMaterial(0xffffff, 0x89f3ff, 0), new THREE.Vector3(0, 0, 0.03)),
  ]
  const dotMeshes = [
    createBubblePart(dotGeometry, createBubbleMaterial(0x1499c4, 0x39dcff, 0), new THREE.Vector3(-0.15, 0.0, 0.12)),
    createBubblePart(dotGeometry, createBubbleMaterial(0x1499c4, 0x39dcff, 0), new THREE.Vector3(0.0, -0.02, 0.12)),
    createBubblePart(dotGeometry, createBubbleMaterial(0x1499c4, 0x39dcff, 0), new THREE.Vector3(0.15, 0.0, 0.12)),
  ]

  for (const bubble of trailBubbles) {
    root.add(bubble)
  }
  for (const mesh of cloudMeshes) {
    cloudGroup.add(mesh)
  }
  for (const dot of dotMeshes) {
    cloudGroup.add(dot)
  }

  let enabled = false
  let elapsed = 0

  function setEnabled(nextEnabled) {
    const normalized = Boolean(nextEnabled)
    if (normalized && !enabled) {
      elapsed = 0
    }
    enabled = normalized
    if (!enabled) {
      root.visible = false
    }
  }

  function update(dt, vrm) {
    if (!enabled || !vrm) {
      root.visible = false
      return
    }

    const headNode = vrm.humanoid?.getNormalizedBoneNode('head')
    if (!headNode) {
      root.visible = false
      return
    }

    elapsed += dt
    const state = computeThinkingBubbleState(elapsed / THINKING_BUBBLE_CYCLE_SECONDS)

    root.visible = true

    headNode.getWorldPosition(tempHead)
    headNode.getWorldQuaternion(tempHeadQuaternion)

    const anchor = computeThinkingBubbleAnchor(
      tempHead,
      tempHeadQuaternion,
      Math.sin(elapsed * THINKING_BUBBLE_BOB_SPEED) * THINKING_BUBBLE_BOB_AMOUNT,
    )
    root.position.copy(anchor.position)
    root.quaternion.copy(anchor.quaternion)

    for (let index = 0; index < trailBubbles.length; index += 1) {
      const weight = state.trail[index] || 0
      setMeshVisibility(trailBubbles[index], 0.35 + weight * 0.65, weight * 0.92)
    }

    cloudGroup.visible = state.cloud > 0.001
    cloudGroup.scale.setScalar(0.65 + state.cloud * 0.35)

    for (let index = 0; index < cloudMeshes.length; index += 1) {
      const opacity = index === 0 ? state.cloud * 0.32 : state.cloud * 0.96
      const scale = index === 0 ? 0.92 + state.cloud * 0.20 : 0.84 + state.cloud * 0.18
      setMeshVisibility(cloudMeshes[index], scale, opacity)
    }

    for (let index = 0; index < dotMeshes.length; index += 1) {
      const weight = state.dots[index] || 0
      setMeshVisibility(dotMeshes[index], 0.55 + weight * 0.45, weight * 0.95)
    }
  }

  function dispose() {
    root.removeFromParent()
    disposeObject3D(root)
  }

  return {
    setEnabled,
    update,
    dispose,
  }
}

function disposeMaterial(material) {
  material?.dispose?.()
}

function disposeObject3D(root) {
  root?.traverse((obj) => {
    obj.geometry?.dispose?.()
    if (Array.isArray(obj.material)) {
      obj.material.forEach(disposeMaterial)
    } else {
      disposeMaterial(obj.material)
    }
  })
}
