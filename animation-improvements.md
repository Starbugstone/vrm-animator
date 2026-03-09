# Animation Improvements

## Current State

The runtime now uses an eased manual blend instead of Three.js's default linear crossfade.

- Outgoing clip weight: `1 - smoothstep(t)`
- Incoming clip weight: `smoothstep(t)`
- This reduces the "slidy" feel, but it is still a full-body pose blend.

## Next Steps

### 1. Transition Windows

Only allow transitions at better moments in the source clip.

- Idle variations should preferably start when the body is close to neutral.
- One-shot actions should return to `idle_main` during a calm recovery phase rather than any arbitrary frame.
- Add per-clip metadata:
  - `exitWindowStart`
  - `exitWindowEnd`
  - `preferredEntryPhase`

Expected result:

- Fewer awkward arm and shoulder blends
- Less visible body drift during stance changes

### 2. Phase Matching

Do not always start the next idle clip at time `0`.

- Sample candidate times in the target clip.
- Compare pose distance against the current outgoing pose.
- Start the target clip at the closest matching phase.

Good comparison points:

- hips rotation and position
- spine/chest/head rotation
- upper arm and lower arm rotation
- upper leg and lower leg rotation

Expected result:

- Idle-to-idle transitions feel intentional instead of arbitrary
- Large stance changes become much less noticeable

### 3. Per-Bone / Layered Blending

Blend different body regions with different timing and weights.

Examples:

- Keep hips and legs stable longer
- Blend spine and shoulders earlier
- Delay hands slightly so arms do not ghost through space

Implementation options:

- Separate tracks into body regions
- Use masked actions if the animation system supports it
- Or manually drive subsets of bones during transition

Expected result:

- Less full-body mush during blends
- Better preservation of grounded lower-body motion

### 4. Foot Locking / Contact Preservation

Detect when a foot should remain planted and preserve that constraint during the blend.

- Track left/right foot world position
- Detect contact windows from clip metadata or heuristics
- During transition, correct hips/leg transforms so planted feet stay anchored

Expected result:

- Major reduction in visible foot sliding
- More believable weight transfer during stance changes

### 5. Inertialization

Preserve outgoing motion velocity rather than blending only between two static poses.

- Estimate per-bone motion delta at transition start
- Decay that delta over a short time while moving into the target animation
- Commonly used in game animation systems because it avoids "pose soup"

Expected result:

- Most natural runtime transitions without authoring many bridge clips
- Better responsiveness when transitions happen mid-motion

Tradeoff:

- Highest runtime complexity of the procedural options

### 6. Authored Bridge Clips

Use short transition clips for difficult pairs.

Best for:

- crouch to upright
- kneel to standing
- strong asymmetrical arm pose to neutral
- turns with large root orientation changes

Suggested metadata:

- `fromClip`
- `toClip`
- `bridgeClip`
- `blendInMs`
- `blendOutMs`

Expected result:

- Highest reliability for edge cases
- Best fallback when procedural blending still looks wrong

## Recommended Order

1. Keep the eased blend that is now implemented.
2. Add transition windows.
3. Add phase matching for idle-to-idle.
4. Add foot locking if lower-body sliding remains obvious.
5. Add authored bridge clips for stubborn bad pairs.
6. Explore inertialization if you want the most game-like result.
