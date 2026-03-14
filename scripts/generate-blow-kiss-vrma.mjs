import fs from 'node:fs'
import path from 'node:path'
import { Quaternion } from 'three'

const TEMPLATE_FILE = path.resolve('default_vrma/Holding Head.vrma')
const FORWARD_POSE_FILE = path.resolve('default_vrma/Taunt.vrma')
const OUTPUT_FILE = path.resolve('default_vrma/Blow-Kiss.vrma')

const BODY_BONES = [
  'upperChest',
  'neck',
  'head',
  'rightShoulder',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'rightThumbMetacarpal',
  'rightThumbProximal',
  'rightThumbDistal',
  'rightIndexProximal',
  'rightIndexIntermediate',
  'rightIndexDistal',
  'rightMiddleProximal',
  'rightMiddleIntermediate',
  'rightMiddleDistal',
  'rightRingProximal',
  'rightRingIntermediate',
  'rightRingDistal',
  'rightLittleProximal',
  'rightLittleIntermediate',
  'rightLittleDistal',
]

const EXPRESSION_NODE_NAMES = [
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
  'aa',
  'oh',
  'ih',
  'ee',
  'ou',
  'blink',
  'blinkLeft',
  'blinkRight',
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
]

const BODY_TIMES = [0, 0.22, 0.58, 1.02, 1.28, 1.6, 1.9, 2.35, 2.85]

const EXPRESSION_CHANNELS = {
  happy: {
    times: [0, 0.12, 0.48, 1.0, 1.56, 2.08, 2.85],
    weights: [0.04, 0.2, 0.26, 0.2, 0.3, 0.12, 0],
  },
  relaxed: {
    times: [0, 0.72, 1.08, 1.82, 2.85],
    weights: [0, 0.06, 0.12, 0.06, 0],
  },
  blinkLeft: {
    times: [0, 0.1, 0.18, 0.28, 0.42, 2.85],
    weights: [0, 0.04, 1, 0.18, 0, 0],
  },
  ou: {
    times: [0, 0.72, 1.0, 1.22, 1.44, 1.68, 2.0, 2.85],
    weights: [0, 0.12, 0.48, 0.72, 0.28, 0.08, 0, 0],
  },
  oh: {
    times: [0, 1.34, 1.56, 1.78, 2.0, 2.24, 2.85],
    weights: [0, 0, 0.7, 0.94, 0.5, 0.08, 0],
  },
  lookRight: {
    times: [0, 0.22, 0.82, 1.46, 2.05, 2.85],
    weights: [0.05, 0.16, 0.1, 0.06, 0.02, 0],
  },
}

function loadGlb(filePath) {
  const buffer = fs.readFileSync(filePath)
  const jsonChunkLength = buffer.readUInt32LE(12)
  const jsonChunkStart = 20
  const json = JSON.parse(buffer.slice(jsonChunkStart, jsonChunkStart + jsonChunkLength).toString('utf8').trim())
  const binHeaderStart = jsonChunkStart + jsonChunkLength
  const binChunkLength = buffer.readUInt32LE(binHeaderStart)
  const binChunkStart = binHeaderStart + 8
  const bin = buffer.slice(binChunkStart, binChunkStart + binChunkLength)

  return { json, bin }
}

function accessorValues(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex]
  const bufferView = json.bufferViews[accessor.bufferView]
  const componentCount = accessor.type === 'SCALAR' ? 1 : accessor.type === 'VEC3' ? 3 : 4
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const values = []

  for (let index = 0; index < accessor.count * componentCount; index += 1) {
    values.push(bin.readFloatLE(byteOffset + index * 4))
  }

  return { values, componentCount }
}

function buildRotationTrackMap(glb) {
  const trackMap = new Map()
  const animation = glb.json.animations[0]

  animation.channels.forEach((channel) => {
    const sampler = animation.samplers[channel.sampler]
    trackMap.set(`${channel.target.node}:${channel.target.path}`, {
      times: accessorValues(glb.json, glb.bin, sampler.input).values,
      ...accessorValues(glb.json, glb.bin, sampler.output),
    })
  })

  return trackMap
}

