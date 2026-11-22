import { TABS } from '../../utils';
import { ChevronRight } from 'lucide-react';
import { QuickPlanBox } from './QuickPlanBox.jsx';

// Grouped, compact main menu. Every entry is a real <button> (keyboard + screen-reader friendly)
// and shows its description inline instead of behind a hover tooltip.
// On top: the one-box planner ("3 days in Paris, hate queues, love food").
const SECTIONS = [
  { title: 'Plan',       tabs: ['locations', 'calendar', 'routespace', 'tripmind'] },
  { title: 'Understand', tabs: ['debates', 'knowledge', 'analytics', 'analyze'] },
  { title: 'Organize',   tabs: ['budget', 'packing', 'notes', 'documents', 'route'] },
];

const badgeFor = (id, { gcUndiscovered, debateCount }) =>
  id === 'analytics' ? gcUndiscovered : id === 'debates' ? debateCount : 0;

export const MenuPanel = ({ setActiveTab, gcUndiscovered, debateCount = 0, onApplyQuickPlan, hasTrip, isDemo, onLoadDemo, onNewTrip }) => (
  <nav className="menu-panel" aria-label="Main menu">
    {onApplyQuickPlan && <QuickPlanBox onApply={onApplyQuickPlan} hasTrip={hasTrip} />}
    {isDemo && (
      <div className="demo-ribbon">
        <span>🦙 You're looking at a demo trip.</span>
        <button type="button" onClick={onNewTrip}>Start empty</button>
      </div>
    )}
    {SECTIONS.map(section => (
      <section key={section.title} className="menu-section">
        <h3 className="menu-section-title">{section.title}</h3>
        <div className="menu-list">
          {section.tabs.map(id => TABS.find(t => t.id === id)).filter(Boolean).map(tab => {
            const badge = badgeFor(tab.id, { gcUndiscovered, debateCount });
            return (
              <button key={tab.id} type="button" className="menu-item" onClick={() => setActiveTab(tab.id)}>
                <span className="menu-item-icon"><tab.Icon size={17} /></span>
                <span className="menu-item-text">
                  <span className="menu-item-label">
                    {tab.label}
                    {badge > 0 && (
                      <span className="menu-item-badge" title={tab.id === 'debates' ? `${badge} disagreements to judge` : `${badge} new insights`}>{badge > 99 ? '99+' : badge}</span>
                    )}
                  </span>
                  <span className="menu-item-desc">{tab.desc}</span>
                </span>
                <ChevronRight size={15} className="menu-item-chevron" />
              </button>
            );
          })}
        </div>
      </section>
    ))}
    {!isDemo && onLoadDemo && (
      <button type="button" className="menu-demo-link" onClick={onLoadDemo}>🦙 Show me the London demo trip</button>
    )}
  </nav>
);
