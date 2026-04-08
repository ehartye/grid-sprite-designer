import type { RGB } from '../../types/color';
import type { ChromaKeySettings, ChromaKeyActions } from '../../hooks/useChromaKeySettings';
import type { PosterizeSettings, PosterizeActions } from '../../hooks/usePosterizeSettings';
import { SidebarGroup } from './SidebarGroup';

export interface PostProcessingSidebarProps {
  chroma: ChromaKeySettings & ChromaKeyActions;
  posterize: PosterizeSettings & PosterizeActions;
  palette: RGB[];
  reExtract: (opts: { aaInset: number; posterizeBits: number }) => void;
  pixelizeEnabled: boolean;
  setPixelizeEnabled: (v: boolean) => void;
  pixelizeSize: number;
  setPixelizeSize: (v: number) => void;
  outlineEnabled: boolean;
  setOutlineEnabled: (v: boolean) => void;
  outlineOutDepth: number;
  setOutlineOutDepth: (v: number) => void;
  outlineInDepth: number;
  setOutlineInDepth: (v: number) => void;
  outlineColor: RGB;
  setOutlineColor: (v: RGB) => void;
  alphaSnapEnabled: boolean;
  setAlphaSnapEnabled: (v: boolean) => void;
  alphaSnapThreshold: number;
  setAlphaSnapThreshold: (v: number) => void;
  struckColors: RGB[];
  setStruckColors: (fn: (prev: RGB[]) => RGB[]) => void;
  showRareColors: boolean;
  setShowRareColors: (fn: (prev: boolean) => boolean) => void;
  strikeTolerance: number;
  setStrikeTolerance: (v: number) => void;
  aaInset: number;
  setAaInset: (v: number) => void;
}

