import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { api } from '../api/client';
import { Icon, formatCurrency, formatDateTime, PERMIT_TYPES, STATUS_LABELS } from '../components/UI';

const PIE_COLORS = ['#7f1d1d', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fee2e2'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.getMonthlyPermits(),
      api.getStatusDistribution(),
      api.getWeeklyTransactions(),
      api.getRecentActivities(),
    ]).then(([s, m, d, w, a]) => {
      setStats(s);
      setMonthly(m.map((x) => ({ ...x, label: x.month?.slice(5) || x.month })));
      setDistribution(d.map((x) => ({ name: STATUS_LABELS[x.status] || x.status, value: x.count })));
      setWeekly(w.map((x) => ({ ...x, label: x.day?.slice(5) || x.day })));
      setActivities(a);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const statCards = [
    { label: 'Total Clients', value: stats.totalClients, icon: 'clients' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: 'permits' },
    { label: 'Approved Permits', value: stats.approvedPermits, icon: 'shield' },
    { label: 'Released Documents', value: stats.releasedDocs, icon: 'reports' },
  ];

  return (
    <div>
      <div className="page-header-row">
        <div>
          <p className="page-subtitle">Manage and track municipal engineering permits & records</p>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>

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

      {/* 2-Column Financial Summary Cards */}
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Today's Transactions</h3>
            <button className="card-action-btn" title="View Details"><Icon name="payments" size={16} /></button>
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
            <button className="card-action-btn" title="Revenue Overview"><Icon name="reports" size={16} /></button>
          </div>
          <div className="card-body">
            <div className="value" style={{ fontSize: 32, color: 'var(--primary)' }}>{formatCurrency(stats.monthlyRevenue)}</div>
            <div className="label" style={{ marginTop: 4, color: 'var(--red-800)', fontWeight: 600 }}>Collected fee totals for current period</div>
          </div>
        </div>
      </div>

      {/* 2-Column Side-by-Side Analytics Charts (Stretch 50%/50% Full Width) */}
      <div className="chart-grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Monthly Permit Applications</h3>
            <button className="card-action-btn" title="Monthly Trend"><Icon name="permits" size={16} /></button>
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
            <button className="card-action-btn" title="Distribution"><Icon name="shield" size={16} /></button>
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
          <h3>Weekly Income & Payment Transactions</h3>
          <button className="card-action-btn" title="Weekly Curve"><Icon name="payments" size={16} /></button>
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
          <button className="card-action-btn" title="Refresh List"><Icon name="audit" size={16} /></button>
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
