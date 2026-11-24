import { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, Plus, Loader2, AlertCircle, MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { Panel, Badge, EmptyState } from '@/components/ui';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { color: 'blue' | 'amber' | 'green' | 'red'; icon: typeof Clock }> = {
  open: { color: 'blue', icon: Clock },
  in_progress: { color: 'amber', icon: Loader2 },
  resolved: { color: 'green', icon: CheckCircle2 },
  closed: { color: 'neutral' as never, icon: CheckCircle2 },
};

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export function SupportPage() {
  const { user } = useApp();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    setTickets(data as Ticket[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.subject.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: form.subject.trim(),
      description: form.description.trim(),
      priority: form.priority,
    });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    setForm({ subject: '', description: '', priority: 'normal' });
    setShowForm(false);
    setSubmitting(false);
    fetchTickets();
  };

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        subtitle="Get help from the Support Team"
        icon={<LifeBuoy className="h-5 w-5" />}
        actions={
          <button onClick={() => setShowForm((v) => !v)} className="btn-gold text-xs">
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        }
      />

      {showForm && (
        <Panel className="mb-6 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Brief summary of your issue"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="input-field"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="input-field resize-none"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 text-red-400" /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-gold text-xs disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Submit Ticket
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-xs">Cancel</button>
            </div>
          </form>
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
        </div>
      ) : tickets.length === 0 ? (
        <Panel className="p-6">
          <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="No support tickets" subtitle="Create a ticket if you need help from the Support Team." />
        </Panel>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
            const StatusIcon = statusCfg.icon;
            return (
              <Panel key={t.id} hover className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-white">{t.subject}</h3>
                      <Badge variant={statusCfg.color}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {t.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant={t.priority === 'urgent' ? 'red' : t.priority === 'high' ? 'amber' : 'neutral'}>
                        {t.priority}
                      </Badge>
                    </div>
                    {t.description && <p className="mt-2 text-sm text-ink-200">{t.description}</p>}
                    <p className="mt-3 text-[11px] text-ink-400">
                      Opened {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
