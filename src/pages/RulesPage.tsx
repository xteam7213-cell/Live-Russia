import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Plus, Edit2, Trash2, X, Save, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { RoleBadges } from '@/components/RoleBadge';
import { hasPermission, type RbacRole } from '@/lib/rbac';

interface Rule {
  id: string;
  category: string;
  title: string;
  description: string;
  author_handle: string;
  created_at: string;
  updated_at: string;
}

const RULE_CATEGORIES = [
  'General Community Rules',
  'Server Owner / Administration Rules',
  'Administrator Rules',
  'Junior Administrator Rules',
  'Moderator Rules',
  'Support Team Rules',
  'Loan Center Management Rules',
  'Loan Officer Rules',
  'Project Team Rules',
];

const CATEGORY_PERMISSIONS: Record<string, RbacPermission[]> = {
  'General Community Rules': ['admin.access', 'rules.manage'],
  'Server Owner / Administration Rules': ['admin.assignRoles'],
  'Administrator Rules': ['admin.assignRoles'],
  'Junior Administrator Rules': ['admin.assignRoles'],
  'Moderator Rules': ['moderation.tools', 'admin.access'],
  'Support Team Rules': ['support.tickets', 'admin.access'],
  'Loan Center Management Rules': ['loans.manage', 'admin.access'],
  'Loan Officer Rules': ['loans.manage'],
  'Project Team Rules': ['admin.assignRoles'],
};

type RbacPermission = Parameters<typeof hasPermission>[1];

export function RulesPage() {
  const { profile, user, rbacRole, secondaryRole } = useApp();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formCategory, setFormCategory] = useState(RULE_CATEGORIES[0]);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const canManageRules = hasPermission(rbacRole, 'rules.manage') || hasPermission(rbacRole, 'admin.access');

  const canManageCategory = (cat: string): boolean => {
    const perms = CATEGORY_PERMISSIONS[cat];
    if (!perms) return false;
    return perms.some((p) => hasPermission(rbacRole, p));
  };

  const loadRules = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('community_rules')
      .select('*')
      .order('category', { ascending: true })
      .order('created_at', { ascending: true });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRules(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRules();
    const channel = supabase
      .channel('community-rules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_rules' }, () => {
        loadRules();
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [loadRules]);

  const handleSave = async () => {
    if (!user || !profile) return;
    if (!formTitle.trim() || !formDesc.trim()) {
      setError('Title and description are required.');
      return;
    }
    setError(null);

    if (editingRule) {
      const { error: updErr } = await supabase
        .from('community_rules')
        .update({
          category: formCategory,
          title: formTitle.trim(),
          description: formDesc.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRule.id);
      if (updErr) { setError(updErr.message); return; }
    } else {
      const { error: insErr } = await supabase.from('community_rules').insert({
        category: formCategory,
        title: formTitle.trim(),
        description: formDesc.trim(),
        author_id: user.id,
        author_handle: profile.handle,
      });
      if (insErr) { setError(insErr.message); return; }
    }
    setShowForm(false);
    setEditingRule(null);
    setFormTitle('');
    setFormDesc('');
    loadRules();
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormCategory(rule.category);
    setFormTitle(rule.title);
    setFormDesc(rule.description);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    const { error: delErr } = await supabase.from('community_rules').delete().eq('id', id);
    if (delErr) { setError(delErr.message); return; }
    loadRules();
  };

  const formatDate = (ts: string) => new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-500" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Community Rules"
        subtitle="Official LIVE RUSSIA GAMING community guidelines"
        icon={<ScrollText className="h-5 w-5" />}
        actions={canManageRules && !showForm ? (
          <button onClick={() => { setEditingRule(null); setFormTitle(''); setFormDesc(''); setShowForm(true); }} className="btn-gold">
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        ) : undefined}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {showForm && (
        <div className="mb-6 panel p-5 animate-fade-up">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">
              {editingRule ? 'Edit Rule' : 'New Rule'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="text-ink-300 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="input-field"
              >
                {RULE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} disabled={!canManageCategory(cat)}>
                    {cat}{!canManageCategory(cat) ? ' (no permission)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Rule title"
                className="input-field"
                maxLength={120}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Describe the rule in detail…"
                className="input-field min-h-[100px] resize-y"
                maxLength={1000}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-gold">
                <Save className="h-4 w-4" /> {editingRule ? 'Update' : 'Publish'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rules.length === 0 && !showForm && (
        <div className="panel flex flex-col items-center justify-center p-12 text-center">
          <BookOpen className="mb-3 h-12 w-12 text-ink-500" />
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">No Rules Published Yet</h3>
          <p className="mt-1 text-sm text-ink-400">
            {canManageRules ? 'Use "Add Rule" to publish the first community rule.' : 'Check back soon for official community rules.'}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {RULE_CATEGORIES.map((cat) => {
          const catRules = rules.filter((r) => r.category === cat);
          if (catRules.length === 0) return null;
          return (
            <div key={cat} className="animate-fade-up">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-gold-500/40 to-transparent" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-gold-300">{cat}</h2>
                <div className="h-px flex-1 bg-gradient-to-l from-gold-500/40 to-transparent" />
              </div>
              <div className="space-y-3">
                {catRules.map((rule, idx) => {
                  const canEdit = canManageCategory(rule.category);
                  return (
                    <div key={rule.id} className="panel panel-hover p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-[10px] font-bold text-gold-400">
                              {idx + 1}
                            </span>
                            <h3 className="font-display text-base font-bold text-white">{rule.title}</h3>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-ink-200">{rule.description}</p>
                          <div className="mt-3 flex items-center gap-3 text-[10px] text-ink-400">
                            <span>By <span className="font-semibold text-ink-300">{rule.author_handle}</span></span>
                            <span>·</span>
                            <span>Published {formatDate(rule.created_at)}</span>
                            {rule.updated_at !== rule.created_at && (
                              <>
                                <span>·</span>
                                <span>Updated {formatDate(rule.updated_at)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => handleEdit(rule)} className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-gold-400" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(rule.id)} className="rounded-lg p-2 text-ink-400 hover:bg-white/5 hover:text-red-400" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
