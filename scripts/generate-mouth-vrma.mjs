import fs from 'node:fs'
import path from 'node:path'

const outputDir = path.resolve('expressions_vrma')

const HIPS_NODE_INDEX = 0
const EXPRESSION_NODE_OFFSET = 1
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
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
]

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
      lookDown: {
        times: [0, 0.6, 1.2, 2.1, 2.6],
        weights: [0, 0.08, 0.2, 0.08, 0],
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
      lookLeft: {
        times: [0, 0.45, 0.9, 1.35, 1.8, 2.3],
        weights: [0.05, 0.16, 0.04, 0.18, 0.06, 0],
      },
      lookRight: {
        times: [0, 0.22, 0.68, 1.08, 1.56, 2.0, 2.3],
        weights: [0.04, 0.12, 0.03, 0.14, 0.05, 0.1, 0],
      },
    },
  },
  {
    filename: 'Speech Calm A.vrma',
    name: 'speech-calm-a',
    channels: {
      aa: {
        times: [0, 0.18, 0.4, 0.64, 0.92, 1.18, 1.46, 1.74, 2.02, 2.28],
        weights: [0.04, 0.38, 0.1, 0.42, 0.08, 0.36, 0.12, 0.34, 0.08, 0],
      },
      oh: {
        times: [0, 0.24, 0.52, 0.82, 1.14, 1.42, 1.78, 2.06, 2.28],
        weights: [0.03, 0.2, 0.08, 0.24, 0.06, 0.22, 0.08, 0.16, 0],
      },
      ih: {
        times: [0, 0.32, 0.58, 0.9, 1.26, 1.62, 1.94, 2.28],
        weights: [0.02, 0.18, 0.42, 0.16, 0.36, 0.14, 0.26, 0],
      },
      blink: {
        times: [0, 1.08, 1.18, 1.3, 2.28],
        weights: [0, 0, 0.78, 0, 0],
      },
      lookLeft: {
        times: [0, 0.55, 1.12, 1.8, 2.28],
        weights: [0.03, 0.09, 0.04, 0.08, 0],
      },
      lookRight: {
        times: [0, 0.28, 0.86, 1.44, 2.04, 2.28],
        weights: [0.02, 0.08, 0.03, 0.09, 0.04, 0],
      },
    },
  },
  {
    filename: 'Speech Bright B.vrma',
    name: 'speech-bright-b',
    channels: {
      aa: {
        times: [0, 0.12, 0.28, 0.46, 0.68, 0.9, 1.12, 1.36, 1.58, 1.82, 2.08, 2.34],
        weights: [0.08, 0.64, 0.14, 0.58, 0.16, 0.72, 0.12, 0.6, 0.14, 0.52, 0.1, 0],
      },
      ee: {
        times: [0, 0.18, 0.42, 0.72, 1.0, 1.28, 1.56, 1.86, 2.14, 2.34],
        weights: [0.04, 0.32, 0.12, 0.4, 0.08, 0.36, 0.12, 0.34, 0.08, 0],
      },
      ou: {
        times: [0, 0.26, 0.58, 0.94, 1.22, 1.52, 1.92, 2.2, 2.34],
        weights: [0.02, 0.18, 0.44, 0.14, 0.36, 0.12, 0.28, 0.1, 0],
      },
      blink: {
        times: [0, 0.94, 1.04, 1.14, 2.34],
        weights: [0, 0, 0.68, 0, 0],
      },
      lookUp: {
        times: [0, 0.5, 1.02, 1.58, 2.02, 2.34],
        weights: [0.05, 0.14, 0.08, 0.16, 0.08, 0],
      },
      happy: {
        times: [0, 0.7, 1.34, 2.0, 2.34],
        weights: [0.08, 0.16, 0.12, 0.14, 0],
      },
    },
  },
  {
    filename: 'Speech Soft C.vrma',
    name: 'speech-soft-c',
    channels: {
      aa: {
        times: [0, 0.22, 0.48, 0.8, 1.12, 1.46, 1.8, 2.12, 2.42],
        weights: [0.02, 0.24, 0.08, 0.3, 0.06, 0.26, 0.08, 0.2, 0],
      },
      oh: {
        times: [0, 0.26, 0.62, 0.98, 1.3, 1.66, 2.02, 2.42],
        weights: [0.03, 0.16, 0.3, 0.14, 0.28, 0.12, 0.18, 0],
      },
      ih: {
        times: [0, 0.34, 0.74, 1.1, 1.52, 1.9, 2.42],
        weights: [0.02, 0.1, 0.24, 0.08, 0.2, 0.06, 0],
      },
      blink: {
        times: [0, 0.82, 0.94, 1.08, 1.78, 1.92, 2.08, 2.42],
        weights: [0, 0, 0.82, 0, 0, 0.72, 0, 0],
      },
      lookDown: {
        times: [0, 0.64, 1.3, 1.94, 2.42],
        weights: [0.06, 0.16, 0.12, 0.16, 0],
      },
      relaxed: {
        times: [0, 0.9, 1.64, 2.42],
        weights: [0.08, 0.18, 0.14, 0],
      },
    },
  },
  {
    filename: 'Happy Talk.vrma',
    name: 'happy-talk',
    channels: {
      aa: {
        times: [0, 0.14, 0.32, 0.52, 0.76, 1.0, 1.24, 1.5, 1.78, 2.04, 2.32],
        weights: [0.1, 0.66, 0.18, 0.62, 0.16, 0.7, 0.14, 0.58, 0.12, 0.5, 0],
      },
      ee: {
        times: [0, 0.2, 0.46, 0.72, 0.98, 1.26, 1.56, 1.84, 2.12, 2.32],
        weights: [0.08, 0.42, 0.12, 0.48, 0.1, 0.4, 0.12, 0.36, 0.08, 0],
      },
      ih: {
        times: [0, 0.3, 0.58, 0.9, 1.2, 1.48, 1.78, 2.08, 2.32],
        weights: [0.04, 0.18, 0.46, 0.14, 0.38, 0.12, 0.32, 0.08, 0],
      },
      happy: {
        times: [0, 0.48, 1.06, 1.68, 2.32],
        weights: [0.42, 0.62, 0.56, 0.6, 0.34],
      },
      lookUp: {
        times: [0, 0.56, 1.18, 1.76, 2.32],
        weights: [0.08, 0.16, 0.12, 0.18, 0],
      },
      lookLeft: {
        times: [0, 0.72, 1.42, 2.02, 2.32],
        weights: [0.04, 0.12, 0.05, 0.1, 0],
      },
      blink: {
        times: [0, 0.98, 1.08, 1.18, 2.32],
        weights: [0, 0, 0.72, 0, 0],
      },
    },
  },
  {
    filename: 'Sad Talk.vrma',
    name: 'sad-talk',
    channels: {
      aa: {
        times: [0, 0.22, 0.54, 0.88, 1.24, 1.62, 2.0, 2.34],
        weights: [0.02, 0.24, 0.08, 0.28, 0.06, 0.24, 0.08, 0],
      },
      oh: {
        times: [0, 0.26, 0.62, 0.98, 1.34, 1.72, 2.1, 2.34],
        weights: [0.04, 0.2, 0.36, 0.18, 0.32, 0.16, 0.22, 0],
      },
      ou: {
        times: [0, 0.34, 0.78, 1.18, 1.56, 1.96, 2.34],
        weights: [0.02, 0.14, 0.28, 0.12, 0.24, 0.08, 0],
      },
      sad: {
        times: [0, 0.6, 1.24, 1.88, 2.34],
        weights: [0.34, 0.54, 0.48, 0.52, 0.28],
      },
      lookDown: {
        times: [0, 0.52, 1.1, 1.7, 2.18, 2.34],
        weights: [0.18, 0.28, 0.22, 0.3, 0.2, 0],
      },
      blink: {
        times: [0, 0.84, 1.0, 1.18, 1.76, 1.92, 2.08, 2.34],
        weights: [0, 0, 0.9, 0, 0, 0.84, 0, 0],
      },
    },
  },
  {
    filename: 'Angry Talk.vrma',
    name: 'angry-talk',
    channels: {
      aa: {
        times: [0, 0.1, 0.24, 0.4, 0.58, 0.8, 1.04, 1.28, 1.54, 1.8, 2.06, 2.28],
        weights: [0.12, 0.78, 0.2, 0.72, 0.18, 0.82, 0.16, 0.68, 0.18, 0.62, 0.12, 0],
      },
      oh: {
        times: [0, 0.18, 0.44, 0.7, 0.96, 1.2, 1.48, 1.76, 2.04, 2.28],
        weights: [0.04, 0.22, 0.08, 0.24, 0.08, 0.22, 0.1, 0.24, 0.08, 0],
      },
      angry: {
        times: [0, 0.46, 0.98, 1.48, 2.0, 2.28],
        weights: [0.44, 0.68, 0.58, 0.7, 0.6, 0.36],
      },
      lookDown: {
        times: [0, 0.62, 1.22, 1.86, 2.28],
        weights: [0.08, 0.16, 0.12, 0.18, 0],
      },
      lookRight: {
        times: [0, 0.3, 0.76, 1.22, 1.68, 2.1, 2.28],
        weights: [0.08, 0.22, 0.06, 0.18, 0.06, 0.16, 0],
      },
      blink: {
        times: [0, 1.22, 1.32, 1.42, 2.28],
        weights: [0, 0, 0.52, 0, 0],
      },
    },
  },
  {
    filename: 'Playful Talk.vrma',
    name: 'playful-talk',
    channels: {
      aa: {
        times: [0, 0.14, 0.36, 0.58, 0.8, 1.04, 1.28, 1.52, 1.78, 2.04, 2.28],
        weights: [0.08, 0.5, 0.12, 0.46, 0.1, 0.54, 0.14, 0.42, 0.12, 0.36, 0],
      },
      ee: {
        times: [0, 0.18, 0.48, 0.74, 1.02, 1.3, 1.58, 1.9, 2.28],
        weights: [0.06, 0.28, 0.1, 0.34, 0.08, 0.3, 0.1, 0.24, 0],
      },
      oh: {
        times: [0, 0.24, 0.64, 1.06, 1.44, 1.86, 2.28],
        weights: [0.03, 0.18, 0.28, 0.14, 0.24, 0.12, 0],
      },
      happy: {
        times: [0, 0.48, 1.08, 1.68, 2.28],
        weights: [0.16, 0.28, 0.22, 0.3, 0.1],
      },
      relaxed: {
        times: [0, 0.54, 1.14, 1.8, 2.28],
        weights: [0.22, 0.4, 0.32, 0.38, 0.14],
      },
      lookLeft: {
        times: [0, 0.26, 0.74, 1.26, 1.78, 2.28],
        weights: [0.06, 0.24, 0.08, 0.26, 0.08, 0],
      },
      lookRight: {
        times: [0, 0.48, 0.98, 1.48, 2.02, 2.28],
        weights: [0.04, 0.18, 0.06, 0.2, 0.08, 0],
      },
      blink: {
        times: [0, 0.9, 1.0, 1.12, 1.86, 1.96, 2.08, 2.28],
        weights: [0, 0, 0.82, 0, 0, 0.74, 0, 0],
      },
    },
  },
  {
    filename: 'Shouting Talk.vrma',
    name: 'shouting-talk',
    channels: {
      aa: {
        times: [0, 0.08, 0.2, 0.34, 0.48, 0.62, 0.8, 1.0, 1.24, 1.5, 1.8, 2.12, 2.36],
        weights: [0.24, 1.0, 0.32, 0.94, 0.28, 0.96, 0.26, 0.9, 0.24, 0.86, 0.22, 0.74, 0],
      },
      oh: {
        times: [0, 0.16, 0.42, 0.7, 1.0, 1.32, 1.68, 2.02, 2.36],
        weights: [0.12, 0.36, 0.18, 0.42, 0.14, 0.38, 0.18, 0.3, 0],
      },
      surprised: {
        times: [0, 0.44, 0.9, 1.4, 1.9, 2.36],
        weights: [0.26, 0.48, 0.36, 0.52, 0.4, 0.12],
      },
      angry: {
        times: [0, 0.52, 1.06, 1.62, 2.12, 2.36],
        weights: [0.12, 0.24, 0.18, 0.28, 0.2, 0],
      },
      lookUp: {
        times: [0, 0.58, 1.12, 1.7, 2.18, 2.36],
        weights: [0.08, 0.16, 0.12, 0.18, 0.08, 0],
      },
      blink: {
        times: [0, 1.36, 1.46, 1.56, 2.36],
        weights: [0, 0, 0.44, 0, 0],
      },
    },
  },
  {
    filename: 'Sleepy Talk.vrma',
    name: 'sleepy-talk',
    channels: {
      aa: {
        times: [0, 0.26, 0.62, 1.0, 1.42, 1.84, 2.24],
        weights: [0.02, 0.22, 0.08, 0.26, 0.08, 0.18, 0],
      },
      oh: {
        times: [0, 0.32, 0.72, 1.12, 1.56, 2.0, 2.24],
        weights: [0.06, 0.26, 0.12, 0.28, 0.12, 0.18, 0],
      },
      relaxed: {
        times: [0, 0.7, 1.42, 2.24],
        weights: [0.18, 0.34, 0.28, 0.08],
      },
      sad: {
        times: [0, 0.84, 1.68, 2.24],
        weights: [0.08, 0.18, 0.14, 0],
      },
      lookDown: {
        times: [0, 0.58, 1.16, 1.78, 2.24],
        weights: [0.12, 0.26, 0.18, 0.28, 0],
      },
      blink: {
        times: [0, 0.66, 0.84, 1.04, 1.46, 1.64, 1.84, 2.24],
        weights: [0, 0, 0.94, 0, 0, 0.9, 0, 0],
      },
    },
  },
  {
    filename: 'Surprised Reaction.vrma',
    name: 'surprised-reaction',
    channels: {
      surprised: {
        times: [0, 0.16, 0.34, 0.6, 0.92, 1.18, 1.42],
        weights: [0, 0.8, 0.92, 0.62, 0.3, 0.12, 0],
      },
      aa: {
        times: [0, 0.14, 0.3, 0.56, 0.88, 1.16, 1.42],
        weights: [0, 0.46, 0.62, 0.38, 0.18, 0.08, 0],
      },
      lookUp: {
        times: [0, 0.22, 0.46, 0.78, 1.1, 1.42],
        weights: [0.04, 0.18, 0.24, 0.16, 0.08, 0],
      },
      blink: {
        times: [0, 0.86, 0.98, 1.1, 1.42],
        weights: [0, 0, 0.36, 0, 0],
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
      generator: 'vrm-animator expression vrma generator',
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
