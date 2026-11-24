import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, Eye, Trash2, X, Maximize2 } from 'lucide-react';

// Notes are shown with simple markup (==highlight==, *bold*). The text is escaped first, so HTML or scripts
// in a note (for example from an imported trip file) are shown as text and never run.
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NotesPanel=({tripData,setTripData})=>{
  const[editModes, setEditModes]=useState({}); // { [key]: boolean }
  const[activeModalNote, setActiveModalNote]=useState(null); // key of note open in modal
  
  const textareaRefs = useRef({});

  const updateNote=(key,value)=>setTripData(prev=>({
    ...prev,
    notes: key==='general'
      ? {...prev.notes, general:value}
      : {...prev.notes, cities:{...prev.notes.cities, [key]:value}}
  }));

  const updateNoteColor = (key, color) => {
    setTripData(prev => ({
      ...prev,
      notes: {
        ...prev.notes,
        colors: {
          ...(prev.notes.colors || {}),
          [key]: color
        }
      }
    }));
  };

  const updateFontSize = (key, size) => {
    setTripData(prev => ({
      ...prev,
      notes: {
        ...prev.notes,
        fontSizes: {
          ...(prev.notes.fontSizes || {}),
          [key]: parseInt(size, 10) || 18
        }
      }
    }));
  };

  const colors = [
    '#fef08a', // Pastel Yellow
    '#fbcfe8', // Pastel Pink
    '#bfdbfe', // Pastel Blue
    '#bbf7d0', // Pastel Green
    '#fed7aa', // Pastel Orange
    '#ddd6fe', // Pastel Purple
  ];

  // Helper to toggle checkbox inside a line
  const handleCheckboxToggle = (key, text, lineIndex) => {
    const lines = text.split('\n');
    const line = lines[lineIndex];
    
    let newLine = line;
    if (line.includes('[x]')) {
      newLine = line.replace('[x]', '[ ]');
    } else if (line.includes('[ ]')) {
      newLine = line.replace('[ ]', '[x]');
    } else if (line.startsWith('- ')) {
      newLine = line.replace('- ', '- [x] ');
    } else {
      newLine = `[x] ${line}`;
    }

    lines[lineIndex] = newLine;
    updateNote(key, lines.join('\n'));
  };

  // Helper to delete todo line entirely
  const handleTodoDelete = (key, text, lineIndex, e) => {
    e.stopPropagation();
    const lines = text.split('\n');
    lines.splice(lineIndex, 1);
    updateNote(key, lines.join('\n'));
  };

  // Helper to render parsed view mode lines (todos, highlight ==text==, bold)
  const renderNoteContent = (key, text, bg) => {
    if (!text.trim()) {
      return <div style={{ fontStyle: 'italic', opacity: 0.45, fontSize: '0.9rem' }}>Empty note, click or Edit below to write.</div>;
    }

    return text.split('\n').map((line, idx) => {
      // Checkbox matching: [ ] or [x]
      const todoMatch = line.match(/^(\s*-\s*)?\[([ xX]?)\]\s*(.*)$/);
      if (todoMatch) {
        const isChecked = todoMatch[2].toLowerCase() === 'x';
        const contentText = todoMatch[3];
        
        // Highlight ==text== inside todo item
        const htmlContent = escapeHtml(contentText)
          .replace(/==(.*?)==/g, '<mark style="background: rgba(252, 211, 77, 0.7); padding: 0 4px; border-radius: 2px; border: 1px dashed rgba(0,0,0,0.1)">$1</mark>')
          .replace(/\*(.*?)\*/g, '<strong>$1</strong>');

        return (
          <div 
            key={idx} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', userSelect: 'none' }} 
            onClick={(e) => {
              e.stopPropagation(); // Prevent entering edit mode
              handleCheckboxToggle(key, text, idx);
            }}
          >
            {/* Custom hand-drawn style tick box */}
            <div style={{
              width: '13px',
              height: '13px',
              border: '1.8px solid #1e293b',
              borderRadius: '3px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '900',
              cursor: 'pointer',
              flexShrink: 0,
              background: isChecked ? '#1e293b' : 'transparent',
              color: bg
            }}>
              {isChecked && '✓'}
            </div>
            
            <span 
              style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.45 : 0.9, flex: 1, cursor: 'pointer' }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
            {isChecked && (
              <button 
                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center', marginLeft: 'auto' }}
                onClick={(e) => handleTodoDelete(key, text, idx, e)}
                title="Delete completed item"
              >
                <Trash2 size={11} color="var(--danger)"/>
              </button>
            )}
          </div>
        );
      }

      // Regular line: parse highlights and bold
      const htmlContent = escapeHtml(line)
        .replace(/==(.*?)==/g, '<mark style="background: rgba(252, 211, 77, 0.7); padding: 0 4px; border-radius: 2px; border: 1px dashed rgba(0,0,0,0.1)">$1</mark>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>');

      return (
        <div 
          key={idx} 
          style={{ minHeight: '1.2rem', marginBottom: '2px' }}
          dangerouslySetInnerHTML={{ __html: htmlContent || '&nbsp;' }}
        />
      );
    });
  };

  // Helper function to render a post-it card object
  const renderPostItCard = (key, title, val, defaultColor, idx, isModal = false) => {
    const isEditing = editModes[key];
    const currentVal = val || '';
    const bg = tripData.notes.colors?.[key] || defaultColor;
    const fontSize = tripData.notes.fontSizes?.[key] || 18;
    const rotation = isModal ? 0 : ((idx % 2 === 0 ? 1 : -1) * (1.2 + (idx % 3) * 0.4));
    
    return (
      <div 
        key={key} 
        className="post-it" 
        style={{
          background: bg,
          transform: isModal ? 'none' : `rotate(${rotation}deg)`,
          width: isModal ? '100%' : 'auto',
          aspectRatio: '1 / 1'
        }}
      >
        <div className="post-it-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{title}</span>
          {isModal && (
            <button 
              className="btn-icon" 
              style={{ padding: '2px', color: '#1e293b' }} 
              onClick={(e) => { e.stopPropagation(); setActiveModalNote(null); }}
              title="Close modal"
            >
              <X size={14}/>
            </button>
          )}
        </div>
        <div 
          className="post-it-body" 
          style={{ fontSize: `${fontSize}px`, cursor: isEditing ? 'text' : 'pointer' }} 
          onClick={() => {
            if (!isEditing) {
              setEditModes(prev => ({ ...prev, [key]: true }));
            }
          }}
        >
          {isEditing ? (
            <textarea 
              ref={el => textareaRefs.current[key] = el}
              className="post-it-textarea"
              placeholder="Use [ ] item for checklist, ==text== to highlight..."
              value={currentVal}
              onChange={e => updateNote(key, e.target.value)}
              onBlur={() => {
                // Return to view mode slightly after blur to allow button clicks to process first
                setTimeout(() => {
                  setEditModes(prev => ({ ...prev, [key]: false }));
                }, 200);
              }}
              autoFocus
            />
          ) : (
            renderNoteContent(key, currentVal, bg)
          )}
        </div>
        
        {/* Note toolbar */}
        <div className="post-it-toolbar" onClick={e => e.stopPropagation()}>
          {/* Edit/View Toggle */}
          <button 
            className="btn-primary" 
            style={{ padding: '3px 8px', color: '#fff', background: '#1e293b', borderRadius: '4px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px', border: 'none' }}
            onClick={() => setEditModes(prev => ({ ...prev, [key]: !prev[key] }))}
          >
            {isEditing ? <Eye size={11}/> : <Pencil size={11}/>}
            {isEditing ? 'Done' : 'Edit'}
          </button>

          {/* Open Fully Button (only visible in grid view) */}
          {!isModal && (
            <button 
              className="btn-icon" 
              style={{ padding: '3px 6px', color: '#1e293b', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
              onClick={() => setActiveModalNote(key)}
              title="Open Fully"
            >
              <Maximize2 size={11}/>
            </button>
          )}

          {/* Font Size Number Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 'bold' }}>Size:</span>
            <input 
              type="number" 
              min="12" 
              max="36" 
              value={fontSize} 
              onChange={e => updateFontSize(key, e.target.value)}
              style={{ width: '40px', fontSize: '0.75rem', padding: '2px 4px', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '4px', color: '#1e293b', textAlign: 'center' }}
            />
          </div>

          {/* Color dots */}
          <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto' }}>
            {colors.map(c => (
              <div 
                key={c} 
                className="color-dot" 
                style={{ background: c }}
                onClick={() => updateNoteColor(key, c)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return(
    <div>
      <style>{`
        .post-it-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1.5rem;
          padding: 1rem 0;
        }
        .post-it {
          position: relative;
          padding: 1.1rem;
          box-shadow: 0 10px 16px rgba(0,0,0,0.25);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          border-radius: 2px;
        }
        .post-it:hover {
          transform: scale(1.06) rotate(0deg) !important;
          box-shadow: 0 18px 28px rgba(0,0,0,0.35);
          z-index: 10;
        }
        .post-it-title {
          font-family: 'Caveat', cursive;
          font-size: 1.35rem;
          font-weight: 700;
          margin-bottom: 0.4rem;
          color: #1e293b;
          border-bottom: 1.2px dashed rgba(30, 41, 59, 0.15);
          padding-bottom: 0.2rem;
          user-select: none;
        }
        .post-it-body {
          font-family: 'Caveat', cursive;
          color: #334155;
          flex: 1;
          width: 100%;
          overflow-y: auto;
          line-height: 1.35;
        }
        .post-it-textarea {
          font-family: 'Caveat', cursive;
          color: #334155;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          height: 100%;
          width: 100%;
          line-height: 1.35;
        }
        .post-it-textarea::placeholder {
          color: rgba(30, 41, 59, 0.4);
        }
        .post-it-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          border-top: 1px dashed rgba(30, 41, 59, 0.1);
          padding-top: 0.3rem;
          margin-top: 0.3rem;
          opacity: 0.15;
          transition: opacity 0.2s ease;
        }
        .post-it:hover .post-it-toolbar {
          opacity: 1;
        }
        .color-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.15);
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .color-dot:hover {
          transform: scale(1.25);
        }
        /* Sticky tape effect at top */
        .post-it::before {
          content: "";
          position: absolute;
          top: -8px;
          left: 33%;
          width: 34%;
          height: 18px;
          background: rgba(255,255,255,0.4);
          backdrop-filter: blur(1px);
          transform: rotate(-2deg);
          box-shadow: 0 2px 4px rgba(0,0,0,0.03);
          border-radius: 1px;
          pointer-events: none;
        }
      `}</style>

      <div className="post-it-grid">
        {/* Render General Note */}
        {renderPostItCard('general', 'General Notes', tripData.notes.general, colors[0], 0)}

        {/* Render City Notes */}
        {tripData.locations.map((city, idx) => 
          renderPostItCard(
            city.id, 
            city.name.split(',')[0], 
            tripData.notes.cities[city.id], 
            colors[(idx + 1) % colors.length], 
            idx + 1
          )
        )}
      </div>

      {/* Modal / Zoomed view Overlay */}
      {activeModalNote !== null && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999
          }}
          onClick={() => setActiveModalNote(null)}
        >
          <div 
            style={{
              width: '90%',
              maxWidth: '520px',
              transform: 'none'
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const key = activeModalNote;
              if (key === 'general') {
                return renderPostItCard('general', 'General Notes', tripData.notes.general, colors[0], 0, true);
              } else {
                const cityIdx = tripData.locations.findIndex(c => c.id === key);
                const city = tripData.locations[cityIdx];
                if (!city) return null;
                return renderPostItCard(key, city.name.split(',')[0], tripData.notes.cities[key], colors[(cityIdx + 1) % colors.length], cityIdx + 1, true);
              }
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
