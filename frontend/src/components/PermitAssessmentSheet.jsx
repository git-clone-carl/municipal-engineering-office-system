import { useState, useMemo, useEffect } from 'react';
import { Icon, escapeHtml, printDocumentHtml } from './UI';
import { parseFeeBreakdown } from '../constants/fees';

const BUILDING_FEE_ROWS = [
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

const OCCUPANCY_FEE_ROWS = [
  { key: 'use_occupancy', label: 'Use/Occupancy Fees' },
  { key: 'change_use_occupancy', label: 'Change of Use/Occupancy Fees' },
  { key: 'building_inspection', label: 'Building Inspection Fees' },
  { key: 'sanitary_inspection', label: 'Sanitary/Plumbing Inspection Fees' },
  { key: 'electrical_inspection', label: 'Electrical Inspection Fees' },
  { key: 'mechanical_inspection', label: 'Mechanical Inspection Fees' },
  { key: 'electronics_inspection', label: 'Electronics Inspection Fees' },
  { key: 'certification', label: 'Certification Fees' },
];

const ELECTRICAL_FEE_ROWS = [
  { key: 'electrical', label: 'Electrical Fees' },
  { key: 'inspection', label: 'Inspection Fees' },
  { key: 'certification', label: 'Certification Fees' },
  { key: 'others', label: 'Other' },
];

function getSheetVariant(permitType) {
  if (permitType === 'occupancy') return 'occupancy';
  if (permitType === 'electrical') return 'electrical';
  return 'building';
}

function getRowsForVariant(variant) {
  if (variant === 'occupancy') return OCCUPANCY_FEE_ROWS;
  if (variant === 'electrical') return ELECTRICAL_FEE_ROWS;
  return BUILDING_FEE_ROWS;
}

function getDefaultFeeKey(permitType) {
  switch (permitType) {
    case 'occupancy':
      return 'use_occupancy';
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
  const variant = getSheetVariant(permit.permit_type);
  const feeRows = getRowsForVariant(variant);
  const defaultFeeKey = getDefaultFeeKey(permit.permit_type);

  const buildInitialState = () => {
    const map = {};
    for (const row of feeRows) map[row.key] = '';
    let initOthersLabel = '';
    let initOthersAmount = '';
    let initPenaltyAmount = '';

    const saved = parseFeeBreakdown(permit.fee_breakdown);
    if (saved.length > 0) {
      for (const item of saved) {
        if (item.key === 'others' && variant !== 'electrical') {
          initOthersAmount = String(Number(item.amount).toFixed(2));
          const m = String(item.label || '').match(/\((.+)\)$/);
          if (m) initOthersLabel = m[1];
        } else if (item.key === 'penalty' && variant === 'building') {
          initPenaltyAmount = String(Number(item.amount).toFixed(2));
        } else if (Object.prototype.hasOwnProperty.call(map, item.key)) {
          map[item.key] = String(Number(item.amount).toFixed(2));
        }
      }
    } else if (Number(permit.total_fee) > 0 && Object.prototype.hasOwnProperty.call(map, defaultFeeKey)) {
      map[defaultFeeKey] = String(Number(permit.total_fee).toFixed(2));
    }
    return { map, initOthersLabel, initOthersAmount, initPenaltyAmount };
  };

  const init = useMemo(buildInitialState, [permit.id, permit.total_fee, permit.fee_breakdown, variant, defaultFeeKey]);

  const [editMode, setEditMode] = useState(false);
  const [ownerApplicant, setOwnerApplicant] = useState(permit.client_name || '');
  const [address, setAddress] = useState(permit.project_location || permit.client_address || '');
  const [typeOfProject, setTypeOfProject] = useState(permit.nature_of_construction || '');
  const [useOfOccupancy, setUseOfOccupancy] = useState(permit.building_type || '');
  const [occupancyGroup, setOccupancyGroup] = useState('');

  const [fees, setFees] = useState(init.map);
  const [othersLabel, setOthersLabel] = useState(init.initOthersLabel);
  const [othersAmount, setOthersAmount] = useState(init.initOthersAmount);
  const [penaltyAmount, setPenaltyAmount] = useState(init.initPenaltyAmount);

  const defaultAssessedTitle = variant === 'building' ? 'Engineer II' : 'Engineer III';
  const defaultApprovedTitle = variant === 'electrical' ? 'Municipal Engineer' : 'Building Official';

  const [assessedByName, setAssessedByName] = useState(signatories.assessed_by_name || 'Engr. Jer Anthony F. Palo');
  const [assessedByTitle, setAssessedByTitle] = useState(defaultAssessedTitle);
  const [approvedByName, setApprovedByName] = useState(signatories.approved_by_name || 'Municipal Engineer');
  const [approvedByTitle, setApprovedByTitle] = useState(defaultApprovedTitle);

  useEffect(() => {
    setOwnerApplicant(permit.client_name || '');
    setAddress(permit.project_location || permit.client_address || '');
    setTypeOfProject(permit.nature_of_construction || '');
    setUseOfOccupancy(permit.building_type || '');
    setFees(init.map);
    setOthersLabel(init.initOthersLabel);
    setOthersAmount(init.initOthersAmount);
    setPenaltyAmount(init.initPenaltyAmount);
    setAssessedByName(signatories.assessed_by_name || 'Engr. Jer Anthony F. Palo');
    setAssessedByTitle(variant === 'building' ? 'Engineer II' : 'Engineer III');
    setApprovedByName(signatories.approved_by_name || 'Municipal Engineer');
    setApprovedByTitle(variant === 'electrical' ? 'Municipal Engineer' : 'Building Official');
  }, [permit.id, permit.client_name, permit.project_location, permit.client_address, permit.nature_of_construction, permit.building_type, init, signatories.assessed_by_name, signatories.approved_by_name, variant]);

  const totalAmount = useMemo(() => {
    const baseSum = feeRows.reduce((sum, r) => sum + parseAmount(fees[r.key]), 0);
    const extraOthers = variant === 'electrical' ? 0 : parseAmount(othersAmount);
    const extraPenalty = variant === 'building' ? parseAmount(penaltyAmount) : 0;
    return baseSum + extraOthers + extraPenalty;
  }, [fees, feeRows, othersAmount, penaltyAmount, variant]);

  const lguShare = totalAmount * 0.8;
  const dpwhShare = totalAmount * 0.05;
  const oboShare = totalAmount * 0.15;

  const handlePrint = () => {
    const totalDisplay = formatAmount(totalAmount);
    let innerHtml = '';

    if (variant === 'electrical') {
      const rowsHtml = ELECTRICAL_FEE_ROWS.map((row) => `
        <tr>
          <td class="el-label">${escapeHtml(row.label)}</td>
          <td class="el-colon">:</td>
          <td class="el-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(fees[row.key])))}</span></td>
        </tr>
      `).join('');

      innerHtml = `
        <div class="gs-field-row"><span class="gs-field-label">Name:</span><span class="gs-field-line">${escapeHtml(ownerApplicant)}</span></div>
        <div class="gs-field-row" style="margin-bottom: 18px;"><span class="gs-field-label">Address:</span><span class="gs-field-line">${escapeHtml(address)}</span></div>
        <div class="el-location-hdr">Gumaca, Quezon</div>
        <table class="el-fee-table">
          <tbody>
            ${rowsHtml}
            <tr>
              <td class="el-label"><strong>TOTAL COST</strong></td>
              <td class="el-colon"><strong>:</strong></td>
              <td class="el-val"><span class="line-val"><strong>${escapeHtml(totalDisplay)}</strong></span></td>
            </tr>
          </tbody>
        </table>
        <table class="gs-shares" style="margin-top: 22px;">
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
        <div class="el-sigs">
          <div class="gs-sig-person" style="margin-top: 32px;">
            <div class="gs-sig-name">${escapeHtml(assessedByName)}</div>
            <div class="gs-sig-title">${escapeHtml(assessedByTitle)}</div>
          </div>
          <div class="gs-sig-person" style="margin-top: 34px; margin-bottom: 0;">
            <div class="gs-sig-name" style="text-transform: uppercase;">${escapeHtml(approvedByName)}</div>
            <div class="gs-sig-title">${escapeHtml(approvedByTitle)}</div>
          </div>
        </div>
      `;
    } else if (variant === 'occupancy') {
      const rowsHtml = OCCUPANCY_FEE_ROWS.map((row) => `
        <tr>
          <td class="fee-label">${escapeHtml(row.label)}</td>
          <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(fees[row.key])))}</span></td>
        </tr>
      `).join('');

      innerHtml = `
        <div class="occ-hdr">
          <div>Republic of the Philippines</div>
          <div style="font-weight: 700;">MUNICIPALITY OF GUMACA</div>
          <div>Province of Quezon</div>
          <div style="letter-spacing: 1px;">oo000oo</div>
        </div>
        <div class="gs-office" style="margin-bottom: 18px;">OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL</div>
        <div class="gs-field-row"><span class="gs-field-label">Owner/Applicant:</span><span class="gs-field-line">${escapeHtml(ownerApplicant)}</span></div>
        <div class="gs-field-row"><span class="gs-field-label">Type of Project:</span><span class="gs-field-line">${escapeHtml(typeOfProject)}</span></div>
        <div class="gs-field-row">
          <span class="gs-field-label">Use or Character of Occupancy:</span>
          <span class="gs-field-line">${escapeHtml(useOfOccupancy)}</span>
          <span class="gs-field-label" style="margin-left: 8px;">Group:</span>
          <span class="gs-field-line" style="max-width: 90px;">${escapeHtml(occupancyGroup)}</span>
        </div>
        <div class="gs-field-row" style="margin-bottom: 18px;"><span class="gs-field-label">Location:</span><span class="gs-field-line">${escapeHtml(address)}</span></div>
        <table class="gs-fee-table">
          <tbody>
            ${rowsHtml}
            <tr>
              <td class="fee-label">
                <div class="gs-others-flex">
                  <span class="gs-others-label">Others</span>
                  <span class="gs-others-line">${escapeHtml(othersLabel)}</span>
                </div>
              </td>
              <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(othersAmount)))}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="gs-total-row">
          <span>Total</span>
          <span class="gs-total-p">P</span>
          <span class="gs-total-num" style="border-bottom: 1px solid #111; min-width: 130px;">${escapeHtml(totalDisplay)}</span>
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
      `;
    } else {
      const rowsHtml = BUILDING_FEE_ROWS.map((row) => `
        <tr>
          <td class="fee-label">${escapeHtml(row.label)}</td>
          <td class="fee-val"><span class="line-val">${escapeHtml(formatAmount(parseAmount(fees[row.key])))}</span></td>
        </tr>
      `).join('');

      innerHtml = `
        <div class="gs-office">OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL</div>
        <div class="gs-owner-row">
          <span class="gs-owner-label">Owner/Applicant:</span>
          <span class="gs-owner-line">${escapeHtml(ownerApplicant)}</span>
        </div>
        <table class="gs-fee-table">
          <tbody>
            ${rowsHtml}
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
          <span class="gs-total-num" style="border-bottom: 1px solid #111; min-width: 130px;">${escapeHtml(totalDisplay)}</span>
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
      `;
    }

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
        .occ-hdr { text-align: center; font-size: 13.5px; line-height: 1.35; margin-bottom: 12px; }
        .gs-office { text-align: center; font-size: 15.5px; font-weight: 700; letter-spacing: 0.2px; margin-bottom: 22px; }
        .gs-owner-row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 22px; max-width: 78%; }
        .gs-owner-label, .gs-field-label { white-space: nowrap; }
        .gs-owner-line, .gs-field-line { flex: 1; border-bottom: 1px solid #111111; min-height: 19px; padding: 0 6px 1px; }
        .gs-field-row { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 6px; }
        .el-location-hdr { text-align: center; font-weight: 700; text-decoration: underline; font-size: 15px; margin-bottom: 14px; }
        .el-fee-table, .gs-fee-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        .gs-fee-table td, .el-fee-table td { padding: 3px 0; vertical-align: bottom; }
        .gs-fee-table .fee-label { width: 66%; padding-right: 18px; }
        .gs-fee-table .fee-val { width: 34%; text-align: right; }
        .el-fee-table .el-label { width: 38%; }
        .el-fee-table .el-colon { width: 20px; text-align: center; }
        .el-fee-table .el-val { width: 58%; }
        .line-val { display: block; width: 100%; min-height: 19px; border-bottom: 1px solid #111111; padding: 0 6px 1px; text-align: right; }
        .gs-others-flex { display: flex; align-items: flex-end; gap: 14px; padding-right: 18px; }
        .gs-others-label { white-space: nowrap; }
        .gs-others-line { flex: 1; border-bottom: 1px solid #111111; min-height: 19px; padding: 0 4px 1px; }
        .gs-total-row { display: flex; align-items: baseline; margin: 10px 0 8px; padding-left: 44%; font-weight: 700; font-size: 14.5px; }
        .gs-total-p { margin-left: 10px; }
        .gs-total-num { margin-left: 10px; text-align: right; padding: 0 6px; }
        .gs-shares { margin: 2px 0 12px 72px; border-collapse: collapse; }
        .gs-shares td { padding: 4px 10px; vertical-align: middle; }
        .gs-shares .share-name { width: 100px; text-align: center; }
        .gs-shares .share-pct { width: 60px; text-align: center; }
        .gs-shares .share-val { width: 155px; border-bottom: 1px solid #111111; text-align: right; padding: 2px 6px; min-height: 19px; }
        .gs-assessed-wrap { margin-top: 6px; padding-left: 88px; }
        .gs-sig-label { margin-bottom: 28px; }
        .gs-sig-person { text-align: center; width: 280px; margin: 0 auto 18px; }
        .gs-sig-name { font-weight: 700; font-size: 14.5px; }
        .gs-sig-title { font-size: 14px; }
        .gs-approved-wrap { margin-top: 6px; padding-left: 72px; }
      </style>
      <div class="gumaca-box">${innerHtml}</div>
    `;

    printDocumentHtml({
      title: `Order of Payment - ${permit.application_no}`,
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
          <Icon name="print" size={16} /> Print Assessment / Order of Payment
        </button>
      </div>

      {editMode && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label>{variant === 'electrical' ? 'Name' : 'Owner/Applicant'}</label>
                <input className="form-control" value={ownerApplicant} onChange={(e) => setOwnerApplicant(e.target.value)} />
              </div>
              {variant !== 'building' && (
                <div className="form-group">
                  <label>{variant === 'electrical' ? 'Address' : 'Location'}</label>
                  <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              )}
            </div>
            {variant === 'occupancy' && (
              <div className="form-row-3">
                <div className="form-group">
                  <label>Type of Project</label>
                  <input className="form-control" value={typeOfProject} onChange={(e) => setTypeOfProject(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Use or Character of Occupancy</label>
                  <input className="form-control" value={useOfOccupancy} onChange={(e) => setUseOfOccupancy(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Group</label>
                  <input className="form-control" value={occupancyGroup} onChange={(e) => setOccupancyGroup(e.target.value)} />
                </div>
              </div>
            )}
            <div className="form-row">
              {feeRows.map((row) => (
                <div className="form-group" key={row.key}>
                  <label>{row.label.replace(/:$/, '')}</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={fees[row.key] || ''}
                    onChange={(e) => setFees((prev) => ({ ...prev, [row.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {variant !== 'electrical' && (
              <div className={variant === 'building' ? 'form-row-3' : 'form-row'}>
                <div className="form-group">
                  <label>Others (Description)</label>
                  <input className="form-control" value={othersLabel} onChange={(e) => setOthersLabel(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Others (Amount)</label>
                  <input className="form-control" type="number" min="0" step="0.01" placeholder="0.00" value={othersAmount} onChange={(e) => setOthersAmount(e.target.value)} />
                </div>
                {variant === 'building' && (
                  <div className="form-group">
                    <label>Penalty</label>
                    <input className="form-control" type="number" min="0" step="0.01" placeholder="0.00" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} />
                  </div>
                )}
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Assessed By (Name)</label>
                <input className="form-control" value={assessedByName} onChange={(e) => setAssessedByName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Assessed By (Title)</label>
                <input className="form-control" value={assessedByTitle} onChange={(e) => setAssessedByTitle(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Approved By (Engineer)</label>
                <input className="form-control" value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Approved By (Title)</label>
                <input className="form-control" value={approvedByTitle} onChange={(e) => setApprovedByTitle(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exact On-Screen Preview matching the 3 Physical Gumaca MEO Sheets */}
      <div className="gumaca-sheet-preview">
        {variant === 'electrical' ? (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Name:</span>
              <span className="gs-owner-line">{ownerApplicant}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Address:</span>
              <span className="gs-owner-line">{address}</span>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 700, textDecoration: 'underline', marginBottom: 14 }}>
              Gumaca, Quezon
            </div>
            <table className="gs-fee-table">
              <tbody>
                {ELECTRICAL_FEE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td style={{ width: '40%' }}>{row.label}</td>
                    <td style={{ width: 20, textAlign: 'center' }}>:</td>
                    <td className="fee-val"><span className="line-val">{formatAmount(parseAmount(fees[row.key]))}</span></td>
                  </tr>
                ))}
                <tr>
                  <td><strong>TOTAL COST</strong></td>
                  <td style={{ textAlign: 'center' }}><strong>:</strong></td>
                  <td className="fee-val"><span className="line-val"><strong>{formatAmount(totalAmount)}</strong></span></td>
                </tr>
              </tbody>
            </table>
            <table className="gs-shares" style={{ marginTop: 20 }}>
              <tbody>
                <tr>
                  <td className="share-name">LGU</td>
                  <td className="share-pct">80%</td>
                  <td className="share-val">{formatAmount(lguShare)}</td>
                </tr>
                <tr>
                  <td className="share-name">DPWH (5%)</td>
                  <td className="share-pct" rowSpan={2}>20%</td>
                  <td className="share-val">{formatAmount(dpwhShare)}</td>
                </tr>
                <tr>
                  <td className="share-name">OBO (15%)</td>
                  <td className="share-val">{formatAmount(oboShare)}</td>
                </tr>
              </tbody>
            </table>
            <div className="gs-sig-person" style={{ marginTop: 28 }}>
              <div className="gs-sig-name">{assessedByName}</div>
              <div className="gs-sig-title">{assessedByTitle}</div>
            </div>
            <div className="gs-sig-person" style={{ marginTop: 28, marginBottom: 0 }}>
              <div className="gs-sig-name" style={{ textTransform: 'uppercase' }}>{approvedByName}</div>
              <div className="gs-sig-title">{approvedByTitle}</div>
            </div>
          </>
        ) : variant === 'occupancy' ? (
          <>
            <div style={{ textAlign: 'center', fontSize: 13.5, lineHeight: 1.35, marginBottom: 12 }}>
              <div>Republic of the Philippines</div>
              <div style={{ fontWeight: 700 }}>MUNICIPALITY OF GUMACA</div>
              <div>Province of Quezon</div>
              <div>oo000oo</div>
            </div>
            <div className="gs-office" style={{ marginBottom: 16 }}>OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Owner/Applicant:</span>
              <span className="gs-owner-line">{ownerApplicant}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Type of Project:</span>
              <span className="gs-owner-line">{typeOfProject}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Use or Character of Occupancy:</span>
              <span className="gs-owner-line">{useOfOccupancy}</span>
              <span style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>Group:</span>
              <span className="gs-owner-line" style={{ maxWidth: 90 }}>{occupancyGroup}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>Location:</span>
              <span className="gs-owner-line">{address}</span>
            </div>
            <table className="gs-fee-table">
              <tbody>
                {OCCUPANCY_FEE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="fee-label">{row.label}</td>
                    <td className="fee-val"><span className="line-val">{formatAmount(parseAmount(fees[row.key]))}</span></td>
                  </tr>
                ))}
                <tr>
                  <td className="fee-label">
                    <div className="gs-others-flex">
                      <span className="gs-others-label">Others</span>
                      <span className="gs-others-line">{othersLabel}</span>
                    </div>
                  </td>
                  <td className="fee-val"><span className="line-val">{formatAmount(parseAmount(othersAmount))}</span></td>
                </tr>
              </tbody>
            </table>
            <div className="gs-total-row">
              <span>Total</span>
              <span className="gs-total-p">P</span>
              <span className="gs-total-num">{formatAmount(totalAmount)}</span>
            </div>
            <table className="gs-shares">
              <tbody>
                <tr>
                  <td className="share-name">LGU</td>
                  <td className="share-pct">80%</td>
                  <td className="share-val">{formatAmount(lguShare)}</td>
                </tr>
                <tr>
                  <td className="share-name">DPWH (5%)</td>
                  <td className="share-pct" rowSpan={2}>20%</td>
                  <td className="share-val">{formatAmount(dpwhShare)}</td>
                </tr>
                <tr>
                  <td className="share-name">OBO (15%)</td>
                  <td className="share-val">{formatAmount(oboShare)}</td>
                </tr>
              </tbody>
            </table>
            <div className="gs-assessed-wrap">
              <div className="gs-sig-label">Assessed by:</div>
              <div className="gs-sig-person">
                <div className="gs-sig-name">{assessedByName}</div>
                <div className="gs-sig-title">{assessedByTitle}</div>
              </div>
            </div>
            <div className="gs-approved-wrap">
              <div className="gs-sig-label">Approved by:</div>
              <div className="gs-sig-person" style={{ marginBottom: 0 }}>
                <div className="gs-sig-name">{approvedByName}</div>
                <div className="gs-sig-title">{approvedByTitle}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="gs-office">OFFICE OF THE MUNICIPAL ENGINEER/BUILDING OFFICIAL</div>
            <div className="gs-owner-row">
              <span className="gs-owner-label">Owner/Applicant:</span>
              <span className="gs-owner-line">{ownerApplicant}</span>
            </div>
            <table className="gs-fee-table">
              <tbody>
                {BUILDING_FEE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="fee-label">{row.label}</td>
                    <td className="fee-val"><span className="line-val">{formatAmount(parseAmount(fees[row.key]))}</span></td>
                  </tr>
                ))}
                <tr>
                  <td className="fee-label">
                    <div className="gs-others-flex">
                      <span className="gs-others-label">Others:</span>
                      <span className="gs-others-line">{othersLabel}</span>
                    </div>
                  </td>
                  <td className="fee-val"><span className="line-val">{formatAmount(parseAmount(othersAmount))}</span></td>
                </tr>
                <tr>
                  <td className="fee-label">Penalty:</td>
                  <td className="fee-val"><span className="line-val">{formatAmount(parseAmount(penaltyAmount))}</span></td>
                </tr>
              </tbody>
            </table>
            <div className="gs-total-row">
              <span>TOTAL</span>
              <span className="gs-total-p">P</span>
              <span className="gs-total-num">{formatAmount(totalAmount)}</span>
            </div>
            <table className="gs-shares">
              <tbody>
                <tr>
                  <td className="share-name">LGU</td>
                  <td className="share-pct">80%</td>
                  <td className="share-val">{formatAmount(lguShare)}</td>
                </tr>
                <tr>
                  <td className="share-name">DPWH (5%)</td>
                  <td className="share-pct" rowSpan={2}>20%</td>
                  <td className="share-val">{formatAmount(dpwhShare)}</td>
                </tr>
                <tr>
                  <td className="share-name">OBO (15%)</td>
                  <td className="share-val">{formatAmount(oboShare)}</td>
                </tr>
              </tbody>
            </table>
            <div className="gs-assessed-wrap">
              <div className="gs-sig-label">Assessed by:</div>
              <div className="gs-sig-person">
                <div className="gs-sig-name">{assessedByName}</div>
                <div className="gs-sig-title">{assessedByTitle}</div>
              </div>
            </div>
            <div className="gs-approved-wrap">
              <div className="gs-sig-label">Approved by:</div>
              <div className="gs-sig-person" style={{ marginBottom: 0 }}>
                <div className="gs-sig-name">{approvedByName}</div>
                <div className="gs-sig-title">{approvedByTitle}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
