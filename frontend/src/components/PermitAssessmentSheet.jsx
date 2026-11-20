import { useState, useMemo } from 'react';
import { Icon, escapeHtml, printDocumentHtml } from './UI';

const FEE_ROWS = [
  { key: 'filing', label: 'Filing Fees:' },
  { key: 'line_and_grade', label: 'Line and Grade Fees:' },
  { key: 'preliminary_inspection', label: 'Preliminary Inspection & Verification Fees:' },
  { key: 'excavation', label: 'Excavation Fees:' },
  { key: 'building', label: 'Building Fees:' },
  { key: 'electrical', label: 'Electrical Fees:' },
  { key: 'mechanical', label: 'Mechanical Fees:' },
  { key: 'sanitary_plumbing', label: 'Sanitary/Plumbing Fees:' },
  { key: 'electronics', label: 'Electronics Fees:' },
];

function getDefaultFeeKey(permitType) {
  switch (permitType) {
    case 'building':
    case 'occupancy':
    case 'annual_inspection':
      return 'building';
    case 'electrical':
      return 'electrical';
    case 'certificate':
      return 'filing';
    default:
      return 'building';
  }
}

function formatAmount(val) {
  const num = Number(val);
  if (!num) return '';
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseAmount(val) {
  const cleaned = String(val ?? '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export default function PermitAssessmentSheet({ data }) {
  const { permit, signatories = {} } = data;

  const defaultFeeKey = getDefaultFeeKey(permit.permit_type);
  const initialFees = useMemo(() => {
    const map = {};
    for (const row of FEE_ROWS) map[row.key] = '';
    if (Number(permit.total_fee) > 0) {
      map[defaultFeeKey] = String(Number(permit.total_fee).toFixed(2));
    }
    return map;
  }, [permit.id, permit.total_fee, defaultFeeKey]);

  const [editMode, setEditMode] = useState(false);
  const [ownerApplicant, setOwnerApplicant] = useState(permit.client_name || '');
  const [fees, setFees] = useState(initialFees);
  const [othersLabel, setOthersLabel] = useState('');
  const [othersAmount, setOthersAmount] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [assessedByName, setAssessedByName] = useState(signatories.assessed_by_name || 'Engr. Jer Anthony F. Palo');
  const [assessedByTitle, setAssessedByTitle] = useState(
    signatories.assessed_by_title && signatories.assessed_by_title !== 'Engineer III'
      ? signatories.assessed_by_title
      : 'Engineer II',
  );
  const [approvedByName, setApprovedByName] = useState(signatories.approved_by_name || 'Engr. Aireen Mañago-Ubas');
  const [approvedByTitle, setApprovedByTitle] = useState(signatories.approved_by_title || 'Building Official');

  const totalAmount = useMemo(() => {
    const baseSum = FEE_ROWS.reduce((sum, r) => sum + parseAmount(fees[r.key]), 0);
    return baseSum + parseAmount(othersAmount) + parseAmount(penaltyAmount);
  }, [fees, othersAmount, penaltyAmount]);

  const lguShare = totalAmount * 0.8;
  const dpwhShare = totalAmount * 0.05;
  const oboShare = totalAmount * 0.15;

  const handlePrint = () => {
    const feeRowsHtml = FEE_ROWS.map((row) => `
      <tr>
        <td class="fee-label">${escapeHtml(row.label)}</td>
        <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(fees[row.key])))}</span></td>
      </tr>
    `).join('');

    const totalDisplay = formatAmount(totalAmount);

    const bodyHtml = `
      <style>
        .gumaca-box {
          max-width: 660px;
          margin: 12px auto 0;
          padding: 22px 26px 26px;
          border: 1px solid #111111;
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.45;
          color: #111111;
          background: #ffffff;
        }
        .gs-office {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.2px;
          margin-bottom: 22px;
        }
        .gs-owner-row {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          margin-bottom: 22px;
          max-width: 74%;
        }
        .gs-owner-label { white-space: nowrap; }
        .gs-owner-line {
          flex: 1;
          border-bottom: 1px solid #111111;
          min-height: 19px;
          padding: 0 6px 1px;
        }
        .gs-fee-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6px;
        }
        .gs-fee-table td {
          padding: 3px 0;
          vertical-align: bottom;
        }
        .gs-fee-table .fee-label {
          width: 66%;
          padding-right: 18px;
        }
        .gs-fee-table .fee-val {
          width: 34%;
          text-align: right;
        }
        .gs-fee-table .line-val {
          display: block;
          width: 100%;
          min-height: 19px;
          border-bottom: 1px solid #111111;
          padding: 0 6px 1px;
          text-align: right;
        }
        .gs-others-flex {
          display: flex;
          align-items: flex-end;
          gap: 18px;
          padding-right: 18px;
        }
        .gs-others-label { white-space: nowrap; }
        .gs-others-line {
          flex: 1;
          border-bottom: 1px solid #111111;
          min-height: 19px;
          padding: 0 4px 1px;
        }
        .gs-total-row {
          display: flex;
          align-items: baseline;
          margin: 8px 0 6px;
          padding-left: 44%;
          font-weight: 700;
          font-size: 14.5px;
        }
        .gs-total-p { margin-left: 10px; }
        .gs-total-num {
          margin-left: 10px;
          min-width: 110px;
          text-align: right;
        }
        .gs-shares {
          margin: 2px 0 12px 72px;
          border-collapse: collapse;
        }
        .gs-shares td {
          padding: 4px 10px;
          vertical-align: middle;
        }
        .gs-shares .share-name {
          width: 100px;
          text-align: center;
        }
        .gs-shares .share-pct {
          width: 60px;
          text-align: center;
        }
        .gs-shares .share-val {
          width: 155px;
          border-bottom: 1px solid #111111;
          text-align: right;
          padding: 2px 6px;
          min-height: 19px;
        }
        .gs-assessed-wrap {
          margin-top: 6px;
          padding-left: 88px;
        }
        .gs-sig-label {
          margin-bottom: 34px;
        }
        .gs-sig-person {
          text-align: center;
          width: 280px;
          margin: 0 auto 18px;
        }
        .gs-sig-name {
          font-weight: 700;
          font-size: 14.5px;
        }
        .gs-sig-title {
          font-size: 14px;
        }
        .gs-approved-wrap {
          margin-top: 6px;
          padding-left: 72px;
        }
      </style>

      <div class="gumaca-box">
        <div class="gs-office">OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL</div>

        <div class="gs-owner-row">
          <span class="gs-owner-label">Owner/Applicant:</span>
          <span class="gs-owner-line">${escapeHtml(ownerApplicant)}</span>
        </div>

        <table class="gs-fee-table">
          <tbody>
            ${feeRowsHtml}
            <tr>
              <td class="fee-label">
                <div class="gs-others-flex">
                  <span class="gs-others-label">Others:</span>
                  <span class="gs-others-line">${escapeHtml(othersLabel)}</span>
                </div>
              </td>
              <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(othersAmount)))}</span></td>
            </tr>
            <tr>
              <td class="fee-label">Penalty:</td>
              <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(penaltyAmount)))}</span></td>
            </tr>
          </tbody>
        </table>

        <div class="gs-total-row">
          <span>TOTAL</span>
          <span class="gs-total-p">P</span>
          ${totalDisplay ? `<span class="gs-total-num">${escapeHtml(totalDisplay)}</span>` : ''}
        </div>

        <table class="gs-shares">
          <tbody>
            <tr>
              <td class="share-name">LGU</td>
              <td class="share-pct">80%</td>
              <td class="share-val">${escapeHtml(formatAmount(lguShare))}</td>
            </tr>
            <tr>
              <td class="share-name">DPWH (5%)</td>
              <td class="share-pct" rowspan="2">20%</td>
              <td class="share-val">${escapeHtml(formatAmount(dpwhShare))}</td>
            </tr>
            <tr>
              <td class="share-name">OBO (15%)</td>
              <td class="share-val">${escapeHtml(formatAmount(oboShare))}</td>
            </tr>
          </tbody>
        </table>

        <div class="gs-assessed-wrap">
          <div class="gs-sig-label">Assessed by:</div>
          <div class="gs-sig-person">
            <div class="gs-sig-name">${escapeHtml(assessedByName)}</div>
            <div class="gs-sig-title">${escapeHtml(assessedByTitle)}</div>
          </div>
        </div>

        <div class="gs-approved-wrap">
          <div class="gs-sig-label">Approved by:</div>
          <div class="gs-sig-person" style="margin-bottom: 0;">
            <div class="gs-sig-name">${escapeHtml(approvedByName)}</div>
            <div class="gs-sig-title">${escapeHtml(approvedByTitle)}</div>
          </div>
        </div>
      </div>
    `;

    printDocumentHtml({
      title: `Permit Assessment - ${permit.application_no}`,
      bodyHtml,
    });
  };

  return (
    <div>
      <div className="receipt-actions no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEditMode((v) => !v)}
        >
          <Icon name="edit" size={15} /> {editMode ? 'Done Editing Fields' : 'Edit Fees / Fields Before Print'}
        </button>
        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          <Icon name="print" size={16} /> Print Permit
        </button>
      </div>

      {editMode && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="form-group">
              <label>Owner/Applicant</label>
              <input className="form-control" value={ownerApplicant} onChange={(e) => setOwnerApplicant(e.target.value)} />
            </div>
            <div className="form-row">
              {FEE_ROWS.map((row) => (
                <div className="form-group" key={row.key}>
                  <label>{row.label.replace(/:$/, '')}</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={fees[row.key]}
                    onChange={(e) => setFees((prev) => ({ ...prev, [row.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Others (Description)</label>
                <input className="form-control" value={othersLabel} onChange={(e) => setOthersLabel(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Others (Amount)</label>
                <input className="form-control" type="number" min="0" step="0.01" placeholder="0.00" value={othersAmount} onChange={(e) => setOthersAmount(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Penalty</label>
                <input className="form-control" type="number" min="0" step="0.01" placeholder="0.00" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Assessed by (Name)</label>
                <input className="form-control" value={assessedByName} onChange={(e) => setAssessedByName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Assessed by (Title)</label>
                <input className="form-control" value={assessedByTitle} onChange={(e) => setAssessedByTitle(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Approved by (Name)</label>
                <input className="form-control" value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Approved by (Title)</label>
                <input className="form-control" value={approvedByTitle} onChange={(e) => setApprovedByTitle(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exact On-Screen Preview matching the Office of the Municipal Engineer/Building Official Assessment Form */}
      <div
        className="permit-document"
        style={{
          fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
          fontSize: 14,
          lineHeight: 1.45,
          color: '#111111',
          background: '#ffffff',
          maxWidth: 660,
          margin: '0 auto',
          padding: '22px 26px 26px',
          border: '1px solid #111111',
          borderRadius: 0,
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, letterSpacing: '0.2px', marginBottom: 22 }}>
          OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 22, maxWidth: '74%' }}>
          <span style={{ whiteSpace: 'nowrap' }}>Owner/Applicant:</span>
          <span style={{ flex: 1, borderBottom: '1px solid #111111', minHeight: 20, padding: '0 6px 1px' }}>
            {ownerApplicant}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
          <tbody>
            {FEE_ROWS.map((row) => (
              <tr key={row.key}>
                <td style={{ width: '66%', padding: '3px 18px 3px 0', verticalAlign: 'bottom', border: 'none' }}>
                  {row.label}
                </td>
                <td style={{ width: '34%', padding: '3px 0', verticalAlign: 'bottom', border: 'none' }}>
                  <div style={{ borderBottom: '1px solid #111111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px' }}>
                    {formatAmount(parseAmount(fees[row.key]))}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '3px 18px 3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Others:</span>
                  <span style={{ flex: 1, borderBottom: '1px solid #111111', minHeight: 20, padding: '0 4px 1px' }}>
                    {othersLabel}
                  </span>
                </div>
              </td>
              <td style={{ padding: '3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ borderBottom: '1px solid #111111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px' }}>
                  {formatAmount(parseAmount(othersAmount))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ width: '66%', padding: '3px 18px 3px 0', verticalAlign: 'bottom', border: 'none' }}>
                Penalty:
              </td>
              <td style={{ width: '34%', padding: '3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ borderBottom: '1px solid #111111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px' }}>
                  {formatAmount(parseAmount(penaltyAmount))}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', alignItems: 'baseline', margin: '8px 0 6px', paddingLeft: '44%', fontWeight: 700, fontSize: 14.5 }}>
          <span>TOTAL</span>
          <span style={{ marginLeft: 10 }}>P</span>
          {totalAmount > 0 && (
            <span style={{ marginLeft: 10, minWidth: 110, textAlign: 'right' }}>
              {formatAmount(totalAmount)}
            </span>
          )}
        </div>

        <table style={{ width: 'auto', margin: '2px 0 12px 72px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: 100, textAlign: 'center', padding: '4px 10px', border: 'none' }}>LGU</td>
              <td style={{ width: 60, textAlign: 'center', padding: '4px 10px', border: 'none' }}>80%</td>
              <td style={{ width: 155, borderBottom: '1px solid #111111', textAlign: 'right', padding: '2px 6px', minHeight: 20 }}>
                {formatAmount(lguShare)}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center', padding: '4px 10px', border: 'none' }}>DPWH (5%)</td>
              <td rowSpan={2} style={{ textAlign: 'center', padding: '4px 10px', verticalAlign: 'middle', border: 'none' }}>20%</td>
              <td style={{ borderBottom: '1px solid #111111', textAlign: 'right', padding: '2px 6px', minHeight: 20 }}>
                {formatAmount(dpwhShare)}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center', padding: '4px 10px', border: 'none' }}>OBO (15%)</td>
              <td style={{ borderBottom: '1px solid #111111', textAlign: 'right', padding: '2px 6px', minHeight: 20 }}>
                {formatAmount(oboShare)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 6, paddingLeft: 88 }}>
          <div style={{ marginBottom: 34 }}>Assessed by:</div>
          <div style={{ textAlign: 'center', width: 280, margin: '0 auto 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{assessedByName}</div>
            <div>{assessedByTitle}</div>
          </div>
        </div>

        <div style={{ marginTop: 6, paddingLeft: 72 }}>
          <div style={{ marginBottom: 34 }}>Approved by:</div>
          <div style={{ textAlign: 'center', width: 280, margin: '0 auto' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{approvedByName}</div>
            <div>{approvedByTitle}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
