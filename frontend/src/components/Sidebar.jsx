import { NavLink, useNavigate } from 'react-router-dom'
import { X, User, LogOut } from 'lucide-react'
import {
  Home, Key, PlayCircle, BarChart3, CreditCard,
  Package, DollarSign, Shield, Layers, GitCompareArrows,
  FileText, List, Database, Bot, MessageSquareText, Plug
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Sidebar = ({ isOpen, isCollapsed, onClose }) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const menuItems = [
    { icon: Home, label: 'Overview', path: '/' },
    { icon: PlayCircle, label: 'Playground', path: '/playground' },
    { icon: Key, label: 'API Keys', path: '/api-keys' },
    { icon: Database, label: 'Knowledge Base', path: '/knowledge-base' },
    { icon: Bot, label: 'Agents', path: '/agents' },
    { icon: MessageSquareText, label: 'Prompts', path: '/prompts' },
    { icon: Layers, label: 'Batch Inference', path: '/batch' },
    { icon: GitCompareArrows, label: 'Model Evaluation', path: '/evaluate' },
    { icon: Shield, label: 'Guardrails', path: '/guardrails' },
    { icon: Plug, label: 'MCP Servers', path: '/mcp-servers' },
    { icon: BarChart3, label: 'Usage and Analytics', path: '/usage-analytics' },
    { icon: List, label: 'Request Logs', path: '/request-logs' },
    { icon: CreditCard, label: 'Buy Credits', path: '/buy-credits' },
    { icon: Package, label: 'Models', path: '/models' },
    { icon: FileText, label: 'Documentation', path: '/documentation' },
    { icon: DollarSign, label: 'Billing', path: '/billing' }
  ]

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Mobile Close Button */}
        <button className="sidebar-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Logo */}
        <div className="sidebar-logo">
          {isCollapsed ? (
            <div className="logo-collapsed-mark" title="InferXspace">
              <span className="logo-gradient">I</span>
              <span className="logo-x">X</span>
              <span className="logo-gradient">S</span>
            </div>
          ) : (
            <>
              <h1>
                <span className="logo-gradient">Infer</span>
                <span className="logo-x">X</span>
                <span className="logo-gradient">space</span>
              </h1>
              <p>India's open-source LLM API platform</p>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              title={item.label}
            >
              <item.icon size={20} />
              {!isCollapsed && <span>{item.label}</span>}
              {item.badge && !isCollapsed && (
                <span className={`badge ${item.badgeColor || 'gray'}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Token balance only (removed "This Month" stats) */}
        {/* <div className="sidebar-stats">
          <div className="token-balance">
            <span className="balance-label">Token Balance</span>
            <div className="balance-amount">
              <span className="balance-value">2.5M</span>
              <span className="balance-unit">tokens</span>
            </div>
            <div className="balance-progress">
              <div className="progress-bar"></div>
            </div>
          </div>
        </div> */}

        {/* User Profile */}
        {!isCollapsed && (
          <div 
            className="sidebar-profile"
            onClick={() => navigate('/settings')}
          >
            <div className="profile-avatar">
              <span>{user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}</span>
            </div>
            <div className="profile-info">
              <div className="profile-name">{user?.name || 'User'}</div>
              <div className="profile-email">{user?.email || ''}</div>
              <div className="profile-status">🟢 Active now</div>
            </div>
          </div>
        )}

        {/* Profile & Sign Out */}
        <div className="sidebar-actions">
          {!isCollapsed ? (
            <>
              <button 
                className="btn-profile"
                onClick={() => navigate('/settings')}
              >
                Profile
              </button>
              <button className="btn-signout" onClick={logout}>Sign Out</button>
            </>
          ) : (
            <>
              <button 
                className="btn-profile icon-only"
                onClick={() => navigate('/settings')}
                title="Profile"
              >
                <User size={18} />
              </button>
              <button className="btn-signout icon-only" title="Sign Out" onClick={logout}>
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>

        {!isCollapsed && <div className="sidebar-version">v1.0.0-beta</div>}
      </aside>

      {/* Profile modal removed; profile navigates to /settings */}
    </>
  )
}

export default Sidebar
