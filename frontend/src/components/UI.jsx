import { useState, useRef, useEffect } from 'react';

export function Icon({ name, size = 18 }) {
  const icons = {
    dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor" />,
    clients: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />,
    permits: <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor" />,
    payments: <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="currentColor" />,
    reports: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor" />,
    audit: <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" />,
    users: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />,
    settings: <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor" />,
    shield: <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="currentColor" />,
    search: <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />,
    bell: <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor" />,
    menu: <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor" />,
    plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />,
    close: <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />,
    edit: <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />,
    delete: <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />,
    view: <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor" />,
    print: <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" fill="currentColor" />,
    calendar: <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" fill="currentColor" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {icons[name]}
    </svg>
  );
}

/**
 * Custom Floating Rounded Select Component
 * Replaces native 0px square OS dropdown popups with a floating rounded pill popover
 */
export function CustomSelect({ value, onChange, options, placeholder = 'Select option', style, className = '' }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [pos, setPos] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const estHeight = Math.min(260, 6 + options.length * 36);
      const up = window.innerHeight - rect.bottom < estHeight + 6;
      const width = Math.max(rect.width, 190);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setOpenUp(up);
      setPos(up
        ? { bottom: window.innerHeight - rect.top + 6, left, width }
        : { top: rect.bottom + 6, left, width }
      );
    }
    setOpen(next);
  };

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={`custom-select-wrap ${className}`} ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div 
        className="custom-select-trigger" 
        onClick={handleToggle}
        tabIndex={0}
      >
        <span className="custom-select-value">{displayLabel}</span>
        <svg className={`custom-select-arrow ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {open && (
        <div className={`custom-select-dropdown ${openUp ? 'open-up' : ''}`} style={pos ? { position: 'fixed', ...pos } : undefined}>
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <div 
                key={String(opt.value)} 
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Custom Floating Rounded Date Picker Component
 * Replaces native OS 0px square datepicker popup with a floating rounded Gumaca theme calendar
 */
export function CustomDatePicker({ value, onChange, placeholder = 'Select date', style, className = '' }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [pos, setPos] = useState(null);
  const containerRef = useRef(null);

  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(isNaN(initialDate.getFullYear()) ? new Date().getFullYear() : initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(isNaN(initialDate.getMonth()) ? new Date().getMonth() : initialDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const up = window.innerHeight - rect.bottom < 340;
      const left = Math.min(rect.left, window.innerWidth - 280 - 8);
      setOpenUp(up);
      setPos(up
        ? { bottom: window.innerHeight - rect.top + 6, left }
        : { top: rect.bottom + 6, left }
      );
    }
    setOpen(next);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const formatted = `${viewYear}-${m}-${d}`;
    onChange(formatted);
    setOpen(false);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const displayString = value ? formatDate(value) : placeholder;

  return (
    <div className={`custom-datepicker-wrap ${className}`} ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div 
        className="custom-datepicker-trigger" 
        onClick={handleToggle}
        tabIndex={0}
      >
        <Icon name="calendar" size={16} />
        <span className="custom-datepicker-value">{displayString}</span>
      </div>

      {open && (
        <div className={`custom-datepicker-popover ${openUp ? 'open-up' : ''}`} style={pos ? { position: 'fixed', ...pos } : undefined}>
          <div className="calendar-header">
            <button type="button" className="cal-nav-btn" onClick={handlePrevMonth}>&lsaquo;</button>
            <span className="cal-title">{monthNames[viewMonth]} {viewYear}</span>
            <button type="button" className="cal-nav-btn" onClick={handleNextMonth}>&rsaquo;</button>
          </div>

          <div className="calendar-weekdays">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div className="calendar-days">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <span key={`empty-${i}`} className="cal-day empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const m = String(viewMonth + 1).padStart(2, '0');
              const dStr = String(day).padStart(2, '0');
              const currentIso = `${viewYear}-${m}-${dStr}`;
              const isSelected = value === currentIso;
              const isToday = new Date().toISOString().split('T')[0] === currentIso;

              return (
                <button
                  key={day}
                  type="button"
                  className={`cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleSelectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="calendar-footer">
            <button type="button" className="cal-footer-btn" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>
            <button type="button" className="cal-footer-btn primary" onClick={() => { 
              const todayIso = new Date().toISOString().split('T')[0];
              onChange(todayIso);
              setOpen(false);
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, large }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${large ? 'modal-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, limit, total, onPageChange }) {
  const totalPages = Math.ceil(total / limit) || 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="pagination">
      <span>Showing {from} to {to} of {total} entries</span>
      <div className="pagination-btns">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = i + 1;
          return <button key={p} className={p === page ? 'active' : ''} onClick={() => onPageChange(p)}>{p}</button>;
        })}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function formatCurrency(n) {
  return `₱ ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-PH');
}

export function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return formatDate(d);
}

export const ROLE_LABELS = {
  admin: 'System Admin',
  municipal_engineer: 'Municipal Engineer',
  engineering_staff: 'Engineering Staff',
  cashier: 'Cashier',
  viewer: 'Citizen / Viewer',
};

export const PERMIT_TYPES = {
  building: 'Building Permit',
  electrical: 'Electrical Permit',
  occupancy: 'Occupancy Permit',
  locational: 'Locational Clearance',
  certificate: 'Certificate',
};

export const STATUS_LABELS = {
  submitted: 'Submitted',
  for_review: 'For Review',
  for_payment: 'For Payment',
  for_approval: 'For Approval',
  approved: 'Approved',
  released: 'Released',
  rejected: 'Rejected',
};
