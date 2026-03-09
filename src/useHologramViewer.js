import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

const STAGE_BASE_HEIGHT = 0.18
const STAGE_BASE_Y = -0.1
const STAGE_TOP_Y = 0.02
const STAGE_FLOOR_Y = STAGE_BASE_Y - STAGE_BASE_HEIGHT / 2
const TARGET_BODY_HEIGHT = 2.0
const FOCUS_LERP = 0.3
const FIT_HEIGHT_RATIO = 0.75
const FIT_WIDTH_RATIO = 0.72
const MIN_FIT_DISTANCE = 3.5
const BOTTOM_EDGE_NDC = -0.85

const DEFAULT_POLAR = 72
const DEFAULT_DISTANCE = 8
const DEFAULT_TARGET_Y = 0.8

const HEIGHT_MIN = -5
const HEIGHT_MAX = 5
const SHIFT_MIN = -1.5
const SHIFT_MAX = 1.5

const DEFAULT_FRAMING = {
  yaw: 0,
  tilt: DEFAULT_POLAR,
  zoom: DEFAULT_DISTANCE,
  height: 0,
  shift: 0,
}

function boneWorldPosition(vrm, name) {
  const node = vrm?.humanoid?.getNormalizedBoneNode(name)
  if (!node) return null
  return node.getWorldPosition(new THREE.Vector3())
}

