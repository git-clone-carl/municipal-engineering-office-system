import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Icon, Modal, timeAgo, PERMIT_TYPES, STATUS_LABELS } from './UI';

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
  const { user, logout, hasAccess, showStaffGuide, dismissStaffGuide } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (showStaffGuide) setDontShowAgain(false);
  }, [showStaffGuide]);

  const handleCloseStaffGuide = () => {
    if (dontShowAgain && user?.id) {
      localStorage.setItem(`hide_staff_guide_${user.id}`, 'true');
    }
    dismissStaffGuide();
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [datetime, setDatetime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  // Global search bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({ permits: [], clients: [], pages: [] });
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults({ permits: [], clients: [], pages: [] });
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const lower = q.toLowerCase();
      const matchedPages = NAV_ITEMS
        .filter((item) => hasAccess(item.module) && item.label.toLowerCase().includes(lower));

      const tasks = [];
      if (hasAccess('permits')) {
        tasks.push(
          api.getPermits({ search: q, page: 1, limit: 5 })
            .then((d) => ({ key: 'permits', items: d.permits || [] }))
            .catch(() => ({ key: 'permits', items: [] })),
        );
      }
      if (hasAccess('clients')) {
        tasks.push(
          api.getClients({ search: q, page: 1, limit: 5 })
            .then((d) => ({ key: 'clients', items: d.clients || [] }))
            .catch(() => ({ key: 'clients', items: [] })),
        );
      }

      const settled = await Promise.all(tasks);
      if (cancelled) return;
      const next = { permits: [], clients: [], pages: matchedPages };
      for (const res of settled) next[res.key] = res.items;
      setSearchResults(next);
      setSearchLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, hasAccess]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      const q = searchQuery.trim();
      if (!q) return;
      setSearchOpen(false);
      if (location.pathname.startsWith('/clients') && hasAccess('clients')) {
        navigate(`/clients?search=${encodeURIComponent(q)}`);
      } else if (hasAccess('permits')) {
        navigate(`/permits?search=${encodeURIComponent(q)}`);
      } else if (hasAccess('clients')) {
        navigate(`/clients?search=${encodeURIComponent(q)}`);
      }
    }
  };

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

  const handleNotificationClick = async (notification) => {
    await markRead(notification);
    setShowNotifications(false);
    if (notification.permit_id) {
      if (hasAccess('permits')) {
        navigate(`/permits?open=${notification.permit_id}`);
      }
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

            <div ref={searchRef} style={{ position: 'relative' }}>
              <div className="search-box">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Search permits, clients, pages..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                    title="Clear search"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--text-light)', fontSize: 16, lineHeight: 1, padding: 0,
                    }}
                  >
                    &times;
                  </button>
                )}
              </div>

              {searchOpen && searchQuery.trim() && (
                <div
                  className="notification-dropdown"
                  style={{ left: 0, right: 'auto', width: 360, maxHeight: 420, overflowY: 'auto' }}
                >
                  <div className="notification-header">
                    <strong>Search Results</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-light)' }}>Press Enter to filter</span>
                  </div>
                  <div className="notification-list">
                    {searchLoading ? (
                      <div className="empty-state" style={{ padding: 16 }}>Searching...</div>
                    ) : (searchResults.permits.length === 0 && searchResults.clients.length === 0 && searchResults.pages.length === 0) ? (
                      <div className="empty-state" style={{ padding: 16 }}>No matches found for &ldquo;{searchQuery.trim()}&rdquo;.</div>
                    ) : (
                      <>
                        {searchResults.permits.length > 0 && (
                          <div>
                            <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', background: 'var(--bg-subcard)' }}>
                              Permit Applications
                            </div>
                            {searchResults.permits.map((p) => (
                              <button
                                key={`permit-${p.id}`}
                                type="button"
                                className="notification-item"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSearchOpen(false);
                                  navigate(`/permits?open=${p.id}`);
                                }}
                              >
                                <div className="notification-item-title">{p.application_no} — {p.client_name}</div>
                                <div className="notification-item-message">
                                  {PERMIT_TYPES[p.permit_type] || p.permit_type} · {STATUS_LABELS[p.status] || p.status}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.clients.length > 0 && (
                          <div>
                            <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', background: 'var(--bg-subcard)' }}>
                              Clients
                            </div>
                            {searchResults.clients.map((c) => (
                              <button
                                key={`client-${c.id}`}
                                type="button"
                                className="notification-item"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSearchOpen(false);
                                  navigate(`/clients?search=${encodeURIComponent(c.full_name)}`);
                                }}
                              >
                                <div className="notification-item-title">{c.full_name}</div>
                                <div className="notification-item-message">
                                  {c.client_id}{c.email ? ` · ${c.email}` : ''}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.pages.length > 0 && (
                          <div>
                            <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', background: 'var(--bg-subcard)' }}>
                              Pages
                            </div>
                            {searchResults.pages.map((page) => (
                              <button
                                key={`page-${page.path}`}
                                type="button"
                                className="notification-item"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSearchOpen(false);
                                  navigate(page.path);
                                }}
                              >
                                <div className="notification-item-title">{page.label}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
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
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleNotificationClick(notification)}
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

      {/* Staff / Engineer Welcome Video Modal */}
      <Modal
        open={showStaffGuide}
        onClose={handleCloseStaffGuide}
        title="Welcome to MEO Gumaca — Staff Quick Guide"
        large
        footer={(
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
            <label htmlFor="dont-show-staff-guide" className="ui-checkbox-label" style={{ cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                id="dont-show-staff-guide"
                className="ui-checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span>Do not show this again</span>
            </label>
            <button type="button" className="btn btn-primary" onClick={handleCloseStaffGuide}>
              Got it
            </button>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <video
            src="/welcome-staff-guide.mp4"
            autoPlay
            loop
            playsInline
            style={{
              width: 'auto',
              maxWidth: '100%',
              maxHeight: '65vh',
              borderRadius: 12,
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