function sampleTrack(track, time) {
  const { times, values, componentCount } = track

  if (time <= times[0]) {
    return values.slice(0, componentCount)
  }

  if (time >= times[times.length - 1]) {
    return values.slice(values.length - componentCount)
  }

  let index = 0
  while (index < times.length - 1 && time > times[index + 1]) {
    index += 1
  }

  const startTime = times[index]
  const endTime = times[index + 1]
  const alpha = (time - startTime) / (endTime - startTime || 1)

  if (componentCount === 4) {
    const from = new Quaternion().fromArray(values, index * 4)
    const to = new Quaternion().fromArray(values, (index + 1) * 4)
    return from.slerp(to, alpha).toArray()
  }

  return Array.from({ length: componentCount }, (_, componentIndex) => (
    values[index * componentCount + componentIndex] * (1 - alpha) +
    values[(index + 1) * componentCount + componentIndex] * alpha
  ))
}

function slerpArray(from, to, alpha) {
  return new Quaternion().fromArray(from).slerp(new Quaternion().fromArray(to), alpha).toArray()
}

function samplePose(filePath, time, skeletonJson, humanoidBones) {
  const glb = loadGlb(filePath)
  const trackMap = buildRotationTrackMap(glb)
  const pose = {}

  BODY_BONES.forEach((boneName) => {
    const nodeIndex = humanoidBones[boneName].node
    const rotationTrack = trackMap.get(`${nodeIndex}:rotation`)
    pose[boneName] = rotationTrack ? sampleTrack(rotationTrack, time) : skeletonJson.nodes[nodeIndex].rotation
  })

  return pose
}

function buildPoseSequence(restPose, nearPose, forwardPose) {
  const sequence = {}

  BODY_BONES.forEach((boneName) => {
    const rest = restPose[boneName]
    const near = nearPose[boneName]
    const forward = forwardPose[boneName]

    const prepAlpha = boneName.startsWith('right') ? 0.28 : 0.18
    const approachAlpha = boneName.startsWith('right') ? 0.72 : 0.58
    const releaseAlpha = ['upperChest', 'neck', 'head'].includes(boneName) ? 0.3 : 0.86
    const settleAlpha = boneName.startsWith('right') ? 0.42 : 0.3

    sequence[boneName] = [
      rest,
      slerpArray(rest, near, prepAlpha),
      slerpArray(rest, near, approachAlpha),
      near,
      near,
      slerpArray(near, forward, releaseAlpha),
      forward,
      slerpArray(forward, rest, settleAlpha),
      rest,
    ]
  })

  sequence.head[5] = slerpArray(restPose.head, forwardPose.head, 0.22)
  sequence.neck[5] = slerpArray(restPose.neck, forwardPose.neck, 0.16)
  sequence.upperChest[5] = slerpArray(restPose.upperChest, forwardPose.upperChest, 0.45)

  return sequence
}

function padBuffer(buffer) {
  const padding = (4 - (buffer.length % 4)) % 4
  if (padding === 0) {
    return buffer
  }

  return Buffer.concat([buffer, Buffer.alloc(padding, 0x20)])
}

function float32Buffer(values) {
  const buffer = Buffer.alloc(values.length * 4)
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4))
  return buffer
}

function addAccessor(json, binaryChunks, values, type) {
  const byteOffset = binaryChunks.byteLength
  const buffer = float32Buffer(values)
  binaryChunks.parts.push(buffer)
  binaryChunks.byteLength += buffer.length

  const bufferViewIndex = json.bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: buffer.length,
  }) - 1

  const accessor = {
    bufferView: bufferViewIndex,
    componentType: 5126,
    count: type === 'SCALAR' ? values.length : values.length / (type === 'VEC3' ? 3 : 4),
    type,
  }

  if (type === 'SCALAR') {
    accessor.min = [Math.min(...values)]
    accessor.max = [Math.max(...values)]
  }

  return json.accessors.push(accessor) - 1
}

function weightTriplets(weights) {
  const values = []
  weights.forEach((weight) => {
    values.push(weight, 0, 0)
  })
  return values
}