export function PostProcessingSidebar({
  chroma,
  posterize: post,
  palette,
  reExtract,
  pixelizeEnabled,
  setPixelizeEnabled,
  pixelizeSize,
  setPixelizeSize,
  outlineEnabled,
  setOutlineEnabled,
  outlineOutDepth,
  setOutlineOutDepth,
  outlineInDepth,
  setOutlineInDepth,
  outlineColor,
  setOutlineColor,
  alphaSnapEnabled,
  setAlphaSnapEnabled,
  alphaSnapThreshold,
  setAlphaSnapThreshold,
  struckColors,
  setStruckColors,
  showRareColors,
  setShowRareColors,
  strikeTolerance,
  setStrikeTolerance,
  aaInset,
  setAaInset,
}: PostProcessingSidebarProps) {
  return (
    <SidebarGroup label="Post-Processing" defaultOpen={false}>
      <div className="sidebar-section">
        <h3>
          Posterize
          <span title="Reduce color depth for a retro pixel-art look. Lower bit values = fewer colors." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
        </h3>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Bit Depth
              <span title="Bits per color channel. 8 = off (original colors). Lower = fewer colors." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
            </label>
            <span className="slider-value">{post.posterizeBits === 8 ? 'off' : `${post.posterizeBits}-bit`}</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            value={post.posterizeBits}
            onChange={(e) => {
              const bits = Number(e.target.value);
              post.setPosterizeBits(bits);
              if (bits === 8) post.setPosterizeOutput(false);
            }}
            style={{ width: '100%' }}
          />
        </div>
        {post.posterizeBits < 8 && (
          <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 4 }}>
            <button
              type="button"
              className={`anim-group-btn ${!post.posterizeOutput ? 'active' : ''}`}
              onClick={() => post.setPosterizeOutput(false)}
            >
              Original
            </button>
            <button
              type="button"
              className={`anim-group-btn ${post.posterizeOutput ? 'active' : ''}`}
              onClick={() => post.setPosterizeOutput(true)}
            >
              Posterized
            </button>
          </div>
        )}
      </div>

      {/* Pixelize */}
      <div className="sidebar-section">
        <h3>
          Pixelize
          <span title="Downscale sprites to a retro pixel art resolution using nearest-neighbor interpolation." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
        </h3>
        <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            className={`anim-group-btn ${!pixelizeEnabled ? 'active' : ''}`}
            onClick={() => setPixelizeEnabled(false)}
          >
            Off
          </button>
          <button
            className={`anim-group-btn ${pixelizeEnabled ? 'active' : ''}`}
            onClick={() => setPixelizeEnabled(true)}
          >
            On
          </button>
        </div>
        {pixelizeEnabled && (
          <div className="pixelize-size-row" style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {([16, 32, 48, 64, 128] as const).map(size => (
              <button
                key={size}
                className={`pixel-size-btn ${pixelizeSize === size ? 'active' : ''}`}
                onClick={() => setPixelizeSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Outline */}
      <div className="sidebar-section">
        <h3>
          Outline
          <span title="Paint a pixel outline around sprites. Outward adds pixels into the transparent area; Inward recolors the outermost opaque ring." style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
        </h3>
        <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={`anim-group-btn ${!outlineEnabled ? 'active' : ''}`} onClick={() => setOutlineEnabled(false)}>Off</button>
          <button className={`anim-group-btn ${outlineEnabled ? 'active' : ''}`} onClick={() => setOutlineEnabled(true)}>On</button>
        </div>
        {outlineEnabled && (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Out</label>
                  <span className="slider-value">{outlineOutDepth}</span>
                </div>
                <input type="range" min={0} max={8} value={outlineOutDepth} onChange={(e) => setOutlineOutDepth(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>In</label>
                  <span className="slider-value">{outlineInDepth}</span>
                </div>
                <input type="range" min={0} max={8} value={outlineInDepth} onChange={(e) => setOutlineInDepth(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {([[0,0,0],[255,255,255]] as RGB[]).map(([cr, cg, cb], idx) => {
                const isSelected = outlineColor[0] === cr && outlineColor[1] === cg && outlineColor[2] === cb;
                return (
                  <button key={idx} onClick={() => setOutlineColor([cr, cg, cb])}
                    title={idx === 0 ? 'Black' : 'White'}
                    style={{ width: 24, height: 24, backgroundColor: `rgb(${cr},${cg},${cb})`, border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                  />
                );
              })}
              {palette.slice(0, 10).map(([cr, cg, cb], i) => {
                const isSelected = outlineColor[0] === cr && outlineColor[1] === cg && outlineColor[2] === cb;
                return (
                  <button key={i + 2} onClick={() => setOutlineColor([cr, cg, cb])}
                    title={`rgb(${cr}, ${cg}, ${cb})`}
                    style={{ width: 24, height: 24, backgroundColor: `rgb(${cr},${cg},${cb})`, border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Chroma Key */}
      <div className="sidebar-section">
        <h3>
          Chroma Key
          <span title="Remove magenta background from sprites" style={{ cursor: 'help', marginLeft: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&#9432;</span>
        </h3>
        <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            className={`anim-group-btn ${!chroma.chromaEnabled ? 'active' : ''}`}
            onClick={() => chroma.setChromaEnabled(false)}
          >
            Off
          </button>
          <button
            className={`anim-group-btn ${chroma.chromaEnabled ? 'active' : ''}`}
            onClick={() => chroma.setChromaEnabled(true)}
          >
            On
          </button>
        </div>
        {chroma.chromaEnabled && (
          <>
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Tolerance
                  <span title="How aggressively the background is removed. Lower values preserve more sprite color but may leave background remnants." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                </label>
                <span className="slider-value">{chroma.chromaTolerance}</span>
              </div>
              <input
                type="range"
                min={1}
                max={150}
                value={chroma.chromaTolerance}
                onChange={(e) => chroma.setChromaTolerance(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Defringe
                  <span title="Fades the alpha of border pixels near the key color. Higher values remove more fringe. Independent of tolerance so edges stay clean even at low tolerance." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                </label>
                <span className="slider-value">{chroma.defringeCore}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                value={chroma.defringeCore}
                onChange={(e) => chroma.setDefringeCore(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Edge Recolor
                  <span title="Replaces pink-tinted RGB on edge pixels with nearby sprite colors. Keeps alpha intact for smooth edges. Higher = more passes inward." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                </label>
                <span className="slider-value">{chroma.edgeRecolorPasses === 0 ? 'off' : chroma.edgeRecolorPasses}</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                value={chroma.edgeRecolorPasses}
                onChange={(e) => chroma.setEdgeRecolorPasses(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            {chroma.edgeRecolorPasses > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Recolor Sensitivity
                    <span title="How liberally pixels are classified as pink. Low = only obvious magenta. High = catches subtle pink tints." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                  </label>
                  <span className="slider-value">{chroma.recolorSensitivity}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={chroma.recolorSensitivity}
                  onChange={(e) => chroma.setRecolorSensitivity(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Hard Edges
                  <span title="Snap partial-alpha fringe pixels to fully opaque or fully transparent. Eliminates semi-transparent edge artifacts from chroma key. Threshold controls the cutoff: pixels above become opaque, below become transparent." style={{ cursor: 'help', marginLeft: 4 }}>&#9432;</span>
                </label>
                <span className="slider-value">{alphaSnapEnabled ? alphaSnapThreshold : 'off'}</span>
              </div>
              <div className="anim-group-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: alphaSnapEnabled ? 4 : 0 }}>
                <button
                  className={`anim-group-btn ${!alphaSnapEnabled ? 'active' : ''}`}
                  onClick={() => setAlphaSnapEnabled(false)}
                >
                  Off
                </button>
                <button
                  className={`anim-group-btn ${alphaSnapEnabled ? 'active' : ''}`}
                  onClick={() => setAlphaSnapEnabled(true)}
                >
                  On
                </button>
              </div>
              {alphaSnapEnabled && (
                <input
                  type="range"
                  min={1}
                  max={254}
                  value={alphaSnapThreshold}
                  onChange={(e) => setAlphaSnapThreshold(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Color Striker */}
      {palette.length > 0 && (
        <div className="sidebar-section">
          <h3>Color Striker</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {palette.slice(0, 72).map(([r, g, b], i) => {
              const isStruck = struckColors.some(
                (c) => c[0] === r && c[1] === g && c[2] === b,
              );
              return (
                <button
                  key={i}
                  onClick={() => {
                    setStruckColors((prev) =>
                      isStruck
                        ? prev.filter((c) => c[0] !== r || c[1] !== g || c[2] !== b)
                        : [...prev, [r, g, b]],
                    );
                  }}
                  title={`rgb(${r}, ${g}, ${b})`}
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: `rgb(${r},${g},${b})`,
                    border: isStruck ? '2px solid var(--accent)' : '2px solid var(--border)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    opacity: isStruck ? 0.4 : 1,
                    position: 'relative',
                  }}
                />
              );
            })}
          </div>
          {palette.length > 72 && (
            <>
              <button
                className="btn btn-sm w-full"
                style={{ marginTop: 6 }}
                onClick={() => setShowRareColors((v) => !v)}
              >
                {showRareColors ? 'Hide' : 'More Colors'} ({palette.length - 72})
              </button>
              {showRareColors && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {palette.slice(72).map(([r, g, b], i) => {
                    const isStruck = struckColors.some(
                      (c) => c[0] === r && c[1] === g && c[2] === b,
                    );
                    return (
                      <button
                        key={i + 72}
                        onClick={() => {
                          setStruckColors((prev) =>
                            isStruck
                              ? prev.filter((c) => c[0] !== r || c[1] !== g || c[2] !== b)
                              : [...prev, [r, g, b]],
                          );
                        }}
                        title={`rgb(${r}, ${g}, ${b})`}
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: `rgb(${r},${g},${b})`,
                          border: isStruck ? '2px solid var(--accent)' : '2px solid var(--border)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          opacity: isStruck ? 0.4 : 1,
                          position: 'relative',
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tolerance</label>
              <span className="slider-value">{strikeTolerance}</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={strikeTolerance}
              onChange={(e) => setStrikeTolerance(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
          {struckColors.length > 0 && (
            <button
              className="btn btn-sm w-full"
              style={{ marginTop: 6 }}
              onClick={() => setStruckColors(() => [])}
            >
              Clear All ({struckColors.length})
            </button>
          )}
        </div>
      )}

      {/* Re-extract */}
      <div className="sidebar-section">
        <div className="slider-row">
          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Edge inset</label>
          <select
            value={aaInset}
            onChange={(e) => setAaInset(Number(e.target.value))}
            className="btn btn-sm"
            style={{ width: 'auto', padding: '2px 6px' }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <option key={v} value={v}>{v}px</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-sm w-full"
          style={{ marginTop: 6 }}
          onClick={() => reExtract({ aaInset, posterizeBits: post.posterizeBits })}
        >
          Re-extract Sprites
        </button>
      </div>
    </SidebarGroup>
  );
}
