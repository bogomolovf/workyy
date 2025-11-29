# Oracle Character Model Setup

## Current Status: Using Professional 3D Character Model

The tarot experience is now set up to load a **realistic 3D character model** from a GLB file, rather than procedural code. This will give you a beautiful, professional-looking oracle character.

## How to Get a Realistic Character Model

### Option 1: Mixamo (Free - Recommended) ⭐

**Best for:** Free, high-quality character models with animations

1. Go to [Mixamo.com](https://www.mixamo.com) (Adobe's free 3D character service)
2. Sign up for a free Adobe account
3. Browse characters:
   - Search for "woman" or "female"
   - Choose a character that matches the oracle aesthetic (e.g., "Samantha", "Aria")
4. Customize:
   - Adjust skin tone to match spec (medium neutral-gold)
   - Choose clothing that fits the ceremonial gown concept
5. Download:
   - Format: **FBX with skin**
   - Include: **T-Pose** (for rigging)
6. Get animations:
   - Download "Idle" animation
   - You can also get breathing/idle variations
7. Convert to GLB:
   - Use [glTF-Pipeline](https://github.com/CesiumGS/gltf-pipeline) or
   - Use [Blender](https://www.blender.org) (free):
     - Import FBX
     - Export as GLB
     - Name animations: `Idle`, `Smoke_A`, `Smoke_B`, `Smoke_C`, `Smoke_D`, `Smile`, `Sad`, `SlySmirk`

### Option 2: Ready Player Me (Free)

**Best for:** Customizable avatars, web-ready

1. Go to [ReadyPlayer.Me](https://readyplayer.me)
2. Create a custom avatar (free)
3. Customize to match oracle spec:
   - Medium skin tone
   - Dark hair
   - Ceremonial/formal clothing
4. Export as GLB
5. Place in `public/models/oracle.glb`

### Option 3: Daz3D / Character Creator (Paid)

**Best for:** Most realistic, professional quality

1. Use Daz3D or Reallusion Character Creator
2. Create character matching oracle spec
3. Export as GLB/FBX
4. Add animations in Blender or Maya
5. Export final GLB

### Option 4: Free Asset Stores

**Best for:** Quick setup with pre-made characters

- [Sketchfab](https://sketchfab.com) - Search "woman character glb"
- [Poly Haven](https://polyhaven.com/models)
- [TurboSquid Free](https://www.turbosquid.com/Search/3D-Models/free/woman)

## Required Animation Clips

Your GLB model should include these named animation clips:

- `Idle` - 8-second breathing/idle loop
- `Smoke_A` - Initial veiled state (100% smoke)
- `Smoke_B` - After Past card (70% smoke)
- `Smoke_C` - After Present card (40% smoke)
- `Smoke_D` - After Future card (15% smoke + halo)
- `Smile` - Positive expression
- `Sad` - Negative expression
- `SlySmirk` - Neutral/mysterious expression

**Note:** If your model doesn't have all animations, the code will gracefully handle missing clips. The `Idle` animation is the most important.

## File Placement

1. Export your character model as `oracle.glb`
2. Place it in: `public/models/oracle.glb`
3. The React component will automatically load it

## Adding Smoke Effects

If your model doesn't include smoke, you can:
1. Add smoke planes in Blender
2. Use the smoke material names: `smoke`, `Smoke`, or `smokeFX`
3. The code will automatically adjust opacity based on smoke state

## Quick Start (Mixamo)

1. **Get Character:**
   ```
   - Go to mixamo.com
   - Download "Samantha" or similar character (FBX)
   - Download "Idle" animation
   ```

2. **Convert in Blender:**
   ```
   - Import FBX character
   - Import FBX animation
   - Export as GLB
   - Save to public/models/oracle.glb
   ```

3. **Test:**
   ```
   npm run dev
   - Navigate to /en/tarot
   - Character should appear!
   ```

## Troubleshooting

- **Model not showing?** Check browser console for errors
- **Animations not working?** Verify animation clip names match exactly
- **Model too small/large?** Adjust `scale` in `OracleCanvas.tsx`
- **Wrong position?** Adjust `position` in the `<primitive>` component

## Next Steps

Once you have a realistic character model, the tarot experience will look professional and polished! The procedural code was just a placeholder - the real magic happens with a proper 3D model.
