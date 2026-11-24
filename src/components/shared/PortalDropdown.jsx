import { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export const PortalDropdown = ({ anchorRef, show, children, onClose }) => {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (show && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    }
  }, [show]);
  if (!show || !rect) return null;
  return createPortal(
    <>
      <div style={{ position:'fixed', inset:0, zIndex:99990 }} onClick={onClose}/>
      <div className="suggestions-dropdown" style={{ position:'fixed', top:rect.top, left:rect.left, width:rect.width, zIndex:99999 }}>
        {children}
      </div>
    </>,
    document.body
  );
};
