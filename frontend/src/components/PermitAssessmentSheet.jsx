import { useState, useMemo } from 'react';
import { Icon, PERMIT_TYPES, escapeHtml, printDocumentHtml } from './UI';

const FEE_ROWS = [
  { key: 'use_occupancy', label: 'Use/Occupancy Fees' },
  { key: 'change_of_use', label: 'Change of Use/Occupancy Fees' },
  { key: 'building_inspection', label: 'Building Inspection Fees' },
  { key: 'sanitary_plumbing', label: 'Sanitary/Plumbing Inspection Fees' },
  { key: 'electrical_inspection', label: 'Electrical Inspection Fees' },
  { key: 'mechanical_inspection', label: 'Mechanical Inspection Fees' },
  { key: 'electronics_inspection', label: 'Electronics Inspection Fees' },
  { key: 'certification', label: 'Certification Fees' },
];

function getDefaultFeeKey(permitType) {
  switch (permitType) {
    case 'occupancy':
      return 'use_occupancy';
    case 'building':
    case 'annual_inspection':
      return 'building_inspection';
    case 'electrical':
      return 'electrical_inspection';
    case 'certificate':
      return 'certification';
    default:
      return 'building_inspection';
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

  const defaultProjectType = useMemo(() => {
    const base = PERMIT_TYPES[permit.permit_type] || permit.permit_type || '';
    if (permit.nature_of_construction) {
      return `${base} - ${permit.nature_of_construction}`;
    }
    return base;
  }, [permit.permit_type, permit.nature_of_construction]);

  const [editMode, setEditMode] = useState(false);
  const [ownerApplicant, setOwnerApplicant] = useState(permit.client_name || '');
  const [typeOfProject, setTypeOfProject] = useState(defaultProjectType);
  const [occupancyUse, setOccupancyUse] = useState(permit.building_type || '');
  const [occupancyGroup, setOccupancyGroup] = useState('');
  const [location, setLocation] = useState(permit.project_location || permit.client_address || '');
  const [fees, setFees] = useState(initialFees);
  const [othersLabel1, setOthersLabel1] = useState('');
  const [othersAmount1, setOthersAmount1] = useState('');
  const [othersLabel2, setOthersLabel2] = useState('');
  const [othersAmount2, setOthersAmount2] = useState('');
  const [assessedByName, setAssessedByName] = useState(signatories.assessed_by_name || 'Engr. Jer Anthony F. Palo');
  const [assessedByTitle, setAssessedByTitle] = useState(signatories.assessed_by_title || 'Engineer III');
  const [approvedByName, setApprovedByName] = useState(signatories.approved_by_name || 'Engr. Aireen Mañago-Ubas');
  const [approvedByTitle, setApprovedByTitle] = useState(signatories.approved_by_title || 'Building Official');

  const totalAmount = useMemo(() => {
    const baseSum = FEE_ROWS.reduce((sum, r) => sum + parseAmount(fees[r.key]), 0);
    return baseSum + parseAmount(othersAmount1) + parseAmount(othersAmount2);
  }, [fees, othersAmount1, othersAmount2]);

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

    const bodyHtml = `
      <style>
        .gumaca-sheet {
          max-width: 680px;
          margin: 0 auto;
          padding: 8px 18px 20px;
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.45;
          color: #111111;
        }
        .gs-header {
          text-align: center;
          margin-bottom: 22px;
        }
        .gs-header .gs-rep { font-size: 14.5px; }
        .gs-header .gs-mun { font-size: 15.5px; font-weight: 700; letter-spacing: 0.3px; }
        .gs-header .gs-prov { font-size: 14.5px; }
        .gs-header .gs-sep { font-size: 13px; margin: 2px 0 18px; letter-spacing: 1px; }
        .gs-header .gs-office { font-size: 15px; font-weight: 700; letter-spacing: 0.2px; }

        .gs-fields { margin-bottom: 28px; }
        .gs-field-row {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          margin-bottom: 6px;
        }
        .gs-field-label { white-space: nowrap; }
        .gs-line {
          flex: 1;
          border-bottom: 1px solid #111111;
          min-height: 19px;
          padding: 0 6px 1px;
        }
        .gs-group-line {
          width: 110px;
          flex: 0 0 110px;
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
          padding-right: 12px;
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
          gap: 12px;
          padding-right: 24px;
        }
        .gs-others-label { width: 58px; flex: 0 0 58px; }
        .gs-others-line {
          flex: 1;
          border-bottom: 1px solid #111111;
          min-height: 19px;
          padding: 0 4px 1px;
        }
        .gs-total-label {
          text-align: right;
          padding-right: 18px !important;
          font-weight: 400;
        }
        .gs-total-currency {
          display: inline-block;
          margin-left: 16px;
        }

        .gs-shares {
          margin: 10px 0 34px 56px;
          border-collapse: collapse;
        }
        .gs-shares td {
          padding: 4px 8px;
          vertical-align: middle;
        }
        .gs-shares .share-name { width: 115px; text-align: center; }
        .gs-shares .share-pct { width: 65px; text-align: center; }
        .gs-shares .share-val {
          width: 175px;
          border-bottom: 1px solid #111111;
          text-align: right;
          padding: 2px 6px;
        }

        .gs-signatories {
          margin-top: 20px;
          padding-left: 70px;
        }
        .gs-sig-block {
          margin-bottom: 34px;
        }
        .gs-sig-label {
          margin-bottom: 22px;
        }
        .gs-sig-person {
          text-align: center;
          width: 280px;
          margin-left: 120px;
        }
        .gs-sig-name {
          font-weight: 700;
          font-size: 14.5px;
        }
        .gs-sig-title {
          font-size: 14px;
        }
      </style>

      <div class="gumaca-sheet">
        <div class="gs-header">
          <div class="gs-rep">Republic of the Philippines</div>
          <div class="gs-mun">MUNICIPALITY OF GUMACA</div>
          <div class="gs-prov">Province of Quezon</div>
          <div class="gs-sep">oo000oo</div>
          <div class="gs-office">OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL</div>
        </div>

        <div class="gs-fields">
          <div class="gs-field-row">
            <span class="gs-field-label">Owner/Applicant:</span>
            <span class="gs-line">${escapeHtml(ownerApplicant)}</span>
          </div>
          <div class="gs-field-row">
            <span class="gs-field-label">Type of Project:</span>
            <span class="gs-line">${escapeHtml(typeOfProject)}</span>
          </div>
          <div class="gs-field-row">
            <span class="gs-field-label">Use or Character of Occupancy:</span>
            <span class="gs-line">${escapeHtml(occupancyUse)}</span>
            <span class="gs-field-label">Group:</span>
            <span class="gs-group-line">${escapeHtml(occupancyGroup)}</span>
          </div>
          <div class="gs-field-row">
            <span class="gs-field-label">Location:</span>
            <span class="gs-line">${escapeHtml(location)}</span>
          </div>
        </div>

        <table class="gs-fee-table">
          <tbody>
            ${feeRowsHtml}
            <tr>
              <td class="fee-label">
                <div class="gs-others-flex">
                  <span class="gs-others-label">Others</span>
                  <span class="gs-others-line">${escapeHtml(othersLabel1)}</span>
                </div>
              </td>
              <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(othersAmount1)))}</span></td>
            </tr>
            <tr>
              <td class="fee-label">
                <div class="gs-others-flex">
                  <span class="gs-others-label"></span>
                  <span class="gs-others-line">${escapeHtml(othersLabel2)}</span>
                </div>
              </td>
              <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(othersAmount2)))}</span></td>
            </tr>
            <tr>
              <td class="fee-label gs-total-label">Total<span class="gs-total-currency">P</span></td>
              <td class="fee-val"><span class="line-val" style="font-weight:700;">${escapeHtml(formatAmount(totalAmount))}</span></td>
            </tr>
          </tbody>
        </table>

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

        <div class="gs-signatories">
          <div class="gs-sig-block">
            <div class="gs-sig-label">Assessed by:</div>
            <div class="gs-sig-person">
              <div class="gs-sig-name">${escapeHtml(assessedByName)}</div>
              <div class="gs-sig-title">${escapeHtml(assessedByTitle)}</div>
            </div>
          </div>
          <div class="gs-sig-block">
            <div class="gs-sig-label">Approved by:</div>
            <div class="gs-sig-person">
              <div class="gs-sig-name">${escapeHtml(approvedByName)}</div>
              <div class="gs-sig-title">${escapeHtml(approvedByTitle)}</div>
            </div>
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
            <div className="form-row">
              <div className="form-group">
                <label>Owner/Applicant</label>
                <input className="form-control" value={ownerApplicant} onChange={(e) => setOwnerApplicant(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Type of Project</label>
                <input className="form-control" value={typeOfProject} onChange={(e) => setTypeOfProject(e.target.value)} />
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Use or Character of Occupancy</label>
                <input className="form-control" value={occupancyUse} onChange={(e) => setOccupancyUse(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Group</label>
                <input className="form-control" placeholder="e.g. A, B, C" value={occupancyGroup} onChange={(e) => setOccupancyGroup(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input className="form-control" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              {FEE_ROWS.map((row) => (
                <div className="form-group" key={row.key}>
                  <label>{row.label}</label>
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
            <div className="form-row">
              <div className="form-group">
                <label>Others (Line 1 Description)</label>
                <input className="form-control" value={othersLabel1} onChange={(e) => setOthersLabel1(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Others (Line 1 Amount)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={othersAmount1} onChange={(e) => setOthersAmount1(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Others (Line 2 Description)</label>
                <input className="form-control" value={othersLabel2} onChange={(e) => setOthersLabel2(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Others (Line 2 Amount)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={othersAmount2} onChange={(e) => setOthersAmount2(e.target.value)} />
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

      {/* Exact On-Screen Preview matching the Gumaca Printed Permit Form */}
      <div
        className="permit-document"
        style={{
          fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
          fontSize: 14,
          lineHeight: 1.45,
          color: '#111111',
          background: '#ffffff',
          maxWidth: 680,
          padding: '28px 34px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 14.5 }}>Republic of the Philippines</div>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '0.3px' }}>MUNICIPALITY OF GUMACA</div>
          <div style={{ fontSize: 14.5 }}>Province of Quezon</div>
          <div style={{ fontSize: 13, margin: '2px 0 18px', letterSpacing: '1px' }}>oo000oo</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL
          </div>
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
            <span style={{ whiteSpace: 'nowrap' }}>Owner/Applicant:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #111', minHeight: 20, padding: '0 6px 1px' }}>{ownerApplicant}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
            <span style={{ whiteSpace: 'nowrap' }}>Type of Project:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #111', minHeight: 20, padding: '0 6px 1px' }}>{typeOfProject}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
            <span style={{ whiteSpace: 'nowrap' }}>Use or Character of Occupancy:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #111', minHeight: 20, padding: '0 6px 1px' }}>{occupancyUse}</span>
            <span style={{ whiteSpace: 'nowrap' }}>Group:</span>
            <span style={{ width: 95, flex: '0 0 95px', borderBottom: '1px solid #111', minHeight: 20, padding: '0 6px 1px' }}>{occupancyGroup}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
            <span style={{ whiteSpace: 'nowrap' }}>Location:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #111', minHeight: 20, padding: '0 6px 1px' }}>{location}</span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <tbody>
            {FEE_ROWS.map((row) => (
              <tr key={row.key}>
                <td style={{ width: '66%', padding: '3px 12px 3px 0', verticalAlign: 'bottom', border: 'none' }}>{row.label}</td>
                <td style={{ width: '34%', padding: '3px 0', verticalAlign: 'bottom', border: 'none' }}>
                  <div style={{ borderBottom: '1px solid #111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px' }}>
                    {formatAmount(parseAmount(fees[row.key]))}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '3px 24px 3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <span style={{ width: 56, flex: '0 0 56px' }}>Others</span>
                  <span style={{ flex: 1, borderBottom: '1px solid #111', minHeight: 20, padding: '0 4px 1px' }}>{othersLabel1}</span>
                </div>
              </td>
              <td style={{ padding: '3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ borderBottom: '1px solid #111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px' }}>
                  {formatAmount(parseAmount(othersAmount1))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '3px 24px 3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <span style={{ width: 56, flex: '0 0 56px' }} />
                  <span style={{ flex: 1, borderBottom: '1px solid #111', minHeight: 20, padding: '0 4px 1px' }}>{othersLabel2}</span>
                </div>
              </td>
              <td style={{ padding: '3px 0', verticalAlign: 'bottom', border: 'none' }}>
                <div style={{ borderBottom: '1px solid #111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px' }}>
                  {formatAmount(parseAmount(othersAmount2))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'right', padding: '6px 18px 3px 0', border: 'none' }}>
                Total <span style={{ display: 'inline-block', marginLeft: 14 }}>P</span>
              </td>
              <td style={{ padding: '6px 0 3px', border: 'none' }}>
                <div style={{ borderBottom: '1px solid #111', minHeight: 20, textAlign: 'right', padding: '0 6px 1px', fontWeight: 700 }}>
                  {formatAmount(totalAmount)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table style={{ margin: '12px 0 32px 48px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: 110, textAlign: 'center', padding: '4px 8px', border: 'none' }}>LGU</td>
              <td style={{ width: 60, textAlign: 'center', padding: '4px 8px', border: 'none' }}>80%</td>
              <td style={{ width: 170, borderBottom: '1px solid #111', textAlign: 'right', padding: '2px 6px' }}>
                {formatAmount(lguShare)}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center', padding: '4px 8px', border: 'none' }}>DPWH (5%)</td>
              <td rowSpan={2} style={{ textAlign: 'center', padding: '4px 8px', verticalAlign: 'middle', border: 'none' }}>20%</td>
              <td style={{ borderBottom: '1px solid #111', textAlign: 'right', padding: '2px 6px' }}>
                {formatAmount(dpwhShare)}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center', padding: '4px 8px', border: 'none' }}>OBO (15%)</td>
              <td style={{ borderBottom: '1px solid #111', textAlign: 'right', padding: '2px 6px' }}>
                {formatAmount(oboShare)}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ paddingLeft: 56, marginTop: 16 }}>
          <div style={{ marginBottom: 30 }}>
            <div style={{ marginBottom: 20 }}>Assessed by:</div>
            <div style={{ textAlign: 'center', width: 260, marginLeft: 110 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{assessedByName}</div>
              <div>{assessedByTitle}</div>
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 20 }}>Approved by:</div>
            <div style={{ textAlign: 'center', width: 260, marginLeft: 110 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{approvedByName}</div>
              <div>{approvedByTitle}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
