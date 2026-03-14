import React from 'react';

const StatsCard = ({ icon: Icon, title, value, subtitle, iconColor, iconBg }) => {
  return (
    <div className="stats-card">
      <div className="stats-icon" style={{ 
        backgroundColor: iconBg || 'var(--border-light)',
        color: iconColor || 'var(--text-secondary)'
      }}>
        {Icon && <Icon size={28} strokeWidth={2} />}
      </div>
      <div className="stats-content">
        <p className="stats-title">{title}</p>
        <h3 className="stats-value">{value}</h3>
        {subtitle && <p className="stats-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
};

export default StatsCard;
