import React, { useState } from 'react';
import { TABS } from '../../utils';
import { Info, MapPin } from 'lucide-react';

export const MenuPanel = ({ activeTab, setActiveTab, gcUndiscovered }) => {
  const [hoveredHelp, setHoveredHelp] = useState(null);

  const exploreTab = TABS.find(t => t.id === 'locations');
  const otherTabs = TABS.filter(t => t.id !== 'locations');

  return (
    <div style={{ padding: '1rem', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: 600 }}>Main Menu</h2>
      
      {/* Featured Explore Button */}
      <div 
        onClick={() => setActiveTab('locations')}
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.3))',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.1)';
        }}
      >
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0
        }}>
          <MapPin size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem', color: '#fff' }}>Explore Map</h3>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)', margin: 0, lineHeight: 1.3 }}>
            {exploreTab?.desc || 'Discover places on the map and add them to your trip locations.'}
          </p>
        </div>
      </div>

      {/* Tools Sections */}
      {[
        { title: 'Map & Routing', tabs: ['routespace', 'analytics', 'knowledge'] },
        { title: 'AI & Planning', tabs: ['tripmind', 'analyze'] },
        { title: 'Logistics & Organization', tabs: ['calendar', 'budget', 'packing', 'notes', 'documents', 'route'] }
      ].map((section, idx) => {
        const sectionTabs = section.tabs.map(id => otherTabs.find(t => t.id === id)).filter(Boolean);
        if (sectionTabs.length === 0) return null;
        
        return (
          <div key={idx} style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
              {section.title}
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '1rem'
            }}>
              {sectionTabs.map(tab => {
                const isHoveredHelp = hoveredHelp === tab.id;
                return (
                  <div 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      position: 'relative',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '1.2rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)'
                    }}>
                      <tab.Icon size={20} />
                    </div>
                    
                    {tab.id === 'analytics' && gcUndiscovered > 0 && (
                      <span style={{position:'absolute',top:'-5px',right:'-5px',minWidth:'18px',height:'18px',background:'#ef4444',borderRadius:'99px',fontSize:'0.65rem',fontWeight:'800',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1,boxShadow:'0 2px 5px rgba(0,0,0,0.3)',zIndex:5}}>
                        {gcUndiscovered>99?'99+':gcUndiscovered}
                      </span>
                    )}
                    
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>{tab.label}</span>
                    
                    <div 
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        padding: '4px',
                        color: isHoveredHelp ? 'var(--text-primary)' : 'rgba(255,255,255,0.4)',
                        cursor: 'help',
                        transition: 'color 0.2s',
                        zIndex: 2
                      }}
                      onClick={(e) => { e.stopPropagation(); }}
                      onMouseEnter={() => setHoveredHelp(tab.id)}
                      onMouseLeave={() => setHoveredHelp(null)}
                    >
                      <Info size={14} />
                    </div>

                    {isHoveredHelp && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: '8px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: 'rgba(255,255,255,0.9)',
                        width: '200px',
                        textAlign: 'center',
                        zIndex: 10,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        pointerEvents: 'none'
                      }}>
                        {tab.desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
