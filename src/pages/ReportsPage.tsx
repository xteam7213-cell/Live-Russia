import { useState, useEffect, useCallback } from 'react';
import { Flag, Loader2, AlertCircle, CheckCircle2, FileText, User, Search } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { usePermissions } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notifications';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';

interface ReportWithNames {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string;
  status: string;
  resolution_notes: string;
  resolver_id: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  reported_name?: string;
  reported_handle?: string;
}

const STATUS_COLORS: Record<string, 'gold' | 'green' | 'red' | 'amber' | 'blue'> = {
  pending: 'amber',
  under_review: 'blue',
  resolved: 'green',
  dismissed: 'red',
};

export function ReportsPage() {
  const { user, logAudit } = useApp();
  const { can, role } = usePermissions();
  const [reports, setReports] = useState<ReportWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportWithNames | null>(null);
  const [resolveModal, setResolveModal] = useState<ReportWithNames | null>(null);

  const canViewReports = can('reports.view');
  const canFileReports = can('reports.file');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('member_reports')
      .select(`
        id, reporter_id, reported_id, reason, details, status, resolution_notes,
        resolver_id, created_at, updated_at
      `)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    const ids = new Set<string>();
    data.forEach((r: ReportWithNames) => {
      ids.add(r.reporter_id);
      ids.add(r.reported_id);
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, handle')
      .in('id', Array.from(ids));

    const profileMap = new Map<string, { display_name: string; handle: string }>();
    (profiles || []).forEach((p: { id: string; display_name: string; handle: string }) => {
      profileMap.set(p.id, { display_name: p.display_name, handle: p.handle });
    });

    const enriched = data.map((r: ReportWithNames) => ({
      ...r,
      reporter_name: profileMap.get(r.reporter_id)?.display_name ?? 'Unknown',
      reported_name: profileMap.get(r.reported_id)?.display_name ?? 'Unknown',
      reported_handle: profileMap.get(r.reported_id)?.handle ?? 'unknown',
    }));

    setReports(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filtered = reports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.reason.toLowerCase().includes(q) ||
        r.reported_name?.toLowerCase().includes(q) ||
        r.reported_handle?.toLowerCase().includes(q) ||
        r.reporter_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!canViewReports && !canFileReports) {
    return (
      <div>
        <PageHeader title="Member Reports" subtitle="You do not have access to this section." icon={<Flag className="h-5 w-5" />} />
        <Panel className="p-8">
          <EmptyState icon={<Flag className="h-6 w-6" />} title="Access Restricted" subtitle="Your role does not permit viewing or filing member reports." />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Member Reports"
        subtitle="Reports filed by staff against community members"
        icon={<Flag className="h-5 w-5" />}
        actions={canFileReports && (
          <button onClick={() => setShowForm(true)} className="btn-gold text-xs">
            <Flag className="h-3.5 w-3.5" /> File Report
          </button>
        )}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p>{error}</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            placeholder="Search by reason, member, or reporter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field sm:w-44"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <Panel>
        <PanelHeader title={`Reports (${filtered.length})`} icon={<FileText className="h-4 w-4" />} />
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Flag className="h-6 w-6" />} title="No Reports Found" subtitle="There are no member reports matching your criteria." />
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="cursor-pointer px-5 py-4 transition-colors hover:bg-white/[0.02]"
                onClick={() => setSelectedReport(r)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_COLORS[r.status] || 'neutral'}>{r.status}</Badge>
                      <span className="text-xs text-ink-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-white">{r.reason}</p>
                    <p className="mt-0.5 text-xs text-ink-300">
                      Reported: <span className="text-ink-100">{r.reported_name}</span> (@{r.reported_handle})
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      Filed by: {r.reporter_name}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showForm && canFileReports && (
        <FileReportModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => { setShowForm(false); fetchReports(); }}
          reporterId={user?.id || ''}
        />
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          canResolve={can('reports.view') && canFileReports}
          onResolve={() => { setResolveModal(selectedReport); setSelectedReport(null); }}
        />
      )}

      {resolveModal && (
        <ResolveReportModal
          report={resolveModal}
          onClose={() => setResolveModal(null)}
          onResolved={(status, notes) => handleResolve(resolveModal.id, status, notes)}
        />
      )}
    </div>
  );

  async function handleResolve(reportId: string, status: string, notes: string) {
    const { error: err } = await supabase
      .from('member_reports')
      .update({
        status,
        resolution_notes: notes,
        resolver_id: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (err) {
      setError(err.message);
    } else {
      logAudit('Report resolved', `Report ${reportId} → ${status}`, status === 'dismissed' ? 'warning' : 'info');
      const reportedId = resolveModal?.reported_id;
      if (reportedId) {
        await sendNotification(reportedId, 'report', 'Report Update', `Your report status has been updated to: ${status}.`);
      }
      setResolveModal(null);
      fetchReports();
    }
  }
}

function FileReportModal({ onClose, onSubmitted, reporterId }: { onClose: () => void; onSubmitted: () => void; reporterId: string }) {
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<{ id: string; display_name: string; handle: string }[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMembers = async (q: string) => {
    setMemberSearch(q);
    if (q.length < 2) { setMembers([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, handle')
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    setMembers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedMember) { setError('Select a member to report.'); return; }
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setLoading(true);
    const { error: err } = await supabase.from('member_reports').insert({
      reporter_id: reporterId,
      reported_id: selectedMember,
      reason: reason.trim(),
      details: details.trim(),
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Panel className="w-full max-w-lg p-6 animate-fade-up max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">File Member Report</h3>
        <p className="mt-1 text-xs text-ink-300">Report a community member for rule violations or misconduct.</p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Search Member to Report</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={memberSearch}
                onChange={(e) => searchMembers(e.target.value)}
                placeholder="Type handle or name..."
                className="input-field pl-9"
              />
            </div>
            {members.length > 0 && (
              <div className="mt-2 space-y-1">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setSelectedMember(m.id); setMemberSearch(`${m.display_name} (@${m.handle})`); setMembers([]); }}
                    className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-ink-900/60 px-3 py-2 text-left text-xs hover:border-gold-500/30"
                  >
                    <User className="h-3.5 w-3.5 text-ink-400" />
                    <span className="text-white">{m.display_name}</span>
                    <span className="text-ink-400">@{m.handle}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedMember && (
              <p className="mt-2 text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Member selected</p>
            )}
          </div>

          <div>
            <label className="label">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Harassment, Cheating, Spam..." className="input-field" required />
          </div>

          <div>
            <label className="label">Details</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Provide full details of the incident..." rows={4} className="input-field resize-none" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-xs">Cancel</button>
            <button type="submit" disabled={loading} className="btn-gold flex-1 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit Report'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function ReportDetailModal({ report, onClose, canResolve, onResolve }: {
  report: ReportWithNames; onClose: () => void; canResolve: boolean; onResolve: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Panel className="w-full max-w-lg p-6 animate-fade-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">Report Details</h3>
          <Badge variant={STATUS_COLORS[report.status] || 'neutral'}>{report.status}</Badge>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Reported Member</p>
            <p className="text-white">{report.reported_name} (@{report.reported_handle})</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Filed By</p>
            <p className="text-white">{report.reporter_name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Reason</p>
            <p className="text-white">{report.reason}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Details</p>
            <p className="text-ink-100">{report.details || 'No additional details provided.'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">Date</p>
            <p className="text-ink-200">{new Date(report.created_at).toLocaleString()}</p>
          </div>
          {report.resolution_notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-400">Resolution Notes</p>
              <p className="text-ink-100">{report.resolution_notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs">Close</button>
          {canResolve && report.status !== 'resolved' && report.status !== 'dismissed' && (
            <button onClick={onResolve} className="btn-gold flex-1 text-xs">Resolve</button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ResolveReportModal({ report, onClose, onResolved }: {
  report: ReportWithNames; onClose: () => void; onResolved: (status: string, notes: string) => void;
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
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">Resolve Report</h3>
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
