export const FEE_TEMPLATES = {
  building: [
    { key: 'filing', label: 'Filing Fees' },
    { key: 'line_and_grade', label: 'Line and Grade Fees' },
    { key: 'preliminary_inspection', label: 'Preliminary Inspection & Verification Fees' },
    { key: 'excavation', label: 'Excavation Fees' },
    { key: 'building', label: 'Building Fees' },
    { key: 'electrical', label: 'Electrical Fees' },
    { key: 'mechanical', label: 'Mechanical Fees' },
    { key: 'sanitary_plumbing', label: 'Sanitary/Plumbing Fees' },
    { key: 'electronics', label: 'Electronics Fees' },
    { key: 'others', label: 'Others' },
    { key: 'penalty', label: 'Penalty' },
  ],
  occupancy: [
    { key: 'use_occupancy', label: 'Use/Occupancy Fees' },
    { key: 'change_use_occupancy', label: 'Change of Use/Occupancy Fees' },
    { key: 'building_inspection', label: 'Building Inspection Fees' },
    { key: 'sanitary_inspection', label: 'Sanitary/Plumbing Inspection Fees' },
    { key: 'electrical_inspection', label: 'Electrical Inspection Fees' },
    { key: 'mechanical_inspection', label: 'Mechanical Inspection Fees' },
    { key: 'electronics_inspection', label: 'Electronics Inspection Fees' },
    { key: 'certification', label: 'Certification Fees' },
    { key: 'others', label: 'Others' },
  ],
  electrical: [
    { key: 'electrical', label: 'Electrical Fees' },
    { key: 'inspection', label: 'Inspection Fees' },
    { key: 'certification', label: 'Certification Fees' },
    { key: 'others', label: 'Other' },
  ],
  annual_inspection: [
    { key: 'inspection', label: 'Annual Inspection Fees' },
    { key: 'filing', label: 'Filing Fees' },
    { key: 'certification', label: 'Certification Fees' },
    { key: 'others', label: 'Others' },
    { key: 'penalty', label: 'Penalty' },
  ],
  certificate: [
    { key: 'certification', label: 'Certification Fees' },
    { key: 'filing', label: 'Filing Fees' },
    { key: 'others', label: 'Others' },
  ],
};

export function getFeeTemplate(permitType) {
  return FEE_TEMPLATES[permitType] || FEE_TEMPLATES.building;
}

export function computeFeeTotal(feeMap = {}) {
  return Object.values(feeMap).reduce((sum, val) => {
    const n = parseFloat(String(val ?? '').replace(/,/g, ''));
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

export function buildFeeBreakdownItems(permitType, feeMap = {}, othersLabel = '') {
  const template = getFeeTemplate(permitType);
  return template
    .map((row) => {
      const amount = parseFloat(String(feeMap[row.key] ?? '').replace(/,/g, ''));
      const label = row.key === 'others' && othersLabel.trim()
        ? `${row.label} (${othersLabel.trim()})`
        : row.label;
      return {
        key: row.key,
        label,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
      };
    })
    .filter((item) => item.amount > 0);
}

export function parseFeeBreakdown(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
