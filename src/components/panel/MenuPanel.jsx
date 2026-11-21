import React from 'react';
import { TABS } from '../../utils';
import { ChevronRight } from 'lucide-react';

// Grouped, compact main menu. Every entry is a real <button> (keyboard + screen-reader friendly)
// and shows its description inline instead of behind a hover tooltip.
const SECTIONS = [
  { title: 'Plan',       tabs: ['locations', 'tripmind', 'calendar', 'routespace'] },
  { title: 'Understand', tabs: ['knowledge', 'analytics', 'analyze'] },
  { title: 'Organize',   tabs: ['budget', 'packing', 'notes', 'documents', 'route'] },
];

export const MenuPanel = ({ setActiveTab, gcUndiscovered }) => (
  <nav className="menu-panel" aria-label="Main menu">
    {SECTIONS.map(section => (
      <section key={section.title} className="menu-section">
        <h3 className="menu-section-title">{section.title}</h3>
        <div className="menu-list">
          {section.tabs.map(id => TABS.find(t => t.id === id)).filter(Boolean).map(tab => (
            <button key={tab.id} type="button" className="menu-item" onClick={() => setActiveTab(tab.id)}>
              <span className="menu-item-icon"><tab.Icon size={17} /></span>
              <span className="menu-item-text">
                <span className="menu-item-label">
                  {tab.label}
                  {tab.id === 'analytics' && gcUndiscovered > 0 && (
                    <span className="menu-item-badge" title={`${gcUndiscovered} new insights`}>{gcUndiscovered > 99 ? '99+' : gcUndiscovered}</span>
                  )}
                </span>
                <span className="menu-item-desc">{tab.desc}</span>
              </span>
              <ChevronRight size={15} className="menu-item-chevron" />
            </button>
          ))}
        </div>
      </section>
    ))}
  </nav>
);
