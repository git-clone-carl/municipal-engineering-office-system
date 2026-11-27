export const PERMIT_TYPES = {
  building: 'Building Permit',
  electrical: 'Electrical Permit',
  occupancy: 'Occupancy Permit',
  annual_inspection: 'Certificate of Annual Inspection',
  certificate: 'Certification',
};

export const ELECTRICAL_SUBTYPES = {
  electrification: 'Electrification',
  transformer: 'Transformer Application',
  special_lights: 'Special Lights',
};

export const ELECTRICAL_REQUIREMENTS = {
  electrification: [
    "Barangay Clearance w/ Owner's Signature & CTC # (Purpose: For Electrification) - BLGU",
    'Filled Up Certificate of Final Electrical Inspection - MEO',
    'Filled Up Electrical Permit w/ Signature - MEO',
    'Schedule of Load / Electrical Plan – Involved Professionals',
    'Photocopy of PRC ID & PTR of PEE/REE/RME - Involved Professionals',
    'Filled Up Service Requirements & Installation Report (SRIR Form) – QUEZELCO',
    'DPWH Road Right of Way Clearance (if along Provincial or National Road) – DPWH OFFICE',
    'Lease Contract Agreement (if lot is PNR Property) – PNR OFFICE',
    'Proof of Ownership (OCT, TCT, Deed of Absolute Sale, or Notarized Lot Owner Consent) – Applicant',
    '2 Copies of 3R Picture of House/Building/Structure to be applied – Applicant',
    'Photocopy of ID of Applicant & Lot Owner w/ specimen signature – Applicant',
  ],
  transformer: [
    "Barangay Clearance w/ Owner's Signature & CTC # (Purpose: Electrification/Transformer) - BLGU",
    'Filled Up Certificate of Final Electrical Inspection - MEO',
    'Filled Up Electrical Permit w/ Signature - MEO',
    'Electrical Plan w/ Transformer Calculation – Involved Professionals',
    'Photocopy of PRC ID & PTR of PEE/REE/RME - Involved Professionals',
    'Filled Up Service Requirements & Installation Report (SRIR Form) – QUEZELCO',
    'DPWH Road Right of Way Clearance (if along Provincial or National Road) – DPWH OFFICE',
    'Lease Contract Agreement (if lot is PNR Property) – PNR OFFICE',
    'Proof of Ownership (Certificate of Occupancy, OCT, TCT, Deed of Absolute Sale, or Notarized Lot Owner Consent) – Applicant',
    '2 Copies of 3R Picture of House/Building/Structure to be applied – Applicant',
    'Photocopy of ID of Applicant & Lot Owner w/ specimen signature – Applicant',
  ],
  special_lights: [
    'Request Letter - Applicant',
    'Filled Up Service Requirements & Installation Report (SRIR Form) - QUEZELCO',
    'Approved Building Permit Certificate - MEO',
    'Filled Up Certificate of Final Electrical Inspection - MEO',
    'Filled Up Permit for Temporary Service Connection - MEO',
    'Special Lights Bill - QUEZELCO',
    "Barangay Clearance w/ Owner's Signature & CTC # (Purpose: Special Lights) - BLGU",
    '2 Copies of 3R Picture of House/Building/Structure to be applied – Applicant',
    'Photocopy of ID of Applicant & Lot Owner w/ specimen signature – Applicant',
  ],
};

export const FALLBACK_REQUIREMENTS = {
  building: [
    'Four (4) copies of filled up Unified Application Form for Building Permit and FSEC',
    'Original Certificate of Title (OCT) / Transfer Certificate of Title (TCT), CERTIFIED True Copy in LRA Paper, Current Real Property Tax Receipt, Tax Declaration of the Property, or Deed of Absolute Sale or Lot Locational Plan from LRA (if lessee, Contract of Lease)',
    'Four (4) sets of Survey Plans, Design Plans and Other Documents (Architectural, Civil/Structural, Electrical, Mechanical, Sanitary, Plumbing, Electronics, Geodetic, Fire Protection Plan if applicable)',
    'Three (3) photocopies of Valid Licenses (PRC I.D.) of all involved professionals',
    'Notarized estimated value of the building / structure to be erected as declared by the owner and project specifications',
    'Structural Analysis (if one storey with roof deck & above)',
    'Affidavit of Undertaking (if applicable)',
    'Soil Test (if two (2) storey with roof deck & above)',
    'DPWH Road Right of Way Clearance (if along Provincial & National Highway)',
    'Brgy. Clearance',
    "Notarized Authorization Letter (for applicant's representative)",
  ],
  electrical: ELECTRICAL_REQUIREMENTS.electrification,
  occupancy: ['Building Permit', 'Certificate of Completion', 'Fire Safety Certificate', 'Tax Declaration'],
  annual_inspection: [
    'Application Form for Annual Inspection',
    'Approved Building Permit / Occupancy Permit',
    'Previous Certificate of Annual Inspection (if renewal)',
    'Latest Electrical / Fire Safety Inspection Report',
  ],
  certificate: ['Application Form', 'Valid ID', 'Tax Declaration'],
};

export function getRequirementsForPermit(permitType, electricalSubtype = 'electrification', requirementsMap = FALLBACK_REQUIREMENTS, electricalMap = ELECTRICAL_REQUIREMENTS) {
  if (permitType === 'electrical') {
    return electricalMap?.[electricalSubtype] || ELECTRICAL_REQUIREMENTS[electricalSubtype] || ELECTRICAL_REQUIREMENTS.electrification;
  }
  return requirementsMap?.[permitType] || FALLBACK_REQUIREMENTS[permitType] || [];
}
