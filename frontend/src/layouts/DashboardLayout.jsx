import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SupportTicketModal from '../components/SupportTicketModal';
import { Bell, HelpCircle, X, FileText, Video, LifeBuoy, Menu } from 'lucide-react';

const DashboardLayout = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSupportTicket, setShowSupportTicket] = useState(false);

  const notifications = [
    {
      id: 1,
      type: 'warning',
      icon: '⚠️',
      title: 'Low Balance Alert',
      message: 'Your token balance is below 1M. Consider purchasing more credits.',
      time: '5 min ago'
    },
    {
      id: 2,
      type: 'info',
      icon: 'ℹ️',
      title: 'New Model Available',
      message: 'Llama 3.2 90B is now available in your dashboard.',
      time: '2 hours ago'
    },
    {
      id: 3,
      type: 'success',
      icon: '✓',
      title: 'API Key Regenerated',
      message: 'Your production API key was successfully regenerated.',
      time: 'Yesterday'
    }
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar isOpen={sidebarOpen} isCollapsed={sidebarCollapsed} onClose={() => setSidebarOpen(false)} />

      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Header */}
        <header className="top-header">
          {/* Mobile & Desktop Toggle Buttons */}
          <button 
            className="icon-btn menu-btn"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setSidebarOpen(!sidebarOpen);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Menu size={20} />
          </button>

          <div className="header-actions">
            <button 
              className="icon-btn"
              onClick={() => {
                setShowHelp(!showHelp);
                setShowNotifications(false);
              }}
            >
              <HelpCircle size={20} />
            </button>

            {/** Notification button removed per request. */}
            {/**
            <button 
              className="icon-btn notification-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowHelp(false);
              }}
            >
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>
            */}
          </div>

          {/* Notifications panel removed per request. */}

          {/* Help Panel */}
          {showHelp && (
            <div className="panel help-panel" style={{
              position: 'absolute',
              top: 'calc(var(--header-height) + 6px)',
              right: '32px',
              width: '420px',
              background: 'var(--surface)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              border: '1px solid var(--border-light)',
              zIndex: 1000
            }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Help & Support</h3>
                  <button 
                    onClick={() => setShowHelp(false)}
                    style={{
                      background: 'var(--background)',
                      border: 'none',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Get assistance and access resources</p>
              </div>

              <div style={{ padding: '16px' }}>
                {[
                  { icon: FileText, title: 'Documentation', desc: 'Browse our comprehensive guides and API reference', color: 'var(--primary)', bg: 'var(--purple-light)', action: () => window.open('https://docs.inferxspace.com', '_blank') },
                  { icon: Video, title: 'Video Tutorials', desc: 'Watch step-by-step tutorials and walkthroughs', color: 'var(--warning)', bg: 'var(--orange-light)', action: () => window.open('https://youtube.com/inferxspace', '_blank') },
                  { icon: LifeBuoy, title: 'Submit Ticket', desc: 'Create a support ticket for technical issues', color: 'var(--secondary)', bg: 'var(--pink-light)', action: () => { setShowSupportTicket(true); setShowHelp(false); } }
                ].map((item, idx) => {
                  const IconComponent = item.icon;
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: '12px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: 'var(--surface)'
                    }} onClick={item.action} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background)'}
                       onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: item.bg,
                        color: item.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={24} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{item.title}</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Common Questions</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ fontSize: '13px', color: 'var(--primary)', marginBottom: '8px', cursor: 'pointer' }}>• How do I get started with the API?</li>
                  <li style={{ fontSize: '13px', color: 'var(--primary)', cursor: 'pointer' }}>• What are the rate limits?</li>
                </ul>
              </div>
            </div>
          )}
        </header>

        {/* Content Area */}
        <div className="content-area">
          <Outlet />
        </div>
      </main>

      {/* Support Ticket Modal */}
      <SupportTicketModal
        isOpen={showSupportTicket}
        onClose={() => setShowSupportTicket(false)}
      />
    </div>
  );
};

export default DashboardLayout;
