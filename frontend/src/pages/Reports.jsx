import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  PERMIT_TYPES, STATUS_LABELS, formatCurrency, formatDateTime,
  CustomDatePicker, Icon, printDocumentHtml, buildFormalHeaderHtml, escapeHtml,
} from '../components/UI';

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState('collection');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [office, setOffice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getOfficeInfo().then(setOffice).catch(() => {});
  }, []);

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

  const periodLabel = from || to
    ? `${from || 'Beginning'} to ${to || 'Present'}`
    : 'All Records';

  const printReport = () => {
    if (!data) return;
    const generatedAt = new Date().toLocaleString();
    const reportTitle = tab === 'collection' ? 'COLLECTION REPORT' : 'PERMIT APPLICATIONS REPORT';

    const headerHtml = buildFormalHeaderHtml({
      office,
      title: reportTitle,
      subtitle: `Period Covered: ${periodLabel}  •  Generated: ${generatedAt}`,
    });

    let tablesHtml = '';
    if (tab === 'collection') {
      const summaryRowsHtml = data.summary.map((row) => `
        <tr>
          <td>${escapeHtml(PERMIT_TYPES[row.permit_type] || row.permit_type)}</td>
          <td class="num">${escapeHtml(row.transaction_count)}</td>
          <td class="num">${escapeHtml(formatCurrency(row.total_amount))}</td>
        </tr>
      `).join('');

      const detailRowsHtml = data.details.length
        ? data.details.map((row) => `
            <tr>
              <td>${escapeHtml(row.or_number)}</td>
              <td>${escapeHtml(formatDateTime(row.payment_date))}</td>
              <td>${escapeHtml(row.client_name)}</td>
              <td>${escapeHtml(PERMIT_TYPES[row.permit_type] || row.permit_type)}</td>
              <td class="num">${escapeHtml(formatCurrency(row.amount))}</td>
              <td>${escapeHtml(row.cashier || '-')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No transactions found for this period.</td></tr>';

      tablesHtml = `
        <div class="section-title">I. Collection Summary by Permit Type</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Permit Type</th>
              <th class="num">Transactions</th>
              <th class="num">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRowsHtml}
            <tr class="total-row">
              <td colspan="2">GRAND TOTAL</td>
              <td class="num">${escapeHtml(formatCurrency(data.grandTotal))}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">II. Detailed Payment Transactions</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>OR No.</th>
              <th>Date &amp; Time</th>
              <th>Client / Payor</th>
              <th>Permit Type</th>
              <th class="num">Amount</th>
              <th>Cashier</th>
            </tr>
          </thead>
          <tbody>
            ${detailRowsHtml}
          </tbody>
        </table>
      `;
    } else {
      const statusRowsHtml = data.statusCounts.map((row) => `
        <tr>
          <td>${escapeHtml(STATUS_LABELS[row.status] || row.status)}</td>
          <td class="num">${escapeHtml(row.count)}</td>
        </tr>
      `).join('');

      const permitRowsHtml = data.permits.length
        ? data.permits.map((row) => `
            <tr>
              <td>${escapeHtml(row.application_no)}</td>
              <td>${escapeHtml(row.client_name)}</td>
              <td>${escapeHtml(PERMIT_TYPES[row.permit_type] || row.permit_type)}</td>
              <td>${escapeHtml(STATUS_LABELS[row.status] || row.status)}</td>
              <td>${escapeHtml(row.assigned_staff || '-')}</td>
              <td class="num">${escapeHtml(formatCurrency(row.total_fee))}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="6" style="text-align:center;color:#6b7280;">No permit applications found for this period.</td></tr>';

      tablesHtml = `
        <div class="section-title">I. Permit Status Summary</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Application Status</th>
              <th class="num">Count</th>
            </tr>
          </thead>
          <tbody>
            ${statusRowsHtml}
            <tr class="total-row">
              <td>TOTAL APPLICATIONS</td>
              <td class="num">${escapeHtml(data.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">II. Permit Applications List</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Application No.</th>
              <th>Client / Applicant</th>
              <th>Permit Type</th>
              <th>Status</th>
              <th>Assigned Staff</th>
              <th class="num">Permit Fee</th>
            </tr>
          </thead>
          <tbody>
            ${permitRowsHtml}
          </tbody>
        </table>
      `;
    }

    const bodyHtml = `
      ${headerHtml}
      ${tablesHtml}
      <div class="signatory-grid">
        <div class="sig-block left">
          <div style="font-size:10px;color:#4b5563;">Prepared by:</div>
          <div class="sig-line">${escapeHtml(user?.full_name || 'Office Staff')}</div>
          <div class="sig-role">Municipal Engineering Office Staff</div>
        </div>
        <div class="sig-block">
          <div style="font-size:10px;color:#4b5563;">Noted / Approved by:</div>
          <div class="sig-line">${escapeHtml(office?.municipal_engineer || 'Municipal Engineer')}</div>
          <div class="sig-role">Municipal Engineer</div>
        </div>
      </div>
    `;

    printDocumentHtml({
      title: `${reportTitle} - ${periodLabel}`,
      bodyHtml,
      pageSize: 'A4 portrait',
    });
  };

  const buildFormalSheet = (rows, colCount, colWidths) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = colWidths;
    const lastCol = Math.max(0, colCount - 1);
    sheet['!merges'] = [0, 1, 2, 3, 4, 5, 6].map((r) => ({
      s: { r, c: 0 },
      e: { r, c: lastCol },
    }));
    return sheet;
  };

  const exportExcel = () => {
    if (!data) return;
    const today = new Date().toISOString().split('T')[0];
    const generatedAt = new Date().toLocaleString();
    const officeName = (office?.office_name || 'MUNICIPAL ENGINEERING OFFICE').toUpperCase();
    const municipality = office?.municipality || 'Municipality of Gumaca, Quezon';
    const engineer = office?.municipal_engineer || 'Municipal Engineer';
    const preparedBy = user?.full_name || 'Office Staff';

    const makeHeader = (title) => [
      ['REPUBLIC OF THE PHILIPPINES'],
      ['PROVINCE OF QUEZON'],
      [municipality.toUpperCase()],
      [officeName],
      [title],
      [`Period Covered: ${periodLabel}`],
      [`Generated: ${generatedAt}`],
      [],
    ];

    const makeSignatories = () => [
      [],
      ['Prepared by:', '', 'Noted by:'],
      [preparedBy, '', engineer],
      ['Municipal Engineering Office Staff', '', 'Municipal Engineer'],
    ];

    const wb = XLSX.utils.book_new();

    if (tab === 'collection') {
      const summaryRows = [
        ...makeHeader('COLLECTION REPORT - SUMMARY'),
        ['Permit Type', 'Transactions', 'Total Amount (PHP)'],
        ...data.summary.map((r) => [
          PERMIT_TYPES[r.permit_type] || r.permit_type,
          Number(r.transaction_count) || 0,
          Number(r.total_amount) || 0,
        ]),
        ['GRAND TOTAL', '', Number(data.grandTotal) || 0],
        ...makeSignatories(),
      ];

      const detailRows = [
        ...makeHeader('COLLECTION REPORT - DETAILED TRANSACTIONS'),
        ['OR No.', 'Date & Time', 'Client / Payor', 'Permit Type', 'Amount (PHP)', 'Cashier'],
        ...data.details.map((r) => [
          r.or_number,
          formatDateTime(r.payment_date),
          r.client_name,
          PERMIT_TYPES[r.permit_type] || r.permit_type,
          Number(r.amount) || 0,
          r.cashier || '-',
        ]),
        ['', '', '', 'GRAND TOTAL', Number(data.grandTotal) || 0, ''],
        ...makeSignatories(),
      ];

      const summarySheet = buildFormalSheet(summaryRows, 3, [{ wch: 26 }, { wch: 16 }, { wch: 20 }]);
      const detailSheet = buildFormalSheet(detailRows, 6, [
        { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 22 },
      ]);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Collection Summary');
      XLSX.utils.book_append_sheet(wb, detailSheet, 'Transactions');
      XLSX.writeFile(wb, `Collection_Report_${today}.xlsx`);
    } else {
      const statusRows = [
        ...makeHeader('PERMIT REPORT - STATUS SUMMARY'),
        ['Application Status', 'Count'],
        ...data.statusCounts.map((s) => [STATUS_LABELS[s.status] || s.status, Number(s.count) || 0]),
        ['TOTAL APPLICATIONS', Number(data.total) || 0],
        ...makeSignatories(),
      ];

      const permitRows = [
        ...makeHeader('PERMIT REPORT - APPLICATIONS LIST'),
        ['Application No.', 'Client / Applicant', 'Permit Type', 'Status', 'Assigned Staff', 'Permit Fee (PHP)'],
        ...data.permits.map((p) => [
          p.application_no,
          p.client_name,
          PERMIT_TYPES[p.permit_type] || p.permit_type,
          STATUS_LABELS[p.status] || p.status,
          p.assigned_staff || '-',
          Number(p.total_fee) || 0,
        ]),
        ...makeSignatories(),
      ];

      const statusSheet = buildFormalSheet(statusRows, 2, [{ wch: 26 }, { wch: 16 }]);
      const permitSheet = buildFormalSheet(permitRows, 6, [
        { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
      ]);
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
        <button className={`tab ${tab === 'collection' ? 'active' : ''}`} onClick={() => { setTab('collection'); setData(null); }}>Collection Report</button>
        <button className={`tab ${tab === 'permits' ? 'active' : ''}`} onClick={() => { setTab('permits'); setData(null); }}>Permit Report</button>
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
              <button className="btn btn-secondary" onClick={printReport} disabled={!data}><Icon name="print" size={16} /> Print / PDF</button>
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
                  {data.statusCounts.map((row) => <tr key={row.status}><td>{STATUS_LABELS[row.status] || row.status}</td><td>{row.count}</td></tr>)}
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
                      <td>{STATUS_LABELS[row.status] || row.status}</td>
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
