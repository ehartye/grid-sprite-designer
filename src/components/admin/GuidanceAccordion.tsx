import { useMemo } from 'react';
import type { CellGroup } from '../../context/AppContext';

export interface GuidanceAccordionProps {
  cellGroups: CellGroup[];
  cellLabels: string[];
  cols: number;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
  onGroupChange: (groupName: string, value: string) => void;
  onCellChange: (label: string, value: string) => void;
  onGroupBlur?: (groupName: string, value: string) => void;
  onCellBlur?: (label: string, value: string) => void;
}

export function GuidanceAccordion({
  cellGroups, cellLabels, cols,
  groupGuidance, cellGuidance,
  onGroupChange, onCellChange,
  onGroupBlur, onCellBlur,
}: GuidanceAccordionProps) {
  const ungrouped = useMemo(() => {
    const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));
    return cellLabels
      .map((label, idx) => ({ label, idx }))
      .filter(({ label, idx }) => label && !groupedIndices.has(idx));
  }, [cellGroups, cellLabels]);

  return (
    <>
      {cellGroups.map((group) => (
        <details key={group.name} className="admin-subsection">
          <summary className="admin-subsection-title" style={{ cursor: 'pointer' }}>
            {group.name}
          </summary>
          <label className="admin-label" style={{ marginTop: '0.5rem' }}>
            Group guidance
            <textarea
              className="admin-textarea"
              value={groupGuidance[group.name] || ''}
              onChange={e => onGroupChange(group.name, e.target.value)}
              onBlur={onGroupBlur ? e => onGroupBlur(group.name, e.target.value) : undefined}
              placeholder={`Guidance for ${group.name} group...`}
            />
          </label>
          {group.cells.map((cellIdx) => {
            const label = cellLabels[cellIdx];
            if (!label) return null;
            const row = Math.floor(cellIdx / cols);
            const col = cellIdx % cols;
            return (
              <label key={cellIdx} className="admin-label">
                {label} ({row},{col})
                <textarea
                  className="admin-textarea"
                  value={cellGuidance[label] || ''}
                  onChange={e => onCellChange(label, e.target.value)}
                  onBlur={onCellBlur ? e => onCellBlur(label, e.target.value) : undefined}
                  placeholder={`Guidance for "${label}"...`}
                />
              </label>
            );
          })}
        </details>
      ))}
      {ungrouped.length > 0 && (
        <details className="admin-subsection">
          <summary className="admin-subsection-title" style={{ cursor: 'pointer' }}>
            Ungrouped cells ({ungrouped.length})
          </summary>
          {ungrouped.map(({ label, idx }) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            return (
              <label key={idx} className="admin-label">
                {label} ({row},{col})
                <textarea
                  className="admin-textarea"
                  value={cellGuidance[label] || ''}
                  onChange={e => onCellChange(label, e.target.value)}
                  onBlur={onCellBlur ? e => onCellBlur(label, e.target.value) : undefined}
                  placeholder={`Guidance for "${label}"...`}
                />
              </label>
            );
          })}
        </details>
      )}
    </>
  );
}
