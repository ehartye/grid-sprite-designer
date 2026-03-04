# Grid Sprite Designer

An AI-powered sprite sheet generator for game development. Describe a character, building, terrain tileset, or parallax background, and Grid Sprite Designer uses Google Gemini to generate a complete set of pixel-art sprites organized in a structured grid — ready for extraction and export.

![Gallery view showing generated characters, buildings, terrain, and backgrounds](screenshots/04-gallery.png)

## Features

### Character Sprite Sheets (6x6 Grid)

Generate 36 sprites for a single character covering a full RPG animation set:

- **Movement**: Walk cycles in 4 directions (3 frames each)
- **Idle**: Standing poses in 4 directions + battle idle loop
- **Combat**: Attack, cast, and damage sequences (3 frames each)
- **Status**: KO sequence, victory celebration, weak/critical poses

Choose from 25 built-in character presets or describe your own from scratch. Each preset includes detailed per-cell pose guidance for consistent results.

![Character configuration panel with preset selected](screenshots/02-character-config.png)

### Building Sprite Sheets (3x3, 2x3, or 2x2 Grids)

Generate building variants across times of day, weather, damage states, or seasonal changes. Configurable grid layouts with custom cell labels for each variant.

![Building configuration panel](screenshots/03-building-config.png)

### Terrain Tilesets (3x3, 4x4, or 5x5 Grids)

Generate tileable terrain tiles with transition edges and corner pieces. Perfect for overworld maps, dungeon floors, and environmental surfaces. Presets include grassland, desert, snow, volcanic, dungeon stone, and forest floor tilesets.

![Terrain configuration with Grassland Plains preset and 4x4 tile label grid](screenshots/08-terrain-config.png)

### Parallax Backgrounds & Scene Variations

Generate layered parallax backgrounds (1x3, 1x4, 1x5) or scene variation grids (2x2, 3x2, 3x3). Parallax mode produces horizontal strips that stack for depth, while scene mode creates full compositions with lighting/weather/time-of-day variants.

![Background configuration with Enchanted Forest parallax preset](screenshots/09-background-config.png)

### Sprite Review & Editing

After generation, sprites are automatically extracted from the AI-generated grid and displayed individually. The editor sidebar provides:

- **Animation preview** with adjustable speed, scale, and arrow-key movement controls
- **Chroma key** background removal with adjustable tolerance
- **Color striker** — click any color to mark it transparent across all sprites
- **Posterization** — reduce color palette (1-8 bit depth) for a retro look
- **Edge inset** trimming for cleaner sprite boundaries
- **Cell swapping** — drag-and-drop reorder sprites in the grid
- **Re-extraction** if grid detection needs adjustment

![Character sprite review with 6x6 grid and editor sidebar](screenshots/05-character-review.png)

![Building sprite review — Medieval Inn across day, evening, and night](screenshots/01-building-review.png)

![Terrain sprite review — Dungeon Stone 3x3 tileset](screenshots/07-terrain-review.png)

### Zoom Modal

Inspect individual sprites at pixel level. Click any pixel to add its color to the strike list, or switch to eraser mode for manual pixel-by-pixel cleanup.

![Zoom modal showing pixel-level sprite editing](screenshots/06-zoom-modal.png)

### Gallery

Browse and reload any previous generation. Each entry shows a thumbnail, name, date, and sprite count. Click any entry to re-enter the review editor with all processing settings preserved.

### Export

- **Sprite sheet** — all sprites composited into a single PNG
- **Individual PNGs** — download each sprite as a separate file

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | SQLite (better-sqlite3) |
| AI | Google Gemini 2.5 Flash |
| Image Processing | Canvas API (client-side) |
| Testing | Playwright |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Installation

```bash
git clone https://github.com/ehartye/grid-sprite-designer.git
cd grid-sprite-designer
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```
GEMINI_API_KEY=your_api_key_here
```

### Running

```bash
npm run dev
```

This starts both the Vite dev server (client) and the Express API server concurrently. Open [http://localhost:5174](http://localhost:5174) in your browser.

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

## How It Works

1. **Configure** — Select a sprite type (character, building, terrain, or background), pick a preset or describe your own, set grid size, and customize per-cell labels
2. **Generate** — The app builds a template grid (magenta cells with labeled black headers), sends it to Gemini along with a detailed prompt, and receives a filled sprite sheet
3. **Extract** — Client-side grid detection finds row/column dividers, strips headers, and crops each sprite automatically
4. **Edit** — Apply chroma key, strike unwanted colors, posterize, zoom in for pixel cleanup
5. **Export** — Download as a composite sprite sheet or individual PNGs

## Project Structure

```
src/
  components/
    config/          # ConfigPanel, BuildingConfigPanel, TerrainConfigPanel,
                     #   BackgroundConfigPanel
    grid/            # SpriteGrid, SpriteReview, SpriteZoomModal
    preview/         # AnimationPreview with arrow-key controls
    gallery/         # GalleryPage
    layout/          # AppHeader with tab navigation
    shared/          # GeneratingOverlay, StatusBanner
  context/           # AppContext (global state via reducer)
  hooks/             # useGridWorkflow, useBuildingWorkflow, useTerrainWorkflow,
                     #   useBackgroundWorkflow, useEditorSettings
  lib/               # Prompt builders, template generator, sprite extraction,
                     #   chroma key, posterization, grid configs, pose definitions
  api/               # Gemini API client
server/
  index.js           # Express routes (generate, history, sprites, presets)
  db.js              # SQLite schema, preset tables, seed data
tests/               # Playwright E2E tests
```

## License

MIT
