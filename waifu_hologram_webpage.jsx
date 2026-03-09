import React, { useEffect, useMemo, useRef, useState } from 'react'

const COMMANDS = ['idle', 'clap', 'jump', 'dance', 'spin']

function CommandButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-cyan-300 bg-cyan-300/20 text-cyan-100 shadow-[0_0_20px_rgba(103,232,249,0.25)]'
          : 'border-white/15 bg-white/5 text-white/80 hover:border-cyan-300/40 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function DropZone({ onFile }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`rounded-3xl border p-4 transition ${
        dragOver ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 bg-white/5'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer?.files?.[0]
        if (file) onFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".vrm,.glb"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <div className="text-sm font-semibold text-cyan-200">Load a VRM avatar</div>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Drag and drop a <code>.vrm</code> file here, or browse for one. Custom uploads are forwarded to a real Three.js + VRM viewer running inside the preview.
      </p>
      <button
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/20"
      >
        Choose VRM / GLB file
      </button>
    </div>
  )
}

function ViewerFrame({ frameRef }) {
  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: radial-gradient(circle at top, #11214b 0%, #071125 35%, #030712 100%); font-family: Inter, system-ui, sans-serif; }
    #app { position: relative; width: 100%; height: 100%; }
    #status { position: absolute; left: 16px; bottom: 16px; z-index: 3; color: #c7f9ff; background: rgba(0,0,0,0.35); border: 1px solid rgba(103,232,249,0.2); border-radius: 999px; padding: 8px 12px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; backdrop-filter: blur(10px); }
    #hint { position: absolute; right: 16px; top: 16px; z-index: 3; color: rgba(255,255,255,0.75); background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 10px 12px; font-size: 12px; max-width: 280px; backdrop-filter: blur(10px); }
    #cameraRail { position: absolute; top: 88px; right: 16px; z-index: 3; width: 220px; display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid rgba(103,232,249,0.14); border-radius: 20px; background: rgba(3,7,18,0.45); backdrop-filter: blur(14px); box-shadow: 0 18px 40px rgba(0,0,0,0.25); }
    #cameraRailHeader { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #c7f9ff; opacity: 0.9; }
    .cameraControl { display: flex; flex-direction: column; gap: 6px; }
    .cameraControlRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: rgba(255,255,255,0.82); font-size: 12px; }
    .cameraControlRow span:last-child { color: #9fe8ff; font-variant-numeric: tabular-nums; }
    .cameraSlider { width: 100%; margin: 0; accent-color: #7cf7ff; }
    #overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.75); pointer-events: none; z-index: 2; }
    #overlayCard { border: 1px solid rgba(103,232,249,0.16); background: rgba(3,7,18,0.45); box-shadow: 0 0 48px rgba(34,211,238,0.08); border-radius: 24px; padding: 18px 20px; backdrop-filter: blur(10px); }
    canvas { display: block; }
    @media (max-width: 900px) {
      #cameraRail { left: 16px; right: 16px; top: auto; bottom: 62px; width: auto; }
      #hint { max-width: 220px; }
    }
  </style>
</head>
<body>
  <div id="app">
    <div id="hint">Real 3D VRM viewer. Drag to orbit, scroll to zoom.</div>
    <div id="cameraRail">
      <div id="cameraRailHeader">Camera sliders</div>
      <label class="cameraControl">
        <div class="cameraControlRow"><span>Yaw</span><span id="yawValue">0°</span></div>
        <input id="yawSlider" class="cameraSlider" type="range" min="-180" max="180" step="1" value="0" />
      </label>
      <label class="cameraControl">
        <div class="cameraControlRow"><span>Tilt</span><span id="tiltValue">72°</span></div>
        <input id="tiltSlider" class="cameraSlider" type="range" min="26" max="88" step="1" value="72" />
      </label>
      <label class="cameraControl">
        <div class="cameraControlRow"><span>Zoom</span><span id="zoomValue">8.00</span></div>
        <input id="zoomSlider" class="cameraSlider" type="range" min="1.8" max="12" step="0.05" value="8.0" />
      </label>
      <label class="cameraControl">
        <div class="cameraControlRow"><span>Height</span><span id="heightValue">0.00</span></div>
        <input id="heightSlider" class="cameraSlider" type="range" min="-1.5" max="1.5" step="0.01" value="0" />
      </label>
      <label class="cameraControl">
        <div class="cameraControlRow"><span>Shift</span><span id="shiftValue">0.00</span></div>
        <input id="shiftSlider" class="cameraSlider" type="range" min="-1.5" max="1.5" step="0.01" value="0" />
      </label>
    </div>
    <div id="overlay"><div id="overlayCard">No avatar loaded yet. Use the upload panel on the left.</div></div>
    <div id="status">Idle</div>
  </div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/",
      "@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3/lib/three-vrm.module.min.js"
    }
  }
  </script>

  <script type="module">
    import * as THREE from 'three'
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
    import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

    const app = document.getElementById('app')
    const statusEl = document.getElementById('status')
    const overlay = document.getElementById('overlay')
    const yawSlider = document.getElementById('yawSlider')
    const tiltSlider = document.getElementById('tiltSlider')
    const zoomSlider = document.getElementById('zoomSlider')
    const heightSlider = document.getElementById('heightSlider')
    const shiftSlider = document.getElementById('shiftSlider')
    const yawValue = document.getElementById('yawValue')
    const tiltValue = document.getElementById('tiltValue')
    const zoomValue = document.getElementById('zoomValue')
    const heightValue = document.getElementById('heightValue')
    const shiftValue = document.getElementById('shiftValue')

    /* ── Scene constants ────────────────────────────────────── */
    const STAGE_BASE_HEIGHT  = 0.18
    const STAGE_BASE_Y       = -0.1
    const STAGE_TOP_Y        = 0.02
    const STAGE_FLOOR_Y      = STAGE_BASE_Y - STAGE_BASE_HEIGHT / 2
    const TARGET_BODY_HEIGHT = 2.0
    const FOCUS_LERP         = 0.30   // blend between stageTop and head for camera focus
    const FIT_HEIGHT_RATIO   = 0.75   // fraction of body height used for vertical framing
    const FIT_WIDTH_RATIO    = 0.72   // fraction of body width used for horizontal framing
    const MIN_FIT_DISTANCE   = 3.5
    const BOTTOM_EDGE_NDC    = -0.85  // where the stage floor should sit in NDC-Y

    /* ── Default camera pose ──────────────────────────────── */
    const DEFAULT_POLAR    = 72   // degrees
    const DEFAULT_DISTANCE = 8.0
    const DEFAULT_TARGET_Y = 0.8

    /* ── Runtime state ────────────────────────────────────── */
    let currentVrm = null
    let currentUrl = null
    let currentCommand = 'idle'
    let commandTime = 0
    let baseTargetX = 0
    let baseTargetY = DEFAULT_TARGET_Y
    let originalHipsY = 0  // captured after avatar load, used as animation base
    const framingState = {
      azimuth: 0,
      polar: THREE.MathUtils.degToRad(DEFAULT_POLAR),
      distance: DEFAULT_DISTANCE,
      targetYOffset: 0,
      targetXOffset: 0,
    }
    const clock = new THREE.Clock()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    app.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x040816, 12, 30)

    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100)
    const initPolar = THREE.MathUtils.degToRad(DEFAULT_POLAR)
    camera.position.set(
      DEFAULT_DISTANCE * Math.sin(initPolar) * Math.sin(0),
      DEFAULT_TARGET_Y + DEFAULT_DISTANCE * Math.cos(initPolar),
      DEFAULT_DISTANCE * Math.sin(initPolar) * Math.cos(0)
    )

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.target.set(0, DEFAULT_TARGET_Y, 0)
    controls.minDistance = 1.8
    controls.maxDistance = 12
    controls.minPolarAngle = 0.45
    controls.maxPolarAngle = 1.55
    controls.update()

    function clampFramingState() {
      framingState.polar = THREE.MathUtils.clamp(framingState.polar, controls.minPolarAngle, controls.maxPolarAngle)
      framingState.distance = THREE.MathUtils.clamp(framingState.distance, controls.minDistance, controls.maxDistance)
      framingState.targetYOffset = THREE.MathUtils.clamp(framingState.targetYOffset, Number(heightSlider.min), Number(heightSlider.max))
      framingState.targetXOffset = THREE.MathUtils.clamp(framingState.targetXOffset, Number(shiftSlider.min), Number(shiftSlider.max))
    }

    function syncSliderUi() {
      yawSlider.value = THREE.MathUtils.radToDeg(framingState.azimuth).toFixed(0)
      tiltSlider.value = THREE.MathUtils.radToDeg(framingState.polar).toFixed(0)
      zoomSlider.min = String(controls.minDistance)
      zoomSlider.max = String(controls.maxDistance)
      zoomSlider.value = framingState.distance.toFixed(2)
      heightSlider.value = framingState.targetYOffset.toFixed(2)
      shiftSlider.value = framingState.targetXOffset.toFixed(2)

      yawValue.textContent = yawSlider.value + '°'
      tiltValue.textContent = tiltSlider.value + '°'
      zoomValue.textContent = framingState.distance.toFixed(2)
      heightValue.textContent = framingState.targetYOffset.toFixed(2)
      shiftValue.textContent = framingState.targetXOffset.toFixed(2)
    }

    function applyFramingState() {
      clampFramingState()
      const offset = new THREE.Vector3().setFromSpherical(
        new THREE.Spherical(framingState.distance, framingState.polar, framingState.azimuth)
      )
      controls.target.set(baseTargetX + framingState.targetXOffset, baseTargetY + framingState.targetYOffset, 0)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      syncSliderUi()
    }

    function syncFramingStateFromCamera() {
      const offset = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)

      framingState.azimuth = spherical.theta
      framingState.polar = spherical.phi
      framingState.distance = spherical.radius
      framingState.targetYOffset = controls.target.y - baseTargetY
      framingState.targetXOffset = controls.target.x - baseTargetX
      clampFramingState()
      syncSliderUi()
    }

    ;[
      [yawSlider, (value) => { framingState.azimuth = THREE.MathUtils.degToRad(Number(value)) }],
      [tiltSlider, (value) => { framingState.polar = THREE.MathUtils.degToRad(Number(value)) }],
      [zoomSlider, (value) => { framingState.distance = Number(value) }],
      [heightSlider, (value) => { framingState.targetYOffset = Number(value) }],
      [shiftSlider, (value) => { framingState.targetXOffset = Number(value) }],
    ].forEach(([slider, update]) => {
      slider.addEventListener('input', (event) => {
        update(event.target.value)
        applyFramingState()
      })
    })

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
      new THREE.MeshStandardMaterial({ color: 0x0d1b36, emissive: 0x0d4cb3, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 })
    )
    base.position.y = STAGE_BASE_Y
    stage.add(base)

    function makeRing(radius, tube, color, y) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 12, 96),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })
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
      new THREE.CylinderGeometry(0.82, 1.25, 3.0, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x59e8ff, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
    )
    beam.position.y = 1.35
    stage.add(beam)

    const particles = new THREE.Group()
    stage.add(particles)
    for (let i = 0; i < 28; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 + Math.random() * 0.02, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x99f7ff, transparent: true, opacity: 0.8 })
      )
      p.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: 0.7 + Math.random() * 0.9,
        speed: 0.3 + Math.random() * 0.6,
        height: Math.random() * 2.4,
      }
      particles.add(p)
    }

    function setStatus(text) {
      statusEl.textContent = text
    }

    function bone(name) {
      return currentVrm?.humanoid?.getNormalizedBoneNode(name) || null
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

      // Use the bounding-box floor as the true bottom of the mesh.
      // Bone positions (ankles, toes) sit above the actual shoe / mesh
      // bottom, which causes the model to be placed too high and the
      // body height to be underestimated.
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

    function alignBottomEdge(worldY) {
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
        for (let i = -8; i <= 8; i += 1) {
          evaluate(center + i * step)
        }
        center = bestDelta
        radius = step * 2
      }

      camera.position.y = originalCameraY + bestDelta
      controls.target.y = originalTargetY + bestDelta
      controls.update()
    }

    function fitAvatarToStage(vrm) {
      const bounds = new THREE.Box3().setFromObject(vrm.scene)
      const initialMetrics = measureAvatar(vrm, bounds)
      if (!Number.isFinite(initialMetrics.bodyHeight) || initialMetrics.bodyHeight <= 0) return

      // Scale avatar so body matches target height
      const scale = TARGET_BODY_HEIGHT / initialMetrics.bodyHeight
      vrm.scene.scale.multiplyScalar(scale)
      vrm.scene.updateMatrixWorld(true)

      // Re-measure after scaling and centre avatar on the stage
      const scaledBounds = new THREE.Box3().setFromObject(vrm.scene)
      const scaledMetrics = measureAvatar(vrm, scaledBounds)
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())

      vrm.scene.position.x -= scaledMetrics.hipsX
      vrm.scene.position.z -= scaledCenter.z
      vrm.scene.position.y += STAGE_TOP_Y - scaledMetrics.footY
      vrm.scene.updateMatrixWorld(true)

      // Compute camera framing that includes the full character + base
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
      framingState.targetXOffset = 0
      framingState.targetYOffset = 0
      syncFramingStateFromCamera()
    }

    async function loadAvatarFromFile(file) {
      try {
        overlay.style.display = 'flex'
        overlay.firstElementChild.textContent = 'Loading avatar...'
        setStatus('Loading')

        if (currentUrl) URL.revokeObjectURL(currentUrl)
        currentUrl = URL.createObjectURL(file)

        if (currentVrm) {
          scene.remove(currentVrm.scene)
          currentVrm.scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose?.()
            if (obj.material) {
              if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
              else obj.material.dispose?.()
            }
          })
          currentVrm = null
        }

        const loader = new GLTFLoader()
        loader.register((parser) => new VRMLoaderPlugin(parser))

        loader.load(
          currentUrl,
          (gltf) => {
            const vrm = gltf.userData.vrm
            if (!vrm) {
              overlay.style.display = 'flex'
              overlay.firstElementChild.textContent = 'This file loaded, but it does not look like a VRM avatar.'
              setStatus('Unsupported file')
              return
            }

            VRMUtils.removeUnnecessaryVertices(gltf.scene)
            VRMUtils.removeUnnecessaryJoints(gltf.scene)
            if (VRMUtils.rotateVRM0) VRMUtils.rotateVRM0(vrm)

            currentVrm = vrm
            fitAvatarToStage(currentVrm)

            // Capture the hips rest position AFTER fitting, so animations
            // can apply deltas instead of overwriting with absolute values.
            const hipsNode = currentVrm.humanoid?.getNormalizedBoneNode('hips')
            originalHipsY = hipsNode ? hipsNode.position.y : 0

            scene.add(currentVrm.scene)
            overlay.style.display = 'none'
            setStatus('Avatar loaded')
          },
          undefined,
          (error) => {
            console.error(error)
            overlay.style.display = 'flex'
            overlay.firstElementChild.textContent = 'Failed to load this avatar.'
            setStatus('Load failed')
          }
        )
      } catch (error) {
        console.error(error)
        overlay.style.display = 'flex'
        overlay.firstElementChild.textContent = 'Unexpected load error.'
        setStatus('Load failed')
      }
    }

    function applyCommand(dt) {
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
      const sway = Math.sin(t * 1.8)

      if (hips) {
        hips.position.y = originalHipsY + Math.sin(t * 2.2) * 0.01
        hips.rotation.set(0, Math.sin(t * 0.8) * 0.04, 0)
      }
      if (spine) spine.rotation.set(Math.sin(t * 1.5) * 0.03, 0, Math.sin(t * 1.4) * 0.03)
      if (chest) chest.rotation.set(Math.sin(t * 1.4) * 0.04, Math.sin(t * 1.0) * 0.05, Math.sin(t * 1.6) * 0.03)
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
        const arc = Math.max(0, Math.sin((t % 1.0) * Math.PI))
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
        if (leftUpperArm) leftUpperArm.rotation.set(-0.55 + Math.sin(t * 4.2) * 0.25, 0, 0.85 + Math.cos(t * 4.0) * 0.2)
        if (rightUpperArm) rightUpperArm.rotation.set(-0.55 - Math.sin(t * 4.2) * 0.25, 0, -0.85 - Math.cos(t * 4.0) * 0.2)
        if (leftLowerArm) leftLowerArm.rotation.set(-0.6 + Math.sin(t * 4.8) * 0.28, 0, 0)
        if (rightLowerArm) rightLowerArm.rotation.set(-0.6 - Math.sin(t * 4.8) * 0.28, 0, 0)
        if (leftUpperLeg) leftUpperLeg.rotation.set(Math.sin(t * 4.0) * 0.35, 0, 0)
        if (rightUpperLeg) rightUpperLeg.rotation.set(Math.sin(t * 4.0 + Math.PI) * 0.35, 0, 0)
      }

      if (currentCommand === 'spin') {
        if (currentVrm?.scene) currentVrm.scene.rotation.y += dt * 4.8
        if (leftUpperArm) leftUpperArm.rotation.set(-0.65, 0, 1.05)
        if (rightUpperArm) rightUpperArm.rotation.set(-0.65, 0, -1.05)
      } else if (currentVrm?.scene) {
        currentVrm.scene.rotation.y = THREE.MathUtils.lerp(currentVrm.scene.rotation.y, 0, dt * 4)
      }
    }

    window.addEventListener('message', (event) => {
      const { type, file, command } = event.data || {}
      if (type === 'load-file' && file) loadAvatarFromFile(file)
      if (type === 'command' && command) {
        currentCommand = command
        commandTime = 0
        setStatus('Command: ' + command)
      }
    })

    function animate() {
      const dt = clock.getDelta()
      const t = clock.elapsedTime

      rings.forEach((ring, i) => {
        ring.rotation.z += dt * (0.35 + i * 0.08)
        ring.position.y = 0.02 + i * 0.05 + Math.sin(t * 2 + i) * 0.01
      })

      particles.children.forEach((p) => {
        p.userData.height += dt * p.userData.speed
        if (p.userData.height > 2.8) p.userData.height = 0
        p.position.set(
          Math.cos(t * 0.6 + p.userData.angle) * p.userData.radius,
          p.userData.height,
          Math.sin(t * 0.6 + p.userData.angle) * p.userData.radius
        )
      })

      beam.material.opacity = 0.08 + Math.sin(t * 2.0) * 0.02
      applyCommand(dt)
      currentVrm?.update(dt)
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })
  </script>
