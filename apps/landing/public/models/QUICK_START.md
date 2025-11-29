# Quick Start: Get a Realistic Oracle Character (5 minutes)

## Fastest Method: Mixamo (Free)

### Step 1: Get Character (2 min)
1. Go to **https://www.mixamo.com**
2. Click **"Characters"** → Search **"Samantha"** or **"Aria"**
3. Click character → **Download** → Choose **FBX with skin**
4. Save as `oracle_character.fbx`

### Step 2: Get Animation (1 min)
1. Still on Mixamo, click **"Animations"**
2. Search **"Idle"** → Choose **"Idle"** or **"Breathing Idle"**
3. Click **Download** → Choose **FBX**
4. Save as `oracle_idle.fbx`

### Step 3: Convert to GLB (2 min)

**Option A: Online Converter (Easiest)**
1. Go to **https://products.aspose.app/3d/conversion/fbx-to-gltf**
2. Upload `oracle_character.fbx`
3. Convert to GLB
4. Download and rename to `oracle.glb`
5. Place in `public/models/oracle.glb`

**Option B: Blender (More Control)**
1. Download Blender (free): https://www.blender.org
2. Open Blender → Delete default cube
3. **File → Import → FBX** → Select `oracle_character.fbx`
4. **File → Import → FBX** → Select `oracle_idle.fbx` (this adds animation)
5. **File → Export → glTF 2.0**
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects**, **Animations**
6. Save as `oracle.glb` in `public/models/`

### Step 4: Test
```bash
pnpm run dev
```
Navigate to `http://localhost:5173/en/tarot`

**Done!** You now have a realistic 3D character! 🎉

## Alternative: Use Ready Player Me (Even Faster)

1. Go to **https://readyplayer.me**
2. Create avatar (takes 2 minutes)
3. Customize to match oracle (dark hair, medium skin, formal clothes)
4. **Download** → Choose **GLB**
5. Save to `public/models/oracle.glb`
6. Done!

## Need Help?

- **Model too big?** Use [glTF-Pipeline](https://github.com/CesiumGS/gltf-pipeline) to compress
- **Animations missing?** The code will still work - just won't animate
- **Wrong size/position?** Edit `OracleCanvas.tsx` → adjust `scale` and `position` in `<primitive>`

