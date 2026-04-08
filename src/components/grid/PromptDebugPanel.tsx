import type { StructuredPrompt } from '../../types/prompt';

interface Props {
  prompt: StructuredPrompt | null;
  open: boolean;
  onClose: () => void;
}

export function PromptDebugPanel({ prompt, open, onClose }: Props) {
  if (!open || !prompt) return null;

  const sectionAt = new Map(prompt.meta.sectionBreakdown.map(s => [s.partIndex, s.name]));

  return (
    <div className="prompt-debug-overlay" onClick={onClose}>
      <div className="prompt-debug-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Prompt debug view">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Prompt Debug View</h3>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {prompt.parts.length} parts | {prompt.meta.spriteType} | ref: {String(prompt.meta.hasReference)} | feedback: {String(prompt.meta.hasFeedback)}
        </div>
        {prompt.parts.map((part, i) => {
          const section = sectionAt.get(i);
          return (
            <div key={i}>
              {section && (
                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent)', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {section}
                </div>
              )}
              {part.type === 'text' ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', background: 'var(--surface-alt)', padding: 8, borderRadius: 4, margin: '4px 0', border: '1px solid var(--border)' }}>
                  {part.content}
                </pre>
              ) : (
                <div style={{ padding: 8, background: 'var(--surface-alt)', borderRadius: 4, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
                  <div style={{ width: 48, height: 48, background: '#333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    IMG
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    [{part.label || 'image'}] {(part.data.length * 0.75 / 1024).toFixed(0)}KB ({part.mimeType})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
