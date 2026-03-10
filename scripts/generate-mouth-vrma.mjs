import fs from 'node:fs'
import path from 'node:path'

const outputDir = path.resolve('expressions_vrma')

const HIPS_NODE_INDEX = 0
const EXPRESSION_NODE_OFFSET = 1
const EXPRESSION_NODE_NAMES = ['aa', 'oh', 'ih', 'ee', 'ou', 'blink']

const CLIPS = [
  {
    filename: 'Mouth Yawn Test.vrma',
    name: 'mouth-yawn-test',
    channels: {
      aa: {
        times: [0, 0.35, 0.8, 1.2, 1.7, 2.2, 2.6],
        weights: [0, 0.12, 0.5, 1.0, 1.0, 0.28, 0],
      },
      oh: {
        times: [0, 0.45, 0.9, 1.4, 1.85, 2.3, 2.6],
        weights: [0, 0.08, 0.22, 0.45, 0.35, 0.08, 0],
      },
      blink: {
        times: [0, 0.72, 0.95, 1.18, 1.35, 1.62, 1.9, 2.6],
        weights: [0, 0, 0.3, 0.82, 0.9, 0.36, 0, 0],
      },
    },
  },
  {
    filename: 'Mouth Talking Test.vrma',
    name: 'mouth-talking-test',
    channels: {
      aa: {
        times: [0, 0.14, 0.32, 0.5, 0.72, 0.92, 1.12, 1.34, 1.58, 1.82, 2.05, 2.3],
        weights: [0.08, 0.72, 0.18, 0.65, 0.1, 0.78, 0.16, 0.68, 0.12, 0.58, 0.08, 0],
      },
      ih: {
        times: [0, 0.18, 0.36, 0.62, 0.84, 1.06, 1.28, 1.52, 1.76, 2.0, 2.3],
        weights: [0.05, 0.14, 0.52, 0.16, 0.48, 0.12, 0.5, 0.18, 0.42, 0.12, 0],
      },
      ee: {
        times: [0, 0.24, 0.46, 0.7, 0.96, 1.2, 1.44, 1.7, 1.94, 2.3],
        weights: [0.04, 0.42, 0.1, 0.36, 0.08, 0.4, 0.12, 0.34, 0.08, 0],
      },
      ou: {
        times: [0, 0.28, 0.54, 0.86, 1.16, 1.48, 1.8, 2.08, 2.3],
        weights: [0.02, 0.22, 0.48, 0.16, 0.44, 0.14, 0.4, 0.12, 0],
      },
      oh: {
        times: [0, 0.2, 0.42, 0.66, 0.9, 1.14, 1.38, 1.62, 1.88, 2.14, 2.3],
        weights: [0.06, 0.3, 0.12, 0.28, 0.1, 0.26, 0.12, 0.3, 0.1, 0.18, 0],
      },
      blink: {
        times: [0, 1.04, 1.14, 1.24, 2.3],
        weights: [0, 0, 0.75, 0, 0],
      },
    },
  },
]

function padBuffer(buffer) {
  const padding = (4 - (buffer.length % 4)) % 4
  if (padding === 0) return buffer
  return Buffer.concat([buffer, Buffer.alloc(padding, 0x20)])
}

function float32Buffer(values) {
  const buffer = Buffer.alloc(values.length * 4)
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4))
  return buffer
}

function weightTriplets(weights) {
  const values = []
  weights.forEach((weight) => {
    values.push(weight, 0, 0)
  })
  return values
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
    count: type === 'SCALAR' ? values.length : values.length / 3,
    type,
  }

  if (type === 'SCALAR') {
    accessor.min = [Math.min(...values)]
    accessor.max = [Math.max(...values)]
  }

  return json.accessors.push(accessor) - 1
}

function buildExpressionExtension() {
  const preset = {}
  EXPRESSION_NODE_NAMES.forEach((name, index) => {
    preset[name] = { node: index + EXPRESSION_NODE_OFFSET }
  })

  return {
    specVersion: '1.0',
    humanoid: {
      humanBones: {
        hips: { node: HIPS_NODE_INDEX },
      },
    },
    expressions: { preset },
  }
}

function buildJson(clip) {
  const json = {
    asset: {
      version: '2.0',
      generator: 'vrm-animator mouth vrma generator',
    },
    scenes: [
      {
        nodes: [HIPS_NODE_INDEX],
      },
    ],
    scene: 0,
    nodes: [
      {
        name: 'VRMHumanoidHips',
        translation: [0, 1, 0],
        children: EXPRESSION_NODE_NAMES.map((_, index) => index + EXPRESSION_NODE_OFFSET),
      },
      ...EXPRESSION_NODE_NAMES.map((name) => ({
        name: `VRMExpression_${name}`,
        translation: [0, 0, 0],
      })),
    ],
    buffers: [],
    bufferViews: [],
    accessors: [],
    animations: [
      {
        name: clip.name,
        channels: [],
        samplers: [],
      },
    ],
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: buildExpressionExtension(),
    },
  }

  const binaryChunks = { parts: [], byteLength: 0 }
  const animation = json.animations[0]

  EXPRESSION_NODE_NAMES.forEach((name, index) => {
    const channel = clip.channels[name]
    if (!channel) return

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
        node: index + EXPRESSION_NODE_OFFSET,
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
  fs.mkdirSync(outputDir, { recursive: true })

  CLIPS.forEach((clip) => {
    const glb = buildGlb(buildJson(clip))
    const outputPath = path.join(outputDir, clip.filename)
    fs.writeFileSync(outputPath, glb)
    console.log(`Wrote ${path.relative(process.cwd(), outputPath)} (${glb.length} bytes)`)
  })
}

main()
