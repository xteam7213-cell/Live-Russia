import { useState, useEffect, useCallback } from 'react';
import { HandCoins, Loader2, AlertCircle, CheckCircle2, Search, Coins } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { usePermissions } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { sendNotification } from '@/lib/notifications';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';

interface OfferWithNames {
  id: string;
  officer_id: string;
  member_id: string;
  amount: number;
  interest_rate: number;
  term_days: number;
  purpose: string;
  status: string;
  created_at: string;
  updated_at: string;
  officer_name?: string;
  member_name?: string;
  member_handle?: string;
}

const STATUS_COLORS: Record<string, 'gold' | 'green' | 'red' | 'amber' | 'blue'> = {
  pending: 'amber',
  accepted: 'green',
  rejected: 'red',
  withdrawn: 'neutral' as 'gold',
};

export function LoanOffersPage() {
  const { user, logAudit } = useApp();
  const { can, role } = usePermissions();
  const [offers, setOffers] = useState<OfferWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);

  const canCreateOffers = can('loans.offers');
  const canViewOffers = can('loans.view') || can('loans.offers') || can('loans.manage');

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('loan_offers')
      .select('id, officer_id, member_id, amount, interest_rate, term_days, purpose, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (err) { setError(err.message); setLoading(false); return; }

    if (!data || data.length === 0) { setOffers([]); setLoading(false); return; }

    const ids = new Set<string>();
    data.forEach((o: OfferWithNames) => { ids.add(o.officer_id); ids.add(o.member_id); });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, handle')
      .in('id', Array.from(ids));

    const profileMap = new Map<string, { display_name: string; handle: string }>();
    (profiles || []).forEach((p: { id: string; display_name: string; handle: string }) => {
      profileMap.set(p.id, { display_name: p.display_name, handle: p.handle });
    });

    setOffers(data.map((o: OfferWithNames) => ({
      ...o,
      officer_name: profileMap.get(o.officer_id)?.display_name ?? 'Unknown',
      member_name: profileMap.get(o.member_id)?.display_name ?? 'Unknown',
      member_handle: profileMap.get(o.member_id)?.handle ?? 'unknown',
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const filtered = offers.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.member_name?.toLowerCase().includes(q) || o.member_handle?.toLowerCase().includes(q) || o.purpose.toLowerCase().includes(q);
    }
    return true;
  });

  const updateOfferStatus = async (offerId: string, status: string) => {
    const { error: err } = await supabase
      .from('loan_offers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (err) { setError(err.message); return; }
    logAudit('Loan offer updated', `Offer ${offerId} → ${status}`, 'info');
    fetchOffers();
  };

  if (!canViewOffers) {
    return (
      <div>
        <PageHeader title="Loan Offers" subtitle="You do not have access to this section." icon={<HandCoins className="h-5 w-5" />} />
        <Panel className="p-8"><EmptyState icon={<HandCoins className="h-6 w-6" />} title="Access Restricted" /></Panel>
      </div>
    );
  }

  const isMember = role === 'Normal Member';
  const isOfferRecipient = (o: OfferWithNames) => o.member_id === user?.id;

  return (
    <div>
      <PageHeader
        title="Loan Offers"
        subtitle="Loan offers from the Loan Center — separate from member loan requests"
        icon={<HandCoins className="h-5 w-5" />}
        actions={canCreateOffers && (
          <button onClick={() => setShowForm(true)} className="btn-gold text-xs">
            <HandCoins className="h-3.5 w-3.5" /> Create Offer
          </button>
        )}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input placeholder="Search by member or purpose..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field sm:w-44">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      <Panel>
        <PanelHeader title={`Loan Offers (${filtered.length})`} icon={<Coins className="h-4 w-4" />} />
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold-400" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<HandCoins className="h-6 w-6" />} title="No Loan Offers" subtitle="There are no loan offers matching your criteria." />
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((o) => (
              <div key={o.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_COLORS[o.status] || 'neutral'}>{o.status}</Badge>
                      <span className="font-display text-sm font-bold text-gold-300">{Number(o.amount).toLocaleString()} coins</span>
                      <span className="text-xs text-ink-400">{o.interest_rate}% · {o.term_days} days</span>
                    </div>
                    <p className="mt-1.5 text-sm text-white">
                      Offer to: <span className="text-gold-200">{o.member_name}</span> (@{o.member_handle})
                    </p>
                    {o.purpose && <p className="mt-0.5 text-xs text-ink-300">{o.purpose}</p>}
                    <p className="mt-0.5 text-xs text-ink-400">
                      Officer: {o.officer_name} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {isOfferRecipient(o) && o.status === 'pending' && (
                      <>
                        <button onClick={() => updateOfferStatus(o.id, 'accepted')} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20">Accept</button>
                        <button onClick={() => updateOfferStatus(o.id, 'rejected')} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-300 hover:bg-red-500/20">Reject</button>
                      </>
                    )}
                    {can('loans.manage') && o.status === 'pending' && !isOfferRecipient(o) && (
                      <button onClick={() => updateOfferStatus(o.id, 'withdrawn')} className="rounded-lg bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-200 hover:bg-white/10">Withdraw</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {showForm && canCreateOffers && (
        <CreateOfferModal
          onClose={() => setShowForm(false)}
          onSubmitted={() => { setShowForm(false); fetchOffers(); }}
          officerId={user?.id || ''}
        />
      )}
    </div>
  );
}

function CreateOfferModal({ onClose, onSubmitted, officerId }: { onClose: () => void; onSubmitted: () => void; officerId: string }) {
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<{ id: string; display_name: string; handle: string }[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('5');
  const [termDays, setTermDays] = useState('30');
  const [purpose, setPurpose] = useState('');
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
    if (!selectedMember) { setError('Select a member for this offer.'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    setLoading(true);
    const { error: err } = await supabase.from('loan_offers').insert({
      officer_id: officerId,
      member_id: selectedMember,
      amount: amt,
      interest_rate: parseFloat(interestRate) || 0,
      term_days: parseInt(termDays) || 30,
      purpose: purpose.trim(),
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    await sendNotification(selectedMember, 'loan_offer', 'New Loan Offer', `You received a loan offer of ${amt.toLocaleString()} coins at ${interestRate}% interest.`);
    onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Panel className="w-full max-w-lg p-6 animate-fade-up max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">Create Loan Offer</h3>
        <p className="mt-1 text-xs text-ink-300">Create a loan offer for a community member.</p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Search Member</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input value={memberSearch} onChange={(e) => searchMembers(e.target.value)} placeholder="Type handle or name..." className="input-field pl-9" />
            </div>
            {members.length > 0 && (
              <div className="mt-2 space-y-1">
                {members.map((m) => (
                  <button key={m.id} type="button" onClick={() => { setSelectedMember(m.id); setMemberSearch(`${m.display_name} (@${m.handle})`); setMembers([]); }} className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-ink-900/60 px-3 py-2 text-left text-xs hover:border-gold-500/30">
                    <span className="text-white">{m.display_name}</span>
                    <span className="text-ink-400">@{m.handle}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedMember && <p className="mt-2 text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Member selected</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (coins)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="input-field" required />
            </div>
            <div>
              <label className="label">Interest Rate (%)</label>
              <input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label">Term (days)</label>
            <input type="number" value={termDays} onChange={(e) => setTermDays(e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="label">Purpose</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose of the loan offer..." className="input-field" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 text-xs">Cancel</button>
            <button type="submit" disabled={loading} className="btn-gold flex-1 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create Offer'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
