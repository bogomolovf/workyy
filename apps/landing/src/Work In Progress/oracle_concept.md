## 1. Reference & Palette Guide

- **Moodboard pillars**: combine Renaissance oracle portraiture, Southeast Asian ceremonial jewelry, and Art-Deco filigree references to maintain cross-cultural ambiguity while feeling premium.
- **Smoke & FX inspiration**: capture wispy volumetric shots from incense photography, aurora borealis gradients for teal glow, and macro shots of opal gemstones for iridescent cues.
- **Primary palette**: deep midnight blue (#041833), peacock teal (#127079), and obsidian black (#080808).
- **Secondary palette**: rich gold (#C78B2A) for filigree, sapphire accents (#1D5CFF), and warm skin highlights (#E8AE7C).
- **FX palette**: emissive teal (#2DF2FF) for sigils, desaturated violet (#564A6A) for shadowed chiffon.
- **Lighting styleframes**: paint-over keyframe showing warm 4200K spotlight, teal rim, and blue ambient fill to align lookdev across DCC and engine.

## 2. Oracle Character Profile

- **Ethnicity & age**: Ambiguous/mixed heritage young adult woman with universally appealing undertones; medium neutral-gold skin that picks up teal rim light gracefully.
- **Face & expression base**: Large luminous eyes with irised teal flecks, softly angular jaw, defined cheekbones, slightly arched brows; resting expression calm, enigmatic, lips gently closed.
- **Hair**: Long, dark espresso hair pulled into braided crown loops that feed into the headpiece, with a few loose tendrils near the temples for softness.
- **Pose & framing**: Medium shot (head to mid-chest) with shoulders relaxed; hands implied below frame so jewelry and neckline dominate; designed to sit centered in a tarot UI hero banner.
- **Dress silhouette**: High-fantasy ceremonial gown with layered chiffon over structured brocade bodice; deep-v neckline partially veiled by translucent teal mantle; sleeves fitted until mid-forearm, then flare.
- **Materials & detailing**: Bodice uses sapphire-inlaid gold filigree; underskirt velvet teal gradient; outer sheer layer embroidered with faint sigils using emissive teal thread.
- **Jewelry hierarchy**: Tiered gold-and-sapphire necklaces (choker + cascading pendant), matching earrings with teardrop gems, and an ornate circlet/headpiece combining fan-like etched plates and gemstone centerpiece; slim gold bangles implied at wrists.
- **Color palette**: Dominant deep blues/teal, secondary rich gold, accent warm amber skin highlights; subtle iridescence on gemstones to echo tarot mysticism.

## 3. Scene, Lighting, and Smoke States

- **Environment suggestion**: Dim temple/ancient wooden interior implied via blurred carved pillars and hanging lantern bokeh; background baked into card art plate for lightweight WebGL load.
- **Lighting setup**: Key—soft warm spotlight (approx 4200K) angled 30° to highlight face/jewelry; Rim—cool teal backlight from camera-left to silhouette smoke; Fill—low-intensity blue ambient to keep shadows readable.
- **Smoke FX base**: Layered particle planes using scrolling alpha textures + shader-based fresnel glow; color shifts from deep teal at edges to translucent gray near center, matching lighting cues.
- **State A – Veiled by smoke (initial)**: Density 100%, opacity 0.75; only specular glints on headpiece/pendant visible; idle loop rotates smoke clockwise 3°/sec, gentle pulsing emissive halo.
- **State B – After first card (Past)**: Density 70%, opacity 0.55; silhouette and top necklace emerge; additive sparkles sync with card draw SFX.
- **State C – After second card (Present)**: Density 40%, opacity 0.35; face and upper torso readable, smoke constrained to shoulders + frame; faint volumetric wisps continue slow orbit.
- **State D – After third card (Future)**: Density 15%, opacity 0.2; smoke collapses into decorative halo ring just behind her head; subtle animated sigils float in halo to signify full reveal.

## 4. Modeling & Sculpt Workflow

- **High-res sculpt**: Block in body, head, and costume layers in ZBrush; keep medium shot framing by prioritizing clavicle-to-head detail density.
- **Hair treatment**: Sculpt braid loops and loose tendrils as separate subtools for clean bake; reserve shell cards for flyaways if needed.
- **Jewelry detailing**: Sculpt base shapes, then add tiling filigree alphas for goldwork; embed gemstone sockets sized for low-poly inserts.
- **Retopology**: Use Maya QuadDraw/topology tools to hit 65K tris (LOD0) focusing loops around face, necklace, and cloth breaks; duplicate mesh and aggressively decimate ornaments for 40K tri LOD1 while baking normals.
- **LOD management**: Share identical UV layouts between LODs so texture atlases remain consistent; verify silhouette hold on shoulders/headpiece.

## 5. UVs & Texture Authoring

- **UV strategy**: UDIM not required—pack two 2K atlases: 0-1 for skin/hair, 1-2 for outfit/jewelry. Keep texel density ~512px/m for face and 384px/m for garments.
- **Bakes**: Export cage meshes to Marmoset Toolbag or Substance 3D; bake normal, AO, curvature, thickness, and position maps.
- **PBR texturing**: In Substance Painter, layer velvet base with anisotropic sheen for underskirt, satin fresnel for chiffon. Use emissive channel for sigil embroidery masks to keep map count tight.
- **Packed maps**: Metallic (R), Roughness (G), AO (B) combined into single texture; height stored in spare alpha if needed for parallax in-engine.
- **FX sheet**: Author 1K atlas with 4 smoke masks + 2 sigil patterns + sparkle sprite; include grayscale mask + emissive companion.

## 6. Rigging & FX Controls

- **Base rig**: Standard humanoid with facial blendshapes; extra controls for headpiece drape and mantle cloth (simple bone chains for real-time).
- **Idle/turntable loop**: 8-second loop; character holds pose, slight breathing motion, tiny head sway; optional 5° back-and-forth yaw for turntable if needed.
- **Smoke interaction timing**: Each card draw triggers 1-second blend from current smoke density to next; shader parameter curves synced to animation events exposed in FBX/GLB metadata.
- **Expression variants** (as morph targets or additive facial clips):
  - *Smile – Gentle hopeful*: soften eyelids, raise mouth corners, introduce subtle cheek lift.
  - *Sad / concerned*: brow inner corners lift, eyes glisten via increased specular, lips relax downward slightly.
  - *Sly smirk*: asymmetric mouth corner raise, eyebrow quirk, slight eye narrowing for playful read.
- **Delivery**: Export separate 0.5-second blend-in clips (or ARKit-style morph targets) for each expression so UI code can trigger them based on tarot results without reloading mesh.
- **Mantle/headpiece controls**: Add FK chains with limited joints (3-4) and driven-key offsets to mimic cloth sway without simulation.
- **Smoke rig**: Parent multiple alpha-card ribbons to a central controller with custom attributes `smokeDensity`, `smokeOpacity`, `haloEmissive`. Expose attributes via Animation > Game Exporter.

## 7. Animation & FX Clip Breakdown

- **Idle**: 8 s cycle, breathing blendshape tied to chest control scaling 2%, head yaw oscillation ±5° with 4 s period, subtle eye dart every 6 s.
- **Smoke states**: Either separate clips (`Smoke_A`…`Smoke_D`) or a single `SmokeReveal` clip with keyed density (1.0 → 0.15) and halo emissive ramp. Include animation events at timestamps 0s, 1s, 2s, 3s for card sync cues.
- **Sparkle burst**: Add 6-frame particle emitter for Past card event referencing sprite from FX atlas; author in engine or via animated material parameter curve.
- **Expression clips**: 0.5 s blend-in, 0.5 s hold, 0.5 s blend-out for `Smile`, `Sad`, `SlySmirk`. Ensure blendshape names align with clip names for mixer targeting.
- **Preview playblast**: Produce viewport capture showing sequence A→D plus expression swap to validate readability before export.

## 8. Realtime Implementation Guidance

- **Optimization targets**: 60K–75K triangles for character + jewelry; smoke planes kept under 5K tris; aim for <3 draw calls (body, accessories, FX).
- **Textures**: 2× 2K atlases (skin/hair, outfit/jewelry) using BC7/ETC2; 1× 1K FX sheet for smoke masks and emissive sigils; pack metallic/roughness/AO in single texture.
- **Shaders**: PBR metallic-roughness for character, masked/translucent shader with scrolling UVs for smoke; add fresnel term for halo glow; expose smoke density parameter to scripts.
- **LOD & variants**: Provide LOD1 at 40K tris, simplified jewelry normal-baked; expression morphs shared across LODs to avoid popping.
- **State integration**: Tarot UI can tween smoke density + expression weights via Three.js animation mixer; card draw events map to states (Past/Present/Future) and to expression choice logic.
- **Export**: Deliver GLB (for Three.js) and FBX (for DCC edits) with embedded animations, named clips (`Idle`, `SmokeReveal`, `Smile`, `Sad`, `SlySmirk`); include USDZ preview if AR needed later.

## 9. Export & Delivery Checklist

- **Formats**: GLB with embedded textures + animations; FBX with split takes; optional USDZ derived from GLB via Reality Converter for AR preview.
- **Clip naming**: `Idle`, `Smoke_A`, `Smoke_B`, `Smoke_C`, `Smoke_D`, `Smile`, `Sad`, `SlySmirk`.
- **Animation channels**: Ensure `smokeDensity` and `haloEmissive` custom properties are keyed and exported; verify Three.js `AnimationClip` names for JS hook-up.
- **Metadata**: Include JSON note listing texture sets, triangle counts per LOD, and expression morph names for engineering reference.
- **Testing**: Load GLB in glTF Viewer + Three.js sandbox to confirm shading, animation timing, and parameter exposure; profile draw calls to confirm target budgets.

## 10. Three.js Integration Notes

- **Loading**: Use `GLTFLoader` and `DRACOLoader` if compression applied; once loaded, cache `gltf.animations` to an `AnimationMixer`.
- **State machine**: Map tarot card events to clip names; e.g., on Past draw, crossfade `Smoke_A` → `Smoke_B` over 1s using `AnimationMixer.clipAction`.
- **Parameter hooks**: Access custom `smokeDensity` track via `mesh.userData.smokeDensity` or animation track targeting `Node.material.uniforms.smokeDensity`. Provide helper to clamp 0–1.
- **Expression blending**: Trigger additive clips (`Smile`, `Sad`, `SlySmirk`) with weight-based actions so they layer atop Idle without restarting base loop.
- **Performance**: Preload textures, enable `premultipliedAlpha` for smoke planes, and share materials between LODs to keep draw calls within budget.

