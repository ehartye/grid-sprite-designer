import type { RGB } from '../types/color';
import type { ExtractedSprite } from './spriteExtractor';
import { pixelizeSprite } from './spriteExtractor';
import { applyChromaKey, defringeRecolor, snapAlpha, outlineSprite, strikeColors, detectKeyColor } from './chromaKey';
import { posterize } from './imagePreprocess';

export interface PosterizeConfig {
  enabled: boolean;
  bits: number;
}

export interface ChromaConfig {
  enabled: boolean;
  tolerance: number;
  defringeCore: number;
  edgeRecolorPasses: number;
  recolorSensitivity: number;
}

export interface PixelizeConfig {
  enabled: boolean;
  size: number;
}

export interface OutlineConfig {
  enabled: boolean;
  outDepth: number;
  inDepth: number;
  color: RGB;
}

export interface AlphaSnapConfig {
  enabled: boolean;
  threshold: number;
}

export interface ColorStrikeConfig {
  colors: RGB[];
  tolerance: number;
}

export interface ProcessSpriteOptions {
  posterize: PosterizeConfig;
  chroma: ChromaConfig;
  pixelize: PixelizeConfig;
  outline: OutlineConfig;
  alphaSnap: AlphaSnapConfig;
  colorStrike: ColorStrikeConfig;
  erasedPixels?: Set<string>;
  /** Chroma key color auto-detected per batch; pass through if pre-detected */
  chromaKeyColor?: RGB;
}

/** Helper: load a base64 sprite into an Image element. */
function loadSpriteImage(sprite: ExtractedSprite): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load sprite'));
    img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  });
}

/**
 * Apply the full post-processing pipeline to a single sprite.
 * Replaces the 22-parameter function previously defined in SpriteReview.tsx.
 */
export async function processSprite(
  sprite: ExtractedSprite,
  opts: ProcessSpriteOptions,
): Promise<ExtractedSprite> {
  const { posterize: post, chroma, pixelize, outline, alphaSnap, colorStrike } = opts;
  const hasErasure = opts.erasedPixels && opts.erasedPixels.size > 0;

  if (!post.enabled && !chroma.enabled && colorStrike.colors.length === 0 && !hasErasure && !chroma.edgeRecolorPasses && !pixelize.enabled && !outline.enabled && !alphaSnap.enabled) {
    return sprite;
  }

  const img = await loadSpriteImage(sprite);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  let imageData = ctx.getImageData(0, 0, img.width, img.height);
  if (post.enabled) imageData = posterize(imageData, post.bits);

  const [keyR, keyG, keyB] = opts.chromaKeyColor ?? [255, 0, 255];
  if (chroma.enabled) imageData = applyChromaKey(imageData, chroma.tolerance, chroma.defringeCore, keyR, keyG, keyB);
  if (chroma.edgeRecolorPasses > 0) imageData = defringeRecolor(imageData, keyR, keyG, keyB, chroma.edgeRecolorPasses, chroma.recolorSensitivity);
  if (alphaSnap.enabled) imageData = snapAlpha(imageData, alphaSnap.threshold);
  if (colorStrike.colors.length > 0) imageData = strikeColors(imageData, colorStrike.colors, colorStrike.tolerance);

  ctx.putImageData(imageData, 0, 0);

  // Pixelize pass — runs before erasure and outline so all operate at final resolution
  let workingSprite: ExtractedSprite;
  if (pixelize.enabled) {
    const dataUrl = canvas.toDataURL('image/png');
    const intermediate: ExtractedSprite = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
    workingSprite = await pixelizeSprite(intermediate, pixelize.size);
  } else {
    const dataUrl = canvas.toDataURL('image/png');
    workingSprite = { ...sprite, imageData: dataUrl.split(',')[1], mimeType: 'image/png' };
  }

  // Erasure pass — after pixelization so coordinates match the zoom view
  if (hasErasure) {
    const imgE = await loadSpriteImage(workingSprite);
    const cE = document.createElement('canvas');
    cE.width = imgE.width;
    cE.height = imgE.height;
    const ctxE = cE.getContext('2d')!;
    ctxE.drawImage(imgE, 0, 0);
    const idE = ctxE.getImageData(0, 0, imgE.width, imgE.height);
    const scaleX = imgE.width / sprite.width;
    const scaleY = imgE.height / sprite.height;
    for (const key of opts.erasedPixels!) {
      const sep = key.indexOf(',');
      const ex = parseInt(key.substring(0, sep), 10);
      const ey = parseInt(key.substring(sep + 1), 10);
      const sx = Math.round(ex * scaleX);
      const sy = Math.round(ey * scaleY);
      if (sx >= 0 && sy >= 0 && sx < imgE.width && sy < imgE.height) {
        idE.data[(sy * imgE.width + sx) * 4 + 3] = 0;
      }
    }
    ctxE.putImageData(idE, 0, 0);
    workingSprite = { ...workingSprite, imageData: cE.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  }

  // Outline pass — runs last, on pixelized dimensions when pixelize is enabled
  if (outline.enabled) {
    const img2 = await loadSpriteImage(workingSprite);
    const c2 = document.createElement('canvas');
    c2.width = img2.width;
    c2.height = img2.height;
    const ctx2 = c2.getContext('2d')!;
    ctx2.drawImage(img2, 0, 0);
    let id2 = ctx2.getImageData(0, 0, img2.width, img2.height);
    id2 = outlineSprite(id2, outline.outDepth, outline.inDepth, outline.color[0], outline.color[1], outline.color[2]);
    ctx2.putImageData(id2, 0, 0);
    return { ...workingSprite, imageData: c2.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  }

  return workingSprite;
}

/**
 * Detect distinct colors from sprites using 4-bit quantization.
 * Moved from SpriteReview.tsx — pure function with no React dependency.
 */
export async function detectPalette(sprites: ExtractedSprite[], maxColors = 144): Promise<RGB[]> {
  const counts = new Map<number, { r: number; g: number; b: number; n: number }>();

  for (const sprite of sprites.slice(0, 12)) {
    const img = await loadSpriteImage(sprite);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    for (let i = 0; i < data.length; i += 8) {
      if (data[i + 3] === 0) continue;
      const qr = data[i] >> 4;
      const qg = data[i + 1] >> 4;
      const qb = data[i + 2] >> 4;
      const key = (qr << 8) | (qg << 4) | qb;
      const entry = counts.get(key);
      if (entry) {
        entry.r += data[i];
        entry.g += data[i + 1];
        entry.b += data[i + 2];
        entry.n++;
      } else {
        counts.set(key, { r: data[i], g: data[i + 1], b: data[i + 2], n: 1 });
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]);
}

/**
 * Auto-detect the chroma key color from the first sprite in a batch.
 * Extracted so the detection runs once per batch, not per-sprite.
 */
export async function detectChromaKeyColor(sprites: ExtractedSprite[]): Promise<RGB> {
  if (sprites.length === 0) return [255, 0, 255];
  const first = sprites[0];
  const img = await loadSpriteImage(first);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  return detectKeyColor(imageData) as RGB;
}
