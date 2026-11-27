import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  Icon, Modal, Pagination, PERMIT_TYPES, STATUS_LABELS, formatCurrency, formatDate,
  formatDateTime, formatFileSize, CustomSelect, CustomDatePicker,
} from '../components/UI';
import { ELECTRICAL_SUBTYPES, getRequirementsForPermit } from '../constants/permits';
import { getFeeTemplate, computeFeeTotal, buildFeeBreakdownItems } from '../constants/fees';
import DocumentsPanel from '../components/DocumentsPanel';
import Receipt from '../components/Receipt';
import PermitAssessmentSheet from '../components/PermitAssessmentSheet';
import {
  BUILDING_TYPE_OPTIONS,
  NATURE_OF_CONSTRUCTION_OPTIONS,
  filterDecimalInput,
  filterIntegerInput,
  filterLabelTextInput,
  filterLocationInput,
  filterNameInput,
  filterPhoneInput,
  validateNotes,
  validatePermitDetails,
  validatePermitSpecs,
} from '../utils/validation';

const STEPS = ['Application Details', 'Requirements', 'Order of Payment', 'Review'];
const STATUS_FLOW = ['submitted', 'for_review', 'for_approval', 'approved', 'paid', 'released'];

const emptyForm = {
  permit_type: 'building',
  electrical_subtype: 'electrification',
  client_id: '',
  client_mode: 'existing',
  new_client_name: '',
  new_client_contact: '',
  new_client_address: '',
  application_date: new Date().toISOString().split('T')[0],
  project_location: '',
  nature_of_construction: '',
  building_type: '',
  total_floor_area: '',
  num_storeys: 1,
  assigned_staff_id: '',
  notes: '',
};