</body>
</html>`,
    []
  )

  return <iframe ref={frameRef} title="VRM Viewer" srcDoc={srcDoc} className="h-full w-full rounded-[32px] border border-cyan-300/15 bg-black/20" sandbox="allow-scripts allow-same-origin" />
}

export default function WaifuHologramPage() {
  const [command, setCommand] = useState('idle')
  const [toolLog, setToolLog] = useState(['System ready'])
  const [loadedName, setLoadedName] = useState('None loaded yet')
  const frameRef = useRef(null)
  const resetTimeoutRef = useRef(null)

  const postToViewer = (payload) => {
    const win = frameRef.current?.contentWindow
    if (!win) return
    win.postMessage(payload, '*')
  }

  const clearResetTimer = () => {
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
  }

  const runCommand = (incoming) => {
    const normalized = String(incoming || '').trim().toLowerCase()
    if (!COMMANDS.includes(normalized)) return false

    clearResetTimer()
    setCommand(normalized)
    setToolLog((prev) => [`Tool command: ${normalized}`, ...prev].slice(0, 8))
    postToViewer({ type: 'command', command: normalized })

    if (normalized === 'jump' || normalized === 'spin') {
      resetTimeoutRef.current = window.setTimeout(() => {
        setCommand('idle')
        postToViewer({ type: 'command', command: 'idle' })
        resetTimeoutRef.current = null
      }, normalized === 'jump' ? 1000 : 1450)
    }

    return true
  }

  useEffect(() => {
    window.hologramTool = {
      execute: runCommand,
      commands: COMMANDS,
      help: 'Use window.hologramTool.execute("dance") or dispatch a hologram-command event.',
    }

    const onEvent = (event) => {
      const cmd = event?.detail?.command
      runCommand(cmd)
    }

    window.addEventListener('hologram-command', onEvent)
    return () => {
      clearResetTimer()
      window.removeEventListener('hologram-command', onEvent)
      delete window.hologramTool
    }
  }, [])

  const handleFile = (file) => {
    setLoadedName(file.name)
    setToolLog((prev) => [`Loaded avatar: ${file.name}`, ...prev].slice(0, 8))
    postToViewer({ type: 'load-file', file })
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,_#11214b_0%,_#071125_35%,_#030712_100%)] text-white">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-white/10 bg-black/20 p-5 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">AI Hologram Console</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">VRM Holo Avatar</h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Real 3D viewer using Three.js + VRM inside an isolated preview frame, with upload support for your own avatars.
            </p>
          </div>

          <DropZone onFile={handleFile} />

          <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-white/75">
            The uploaded VRM you attached to this chat is available to me server-side, but the live preview cannot directly access that private file path from the browser sandbox. To test it here, re-select the same <code>.vrm</code> file using the upload box above.
          </div>

          <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-white/5 p-4 shadow-2xl shadow-cyan-950/30">
            <div className="mb-3 text-sm font-semibold text-cyan-200">Test actions</div>
            <div className="grid grid-cols-2 gap-3">
              {COMMANDS.map((item) => (
                <CommandButton key={item} label={item} active={command === item} onClick={() => runCommand(item)} />
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-sm font-semibold text-cyan-200">Loaded avatar</div>
            <div className="rounded-xl bg-black/25 px-3 py-2 text-sm text-white/75">{loadedName}</div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-sm font-semibold text-cyan-200">Tool API</div>
            <div className="space-y-2 font-mono text-xs leading-5 text-white/75">
              <div className="rounded-xl bg-black/30 p-3">window.hologramTool.execute('dance')</div>
              <div className="rounded-xl bg-black/30 p-3">window.dispatchEvent(new CustomEvent('hologram-command', {'{'} detail: {'{'} command: 'jump' {'}'} {'}'}))</div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-sm font-semibold text-cyan-200">Recent log</div>
            <div className="space-y-2 text-sm text-white/70">
              {toolLog.map((line, i) => (
                <div key={i} className="rounded-xl bg-black/25 px-3 py-2">{line}</div>
              ))}
            </div>
          </div>
        </aside>

        <main className="relative p-4 lg:p-5">
          <ViewerFrame frameRef={frameRef} />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-8">
            <div className="rounded-full border border-cyan-300/20 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.25em] text-cyan-200/90 backdrop-blur">
              Active command: {command}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
