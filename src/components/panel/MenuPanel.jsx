import { TABS } from '../../utils';
import { ChevronRight, Compass, Scale } from 'lucide-react';
import { QuickPlanBox } from './QuickPlanBox.jsx';

// "What do sources say about…": one click opens the map's "Do sources agree?" panel with that topic expanded
const ASK_TOPICS = ['Safety & Health', 'Transport', 'Food & Drink', 'Money & Costs', 'Climate', 'Nightlife'];
const askTopic = (topic) => window.dispatchEvent(new CustomEvent('alpacamap-open-topic', { detail: { topic } }));

function AskSources({ hasKnowledge }) {
  return (
    <section className="menu-section ask-sources">
      <h3 className="menu-section-title"><Scale size={12} /> What do sources say about…</h3>
      {hasKnowledge ? (
        <div className="ask-chips">
          {ASK_TOPICS.map((t) => (
            <button key={t} type="button" className="ask-chip" onClick={() => askTopic(t)}>{t}</button>
          ))}
        </div>
      ) : <p className="menu-item-desc">Add a city to your trip (London, Paris, Rome, Edinburgh or Zurich have ready-made knowledge).</p>}
    </section>
  );
}

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

export const MenuPanel = ({ setActiveTab, gcUndiscovered, debateCount = 0, onApplyQuickPlan, hasTrip, isDemo, onLoadDemo, onStartTour, hasKnowledge = false }) => {
  return (
  <nav className="menu-panel" aria-label="Main menu">
    {onStartTour && <button type="button" className="menu-tour-btn" onClick={onStartTour}><Compass size={15} /> New here? Take the one-minute tour</button>}
    {onApplyQuickPlan && <QuickPlanBox onApply={onApplyQuickPlan} hasTrip={hasTrip} />}
    {isDemo && <p className="menu-example-note">This is an example trip. Use <b>Destination</b> at the top to explore another city, or describe your own trip above.</p>}
    <AskSources hasKnowledge={hasKnowledge} />
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
      <button type="button" className="menu-demo-link" onClick={onLoadDemo}>🦙 Open the London example trip</button>
    )}
    <button type="button" className="menu-demo-link menu-about-link" onClick={() => setActiveTab('about')}>About, privacy &amp; imprint</button>
  </nav>
  );
};
