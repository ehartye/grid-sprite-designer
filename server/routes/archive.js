import { Router } from 'express';
import { mkdirSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

export function createArchiveRouter(outputDir) {
  const router = Router();

  router.post('/', (req, res, next) => {
    try {
      const { contentName, filledGridImage, filledGridMimeType, sprites } = req.body;

      if (!contentName || !filledGridImage) {
        return res.status(400).json({ error: 'contentName and filledGridImage are required' });
      }

      // Build folder name: content-name_YYYYMMDD-HHmmss
      const slug = contentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/(\d{8})(\d{6})/, '$1-$2');
      const folderName = `${slug}_${ts}`;
      const folderPath = join(outputDir, folderName);

      mkdirSync(folderPath, { recursive: true });

      // Save filled grid
      const gridExt = (filledGridMimeType || 'image/png').includes('jpeg') ? 'jpg' : 'png';
      writeFileSync(join(folderPath, `grid.${gridExt}`), Buffer.from(filledGridImage, 'base64'));

      // Save individual sprites
      let spriteCount = 0;
      if (sprites && Array.isArray(sprites)) {
        const spritesDir = join(folderPath, 'sprites');
        mkdirSync(spritesDir, { recursive: true });

        for (const s of sprites) {
          const ext = (s.mimeType || 'image/png').includes('jpeg') ? 'jpg' : 'png';
          const idx = String(s.cellIndex).padStart(2, '0');
          const poseSlug = (s.poseName || s.poseId || `cell-${idx}`)
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const filename = `${idx}-${poseSlug}.${ext}`;
          writeFileSync(join(spritesDir, filename), Buffer.from(s.imageData, 'base64'));
          spriteCount++;
        }
      }

      console.log(`[Archive] Saved to ${folderName}: grid + ${spriteCount} sprites`);
      res.status(201).json({ folder: folderName, spriteCount });
    } catch (err) { next(err); }
  });

  router.get('/', (req, res, next) => {
    try {
      if (!existsSync(outputDir)) {
        return res.json([]);
      }
      const entries = readdirSync(outputDir)
        .filter(name => {
          const full = join(outputDir, name);
          return statSync(full).isDirectory();
        })
        .map(name => {
          const full = join(outputDir, name);
          const hasGrid = existsSync(join(full, 'grid.png')) || existsSync(join(full, 'grid.jpg'));
          const spritesDir = join(full, 'sprites');
          const spriteCount = existsSync(spritesDir) ? readdirSync(spritesDir).length : 0;
          return {
            folder: name,
            hasGrid,
            spriteCount,
            createdAt: statSync(full).birthtime.toISOString(),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      res.json(entries);
    } catch (err) { next(err); }
  });

  return router;
}
