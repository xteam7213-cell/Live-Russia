import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ThumbsUp, ThumbsDown, Plus, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { Panel, Badge, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  created_at: string;
  profiles?: { handle: string; avatar_initials: string; accent: string } | null;
}

interface Vote {
  id: string;
  suggestion_id: string;
  user_id: string;
  vote: string;
}

const CATEGORIES = ['General', 'Events', 'Server', 'Discord', 'Content', 'Feature Request'];
const STATUS_COLORS: Record<string, 'neutral' | 'gold' | 'green' | 'amber' | 'blue'> = {
  open: 'blue',
  under_review: 'amber',
  approved: 'green',
  implemented: 'gold',
  rejected: 'red' as never,
};

export function SuggestionsPage() {
  const { profile, user } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'General' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: suggData }, { data: voteData }] = await Promise.all([
      supabase.from('suggestions').select('*, profiles:suggestions_user_id_fkey(handle, avatar_initials, accent)').order('created_at', { ascending: false }),
      supabase.from('suggestion_votes').select('id, suggestion_id, user_id, vote'),
    ]);
    setSuggestions(suggData as Suggestion[] || []);
    setVotes(voteData as Vote[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getVoteCount = (suggestionId: string, type: 'up' | 'down') => {
    return votes.filter((v) => v.suggestion_id === suggestionId && v.vote === type).length;
  };

  const getUserVote = (suggestionId: string) => {
    return votes.find((v) => v.suggestion_id === suggestionId && v.user_id === user?.id);
  };

  const handleVote = async (suggestionId: string, voteType: 'up' | 'down') => {
    if (!user) return;
    const existing = getUserVote(suggestionId);
    if (existing) {
      if (existing.vote === voteType) {
        await supabase.from('suggestion_votes').delete().eq('id', existing.id);
      } else {
        await supabase.from('suggestion_votes').update({ vote: voteType }).eq('id', existing.id);
      }
    } else {
      await supabase.from('suggestion_votes').insert({ suggestion_id: suggestionId, user_id: user.id, vote: voteType });
    }
    fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from('suggestions').insert({
      user_id: user.id,
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
    });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    setForm({ title: '', body: '', category: 'General' });
    setShowForm(false);
    setSubmitting(false);
    fetchData();
  };

  return (
    <div>
      <PageHeader
        title="Community Suggestions"
        subtitle="Propose ideas and vote on community improvements"
        icon={<Lightbulb className="h-5 w-5" />}
        actions={
          <button onClick={() => setShowForm((v) => !v)} className="btn-gold text-xs">
            <Plus className="h-4 w-4" />
            New Suggestion
          </button>
        }
      />

      {showForm && (
        <Panel className="mb-6 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief title for your suggestion"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input-field"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Details</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Describe your idea in detail..."
                rows={3}
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
                Submit
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
      ) : suggestions.length === 0 ? (
        <Panel className="p-6">
          <EmptyState icon={<Lightbulb className="h-6 w-6" />} title="No suggestions yet" subtitle="Be the first to propose an idea for the community." />
        </Panel>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => {
            const userVote = getUserVote(s.id);
            const upCount = getVoteCount(s.id, 'up');
            const downCount = getVoteCount(s.id, 'down');
            return (
              <Panel key={s.id} hover className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleVote(s.id, 'up')}
                      className={cn('rounded-lg p-1.5 transition-colors', userVote?.vote === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'text-ink-300 hover:bg-white/5 hover:text-emerald-400')}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold text-white">{upCount - downCount}</span>
                    <button
                      onClick={() => handleVote(s.id, 'down')}
                      className={cn('rounded-lg p-1.5 transition-colors', userVote?.vote === 'down' ? 'bg-red-500/20 text-red-400' : 'text-ink-300 hover:bg-white/5 hover:text-red-400')}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-white">{s.title}</h3>
                      <Badge variant={STATUS_COLORS[s.status] || 'neutral'}>{s.status.replace('_', ' ')}</Badge>
                      <Badge>{s.category}</Badge>
                    </div>
                    {s.body && <p className="mt-2 text-sm text-ink-200">{s.body}</p>}
                    <p className="mt-3 text-[11px] text-ink-400">
                      by {s.profiles?.handle || 'Unknown'} · {new Date(s.created_at).toLocaleDateString()}
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