function measureAvatar(vrm, bounds) {
  const head = boneWorldPosition(vrm, 'head')
  const hips = boneWorldPosition(vrm, 'hips')
  const fallbackCenter = bounds.getCenter(new THREE.Vector3())
  const footY = bounds.min.y
  const headY = head?.y ?? bounds.max.y
  const bodyHeight = Math.max(0.5, headY - footY)

  return {
    footY,
    headY,
    bodyHeight,
    hipsX: hips?.x ?? fallbackCenter.x,
    hipsY: hips?.y ?? footY + bodyHeight * 0.53,
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

export default function useHologramViewer(canvasRef) {
  const internalsRef = useRef(null)
  const [status, setStatus] = useState('Idle')
  const [isLoaded, setIsLoaded] = useState(false)
  const [framingState, setFramingState] = useState(DEFAULT_FRAMING)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return undefined

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x040816, 12, 30)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    const initialPolar = THREE.MathUtils.degToRad(DEFAULT_POLAR)
    camera.position.set(
      DEFAULT_DISTANCE * Math.sin(initialPolar) * Math.sin(0),
      DEFAULT_TARGET_Y + DEFAULT_DISTANCE * Math.cos(initialPolar),
      DEFAULT_DISTANCE * Math.sin(initialPolar) * Math.cos(0),
    )

    const controls = new OrbitControls(camera, canvas)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, DEFAULT_TARGET_Y, 0)
    controls.minDistance = 1.8
    controls.maxDistance = 12
    controls.minPolarAngle = 0.45
    controls.maxPolarAngle = 1.55
    controls.mouseButtons.MIDDLE = null
    controls.update()

    const clock = new THREE.Clock()
    const framing = {
      azimuth: 0,
      polar: THREE.MathUtils.degToRad(DEFAULT_POLAR),
      distance: DEFAULT_DISTANCE,
      targetYOffset: 0,
      targetXOffset: 0,
    }

    let baseTargetX = 0
    let baseTargetY = DEFAULT_TARGET_Y
    let originalHipsY = 0
    let currentVrm = null
    let currentUrl = null
    let currentCommand = 'idle'
    let commandTime = 0
    let loadVersion = 0

    const setViewerStatus = (nextStatus) => {
      setStatus(nextStatus)
    }

    const emitFraming = () => {
      setFramingState({
        yaw: Math.round(THREE.MathUtils.radToDeg(framing.azimuth)),
        tilt: Math.round(THREE.MathUtils.radToDeg(framing.polar)),
        zoom: Number(framing.distance.toFixed(2)),
        height: Number(framing.targetYOffset.toFixed(2)),
        shift: Number(framing.targetXOffset.toFixed(2)),
      })
    }

    const clampFramingState = () => {
      framing.polar = THREE.MathUtils.clamp(framing.polar, controls.minPolarAngle, controls.maxPolarAngle)
      framing.distance = THREE.MathUtils.clamp(framing.distance, controls.minDistance, controls.maxDistance)
      framing.targetYOffset = THREE.MathUtils.clamp(framing.targetYOffset, HEIGHT_MIN, HEIGHT_MAX)
      framing.targetXOffset = THREE.MathUtils.clamp(framing.targetXOffset, SHIFT_MIN, SHIFT_MAX)
    }

    const applyFramingState = () => {
      clampFramingState()
      const offset = new THREE.Vector3().setFromSpherical(
        new THREE.Spherical(framing.distance, framing.polar, framing.azimuth),
      )
      controls.target.set(baseTargetX + framing.targetXOffset, baseTargetY + framing.targetYOffset, 0)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      emitFraming()
    }

    const syncFramingStateFromCamera = () => {
      const offset = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      framing.azimuth = spherical.theta
      framing.polar = spherical.phi
      framing.distance = spherical.radius
      framing.targetYOffset = controls.target.y - baseTargetY
      framing.targetXOffset = controls.target.x - baseTargetX
      clampFramingState()
      emitFraming()
    }

    controls.addEventListener('change', syncFramingStateFromCamera)
    syncFramingStateFromCamera()

    scene.add(new THREE.AmbientLight(0xffffff, 1.15))

    const keyLight = new THREE.DirectionalLight(0xa0f2ff, 2.2)
    keyLight.position.set(3, 6, 4)
    scene.add(keyLight)

    const fill1 = new THREE.PointLight(0x3f6bff, 40, 9)
    fill1.position.set(-3, 2, 2)
    scene.add(fill1)

    const fill2 = new THREE.PointLight(0x62ffff, 28, 8)
    fill2.position.set(3, 4, -2)
    scene.add(fill2)

    const stage = new THREE.Group()
    scene.add(stage)

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.6, STAGE_BASE_HEIGHT, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0d1b36,
        emissive: 0x0d4cb3,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.3,
      }),
    )
    base.position.y = STAGE_BASE_Y
    stage.add(base)

    function makeRing(radius, tube, color, y) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 12, 96),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      stage.add(ring)
      return ring
    }

    const rings = [
      makeRing(0.95, 0.01, 0x7c9dff, 0.02),
      makeRing(1.18, 0.01, 0x7cf7ff, 0.07),
      makeRing(1.42, 0.01, 0x7c9dff, 0.12),
    ]

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 1.25, 3, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x59e8ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    beam.position.y = 1.35
    stage.add(beam)

    const particles = new THREE.Group()
    stage.add(particles)
    for (let index = 0; index < 28; index += 1) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 + Math.random() * 0.02, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x99f7ff, transparent: true, opacity: 0.8 }),
      )
      particle.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: 0.7 + Math.random() * 0.9,
        speed: 0.3 + Math.random() * 0.6,
        height: Math.random() * 2.4,
      }
      particles.add(particle)
    }

    const bone = (name) => currentVrm?.humanoid?.getNormalizedBoneNode(name) || null

    const alignBottomEdge = (worldY) => {
      const desiredBottomNdcY = BOTTOM_EDGE_NDC
      const originalCameraY = camera.position.y
      const originalTargetY = controls.target.y
      const samplePoint = new THREE.Vector3(controls.target.x, worldY, 0)
      let center = 0
      let radius = Math.max(2.5, Math.abs(originalCameraY - worldY) + 1.5)
      let bestDelta = 0
      let bestError = Number.POSITIVE_INFINITY

      const evaluate = (delta) => {
        camera.position.y = originalCameraY + delta
        controls.target.y = originalTargetY + delta
        camera.updateMatrixWorld(true)
        const projectedY = samplePoint.clone().project(camera).y
        const error = Math.abs(projectedY - desiredBottomNdcY)
        if (error < bestError) {
          bestError = error
          bestDelta = delta
        }
      }

      for (let pass = 0; pass < 3; pass += 1) {
        const step = radius / 8
        for (let index = -8; index <= 8; index += 1) {
          evaluate(center + index * step)
        }
        center = bestDelta
        radius = step * 2
      }

      camera.position.y = originalCameraY + bestDelta
      controls.target.y = originalTargetY + bestDelta
      controls.update()
    }

    const fitAvatarToStage = (vrm) => {
      const bounds = new THREE.Box3().setFromObject(vrm.scene)
      const initialMetrics = measureAvatar(vrm, bounds)
      if (!Number.isFinite(initialMetrics.bodyHeight) || initialMetrics.bodyHeight <= 0) {
        return
      }

      const scale = TARGET_BODY_HEIGHT / initialMetrics.bodyHeight
      vrm.scene.scale.multiplyScalar(scale)
      vrm.scene.updateMatrixWorld(true)

      const scaledBounds = new THREE.Box3().setFromObject(vrm.scene)
      const scaledMetrics = measureAvatar(vrm, scaledBounds)
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())

      vrm.scene.position.x -= scaledMetrics.hipsX
      vrm.scene.position.z -= scaledCenter.z
      vrm.scene.position.y += STAGE_TOP_Y - scaledMetrics.footY
      vrm.scene.updateMatrixWorld(true)

      const finalBounds = new THREE.Box3().setFromObject(vrm.scene)
      const finalSize = finalBounds.getSize(new THREE.Vector3())
      const finalMetrics = measureAvatar(vrm, finalBounds)

      const focusY = THREE.MathUtils.lerp(STAGE_TOP_Y, finalMetrics.headY, FOCUS_LERP)
      const target = new THREE.Vector3(0, focusY, 0)

      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
      const fitHeight = (finalMetrics.bodyHeight * FIT_HEIGHT_RATIO) / Math.tan(verticalFov / 2)
      const fitWidth = (Math.max(finalSize.x, 1.1) * FIT_WIDTH_RATIO) / Math.tan(horizontalFov / 2)
      const distance = Math.max(fitHeight, fitWidth, MIN_FIT_DISTANCE) * 1.02
      const direction = new THREE.Vector3(0, 0.02, 1).normalize()

      controls.target.copy(target)
      camera.position.copy(target).add(direction.multiplyScalar(distance))
      camera.near = Math.max(0.1, distance / 50)
      camera.far = Math.max(100, distance * 30)
      camera.updateProjectionMatrix()
      controls.minDistance = Math.max(1.25, distance * 0.45)
      controls.maxDistance = Math.max(8, distance * 2.4)
      controls.update()

      alignBottomEdge(Math.min(finalBounds.min.y, STAGE_FLOOR_Y))
      baseTargetX = controls.target.x
      baseTargetY = controls.target.y
      framing.targetXOffset = 0
      framing.targetYOffset = 0
      syncFramingStateFromCamera()
    }

    const removeCurrentAvatar = () => {
      if (!currentVrm) return
      scene.remove(currentVrm.scene)
      disposeObject3D(currentVrm.scene)
      currentVrm = null
    }

    const loadAvatarFromFile = (file) => {
      if (!file) return

      loadVersion += 1
      const thisLoadVersion = loadVersion

      setIsLoaded(false)
      setViewerStatus('Loading')

      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
      currentUrl = URL.createObjectURL(file)

      removeCurrentAvatar()

      const loader = new GLTFLoader()
      loader.register((parser) => new VRMLoaderPlugin(parser))

      loader.load(
        currentUrl,
        (gltf) => {
          if (thisLoadVersion !== loadVersion) return
          const vrm = gltf.userData.vrm
          if (!vrm) {
            setViewerStatus('Unsupported file')
            return
          }

          VRMUtils.removeUnnecessaryVertices(gltf.scene)
          VRMUtils.removeUnnecessaryJoints(gltf.scene)
          if (VRMUtils.rotateVRM0) {
            VRMUtils.rotateVRM0(vrm)
          }

          currentVrm = vrm
          fitAvatarToStage(currentVrm)

          const hipsNode = currentVrm.humanoid?.getNormalizedBoneNode('hips')
          originalHipsY = hipsNode ? hipsNode.position.y : 0

          scene.add(currentVrm.scene)
          setIsLoaded(true)
          setViewerStatus('Avatar loaded')
        },
        undefined,
        (error) => {
          if (thisLoadVersion !== loadVersion) return
          console.error(error)
          setViewerStatus('Load failed')
        },
      )
    }

    const applyCommand = (dt) => {
      if (!currentVrm) return
      commandTime += dt

      const hips = bone('hips')
      const spine = bone('spine')
      const chest = bone('chest')
      const head = bone('head')
      const leftUpperArm = bone('leftUpperArm')
      const rightUpperArm = bone('rightUpperArm')
      const leftLowerArm = bone('leftLowerArm')
      const rightLowerArm = bone('rightLowerArm')
      const leftUpperLeg = bone('leftUpperLeg')
      const rightUpperLeg = bone('rightUpperLeg')
      const leftLowerLeg = bone('leftLowerLeg')
      const rightLowerLeg = bone('rightLowerLeg')

      const t = commandTime

      if (hips) {
        hips.position.y = originalHipsY + Math.sin(t * 2.2) * 0.01
        hips.rotation.set(0, Math.sin(t * 0.8) * 0.04, 0)
      }
      if (spine) spine.rotation.set(Math.sin(t * 1.5) * 0.03, 0, Math.sin(t * 1.4) * 0.03)
      if (chest) chest.rotation.set(Math.sin(t * 1.4) * 0.04, Math.sin(t * 1) * 0.05, Math.sin(t * 1.6) * 0.03)
      if (head) head.rotation.set(Math.sin(t * 1.7) * 0.03, Math.sin(t * 1.1) * 0.08, 0)
      if (leftUpperArm) leftUpperArm.rotation.set(0, 0, 0.18 + Math.sin(t * 1.4) * 0.03)
      if (rightUpperArm) rightUpperArm.rotation.set(0, 0, -0.18 - Math.sin(t * 1.4) * 0.03)
      if (leftLowerArm) leftLowerArm.rotation.set(-0.18, 0, 0)
      if (rightLowerArm) rightLowerArm.rotation.set(-0.18, 0, 0)
      if (leftUpperLeg) leftUpperLeg.rotation.set(Math.sin(t * 1.4) * 0.04, 0, 0)
      if (rightUpperLeg) rightUpperLeg.rotation.set(-Math.sin(t * 1.4) * 0.04, 0, 0)
      if (leftLowerLeg) leftLowerLeg.rotation.set(0.04, 0, 0)
      if (rightLowerLeg) rightLowerLeg.rotation.set(0.04, 0, 0)

      if (currentCommand === 'clap') {
        if (leftUpperArm) leftUpperArm.rotation.set(-0.25, 0, 0.85)
        if (rightUpperArm) rightUpperArm.rotation.set(-0.25, 0, -0.85)
        if (leftLowerArm) leftLowerArm.rotation.set(-1.15 + Math.sin(t * 8) * 0.15, 0, 0)
        if (rightLowerArm) rightLowerArm.rotation.set(-1.15 + Math.sin(t * 8) * 0.15, 0, 0)
        if (chest) chest.rotation.set(0.08, 0, 0)
      }

      if (currentCommand === 'jump') {
        const arc = Math.max(0, Math.sin((t % 1) * Math.PI))
        if (hips) hips.position.y = originalHipsY + arc * 0.22
        if (leftUpperArm) leftUpperArm.rotation.set(-0.9, 0, 0.25)
        if (rightUpperArm) rightUpperArm.rotation.set(-0.9, 0, -0.25)
        if (leftUpperLeg) leftUpperLeg.rotation.set(-0.35 + arc * 0.15, 0, 0)
        if (rightUpperLeg) rightUpperLeg.rotation.set(-0.35 + arc * 0.15, 0, 0)
      }

      if (currentCommand === 'dance') {
        if (hips) {
          hips.position.y = originalHipsY + Math.max(0, Math.sin(t * 4)) * 0.05
          hips.rotation.y = Math.sin(t * 2.8) * 0.2
        }
        if (chest) chest.rotation.set(Math.sin(t * 3.1) * 0.12, Math.sin(t * 2.8) * 0.24, Math.cos(t * 3.4) * 0.12)
        if (leftUpperArm) leftUpperArm.rotation.set(-0.55 + Math.sin(t * 4.2) * 0.25, 0, 0.85 + Math.cos(t * 4) * 0.2)
        if (rightUpperArm) rightUpperArm.rotation.set(-0.55 - Math.sin(t * 4.2) * 0.25, 0, -0.85 - Math.cos(t * 4) * 0.2)
        if (leftLowerArm) leftLowerArm.rotation.set(-0.6 + Math.sin(t * 4.8) * 0.28, 0, 0)
        if (rightLowerArm) rightLowerArm.rotation.set(-0.6 - Math.sin(t * 4.8) * 0.28, 0, 0)
        if (leftUpperLeg) leftUpperLeg.rotation.set(Math.sin(t * 4) * 0.35, 0, 0)
        if (rightUpperLeg) rightUpperLeg.rotation.set(Math.sin(t * 4 + Math.PI) * 0.35, 0, 0)
      }

      if (currentCommand === 'spin') {
        if (currentVrm?.scene) currentVrm.scene.rotation.y += dt * 4.8
        if (leftUpperArm) leftUpperArm.rotation.set(-0.65, 0, 1.05)
        if (rightUpperArm) rightUpperArm.rotation.set(-0.65, 0, -1.05)
      } else if (currentVrm?.scene) {
        currentVrm.scene.rotation.y = THREE.MathUtils.lerp(currentVrm.scene.rotation.y, 0, dt * 4)
      }
    }

    let middleDragging = false
    let lastMouseY = 0

    const onMouseDown = (event) => {
      if (event.button !== 1) return
      event.preventDefault()
      event.stopPropagation()
      middleDragging = true
      lastMouseY = event.clientY
    }

    const onMouseMove = (event) => {
      if (!middleDragging) return
      event.preventDefault()
      const deltaY = event.clientY - lastMouseY
      lastMouseY = event.clientY
      framing.targetYOffset += deltaY * -0.01
      applyFramingState()
    }

    const onMouseUp = (event) => {
      if (event.button === 1) {
        middleDragging = false
      }
    }

    const onAuxClick = (event) => {
      if (event.button === 1) {
        event.preventDefault()
      }
    }

    canvas.addEventListener('mousedown', onMouseDown, true)
    canvas.addEventListener('auxclick', onAuxClick)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    let animationFrameId = 0

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width <= 0 || height <= 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      const dt = clock.getDelta()
      const t = clock.elapsedTime

      rings.forEach((ring, index) => {
        ring.rotation.z += dt * (0.35 + index * 0.08)
        ring.position.y = 0.02 + index * 0.05 + Math.sin(t * 2 + index) * 0.01
      })

      particles.children.forEach((particle) => {
        particle.userData.height += dt * particle.userData.speed
        if (particle.userData.height > 2.8) {
          particle.userData.height = 0
        }
        particle.position.set(
          Math.cos(t * 0.6 + particle.userData.angle) * particle.userData.radius,
          particle.userData.height,
          Math.sin(t * 0.6 + particle.userData.angle) * particle.userData.radius,
        )
      })

      beam.material.opacity = 0.08 + Math.sin(t * 2) * 0.02
      applyCommand(dt)
      currentVrm?.update(dt)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    internalsRef.current = {
      loadFile: loadAvatarFromFile,
      setCommand: (nextCommand) => {
        currentCommand = nextCommand
        commandTime = 0
        setViewerStatus(`Command: ${nextCommand}`)
      },
      setFramingValue: (key, value) => {
        const numericValue = Number(value)
        if (key === 'yaw') framing.azimuth = THREE.MathUtils.degToRad(numericValue)
        if (key === 'tilt') framing.polar = THREE.MathUtils.degToRad(numericValue)
        if (key === 'zoom') framing.distance = numericValue
        if (key === 'height') framing.targetYOffset = numericValue
        if (key === 'shift') framing.targetXOffset = numericValue
        applyFramingState()
      },
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      controls.removeEventListener('change', syncFramingStateFromCamera)
      controls.dispose()
      canvas.removeEventListener('mousedown', onMouseDown, true)
      canvas.removeEventListener('auxclick', onAuxClick)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      removeCurrentAvatar()
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
      disposeObject3D(stage)
      renderer.dispose()
      internalsRef.current = null
    }
  }, [canvasRef])

  const loadFile = useCallback((file) => {
    internalsRef.current?.loadFile(file)
  }, [])

  const setCommand = useCallback((command) => {
    internalsRef.current?.setCommand(command)
  }, [])

  const setFramingValue = useCallback((key, value) => {
    internalsRef.current?.setFramingValue(key, value)
  }, [])

  return {
    loadFile,
    setCommand,
    setFramingValue,
    framingState,
    status,
    isLoaded,
  }
}