export default function Permits() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isClient = user?.role === 'viewer';
  const isStaff = ['engineering_staff', 'admin'].includes(user?.role);
  const isEngineer = user?.role === 'municipal_engineer';
  const canReviewDocuments = ['admin', 'engineering_staff', 'municipal_engineer'].includes(user?.role);
  const canArchive = ['admin', 'engineering_staff', 'municipal_engineer'].includes(user?.role);

  const [permits, setPermits] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [myClient, setMyClient] = useState(null);
  const [staff, setStaff] = useState([]);
  const [step, setStep] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPermit, setSelectedPermit] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [decision, setDecision] = useState(null);
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [viewSuccess, setViewSuccess] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [error, setError] = useState('');
  const [requirementFiles, setRequirementFiles] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [validatingStep, setValidatingStep] = useState(false);
  const [natureOther, setNatureOther] = useState(false);
  const [buildingOther, setBuildingOther] = useState(false);
  const [feeItems, setFeeItems] = useState({});
  const [feeOthersLabel, setFeeOthersLabel] = useState('');
  const [viewTab, setViewTab] = useState('details');
  const [archiveView, setArchiveView] = useState('active');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getPermits({
        search,
        status,
        type,
        archived: canArchive && archiveView === 'archived' ? '1' : '0',
        page,
        limit: 10,
      });
      setPermits(data.permits);
      setTotal(data.total);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, search, status, type, archiveView, canArchive]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    if (querySearch !== null) {
      setSearch(querySearch);
      setPage(1);
    }
    const action = searchParams.get('action');
    if (action === 'new') {
      setSearchParams({}, { replace: true });
      setForm({
        ...emptyForm,
        client_id: myClient?.id ? String(myClient.id) : '',
      });
      setRequirementFiles({});
      setNatureOther(false);
      setBuildingOther(false);
      setStep(0);
      setError('');
      setPageSuccess('');
      setSelectedPermit(null);
      setModal('create');
      return;
    }
    const openId = searchParams.get('open');
    if (!openId) return;
    setSearchParams({}, { replace: true });
    api.getPermit(openId)
      .then((data) => {
        setViewError('');
        setViewSuccess('');
        setSelectedPermit(data);
        setModal('view');
      })
      .catch(() => {});
  }, [searchParams, setSearchParams, myClient]);

  // Poll so status changes made on another laptop appear without a manual reload.
  useEffect(() => {
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (isClient) {
      api.getMyClient()
        .then((client) => { setMyClient(client); setClients([client]); })
        .catch((err) => setError(err.message));
    } else {
      api.getClients({ search: '', page: 1, limit: 1000 })
        .then((d) => setClients(d.clients))
        .catch(() => {});
    }
    if (!isClient) {
      api.getStaff().then(setStaff).catch(() => {});
    }
  }, [isClient]);

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(form.client_id)),
    [clients, form.client_id],
  );

  const refreshSelected = async (permitId = selectedPermit?.id) => {
    if (!permitId) return;
    try {
      setSelectedPermit(await api.getPermit(permitId));
    } catch (err) {
      setViewError(err.message);
    }
  };

  const openCreate = () => {
    setForm({
      ...emptyForm,
      client_id: myClient?.id ? String(myClient.id) : '',
    });
    setRequirementFiles({});
    setFeeItems({});
    setFeeOthersLabel('');
    setNatureOther(false);
    setBuildingOther(false);
    setStep(0);
    setError('');
    setPageSuccess('');
    setSelectedPermit(null);
    setModal('create');
  };

  const openView = async (permit) => {
    setViewError('');
    setViewSuccess('');
    setViewTab('details');
    try {
      const data = await api.getPermit(permit.id);
      setSelectedPermit(data);
      setModal('view');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleArchivePermit = async (permit) => {
    if (!confirm(`Archive application ${permit.application_no}?`)) return;
    try {
      await api.archivePermit(permit.id);
      setPageSuccess(`Application ${permit.application_no} moved to Archive.`);
      await load(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRestorePermit = async (permit) => {
    try {
      await api.restorePermit(permit.id);
      setPageSuccess(`Application ${permit.application_no} restored from Archive.`);
      await load(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePermit = async (permit) => {
    if (!confirm(`Permanently delete application ${permit.application_no}? This cannot be undone.`)) return;
    try {
      await api.deletePermit(permit.id);
      setPageSuccess(`Application ${permit.application_no} permanently deleted.`);
      await load(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openPreview = async (permit) => {
    try {
      setPreviewData(await api.getPermitPreview(permit.id));
      setModal('preview');
    } catch (err) {
      alert(err.message);
    }
  };

  const requiredDocs = getRequirementsForPermit(form.permit_type, form.electrical_subtype);

  const handleReqFileChange = (reqName, file) => {
    setError('');
    if (!file) return;
    const isAllowed = file.type === 'application/pdf'
      || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    if (!isAllowed) {
      setError(`"${file.name}" is not supported. Only PDF or image files (JPG, PNG, WEBP) are allowed.`);
      return;
    }
    setRequirementFiles((prev) => ({ ...prev, [reqName]: file }));
  };

  const handleNextStep = async () => {
    setError('');
    if (step === 0) {
      if (isClient) {
        if (!myClient?.id) {
          setError('Your client profile is still loading. Please try again.');
          return;
        }
      } else if (form.client_mode === 'new') {
        if (!String(form.new_client_name || '').trim()) {
          setError('Client Full Name is required.');
          return;
        }
        if (!String(form.new_client_address || '').trim()) {
          setError('Client Address is required.');
          return;
        }
      } else if (!form.client_id) {
        setError('Please select a client or switch to New Walk-in Client.');
        return;
      }

      const detailsErr = validatePermitDetails({
        project_location: form.project_location,
        nature_of_construction: form.nature_of_construction,
        building_type: form.building_type,
      });
      if (detailsErr) {
        setError(detailsErr);
        return;
      }
    }
    if (step === 2) {
      const specsErr = validatePermitSpecs({
        total_floor_area: form.total_floor_area,
        num_storeys: form.num_storeys,
      });
      if (specsErr) {
        setError(specsErr);
        return;
      }
    }
    setStep(step + 1);
  };

  const handleCreate = async () => {
    let clientId = isClient ? myClient?.id : form.client_id;
    if (!isClient && form.client_mode === 'new') {
      if (!String(form.new_client_name || '').trim()) {
        setError('Client Full Name is required.');
        setStep(0);
        return;
      }
    } else if (!clientId) {
      setError(isClient
        ? 'Your client profile is still loading. Please try again.'
        : 'Please select a client.');
      setStep(0);
      return;
    }
    const notesErr = validateNotes(form.notes);
    if (notesErr) {
      setError(notesErr);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (!isClient && form.client_mode === 'new') {
        const createdClient = await api.createClient({
          full_name: form.new_client_name.trim(),
          contact_number: form.new_client_contact.trim(),
          address: form.new_client_address.trim(),
        });
        clientId = createdClient.id;
        api.getClients({ search: '', page: 1, limit: 1000 })
          .then((d) => setClients(d.clients))
          .catch(() => {});
      }

      const computedTotal = computeFeeTotal(feeItems);
      const breakdownItems = buildFeeBreakdownItems(form.permit_type, feeItems, feeOthersLabel);

      const created = await api.createPermit({
        ...form,
        client_id: Number(clientId),
        assigned_staff_id: !isClient && form.assigned_staff_id
          ? Number(form.assigned_staff_id)
          : null,
        total_floor_area: Number(form.total_floor_area || 0),
        num_storeys: Number(form.num_storeys || 1),
        total_fee: computedTotal > 0 ? computedTotal : undefined,
        fee_breakdown: breakdownItems.length > 0 ? breakdownItems : undefined,
      });

      const detail = await api.getPermit(created.id);
      const reqs = detail.requirements || [];
      for (const reqName of requiredDocs) {
        const file = requirementFiles[reqName];
        if (!file) continue;
        const matchedReq = reqs.find((r) => r.requirement_name === reqName);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('document_type', reqName);
        if (matchedReq) fd.append('requirement_id', String(matchedReq.id));
        await api.uploadDocument(created.id, fd);
        if (matchedReq && !isClient) {
          await api.updateRequirement(created.id, matchedReq.id, 'submitted');
        }
      }

      setModal(null);
      setViewSuccess('');
      setPageSuccess(`Application ${created.application_no} submitted.`);
      await load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action, successMessage) => {
    setActionLoading(true);
    setViewError('');
    setViewSuccess('');
    try {
      const result = await action();
      await load(true);
      await refreshSelected();
      setViewSuccess(successMessage);
    } catch (err) {
      setViewError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequirementToggle = async (permitId, reqId, newStatus) => {
    try {
      await api.updateRequirement(permitId, reqId, newStatus);
      await refreshSelected(permitId);
    } catch (err) {
      alert(err.message);
    }
  };

  const openDecision = (kind) => {
    setDecision(kind);
    setDecisionRemarks('');
    setDecisionError('');
  };

  const submitDecision = async () => {
    if (decision === 'reject' && !decisionRemarks.trim()) {
      setDecisionError('Rejection remarks are required.');
      return;
    }
    setActionLoading(true);
    setDecisionError('');
    try {
      const result = decision === 'approve'
        ? await api.approvePermit(selectedPermit.id, decisionRemarks.trim())
        : await api.rejectPermit(selectedPermit.id, decisionRemarks.trim());
      setDecision(null);
      await load(true);
      await refreshSelected();
      const baseMsg = decision === 'approve'
        ? 'Application approved. Payment can now be processed.'
        : 'Application rejected.';
      setViewSuccess(baseMsg);
    } catch (err) {
      setDecisionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openReceipt = async (paymentId) => {
    try {
      setReceiptData(await api.getReceipt(paymentId));
    } catch (err) {
      alert(err.message);
    }
  };

  const currentStatusIndex = selectedPermit ? STATUS_FLOW.indexOf(selectedPermit.status) : -1;

  return (
    <div>
      <h1 className="page-title">{isClient ? 'My Permit Applications' : 'Permit Applications'}</h1>
      <p className="page-subtitle">
        {isClient
          ? 'Submit applications, upload requirements and track their status'
          : 'Process permit requests, review documents and track approvals'}
      </p>

      {error && <div className="login-error">{error}</div>}
      {pageSuccess && <div className="badge badge-active" style={{ display: 'inline-block', marginBottom: 12 }}>{pageSuccess}</div>}

      {canArchive && (
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`tab ${archiveView === 'active' ? 'active' : ''}`}
            onClick={() => { setArchiveView('active'); setPage(1); }}
          >
            Active Applications
          </button>
          <button
            type="button"
            className={`tab ${archiveView === 'archived' ? 'active' : ''}`}
            onClick={() => { setArchiveView('archived'); setPage(1); }}
          >
            Archived Applications
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="form-control"
            style={{ width: 220 }}
            placeholder="Search application or client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <CustomSelect
            value={type}
            onChange={(val) => { setType(val); setPage(1); }}
            placeholder="All Types"
            options={[
              { value: '', label: 'All Types' },
              ...Object.entries(PERMIT_TYPES).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <CustomSelect
            value={status}
            onChange={(val) => { setStatus(val); setPage(1); }}
            placeholder="All Status"
            options={[
              { value: '', label: 'All Status' },
              ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={16} /> New Application
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="loading">Loading permits...</div> : (
            <table>
              <thead>
                <tr>
                  <th>Application No.</th>
                  <th>Client</th>
                  <th>Permit Type</th>
                  <th>Status</th>
                  <th>Fee</th>
                  <th>Paid</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {permits.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No permit applications found.</td></tr>
                ) : permits.map((p) => (
                  <tr key={p.id}>
                    <td>{p.application_no}</td>
                    <td>{p.client_name}</td>
                    <td>{PERMIT_TYPES[p.permit_type] || p.permit_type}</td>
                    <td>
                      <span className={`badge badge-${p.status}`}>{STATUS_LABELS[p.status] || p.status}</span>
                      {p.resubmission_count > 0 && (
                        <span className="badge badge-requires_resubmission" style={{ marginLeft: 4 }}>
                          {p.resubmission_count} to resubmit
                        </span>
                      )}
                    </td>
                    <td>{formatCurrency(p.total_fee)}</td>
                    <td>{formatCurrency(p.amount_paid)}</td>
                    <td>{p.document_count || 0}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openView(p)}>
                        Review
                      </button>
                      {!isClient && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openPreview(p)}>
                          Preview
                        </button>
                      )}
                      {isEngineer && archiveView === 'active' && p.status === 'for_approval' && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={async () => {
                            await openView(p);
                            openDecision('approve');
                          }}
                        >
                          Approve
                        </button>
                      )}
                      {canArchive && archiveView === 'active' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleArchivePermit(p)}
                        >
                          Archive
                        </button>
                      )}
                      {canArchive && archiveView === 'archived' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handleRestorePermit(p)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeletePermit(p)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '0 16px' }}>
          <Pagination page={page} limit={10} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal
        open={modal === 'create'}
        onClose={() => setModal(null)}
        title="New Permit Application"
        large
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={submitting}>Cancel</button>
            {step > 0 && <button className="btn btn-secondary" onClick={() => { setError(''); setStep(step - 1); }} disabled={submitting}>Back</button>}
            {step < STEPS.length - 1
              ? <button className="btn btn-primary" onClick={handleNextStep} disabled={validatingStep}>{validatingStep ? 'Validating...' : 'Next'}</button>
              : <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Application'}</button>}
          </>
        }
      >
        <div className="stepper">
          {STEPS.map((label, i) => (
            <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
              <div className="step-num">{i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>
        {error && <div className="login-error">{error}</div>}

        {step === 0 && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Permit Type</label>
                <CustomSelect
                  value={form.permit_type}
                  onChange={(val) => {
                    setForm({ ...form, permit_type: val });
                    setRequirementFiles({});
                    setFeeItems({});
                    setFeeOthersLabel('');
                  }}
                  options={Object.entries(PERMIT_TYPES).map(([key, label]) => ({ value: key, label }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>Application Date</label>
                <CustomDatePicker
                  value={form.application_date}
                  onChange={(val) => setForm({ ...form, application_date: val })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            {form.permit_type === 'electrical' && (
              <div className="form-group">
                <label>Electrical Application Type</label>
                <CustomSelect
                  value={form.electrical_subtype}
                  onChange={(val) => { setForm({ ...form, electrical_subtype: val }); setRequirementFiles({}); }}
                  options={Object.entries(ELECTRICAL_SUBTYPES).map(([key, label]) => ({ value: key, label }))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
            {isClient ? (
              <div className="form-group">
                <label>Applicant</label>
                <input className="form-control" value={myClient ? `${myClient.client_id} - ${myClient.full_name}` : 'Loading your profile...'} readOnly />
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${form.client_mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setForm({ ...form, client_mode: 'existing' })}
                  >
                    Existing Client
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${form.client_mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setForm({ ...form, client_mode: 'new', client_id: '' })}
                  >
                    New Walk-in Client
                  </button>
                </div>

                {form.client_mode === 'existing' ? (
                  <div className="form-group">
                    <label>Client *</label>
                    <CustomSelect
                      value={form.client_id}
                      onChange={(val) => setForm({ ...form, client_id: val })}
                      placeholder="Select client"
                      options={clients.map((c) => ({ value: c.id, label: `${c.client_id} - ${c.full_name}` }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                ) : (
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Client Full Name *</label>
                      <input
                        className="form-control"
                        placeholder="Juan Dela Cruz"
                        value={form.new_client_name}
                        onChange={(e) => setForm({ ...form, new_client_name: filterNameInput(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Number</label>
                      <input
                        className="form-control"
                        placeholder="09XXXXXXXXX"
                        value={form.new_client_contact}
                        onChange={(e) => setForm({ ...form, new_client_contact: filterPhoneInput(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Client Address *</label>
                      <input
                        className="form-control"
                        placeholder="Barangay, Gumaca, Quezon"
                        value={form.new_client_address}
                        onChange={(e) => setForm({ ...form, new_client_address: filterLocationInput(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label>Project Location *</label>
              <input
                className="form-control"
                placeholder="e.g. Brgy. Poblacion, Gumaca, Quezon"
                maxLength={200}
                value={form.project_location}
                onChange={(e) => setForm({ ...form, project_location: filterLocationInput(e.target.value) })}
              />
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>Nature of Construction</label>
                <CustomSelect
                  value={natureOther ? '__other__' : form.nature_of_construction}
                  onChange={(val) => {
                    if (val === '__other__') {
                      setNatureOther(true);
                      setForm({ ...form, nature_of_construction: '' });
                    } else {
                      setNatureOther(false);
                      setForm({ ...form, nature_of_construction: val });
                    }
                  }}
                  placeholder="Select nature of construction"
                  options={NATURE_OF_CONSTRUCTION_OPTIONS}
                  style={{ width: '100%' }}
                />
                {natureOther && (
                  <input
                    className="form-control"
                    style={{ marginTop: 6 }}
                    placeholder="Specify nature of construction"
                    maxLength={100}
                    value={form.nature_of_construction}
                    onChange={(e) => setForm({ ...form, nature_of_construction: filterLabelTextInput(e.target.value, 100) })}
                  />
                )}
              </div>
              <div className="form-group">
                <label>Building Type</label>
                <CustomSelect
                  value={buildingOther ? '__other__' : form.building_type}
                  onChange={(val) => {
                    if (val === '__other__') {
                      setBuildingOther(true);
                      setForm({ ...form, building_type: '' });
                    } else {
                      setBuildingOther(false);
                      setForm({ ...form, building_type: val });
                    }
                  }}
                  placeholder="Select building type"
                  options={BUILDING_TYPE_OPTIONS}
                  style={{ width: '100%' }}
                />
                {buildingOther && (
                  <input
                    className="form-control"
                    style={{ marginTop: 6 }}
                    placeholder="Specify building type"
                    maxLength={100}
                    value={form.building_type}
                    onChange={(e) => setForm({ ...form, building_type: filterLabelTextInput(e.target.value, 100) })}
                  />
                )}
              </div>
              {!isClient && (
                <div className="form-group">
                  <label>Assigned Staff</label>
                  <CustomSelect
                    value={form.assigned_staff_id}
                    onChange={(val) => setForm({ ...form, assigned_staff_id: val })}
                    placeholder="Unassigned"
                    options={staff.map((s) => ({ value: s.id, label: s.full_name }))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <div className="card">
            <div className="card-body">
              <p style={{ marginBottom: 12 }}>
                Upload PDF or image documents (JPG, PNG, WEBP) for <strong>{PERMIT_TYPES[form.permit_type]}</strong>. You may proceed even without uploading all requirements now.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requiredDocs.map((reqName) => {
                  const file = requirementFiles[reqName];
                  return (
                    <div
                      key={reqName}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-subcard)',
                        border: `1px solid ${file ? 'var(--green-600)' : 'var(--border-color)'}`,
                        background: file ? 'rgba(22, 163, 74, 0.06)' : 'var(--bg-subcard)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{reqName}</div>
                        <div style={{ fontSize: 12, color: file ? 'var(--green-800)' : 'var(--text-light)' }}>
                          {file ? `Uploaded: ${file.name} (${formatFileSize(file.size)})` : 'Optional (PDF or Image, max 10 MB)'}
                        </div>
                      </div>
                      <label className="btn btn-secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap', margin: 0 }}>
                        <Icon name="upload" size={14} /> {file ? 'Change File' : 'Upload PDF / Image'}
                        <input
                          type="file"
                          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => handleReqFileChange(reqName, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (() => {
          const feeRows = getFeeTemplate(form.permit_type);
          const computedTotal = computeFeeTotal(feeItems);
          return (
            <div className="card">
              <div className="card-header">
                <h3>Order of Payment &mdash; {PERMIT_TYPES[form.permit_type]}</h3>
              </div>
              <div className="card-body">
                <div className="form-row" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label>Estimated Floor Area (sq)</label>
                    <input
                      className="form-control"
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter floor area in sq (e.g. 120.5)"
                      value={form.total_floor_area}
                      onChange={(e) => setForm({ ...form, total_floor_area: filterDecimalInput(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Number of Storeys</label>
                    <input
                      className="form-control"
                      type="text"
                      inputMode="numeric"
                      placeholder="1"
                      value={form.num_storeys}
                      onChange={(e) => setForm({ ...form, num_storeys: filterIntegerInput(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, background: 'var(--bg-subcard)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, color: 'var(--text-main)' }}>
                    Itemized Fees (Enter applicable amounts — total computes automatically)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {feeRows.map((row) => (
                      <div
                        key={row.key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 160px',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{row.label}:</span>
                          {row.key === 'others' && (
                            <input
                              className="form-control"
                              style={{ padding: '4px 8px', fontSize: 12.5, maxWidth: 200 }}
                              placeholder="Specify others..."
                              value={feeOthersLabel}
                              onChange={(e) => setFeeOthersLabel(e.target.value)}
                            />
                          )}
                        </div>
                        <input
                          className="form-control"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          style={{ textAlign: 'right' }}
                          value={feeItems[row.key] || ''}
                          onChange={(e) => setFeeItems((prev) => ({
                            ...prev,
                            [row.key]: filterDecimalInput(e.target.value),
                          }))}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 15 }}>TOTAL ORDER OF PAYMENT</strong>
                    <strong style={{ fontSize: 18, color: 'var(--primary)' }}>{formatCurrency(computedTotal)}</strong>
                  </div>

                  {computedTotal > 0 && (
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
                      <div>LGU (80%): <strong>{formatCurrency(computedTotal * 0.8)}</strong></div>
                      <div>DPWH (5%): <strong>{formatCurrency(computedTotal * 0.05)}</strong></div>
                      <div>OBO (15%): <strong>{formatCurrency(computedTotal * 0.15)}</strong></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {step === 3 && (
          <div className="card">
            <div className="card-body">
              <div className="form-group">
                <label>Selected Client</label>
                <p>
                  {selectedClient
                    ? `${selectedClient.client_id} - ${selectedClient.full_name}`
                    : form.client_mode === 'new' && form.new_client_name
                      ? `${form.new_client_name} (New Walk-in Client)`
                      : myClient
                        ? `${myClient.client_id} - ${myClient.full_name}`
                        : 'No client selected'}
                </p>
              </div>
              <div className="form-group"><label>Permit Type</label><p>{PERMIT_TYPES[form.permit_type]}</p></div>
              <div className="form-group"><label>Project Location</label><p>{form.project_location || '-'}</p></div>
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Notes</span>
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{(form.notes || '').length}/500</span>
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  maxLength={500}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 500) })}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modal === 'view'}
        onClose={() => setModal(null)}
        title={selectedPermit ? `Application ${selectedPermit.application_no}` : 'Application Details'}
        large
        footer={selectedPermit && (
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Close</button>
            {isStaff && selectedPermit.status === 'submitted' && (
              <button className="btn btn-secondary" disabled={actionLoading}
                onClick={() => runAction(() => api.reviewPermit(selectedPermit.id), 'Application marked under review.')}>
                Mark Under Review
              </button>
            )}
            {isStaff && selectedPermit.status === 'for_review' && (
              <button className="btn btn-primary" disabled={actionLoading}
                onClick={() => runAction(() => api.forwardPermit(selectedPermit.id), 'Application forwarded to the Municipal Engineer.')}>
                Forward to Engineer
              </button>
            )}
            {isEngineer && selectedPermit.status === 'for_approval' && (
              <>
                <button className="btn btn-danger" disabled={actionLoading} onClick={() => openDecision('reject')}>Reject</button>
                <button className="btn btn-success" disabled={actionLoading} onClick={() => openDecision('approve')}>Approve</button>
              </>
            )}
            {isStaff && selectedPermit.status === 'paid' && (
              <button className="btn btn-primary" disabled={actionLoading}
                onClick={() => runAction(() => api.releasePermit(selectedPermit.id), 'Permit released to the client.')}>
                Release Permit
              </button>
            )}
          </>
        )}
      >
        {selectedPermit && (
          <>
            {viewError && <div className="login-error">{viewError}</div>}
            {viewSuccess && <div className="badge badge-active" style={{ display: 'inline-block', marginBottom: 12 }}>{viewSuccess}</div>}
            {selectedPermit.status === 'rejected' && (
              <div className="login-error">
                Application rejected. Reason: {selectedPermit.rejection_reason || 'No remarks provided.'}
              </div>
            )}

            <div className="permit-modal-layout">
              <div className="permit-modal-tabs" role="tablist" aria-label="Application Sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'details'}
                  className={`permit-modal-tab ${viewTab === 'details' ? 'active' : ''}`}
                  onClick={() => setViewTab('details')}
                >
                  Application Details
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'status'}
                  className={`permit-modal-tab ${viewTab === 'status' ? 'active' : ''}`}
                  onClick={() => setViewTab('status')}
                >
                  Status &amp; History
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'requirements'}
                  className={`permit-modal-tab ${viewTab === 'requirements' ? 'active' : ''}`}
                  onClick={() => setViewTab('requirements')}
                >
                  Requirements ({selectedPermit.requirements?.length || 0})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'documents'}
                  className={`permit-modal-tab ${viewTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setViewTab('documents')}
                >
                  Documents (PDF) ({selectedPermit.documents?.length || 0})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewTab === 'payments'}
                  className={`permit-modal-tab ${viewTab === 'payments' ? 'active' : ''}`}
                  onClick={() => setViewTab('payments')}
                >
                  Payments ({selectedPermit.payments?.length || 0})
                </button>
              </div>

              <div className="permit-modal-content">
                {viewTab === 'details' && (
                  <div className="card">
                    <div className="card-header"><h3>Application Details</h3></div>
                    <div className="card-body">
                      <div className="doc-field"><span className="label">Application No.</span><span>{selectedPermit.application_no}</span></div>
                      <div className="doc-field"><span className="label">Client</span><span>{selectedPermit.client_name}</span></div>
                      <div className="doc-field"><span className="label">Permit Type</span><span>{PERMIT_TYPES[selectedPermit.permit_type]}</span></div>
                      <div className="doc-field"><span className="label">Application Date</span><span>{formatDate(selectedPermit.application_date)}</span></div>
                      {selectedPermit.permit_type === 'electrical' && selectedPermit.electrical_subtype && (
                        <div className="doc-field">
                          <span className="label">Electrical Type</span>
                          <span>{ELECTRICAL_SUBTYPES[selectedPermit.electrical_subtype] || selectedPermit.electrical_subtype}</span>
                        </div>
                      )}
                      <div className="doc-field"><span className="label">Project Location</span><span>{selectedPermit.project_location || '-'}</span></div>
                      <div className="doc-field"><span className="label">Assigned Staff</span><span>{selectedPermit.assigned_staff_name || '-'}</span></div>
                      <div className="doc-field"><span className="label">Status</span><span><span className={`badge badge-${selectedPermit.status}`}>{STATUS_LABELS[selectedPermit.status] || selectedPermit.status}</span></span></div>
                      <div className="doc-field"><span className="label">Total Fee</span><span>{formatCurrency(selectedPermit.total_fee)}</span></div>
                      <div className="doc-field"><span className="label">Amount Paid</span><span>{formatCurrency(selectedPermit.amount_paid)}</span></div>
                      {selectedPermit.approved_by_name && (
                        <div className="doc-field"><span className="label">Approved By</span><span>{selectedPermit.approved_by_name}</span></div>
                      )}
                      {selectedPermit.approved_at && (
                        <div className="doc-field"><span className="label">Approved At</span><span>{formatDateTime(selectedPermit.approved_at)}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {viewTab === 'status' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card">
                      <div className="card-header"><h3>Application Status</h3></div>
                      <div className="card-body">
                        {selectedPermit.status === 'rejected' ? (
                          <div className="status-step current">
                            <div className="status-dot" />
                            <div>
                              <strong>Rejected</strong>
                              <div style={{ fontSize: 12, color: 'var(--red-800)' }}>{selectedPermit.rejection_reason || 'No remarks'}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="status-tracker">
                            {STATUS_FLOW.map((s, index) => {
                              const currentIndex = currentStatusIndex >= 0 ? currentStatusIndex : 0;
                              const stateClass = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
                              return (
                                <div key={s}>
                                  <div className={`status-step ${stateClass}`}>
                                    <div className="status-dot" />
                                    <div>
                                      <strong>{STATUS_LABELS[s]}</strong>
                                      <div style={{ fontSize: 12, color: 'var(--green-800)' }}>
                                        {index <= currentIndex ? 'Reached' : 'Pending'}
                                      </div>
                                    </div>
                                  </div>
                                  {index < STATUS_FLOW.length - 1 && <div className="status-line" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header"><h3>Approval History</h3></div>
                      <div className="card-body">
                        {selectedPermit.approvals?.length ? selectedPermit.approvals.map((approval) => (
                          <div key={approval.id} className="approval-record">
                            <div>
                              <span className={`badge badge-${approval.decision === 'approved' ? 'approved' : 'rejected'}`}>
                                {approval.decision === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
                              <strong style={{ marginLeft: 8 }}>{approval.engineer_name || 'Municipal Engineer'}</strong>
                            </div>
                            <div className="doc-meta">{formatDateTime(approval.created_at)}</div>
                            {approval.remarks && <div className="approval-remarks">{approval.remarks}</div>}
                          </div>
                        )) : <p className="page-subtitle">No engineer decision recorded yet.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {viewTab === 'requirements' && (
                  <div className="card">
                    <div className="card-header"><h3>Requirements Checklist</h3></div>
                    <div className="table-wrap mobile-card-table">
                      <table>
                        <thead><tr><th>Requirement</th><th style={{ width: 120 }}>Status</th><th style={{ width: 150 }}>Action</th></tr></thead>
                        <tbody>
                          {selectedPermit.requirements?.map((r) => (
                            <tr key={r.id}>
                              <td className="mobile-full" data-label="Requirement">{r.requirement_name}</td>
                              <td data-label="Status"><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                              <td data-label="Action">
                                {canReviewDocuments ? (
                                  <CustomSelect
                                    value={r.status}
                                    onChange={(val) => handleRequirementToggle(selectedPermit.id, r.id, val)}
                                    options={[
                                      { value: 'pending', label: 'Pending' },
                                      { value: 'submitted', label: 'Submitted' },
                                    ]}
                                    style={{ minWidth: 135 }}
                                  />
                                ) : (
                                  <span>{r.status === 'submitted' ? 'Submitted' : 'Pending'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {viewTab === 'documents' && (
                  <DocumentsPanel
                    permit={selectedPermit}
                    user={user}
                    onChanged={() => refreshSelected()}
                  />
                )}

                {viewTab === 'payments' && (
                  <div className="card">
                    <div className="card-header">
                      <h3>Order of Payment &amp; Payments</h3>
                      {isStaff && selectedPermit.status === 'approved' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={actionLoading}
                          onClick={() => runAction(async () => {
                            const res = await api.issueOrderOfPayment(selectedPermit.id);
                            await openReceipt(res.id);
                            return res;
                          }, 'Order of Payment issued.')}
                        >
                          Issue Order of Payment
                        </button>
                      )}
                    </div>
                    <div className="card-body">
                      {selectedPermit.payments?.length ? selectedPermit.payments.map((payment) => (
                        <div key={payment.id} className="payment-record">
                          <div>
                            <strong>{payment.or_number}</strong>
                            <div className="doc-meta">{formatDateTime(payment.payment_date)} · {payment.cashier_name || '-'}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className={`badge badge-${payment.status === 'pending' ? 'for_payment' : 'paid'}`}>
                              {payment.status === 'pending' ? 'Unpaid' : 'Paid'}
                            </span>
                            <strong>{formatCurrency(payment.amount)}</strong>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt(payment.id)}>
                              Order of Payment
                            </button>
                            {payment.status === 'pending' && isStaff && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                disabled={actionLoading}
                                onClick={() => runAction(() => api.markPaymentPaid(payment.id), 'Payment marked as PAID.')}
                              >
                                Mark as Paid
                              </button>
                            )}
                          </div>
                        </div>
                      )) : <p className="page-subtitle">No Order of Payment issued yet.</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision === 'approve' ? 'Approve Application' : 'Reject Application'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDecision(null)}>Cancel</button>
            <button
              className={`btn ${decision === 'approve' ? 'btn-success' : 'btn-danger'}`}
              onClick={submitDecision}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving...' : (decision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
            </button>
          </>
        }
      >
        {decisionError && <div className="login-error">{decisionError}</div>}
        <p style={{ marginBottom: 12 }}>
          {decision === 'approve'
            ? 'The application status will be updated to Approved and payment will be allowed.'
            : 'The application status will be updated to Rejected and the client will be notified.'}
        </p>
        <div className="form-group">
          <label>Remarks {decision === 'reject' ? '*' : '(optional)'}</label>
          <textarea
            className="form-control"
            rows={4}
            value={decisionRemarks}
            onChange={(e) => setDecisionRemarks(e.target.value)}
            placeholder={decision === 'reject'
              ? 'Explain why the application is rejected...'
              : 'Optional approval remarks...'}
          />
        </div>
      </Modal>

      <Modal open={modal === 'preview'} onClose={() => setModal(null)} title="Printable Permit Preview" large>
        {previewData && <PermitAssessmentSheet data={previewData} />}
      </Modal>

      <Modal open={!!receiptData} onClose={() => setReceiptData(null)} title="Order of Payment" large>
        {receiptData && <Receipt data={receiptData} />}
      </Modal>
    </div>
  );
}
