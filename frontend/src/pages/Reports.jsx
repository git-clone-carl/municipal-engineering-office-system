import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { PERMIT_TYPES, formatCurrency, formatDateTime, CustomDatePicker, Icon } from '../components/UI';

export default function Reports() {
  const [tab, setTab] = useState('collection');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = tab === 'collection'
        ? await api.getCollectionReport({ from, to })
        : await api.getPermitReport({ from, to });
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!data) return;
    const period = `${from || 'All time'} to ${to || 'All time'}`;
    const today = new Date().toISOString().split('T')[0];
    let wb;

    if (tab === 'collection') {
      const summaryRows = [
        ['MUNICIPAL ENGINEERING OFFICE'],
        ['Collection Report'],
        [`Period: ${period}`],
        [],
        ['Permit Type', 'Transactions', 'Total Amount'],
        ...data.summary.map((r) => [PERMIT_TYPES[r.permit_type] || r.permit_type, r.transaction_count, r.total_amount]),
        ['TOTAL', '', data.grandTotal],
      ];
      const detailRows = [
        ['MUNICIPAL ENGINEERING OFFICE'],
        ['Collection Report - Detailed Transactions'],
        [`Period: ${period}`],
        [],
        ['OR No.', 'Date', 'Client', 'Permit Type', 'Amount', 'Cashier'],
        ...data.details.map((r) => [
          r.or_number,
          formatDateTime(r.payment_date),
          r.client_name,
          PERMIT_TYPES[r.permit_type] || r.permit_type,
          r.amount,
          r.cashier || '-',
        ]),
      ];
      wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 16 }];
      const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
      detailSheet['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Collection Summary');
      XLSX.utils.book_append_sheet(wb, detailSheet, 'Transactions');
      XLSX.writeFile(wb, `Collection_Report_${today}.xlsx`);
    } else {
      const statusRows = [
        ['MUNICIPAL ENGINEERING OFFICE'],
        ['Permit Report - Status Summary'],
        [`Period: ${period}`],
        [],
        ['Status', 'Count'],
        ...data.statusCounts.map((s) => [s.status, s.count]),
        ['TOTAL', data.total],
      ];
      const permitRows = [
        ['MUNICIPAL ENGINEERING OFFICE'],
        ['Permit Report - Applications'],
        [`Period: ${period}`],
        [],
        ['Application No.', 'Client', 'Permit Type', 'Status', 'Assigned Staff', 'Fee'],
        ...data.permits.map((p) => [
          p.application_no,
          p.client_name,
          PERMIT_TYPES[p.permit_type] || p.permit_type,
          p.status,
          p.assigned_staff || '-',
          p.total_fee,
        ]),
      ];
      wb = XLSX.utils.book_new();
      const statusSheet = XLSX.utils.aoa_to_sheet(statusRows);
      statusSheet['!cols'] = [{ wch: 20 }, { wch: 12 }];
      const permitSheet = XLSX.utils.aoa_to_sheet(permitRows);
      permitSheet['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, statusSheet, 'Status Summary');
      XLSX.utils.book_append_sheet(wb, permitSheet, 'Applications');
      XLSX.writeFile(wb, `Permit_Report_${today}.xlsx`);
    }
  };

  return (
    <div>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">Generate collection and permit reports</p>

      <div className="tabs">
        <button className={`tab ${tab === 'collection' ? 'active' : ''}`} onClick={() => setTab('collection')}>Collection Report</button>
        <button className={`tab ${tab === 'permits' ? 'active' : ''}`} onClick={() => setTab('permits')}>Permit Report</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="toolbar">
            <div className="toolbar-left" style={{ alignItems: 'flex-end', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>From Date</label>
                <CustomDatePicker value={from} onChange={setFrom} placeholder="Select start date" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>To Date</label>
                <CustomDatePicker value={to} onChange={setTo} placeholder="Select end date" />
              </div>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-primary" onClick={generate}>Generate Report</button>
              <button className="btn btn-secondary" onClick={exportExcel} disabled={!data}><Icon name="reports" size={16} /> Export Excel</button>
              <button className="btn btn-secondary" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="loading">Generating report...</div>}

      {!loading && data && tab === 'collection' && (
        <>
          <div className="chart-grid">
            <div className="card">
              <div className="card-header"><h3>Collection Summary</h3></div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Permit Type</th><th>Transactions</th><th>Total Amount</th></tr>
                  </thead>
                  <tbody>
                    {data.summary.map((row) => (
                      <tr key={row.permit_type}>
                        <td>{PERMIT_TYPES[row.permit_type]}</td>
                        <td>{row.transaction_count}</td>
                        <td>{formatCurrency(row.total_amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2}><strong>Total</strong></td>
                      <td><strong>{formatCurrency(data.grandTotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Collection Chart</h3></div>
              <div className="card-body" style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={data.summary.map((r) => ({ ...r, label: PERMIT_TYPES[r.permit_type] }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={12} angle={-10} textAnchor="end" height={70} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="total_amount" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Detailed Transactions</h3></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>OR No.</th><th>Date</th><th>Client</th><th>Permit Type</th><th>Amount</th><th>Cashier</th></tr>
                </thead>
                <tbody>
                  {data.details.map((row) => (
                    <tr key={row.or_number}>
                      <td>{row.or_number}</td>
                      <td>{formatDateTime(row.payment_date)}</td>
                      <td>{row.client_name}</td>
                      <td>{PERMIT_TYPES[row.permit_type]}</td>
                      <td>{formatCurrency(row.amount)}</td>
                      <td>{row.cashier || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && data && tab === 'permits' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3>Permit Status Summary</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {data.statusCounts.map((row) => <tr key={row.status}><td>{row.status}</td><td>{row.count}</td></tr>)}
                  <tr><td><strong>Total</strong></td><td><strong>{data.total}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Permit Applications</h3></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Application No.</th><th>Client</th><th>Permit Type</th><th>Status</th><th>Assigned Staff</th><th>Fee</th></tr>
                </thead>
                <tbody>
                  {data.permits.map((row) => (
                    <tr key={row.id}>
                      <td>{row.application_no}</td>
                      <td>{row.client_name}</td>
                      <td>{PERMIT_TYPES[row.permit_type]}</td>
                      <td>{row.status}</td>
                      <td>{row.assigned_staff || '-'}</td>
                      <td>{formatCurrency(row.total_fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
