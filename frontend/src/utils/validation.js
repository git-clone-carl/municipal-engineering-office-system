const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

const DOMAIN_TYPOS = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
};

const BLOCKED_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'invalid.com',
  'localhost',
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.email',
  'fakeinbox.com',
  'trashmail.com',
]);

const KEYBOARD_MASH_PATTERNS = [
  'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', '123456', 'abcdef', 'wasd',
];

export const NATURE_OF_CONSTRUCTION_OPTIONS = [
  { value: 'New Construction', label: 'New Construction' },
  { value: 'Renovation / Repair', label: 'Renovation / Repair' },
  { value: 'Extension / Addition', label: 'Extension / Addition' },
  { value: 'Alteration / Remodeling', label: 'Alteration / Remodeling' },
  { value: 'Demolition', label: 'Demolition' },
  { value: 'Electrical Installation', label: 'Electrical Installation' },
  { value: 'Fencing / Perimeter Wall', label: 'Fencing / Perimeter Wall' },
  { value: 'Signage Installation', label: 'Signage Installation' },
  { value: '__other__', label: 'Other (Specify)' },
];

export const BUILDING_TYPE_OPTIONS = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Industrial', label: 'Industrial' },
  { value: 'Institutional', label: 'Institutional' },
  { value: 'Agricultural', label: 'Agricultural' },
  { value: 'Mixed-Use', label: 'Mixed-Use' },
  { value: 'Warehouse / Storage', label: 'Warehouse / Storage' },
  { value: '__other__', label: 'Other (Specify)' },
];

export function filterEmailInput(value) {
  return String(value || '').replace(/\s+/g, '').slice(0, 254);
}

export function filterLocationInput(value) {
  return String(value || '').replace(/[^a-zA-Z0-9\s,.\-#/()'ñÑ]/g, '').slice(0, 200);
}

export function filterLabelTextInput(value, max = 100) {
  return String(value || '').replace(/[^a-zA-Z0-9\s,.\-/()&ñÑ]/g, '').slice(0, max);
}

export function filterNameInput(value) {
  return String(value || '').replace(/[^a-zA-Z\s.\-'ñÑ]/g, '').slice(0, 100);
}

export function filterPhoneInput(value) {
  return String(value || '').replace(/[^0-9+\-\s()]/g, '').slice(0, 20);
}

export function filterDecimalInput(value) {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned.slice(0, 9);
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`.slice(0, 10);
}

export function filterIntegerInput(value) {
  return String(value || '').replace(/[^0-9]/g, '').slice(0, 3);
}

export function isGibberishText(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;
  if (/(.)\1{4,}/i.test(value)) return true;
  const lower = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (KEYBOARD_MASH_PATTERNS.some((p) => lower.includes(p))) return true;
  const words = value.split(/\s+/);
  for (const word of words) {
    const lettersOnly = word.replace(/[^a-zA-Z]/g, '');
    if (lettersOnly.length >= 6 && !/[aeiouy]/i.test(lettersOnly)) {
      return true;
    }
  }
  return false;
}

export function validateEmailFormat(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) {
    return { valid: false, error: 'Email address is required.' };
  }
  if (clean.length > 254 || /\s/.test(clean)) {
    return { valid: false, error: 'Please enter a valid email address without spaces.' };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. name@gmail.com).' };
  }

  const [localPart, domain] = clean.split('@');
  if (!localPart || !domain || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { valid: false, error: 'Email address format is invalid.' };
  }

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { valid: false, error: 'Email domain extension is invalid.' };
  }

  if (DOMAIN_TYPOS[domain]) {
    const suggested = `${localPart}@${DOMAIN_TYPOS[domain]}`;
    return {
      valid: false,
      error: `Did you mean ${suggested}? Please check your email domain.`,
      suggestion: suggested,
    };
  }

  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, error: 'Please use a real, active email address (disposable or example domains are not allowed).' };
  }

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const baseLocal = localPart.split('+')[0];
    if (baseLocal.length < 6 || baseLocal.length > 30) {
      return { valid: false, error: 'Gmail usernames must be between 6 and 30 characters long.' };
    }
    if (!/^[a-z0-9.]+$/.test(baseLocal)) {
      return { valid: false, error: 'Gmail usernames may only contain letters, numbers, and periods (.).' };
    }
    if (/^(.)\1+$/.test(baseLocal.replace(/\./g, ''))) {
      return { valid: false, error: 'Please enter a real Gmail address.' };
    }
  }

  return { valid: true, email: clean, domain };
}

export function validateTextField(value, { label, required = false, min = 3, max = 150 }) {
  const clean = String(value || '').trim();
  if (!clean) {
    return required ? `${label} is required.` : null;
  }
  if (clean.length < min) {
    return `${label} must be at least ${min} characters.`;
  }
  if (clean.length > max) {
    return `${label} must be at most ${max} characters.`;
  }
  const letterCount = (clean.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 2) {
    return `${label} must contain valid words, not just numbers or symbols.`;
  }
  if (isGibberishText(clean)) {
    return `Please enter a valid ${label.toLowerCase()} (random or repeated characters are not allowed).`;
  }
  return null;
}

export function validatePermitDetails({ project_location, nature_of_construction, building_type }) {
  const locErr = validateTextField(project_location, { label: 'Project location', required: true, min: 5, max: 200 });
  if (locErr) return locErr;
  const natureErr = validateTextField(nature_of_construction, { label: 'Nature of construction', required: false, min: 3, max: 100 });
  if (natureErr) return natureErr;
  const bldgErr = validateTextField(building_type, { label: 'Building type', required: false, min: 3, max: 100 });
  if (bldgErr) return bldgErr;
  return null;
}

export function validatePermitSpecs({ total_floor_area, num_storeys }) {
  if (total_floor_area !== '' && total_floor_area !== null && total_floor_area !== undefined) {
    const area = Number(total_floor_area);
    if (!Number.isFinite(area) || area < 0 || area > 100000) {
      return 'Estimated floor area must be a valid number between 0 and 100,000 sq.m.';
    }
  }
  const storeys = Number(num_storeys);
  if (!Number.isInteger(storeys) || storeys < 1 || storeys > 100) {
    return 'Number of storeys must be a whole number between 1 and 100.';
  }
  return null;
}

export function validateNotes(notes) {
  const clean = String(notes || '').trim();
  if (clean.length > 500) return 'Notes must be at most 500 characters.';
  if (clean.length >= 6 && isGibberishText(clean)) {
    return 'Notes contain invalid or random repeated characters.';
  }
  return null;
}

export function validatePublicApplicant({ full_name, contact_number, address }) {
  const nameErr = validateTextField(full_name, { label: 'Full name', required: true, min: 3, max: 100 });
  if (nameErr) return nameErr;
  const digits = String(contact_number || '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 13) {
    return 'Please enter a valid contact number (7 to 13 digits, e.g. 0917-123-4567).';
  }
  const addrErr = validateTextField(address, { label: 'Address', required: true, min: 5, max: 200 });
  if (addrErr) return addrErr;
  return null;
}