function buildJson(skeletonJson, humanoidBones, poseSequence) {
  const hipsNodeIndex = humanoidBones.hips.node
  const nodes = skeletonJson.nodes.map((node) => ({
    ...node,
    children: node.children ? [...node.children] : undefined,
  }))
  const expressionNodeOffset = nodes.length

  EXPRESSION_NODE_NAMES.forEach((name, index) => {
    nodes.push({
      name: `VRMExpression_${name}`,
      translation: [0, 0, 0],
    })
    nodes[hipsNodeIndex].children.push(expressionNodeOffset + index)
  })

  const json = {
    asset: {
      version: '2.0',
      generator: 'vrm-animator blow-kiss vrma generator',
    },
    scenes: skeletonJson.scenes,
    scene: skeletonJson.scene,
    nodes,
    buffers: [],
    bufferViews: [],
    accessors: [],
    animations: [
      {
        name: 'blow-kiss',
        channels: [],
        samplers: [],
      },
    ],
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: '1.0',
        humanoid: {
          humanBones: humanoidBones,
        },
        expressions: {
          preset: Object.fromEntries(
            EXPRESSION_NODE_NAMES.map((name, index) => [name, { node: expressionNodeOffset + index }]),
          ),
        },
      },
    },
  }

  const binaryChunks = { parts: [], byteLength: 0 }
  const animation = json.animations[0]

  BODY_BONES.forEach((boneName) => {
    const inputAccessor = addAccessor(json, binaryChunks, BODY_TIMES, 'SCALAR')
    const outputAccessor = addAccessor(json, binaryChunks, poseSequence[boneName].flat(), 'VEC4')

    const samplerIndex = animation.samplers.push({
      input: inputAccessor,
      output: outputAccessor,
      interpolation: 'LINEAR',
    }) - 1

    animation.channels.push({
      sampler: samplerIndex,
      target: {
        node: humanoidBones[boneName].node,
        path: 'rotation',
      },
    })
  })

  EXPRESSION_NODE_NAMES.forEach((name, index) => {
    const channel = EXPRESSION_CHANNELS[name]
    if (!channel) {
      return
    }

    const inputAccessor = addAccessor(json, binaryChunks, channel.times, 'SCALAR')
    const outputAccessor = addAccessor(json, binaryChunks, weightTriplets(channel.weights), 'VEC3')

    const samplerIndex = animation.samplers.push({
      input: inputAccessor,
      output: outputAccessor,
      interpolation: 'LINEAR',
    }) - 1

    animation.channels.push({
      sampler: samplerIndex,
      target: {
        node: expressionNodeOffset + index,
        path: 'translation',
      },
    })
  })

  json.buffers.push({ byteLength: binaryChunks.byteLength })

  return {
    json,
    binaryBuffer: Buffer.concat(binaryChunks.parts),
  }
}

function buildGlb({ json, binaryBuffer }) {
  const jsonChunk = padBuffer(Buffer.from(JSON.stringify(json), 'utf8'))
  const binChunk = padBuffer(binaryBuffer)
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length

  const header = Buffer.alloc(12)
  header.write('glTF', 0, 4, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(totalLength, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonChunk.length, 0)
  jsonHeader.write('JSON', 4, 4, 'ascii')

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binChunk.length, 0)
  binHeader.write('BIN\0', 4, 4, 'ascii')

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk])
}

function main() {
  const template = loadGlb(TEMPLATE_FILE)
  const humanoidBones = template.json.extensions.VRMC_vrm_animation.humanoid.humanBones

  const restPose = Object.fromEntries(
    BODY_BONES.map((boneName) => [boneName, template.json.nodes[humanoidBones[boneName].node].rotation]),
  )
  const nearPose = samplePose(TEMPLATE_FILE, 1.0725, template.json, humanoidBones)
  const forwardPose = samplePose(FORWARD_POSE_FILE, 2.7125, template.json, humanoidBones)
  const poseSequence = buildPoseSequence(restPose, nearPose, forwardPose)
  const glb = buildGlb(buildJson(template.json, humanoidBones, poseSequence))

  fs.writeFileSync(OUTPUT_FILE, glb)
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)} (${glb.length} bytes)`)
}

main()
