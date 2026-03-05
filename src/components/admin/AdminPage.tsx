/**
 * Admin page for managing grid presets and content presets.
 * Tabbed interface: Grid Presets, Characters, Buildings, Terrain, Backgrounds.
 */

import React, { useState } from 'react';
import { GridPresetsTab } from './GridPresetsTab';
import { CharacterPresetsTab } from './CharacterPresetsTab';
import { BuildingPresetsTab } from './BuildingPresetsTab';
import { TerrainPresetsTab } from './TerrainPresetsTab';
import { BackgroundPresetsTab } from './BackgroundPresetsTab';
import '../../styles/admin.css';

type AdminTab = 'grid-presets' | 'characters' | 'buildings' | 'terrain' | 'backgrounds';

const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: 'grid-presets', label: 'Grid Presets' },
  { key: 'characters', label: 'Characters' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'backgrounds', label: 'Backgrounds' },
];

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('grid-presets');

  return (
    <div className="admin-page">
      <nav className="admin-tabs">
        {ADMIN_TABS.map(tab => (
          <button
            key={tab.key}
            className={`admin-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="admin-content">
        {activeTab === 'grid-presets' && <GridPresetsTab />}
        {activeTab === 'characters' && <CharacterPresetsTab />}
        {activeTab === 'buildings' && <BuildingPresetsTab />}
        {activeTab === 'terrain' && <TerrainPresetsTab />}
        {activeTab === 'backgrounds' && <BackgroundPresetsTab />}
      </main>
    </div>
  );
}
