import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Icon, timeAgo } from './UI';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', module: 'dashboard' },
  { path: '/clients', label: 'Client Management', icon: 'clients', module: 'clients' },
  { path: '/permits', label: 'Permit Applications', icon: 'permits', module: 'permits' },
  { path: '/payments', label: 'Payments', icon: 'payments', module: 'payments' },
  { path: '/reports', label: 'Reports', icon: 'reports', module: 'reports' },
  { path: '/audit', label: 'Audit Logs', icon: 'audit', module: 'audit_logs' },
  { path: '/users', label: 'User Management', icon: 'users', module: 'users' },
  { path: '/rbac', label: 'RBAC', icon: 'shield', module: 'rbac' },
  { path: '/settings', label: 'Settings', icon: 'settings', module: 'settings' },
];

export default function Layout() {
  const { user, logout, hasAccess } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [datetime, setDatetime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDatetime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications();
        if (!active) return;
        setNotifications(data.notifications || []);
        setUnread(data.unread || 0);
      } catch {
        /* notification polling is best-effort */
      }
    };
    loadNotifications();
    const timer = setInterval(loadNotifications, 20000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const handleLogout = () => {
    setShowUserMenu(false);
    setShowNotifications(false);
    logout();
    navigate('/login');
  };

  const markRead = async (notification) => {
    if (!notification.is_read) {
      try {
        await api.markNotificationRead(notification.id);
        setNotifications((rows) => rows.map((n) => n.id === notification.id ? { ...n, is_read: 1 } : n));
        setUnread((count) => Math.max(0, count - 1));
      } catch { /* ignore */ }
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((rows) => rows.map((n) => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  const visibleNav = NAV_ITEMS
    .filter((item) => hasAccess(item.module))
    .map((item) => (user?.role === 'viewer' && item.path === '/permits'
      ? { ...item, label: 'My Applications' }
      : item));

  return (
    <div className="app-layout">
      {/* Fixed Sidebar Navigation with Official Gumaca Banner */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-banner-wrap" onClick={() => navigate('/')} title="Municipality of Gumaca, Quezon">
            <img 
              src="/gumacalogo.png" 
              alt="Municipality of Gumaca" 
              className="gumaca-sidebar-banner" 
            />
          </div>
          
          <button type="button" className="sidebar-close-btn" onClick={() => setMobileOpen(false)} title="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>
        
        <nav className="sidebar-nav" style={{ paddingBottom: 24 }}>
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main App Content Container */}
      <div className="main-content">
        {/* Top Header Bar */}
        <header className="top-header">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} title="Toggle Mobile Menu">
              <Icon name="menu" size={20} />
            </button>

            <div className="search-box">
              <Icon name="search" size={16} />
              <input type="text" placeholder="Search tasks, permits, clients..." />
            </div>
          </div>

          <div className="header-right">
            <span className="datetime">
              {datetime.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Notifications (database-backed, polled so other laptops' actions appear) */}
            <div className="notification-wrap">
              <button
                type="button"
                className="notification-bell"
                title="Notifications"
                onClick={() => setShowNotifications((open) => !open)}
              >
                <Icon name="bell" size={19} />
                {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
              </button>

              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <strong>Notifications</strong>
                    <button type="button" className="notification-mark-all" onClick={markAllRead}>
                      Mark all read
                    </button>
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="empty-state" style={{ padding: 20 }}>No notifications yet.</div>
                    ) : notifications.map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        className={`notification-item ${notification.is_read ? '' : 'unread'} type-${notification.type || 'info'}`}
                        onClick={() => markRead(notification)}
                      >
                        <div className="notification-item-title">{notification.title}</div>
                        <div className="notification-item-message">{notification.message}</div>
                        <div className="notification-item-time">{timeAgo(notification.created_at)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clickable User Account Profile Pill with Anonymous Character Icon & Logout Dropdown */}
            <div style={{ position: 'relative' }}>
              <div 
                className="user-info" 
                onClick={() => setShowUserMenu(!showUserMenu)} 
                title="Account Menu & Logout"
                style={{ cursor: 'pointer' }}
              >
                {/* Anonymous Character Avatar Icon */}
                <div className="user-avatar">
                  <Icon name="users" size={16} />
                </div>
                <div className="user-details">
                  <div className="name">{user?.full_name}</div>
                  <div className="role">{user?.role?.replace(/_/g, ' ')}</div>
                </div>
              </div>

              {/* User Account Popover Menu */}
              {showUserMenu && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div className="user-avatar-lg">
                      <Icon name="users" size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}>{user?.full_name}</div>
                      <div className="role-tag">{user?.role?.replace(/_/g, ' ')}</div>
                    </div>
                  </div>

                  <div className="user-dropdown-actions">
                    <button 
                      type="button" 
                      className="user-dropdown-item logout" 
                      onClick={handleLogout}
                    >
                      <Icon name="delete" size={16} />
                      <span>Logout Account</span>
                    </button>

                    <button 
                      type="button" 
                      className="user-dropdown-item" 
                      onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }}
                    >
                      <Icon name="users" size={16} />
                      <span>Switch Account / Sign In</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <div className="page-content">
          <Outlet />
        </div>
      </div>

      {/* Backdrop for Mobile Drawer */}
      {mobileOpen && <div className="modal-overlay" style={{ zIndex: 99 }} onClick={() => setMobileOpen(false)} />}
    </div>
  );
}
