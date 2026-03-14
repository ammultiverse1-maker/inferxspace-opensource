import React, { useEffect, useState } from 'react';

const Notification = ({ id, type, message, onClose }) => {
  return (
    <div
      style={{
        marginBottom: '8px',
        padding: '10px 14px',
        borderRadius: 8,
        color: 'white',
        background: type === 'error' ? 'color-mix(in srgb, var(--error) 90%, transparent)' : 'color-mix(in srgb, var(--success) 95%, transparent)',
        boxShadow: 'var(--shadow-md)',
        minWidth: 220,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14 }}>{message}</div>
        <button
          onClick={() => onClose(id)}
          style={{
            marginLeft: 12,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.9)',
            cursor: 'pointer',
            fontSize: 14,
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const NotificationCenter = () => {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { type, message } = e.detail || {};
      if (!message) return;
      const id = Date.now() + Math.random();
      setNotes((prev) => [...prev, { id, type, message }]);
      // Auto dismiss
      setTimeout(() => {
        setNotes((prev) => prev.filter(n => n.id !== id));
      }, 4500);
    };

    window.addEventListener('app-notify', handler);
    return () => window.removeEventListener('app-notify', handler);
  }, []);

  const handleClose = (id) => {
    setNotes((prev) => prev.filter(n => n.id !== id));
  };

  if (notes.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
      {notes.map(n => (
        <Notification key={n.id} id={n.id} type={n.type} message={n.message} onClose={handleClose} />
      ))}
    </div>
  );
};

export default NotificationCenter;
