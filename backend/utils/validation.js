const dns = require('dns').promises;

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

function isGibberishText(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;
  // 5+ identical characters in a row (e.g. "aaaaaa", "111111")
  if (/(.)\1{4,}/i.test(value)) return true;
  const lower = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (KEYBOARD_MASH_PATTERNS.some((p) => lower.includes(p))) return true;
  // Long purely-alphabetic token with no vowels at all (e.g. "bcdfghjk")
  const words = value.split(/\s+/);
  for (const word of words) {
    const lettersOnly = word.replace(/[^a-zA-Z]/g, '');
    if (lettersOnly.length >= 6 && !/[aeiouy]/i.test(lettersOnly)) {
      return true;
    }
  }
  return false;
}

function validateEmailFormat(email) {
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
      return {
        valid: false,
        error: 'Gmail usernames must be between 6 and 30 characters long.',
      };
    }
    if (!/^[a-z0-9.]+$/.test(baseLocal)) {
      return {
        valid: false,
        error: 'Gmail usernames may only contain letters, numbers, and periods (.).',
      };
    }
    if (/^(.)\1+$/.test(baseLocal.replace(/\./g, ''))) {
      return {
        valid: false,
        error: 'Please enter a real Gmail address.',
      };
    }
  }

  return { valid: true, email: clean, domain };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), ms)),
  ]);
}

async function verifyEmailDeliverable(email) {
  const formatCheck = validateEmailFormat(email);
  if (!formatCheck.valid) {
    return formatCheck;
  }

  try {
    const mxRecords = await withTimeout(dns.resolveMx(formatCheck.domain), 4000);
    if (!Array.isArray(mxRecords) || mxRecords.length === 0) {
      return {
        valid: false,
        error: `The domain "${formatCheck.domain}" cannot receive emails (no mail servers found).`,
      };
    }
    return {
      valid: true,
      email: formatCheck.email,
      domain: formatCheck.domain,
      mxChecked: true,
      mxHost: mxRecords[0].exchange,
    };
  } catch (err) {
    // Definite non-existent domain / no MX record
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'NXDOMAIN') {
      return {
        valid: false,
        error: `The email domain "${formatCheck.domain}" does not exist or cannot receive emails.`,
      };
    }
    // Network offline / DNS timeout: allow format-validated email without blocking offline LAN
    return {
      valid: true,
      email: formatCheck.email,
      domain: formatCheck.domain,
      mxChecked: false,
      warning: 'Could not reach DNS to verify mail server; email format is valid.',
    };
  }
}

function validateTextField(value, { label, required = false, min = 3, max = 150, pattern, patternMessage }) {
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
  if (pattern && !pattern.test(clean)) {
    return patternMessage || `${label} contains invalid characters.`;
  }
  if (isGibberishText(clean)) {
    return `Please enter a valid ${label.toLowerCase()} (random or repeated characters are not allowed).`;
  }
  return null;
}

function validatePermitFields(data = {}) {
  const errors = [];

  const locationErr = validateTextField(data.project_location, {
    label: 'Project location',
    required: true,
    min: 5,
    max: 200,
    pattern: /^[a-zA-Z0-9\s,.\-#/()'ñÑ]+$/,
    patternMessage: 'Project location contains invalid special characters.',
  });
  if (locationErr) errors.push(locationErr);

  const natureErr = validateTextField(data.nature_of_construction, {
    label: 'Nature of construction',
    required: false,
    min: 3,
    max: 100,
    pattern: /^[a-zA-Z0-9\s,.\-/()&ñÑ]+$/,
    patternMessage: 'Nature of construction contains invalid special characters.',
  });
  if (natureErr) errors.push(natureErr);

  const buildingErr = validateTextField(data.building_type, {
    label: 'Building type',
    required: false,
    min: 3,
    max: 100,
    pattern: /^[a-zA-Z0-9\s,.\-/()&ñÑ]+$/,
    patternMessage: 'Building type contains invalid special characters.',
  });
  if (buildingErr) errors.push(buildingErr);

  if (data.total_floor_area !== undefined && data.total_floor_area !== '' && data.total_floor_area !== null) {
    const area = Number(data.total_floor_area);
    if (!Number.isFinite(area) || area < 0 || area > 100000) {
      errors.push('Estimated floor area must be a valid number between 0 and 100,000 sq.m.');
    }
  }

  if (data.num_storeys !== undefined && data.num_storeys !== '' && data.num_storeys !== null) {
    const storeys = Number(data.num_storeys);
    if (!Number.isInteger(storeys) || storeys < 1 || storeys > 100) {
      errors.push('Number of storeys must be a whole number between 1 and 100.');
    }
  }

  const cleanNotes = String(data.notes || '').trim();
  if (cleanNotes.length > 500) {
    errors.push('Notes must be at most 500 characters.');
  } else if (cleanNotes.length >= 6 && isGibberishText(cleanNotes)) {
    errors.push('Notes contain invalid or random repeated characters.');
  }

  return errors;
}

module.exports = {
  validateEmailFormat,
  verifyEmailDeliverable,
  validatePermitFields,
  isGibberishText,
};
