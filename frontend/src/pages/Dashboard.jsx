import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icon, formatCurrency, formatDateTime, timeAgo, PERMIT_TYPES, STATUS_LABELS, DOCUMENT_STATUS_LABELS } from '../components/UI';

const PIE_COLORS = ['#7f1d1d', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fee2e2'];

export default function Dashboard() {
  const { user, hasAccess } = useAuth();
  const navigate = useNavigate();
  const isClient = user?.role === 'viewer';
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [activities, setActivities] = useState([]);
  const [engineerRemarks, setEngineerRemarks] = useState([]);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [liveToast, setLiveToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setNowTick] = useState(0);
  const toastTimerRef = useRef(null);

  const loadDashboard = useCallback(() => {
    Promise.all([
      api.getDashboardStats(),
      api.getMonthlyPermits(),
      api.getStatusDistribution(),
      api.getWeeklyTransactions(),
      api.getRecentActivities(),
      api.getEngineerRemarks(),
      api.getNotifications().catch(() => ({ notifications: [] })),
    ]).then(([s, m, d, w, a, r, n]) => {
      setStats(s);
      setMonthly(m.map((x) => ({ ...x, label: x.month?.slice(5) || x.month })));
      setDistribution(d.map((x) => ({ name: STATUS_LABELS[x.status] || x.status, value: x.count })));
      setWeekly(w.map((x) => ({ ...x, label: x.day?.slice(5) || x.day })));
      setActivities(a);
      setEngineerRemarks(r || []);
      setRecentNotifs((n?.notifications || []).slice(0, 8));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();

    let es;
    try {
      es = new EventSource(api.getNotificationStreamUrl());
      es.addEventListener('update', (evt) => {
        loadDashboard();
        try {
          const parsed = JSON.parse(evt.data);
          if (parsed?.payload?.title) {
            setLiveToast({
              title: parsed.payload.title,
              message: parsed.payload.message,
              permitId: parsed.payload.permitId,
            });
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setLiveToast(null), 8000);
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* fallback to polling */
    }

    const timer = setInterval(loadDashboard, 5000);
    const clockTimer = setInterval(() => setNowTick((t) => t + 1), 15000);
    return () => {
      clearInterval(timer);
      clearInterval(clockTimer);
      clearTimeout(toastTimerRef.current);
      if (es) es.close();
    };
  }, [loadDashboard]);

  if (loading || !stats) return <div className="loading">Loading dashboard...</div>;

  const statCards = [
    { label: isClient ? 'My Applications' : 'Total Clients', value: isClient ? stats.pendingRequests + stats.approvedPermits : stats.totalClients, icon: 'clients' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: 'permits' },
    { label: 'Approved Permits', value: stats.approvedPermits, icon: 'shield' },
    { label: 'Released Documents', value: stats.releasedDocs, icon: 'reports' },
  ];

  let queueMessage = '';
  if (user?.role === 'municipal_engineer') {
    queueMessage = `${stats.forApproval} application${stats.forApproval === 1 ? '' : 's'} awaiting your approval`;
  } else if (isClient) {
    queueMessage = `${stats.pendingRequests} application${stats.pendingRequests === 1 ? '' : 's'} in progress`;
  } else if (['admin', 'engineering_staff'].includes(user?.role)) {
    queueMessage = `${stats.forApproval} for engineer approval · ${stats.awaitingPayment} awaiting payment`;
  }

  const canAddPermit = hasAccess('permits');
  const canAddClient = hasAccess('clients') && ['engineering_staff', 'municipal_engineer'].includes(user?.role);

  return (
    <div>
      <div className="page-header-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p className="page-subtitle">Manage and track municipal engineering permits &amp; records</p>
          <h1 className="page-title">Dashboard</h1>
        </div>
        {(canAddPermit || canAddClient) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {canAddClient && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/clients?action=new')}
              >
                <Icon name="plus" size={16} /> Add New Client
              </button>
            )}
            {canAddPermit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/permits?action=new')}
              >
                <Icon name="plus" size={16} /> New Permit Application
              </button>
            )}
          </div>
        )}
      </div>

      {liveToast && (
        <div
          className="dashboard-queue-banner"
          style={{
            background: '#fef2f2',
            borderColor: '#dc2626',
            justifyContent: 'space-between',
            cursor: liveToast.permitId ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (liveToast.permitId) navigate(`/permits?open=${liveToast.permitId}`);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="bell" size={16} />
            <span><strong>{liveToast.title}:</strong> {liveToast.message}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); setLiveToast(null); }}
          >
            Dismiss
          </button>
        </div>
      )}

      {queueMessage && (
        <div className="dashboard-queue-banner">
          <Icon name="bell" size={16} />
          <span>{queueMessage}</span>
        </div>
      )}

      {/* Floating Stat Cards - 4 Column Full Width */}
      <div className="stat-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="icon">
              <Icon name={s.icon} size={20} />
            </div>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Real-Time Notifications & Engineer Remarks Feed */}
      <div className="chart-grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3>Real-Time Notifications</h3>
              <span className="live-pill">
                <span className="live-dot" /> Live
              </span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}>
              Refresh
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentNotifs.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>No notifications yet.</div>
            ) : (
              <div className="remarks-feed">
                {recentNotifs.map((n) => (
                  <div
                    key={n.id}
                    className="remarks-feed-item"
                    onClick={() => n.permit_id && navigate(`/permits?open=${n.permit_id}`)}
                    style={{ cursor: n.permit_id ? 'pointer' : 'default' }}
                  >
                    <div className="remarks-feed-top">
                      <strong>{n.title}</strong>
                      <span className="doc-meta" title={formatDateTime(n.created_at)}>
                        {timeAgo(n.created_at)} &middot; {formatDateTime(n.created_at)}
                      </span>
                    </div>
                    <div className="remarks-feed-body">{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3>Engineer Remarks</h3>
              <span className="live-pill">
                <span className="live-dot" /> Live
              </span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}>
              Refresh
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {engineerRemarks.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>No engineer remarks yet.</div>
            ) : (
              <div className="remarks-feed">
                {engineerRemarks.map((item) => (
                  <div
                    key={`${item.source}-${item.id}`}
                    className="remarks-feed-item"
                    onClick={() => navigate(`/permits?open=${item.permit_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="remarks-feed-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong>{item.application_no}</strong>
                        <span>&mdash; {item.client_name}</span>
                        <span className={`badge badge-${item.status}`}>
                          {DOCUMENT_STATUS_LABELS[item.status] || STATUS_LABELS[item.status] || item.status}
                        </span>
                        {item.source === 'document' && item.document_type && (
                          <span className="doc-meta">({item.document_type})</span>
                        )}
                      </div>
                      <span className="doc-meta" title={formatDateTime(item.created_at)}>
                        {timeAgo(item.created_at)} &middot; {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <div className="remarks-feed-body">
                      {item.remarks ? (
                        <span>&ldquo;{item.remarks}&rdquo;</span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>No remarks text</span>
                      )}
                      {item.engineer_name && (
                        <span className="doc-meta" style={{ marginLeft: 8 }}>&mdash; {item.engineer_name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-Column Financial Summary Cards (staff roles only) */}
      {!isClient && (
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Today&apos;s Transactions</h3>
          </div>
          <div className="card-body">
            <div className="stat-card" style={{ border: 'none', boxShadow: 'none', padding: 0 }}>
              <div className="value" style={{ fontSize: 32 }}>{stats.todayTransactions}</div>
              <div className="label">transactions processed today</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Monthly Revenue</h3>
          </div>
          <div className="card-body">
            <div className="value" style={{ fontSize: 32, color: 'var(--primary)' }}>{formatCurrency(stats.monthlyRevenue)}</div>
            <div className="label" style={{ marginTop: 4, color: 'var(--red-800)', fontWeight: 600 }}>Collected fee totals for current period</div>
          </div>
        </div>
      </div>
      )}

      {/* 2-Column Side-by-Side Analytics Charts (Stretch 50%/50% Full Width) */}
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Monthly Permit Applications</h3>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            {monthly.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fce8e8" />
                  <XAxis dataKey="label" fontSize={12} stroke="#991b1b" />
                  <YAxis fontSize={12} stroke="#991b1b" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#b91c1c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No permit data yet</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Permit Status Overview</h3>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            {distribution.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={45} label>
                    {distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state">No permit data yet</div>}
          </div>
        </div>
      </div>

      {/* 100% Full Width Income Curve */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>Weekly Income &amp; Payment Transactions</h3>
        </div>
        <div className="card-body" style={{ height: 300 }}>
          {weekly.length > 0 ? (
            <ResponsiveContainer>
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fce8e8" />
                <XAxis dataKey="label" fontSize={12} stroke="#991b1b" />
                <YAxis fontSize={12} stroke="#991b1b" />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line type="monotone" dataKey="total" stroke="#b91c1c" strokeWidth={3} dot={{ r: 5, fill: '#7f1d1d' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No transaction data yet</div>}
        </div>
      </div>

      {/* 100% Full Width Recent System Activities Table */}
      <div className="card">
        <div className="card-header">
          <h3>Recent System Activities</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Permit Type</th>
                <th>Status</th>
                <th>Assigned Staff</th>
                <th>Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No recent activities</td></tr>
              ) : activities.map((a, i) => (
                <tr key={i}>
                  <td><strong>{a.client_name}</strong></td>
                  <td>{PERMIT_TYPES[a.permit_type] || a.permit_type}</td>
                  <td><span className={`badge badge-${a.status}`}>{STATUS_LABELS[a.status]}</span></td>
                  <td>{a.assigned_staff || '-'}</td>
                  <td>{formatDateTime(a.date_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
