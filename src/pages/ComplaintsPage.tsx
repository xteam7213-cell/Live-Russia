import { useState, useEffect, useCallback } from 'react';
import { Gavel, Loader2, AlertCircle, CheckCircle2, Shield, ShieldAlert, Lock, Search } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { usePermissions } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notifications';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';

interface ComplaintWithNames {
  id: string;
  complainant_id: string;
  accused_id: string;
  accused_role: string;
  subject: string;
  details: string;
  status: string;
  resolution_notes: string;
  resolver_id: string | null;
  created_at: string;
  updated_at: string;
  complainant_name?: string;
  accused_name?: string;
  accused_handle?: string;
}

const STATUS_COLORS: Record<string, 'gold' | 'green' | 'red' | 'amber' | 'blue'> = {
  pending: 'amber',
  under_review: 'blue',
  resolved: 'green',
  dismissed: 'red',
};

export function ComplaintsPage() {
  const { user, logAudit } = useApp();
  const { can, role } = usePermissions();
  const [complaints, setComplaints] = useState<ComplaintWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintWithNames | null>(null);
  const [resolveModal, setResolveModal] = useState<ComplaintWithNames | null>(null);

  const canFileComplaint = can('complaints.file');
  const canViewJunior = can('complaints.view_junior');
  const canViewAdmin = can('complaints.view_admin');
  const canViewAny = canViewJunior || canViewAdmin;

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('admin_complaints')
      .select(`
        id, complainant_id, accused_id, accused_role, subject, details, status,
        resolution_notes, resolver_id, created_at, updated_at
      `)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setComplaints([]);
      setLoading(false);
      return;
    }

    const ids = new Set<string>();
    data.forEach((c: ComplaintWithNames) => {
      ids.add(c.complainant_id);
      ids.add(c.accused_id);
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, handle')
      .in('id', Array.from(ids));

    const profileMap = new Map<string, { display_name: string; handle: string }>();
    (profiles || []).forEach((p: { id: string; display_name: string; handle: string }) => {
      profileMap.set(p.id, { display_name: p.display_name, handle: p.handle });
    });

    const enriched = data.map((c: ComplaintWithNames) => ({
      ...c,
      complainant_name: profileMap.get(c.complainant_id)?.display_name ?? 'Unknown',
      accused_name: profileMap.get(c.accused_id)?.display_name ?? 'Unknown',
      accused_handle: profileMap.get(c.accused_id)?.handle ?? 'unknown',
    }));

    setComplaints(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const filtered = complaints.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.subject.toLowerCase().includes(q) || c.accused_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const canResolveComplaint = (c: ComplaintWithNames) => {
    if (c.accused_role === 'Administrator') return canViewAdmin;
    if (c.accused_role === 'Junior Administrator') return canViewJunior;
    return false;
  };

  if (!canFileComplaint && !canViewAny) {
    return (
      <div>
        <PageHeader title="Admin Complaints" subtitle="You do not have access to this section." icon={<Gavel className="h-5 w-5" />} />
        <Panel className="p-8">
          <EmptyState icon={<Gavel className="h-6 w-6" />} title="Access Restricted" />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Administration Complaints"
        subtitle="Confidential complaints against staff — strict access hierarchy enforced"
        icon={<Gavel className="h-5 w-5" />}
        actions={canFileComplaint && (
          <button onClick={() => setShowForm(true)} className="btn-gold text-xs">
            <Gavel className="h-3.5 w-3.5" /> File Complaint
          </button>
        )}
      />

      <div className="mb-4 rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 text-xs text-gold-200/80">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
          <div>
            <p className="font-semibold text-gold-300">Confidentiality Hierarchy</p>
            <p className="mt-0.5">Complaints against Junior Administrators are visible to Administrators and the Server Owner only. Complaints against Administrators are visible to the Server Owner only. The accused staff member can never see complaints filed against them.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
        </div>
      )}

      {canViewAny && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              placeholder="Search by subject or accused..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field sm:w-44">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      )}

      {canViewAny ? (
        <Panel>
          <PanelHeader title={`Complaints (${filtered.length})`} icon={<Gavel className="h-4 w-4" />} />
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold-400" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Gavel className="h-6 w-6" />} title="No Complaints Found" />
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((c) => (
                <div key={c.id} className="cursor-pointer px-5 py-4 transition-colors hover:bg-white/[0.02]" onClick={() => setSelectedComplaint(c)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_COLORS[c.status] || 'neutral'}>{c.status}</Badge>
                        {c.accused_role === 'Administrator' ? (
                          <Badge variant="red"><ShieldAlert className="h-3 w-3" /> vs Administrator</Badge>
                        ) : (
                          <Badge variant="amber"><Shield className="h-3 w-3" /> vs Junior Admin</Badge>
                        )}
                        <span className="text-xs text-ink-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-white">{c.subject}</p>
                      <p className="mt-0.5 text-xs text-ink-300">Accused: {c.accused_name} (@{c.accused_handle})</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel className="p-8">
          <EmptyState icon={<Gavel className="h-6 w-6" />} title="File a Complaint" subtitle="You can file a complaint against a Junior Administrator or Administrator. You will be able to see the status of complaints you have filed." />
        </Panel>
      )}

      {showForm && canFileComplaint && (
        <FileComplaintModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => { setShowForm(false); fetchComplaints(); }}
          complainantId={user?.id || ''}
        />
      )}

      {selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          canResolve={canResolveComplaint(selectedComplaint)}
          onResolve={() => { setResolveModal(selectedComplaint); setSelectedComplaint(null); }}
        />
      )}

      {resolveModal && (
        <ResolveComplaintModal
          complaint={resolveModal}
          onClose={() => setResolveModal(null)}
          onResolved={(status, notes) => handleResolve(resolveModal.id, status, notes)}
        />
      )}
    </div>
  );

  async function handleResolve(complaintId: string, status: string, notes: string) {
    const { error: err } = await supabase
      .from('admin_complaints')
      .update({
        status,
        resolution_notes: notes,
        resolver_id: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', complaintId);

    if (err) {
      setError(err.message);
    } else {
      logAudit('Complaint resolved', `Complaint ${complaintId} → ${status}`, 'warning');
      const complainantId = resolveModal?.complainant_id;
      if (complainantId) {
        await sendNotification(complainantId, 'complaint', 'Complaint Update', `Your complaint status has been updated to: ${status}.`);
      }
      setResolveModal(null);
      fetchComplaints();
    }
  }
}

function FileComplaintModal({ onClose, onSubmitted, complainantId }: { onClose: () => void; onSubmitted: () => void; complainantId: string }) {
  const [staffSearch, setStaffSearch] = useState('');
  const [staff, setStaff] = useState<{ id: string; display_name: string; handle: string }[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [accusedRole, setAccusedRole] = useState<'Junior Administrator' | 'Administrator'>('Junior Administrator');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchStaff = async (q: string) => {
    setStaffSearch(q);
    if (q.length < 2) { setStaff([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, handle')
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    setStaff(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedStaff) { setError('Select the staff member to complain about.'); return; }
    if (selectedStaff === complainantId) { setError('You cannot file a complaint against yourself.'); return; }
    if (!subject.trim()) { setError('Subject is required.'); return; }
    setLoading(true);
    const { error: err } = await supabase.from('admin_complaints').insert({
      complainant_id: complainantId,
      accused_id: selectedStaff,
      accused_role: accusedRole,
      subject: subject.trim(),
      details: details.trim(),
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Panel className="w-full max-w-lg p-6 animate-fade-up max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">File Administration Complaint</h3>
        <p className="mt-1 text-xs text-ink-300">File a confidential complaint against a Junior Administrator or Administrator.</p>

        <div className="mt-3 rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 text-xs text-gold-200/80">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
            <p>This complaint is confidential. The accused staff member will never see this complaint. Complaints against Junior Administrators are reviewed by Administrators and the Server Owner. Complaints against Administrators are reviewed by the Server Owner only.</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Accused Staff Role</label>
            <select value={accusedRole} onChange={(e) => setAccusedRole(e.target.value as 'Junior Administrator' | 'Administrator')} className="input-field">
              <option value="Junior Administrator">Junior Administrator</option>
              <option value="Administrator">Administrator</option>
            </select>
          </div>

          <div>
            <label className="label">Search Accused Staff Member</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input value={staffSearch} onChange={(e) => searchStaff(e.target.value)} placeholder="Type name or handle..." className="input-field pl-9" />
            </div>
            {staff.length > 0 && (
              <div className="mt-2 space-y-1">
                {staff.map((s) => (
                  <button key={s.id} type="button" onClick={() => { setSelectedStaff(s.id); setStaffSearch(`${s.display_name} (@${s.handle})`); setStaff([]); }} className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-ink-900/60 px-3 py-2 text-left text-xs hover:border-gold-500/30">
                    <Shield className="h-3.5 w-3.5 text-ink-400" />
                    <span className="text-white">{s.display_name}</span>
                    <span className="text-ink-400">@{s.handle}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedStaff && <p className="mt-2 text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Staff member selected</p>}
          </div>

          <div>
            <label className="label">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of the complaint..." className="input-field" required />
          </div>

          <div>
            <label className="label">Details</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Provide full details of the complaint..." rows={4} className="input-field resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-xs">Cancel</button>
            <button type="submit" disabled={loading} className="btn-gold flex-1 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function ComplaintDetailModal({ complaint, onClose, canResolve, onResolve }: {
  complaint: ComplaintWithNames; onClose: () => void; canResolve: boolean; onResolve: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Panel className="w-full max-w-lg p-6 animate-fade-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">Complaint Details</h3>
          <Badge variant={STATUS_COLORS[complaint.status] || 'neutral'}>{complaint.status}</Badge>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {complaint.accused_role === 'Administrator' ? (
              <Badge variant="red"><ShieldAlert className="h-3 w-3" /> vs Administrator</Badge>
            ) : (
              <Badge variant="amber"><Shield className="h-3 w-3" /> vs Junior Admin</Badge>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Subject</p>
            <p className="text-white">{complaint.subject}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Accused</p>
            <p className="text-white">{complaint.accused_name} (@{complaint.accused_handle})</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Filed By</p>
            <p className="text-white">{complaint.complainant_name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Details</p>
            <p className="text-ink-100">{complaint.details || 'No additional details provided.'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Date</p>
            <p className="text-ink-200">{new Date(complaint.created_at).toLocaleString()}</p>
          </div>
          {complaint.resolution_notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-400">Resolution Notes</p>
              <p className="text-ink-100">{complaint.resolution_notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs">Close</button>
          {canResolve && complaint.status !== 'resolved' && complaint.status !== 'dismissed' && (
            <button onClick={onResolve} className="btn-gold flex-1 text-xs">Resolve</button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ResolveComplaintModal({ complaint, onClose, onResolved }: {
  complaint: ComplaintWithNames; onClose: () => void; onResolved: (status: string, notes: string) => void;
}) {
  const [status, setStatus] = useState('resolved');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onResolved(status, notes.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Panel className="w-full max-w-md p-6 animate-fade-up">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">Resolve Complaint</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Outcome</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field">
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="under_review">Under Review</option>
            </select>
          </div>
          <div>
            <label className="label">Resolution Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about the resolution..." rows={3} className="input-field resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-xs">Cancel</button>
            <button type="submit" disabled={loading} className="btn-gold flex-1 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
