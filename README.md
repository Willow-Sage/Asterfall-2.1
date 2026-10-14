# Asterfall 2.1 — The Living Realms

**Chapter I: Terravelle / Serenova Barony**, Kingdom of Solterra, continent of Evrosia.

A standalone browser-playable, single-player fantasy survival/life-simulation RPG prototype, designed as the beginning of a larger game inspired by the user's Tervac world wiki.

## Play each version

- **[Asterfall 2.2 — Solterra Visual Alpha](https://willow-sage.github.io/Asterfall-2.1/v2.2/)** — dedicated version with revised third-person character silhouettes, terrain colors, and visibly labeled 2.2 title screen.
- **[Asterfall 2.1 — Original 3D Alpha](https://willow-sage.github.io/Asterfall-2.1/)** — preserved at the original address.

Both are hosted from the same GitHub Pages repository, but use separate paths. Browser-based local saves remain compatible. The 2.2 art is a procedural *visual alpha*, not the finished anime-light-novel models shown in the approved concept boards.

## Play

Open `index.html` in a modern browser or deploy with GitHub Pages. Progress is stored in the current browser; clearing site data may erase saves.

## Features

- Explore Serenova and the nearby Solterran landscape.
- Meet residents and complete introductory quests.
- Gather resources, fish, craft equipment, trade, and place structures.
- Develop professions including optional earth magic.
- Navigate Evrosia, the Magical Empire (25 kingdoms plus Mythralis), Solterra, Terravelle, and the local region through the atlas.
- Save and exit to the title screen.

## Status and scope

This is a **third-person WebGL2 3D alpha** (with an isometric 2D fallback), using procedural stylized models; it has not yet reached anime-realistic graphical fidelity. It is not yet multiplayer, a player-run economy, or a complete rendition of Solterra. Locations outside the playable slice are atlas/lore placeholders and should not be represented as fully implemented.

## Deployment

The GitHub Pages workflow in `.github/workflows/deploy.yml` publishes the root directory. In repository Settings → Pages, select **GitHub Actions** as Build and deployment source. GitHub Pages availability for private repositories depends on account plan and repository settings. Do not claim the public game URL is accessible until deployment succeeds.

## Origin

Built as a new project independently of Replit; original 1.0 project remains unchanged.
\n## Third-person 3D alpha (new)\n\nThe playable game now includes a dependency-free WebGL2 3D landscape, a third-person follow camera with mouse/touch orbit and scroll zoom, and camera-relative WASD movement. Houses, paths, trees, resources, and residents are represented as true 3D geometry; inventory, skills, quests, fishing, crafting, NPC dialogue, and local saves continue using the original Asterfall 2.1 systems.\n\n**New camera controls:** Drag the game world to orbit; scroll to zoom; WASD/arrow keys to walk relative to the camera; Shift to sprint; E/F to interact; R to reset camera; M for maps; I for inventory; C for crafting; P for professions; Esc for the journey menu. Clicking the ground also sets a travel destination.\n\n**Rendering support:** A WebGL2-capable browser/device is required for the 3D presentation. If WebGL2 is unavailable, the previous 2D isometric view remains accessible. The original save format is retained.\n\n**Current art status:** This is the functional third-person **3D alpha**, with procedural stylized low-poly models—not yet fully anime-realistic high-fidelity character and environmental art. Further passes will improve character rigs/animation, scenery, shadows, terrain blending, camera collision, and traversal polish. Multiplayer remains a future system.\n
## Asterfall 2.2 visual pass (October 2026)

The live playable game now includes an early Solterra visual redesign of the WebGL2 third-person scene: layered anime-inspired player and NPC silhouettes, a warmer Terravelle landscape palette, lighter plaster and terracotta building colors, and stepped character/world lighting. The original quests, gathering, crafting, professions, atlas, and saves are preserved. This is an early **visual alpha**, not the finished approved anime/light-novel artwork: the avatar and environment remain procedural geometry rather than professionally modeled, textured, rigged art assets. The next production milestone is integrating authored GLB/GLTF avatar and environment assets using the approved style board as reference, while keeping the same gameplay state.
