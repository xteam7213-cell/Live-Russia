import { useState, useCallback, useRef } from 'react';
import { Upload, File as FileIcon, Loader2, Trash2, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';

interface AttachmentRecord {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentUpload({ table, recordId }: { table: string; recordId?: string }) {
  const { user } = useApp();
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fetchAttachments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('attachments').select('*').eq('user_id', user.id);
    if (recordId) query = query.eq('record_id', recordId);
    const { data } = await query.order('created_at', { ascending: false });
    setAttachments((data as AttachmentRecord[]) || []);
    setLoading(false);
  }, [user, recordId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    const file = e.target.files[0];
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be under 10 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const safeName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: upErr } = await supabase.storage
      .from('attachments')
      .upload(safeName, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { error: dbErr } = await supabase.from('attachments').insert({
      user_id: user.id,
      table_name: table,
      record_id: recordId || null,
      filename: file.name,
      storage_path: safeName,
      mime_type: file.type || ext,
      size_bytes: file.size,
    });
    if (dbErr) {
      setError(dbErr.message);
      setUploading(false);
      return;
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    fetchAttachments();
  };

  const handleDelete = async (att: AttachmentRecord) => {
    await supabase.storage.from('attachments').remove([att.storage_path]);
    await supabase.from('attachments').delete().eq('id', att.id);
    fetchAttachments();
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <Panel>
      <PanelHeader
        title="My Files"
        subtitle="Upload and manage your attachments"
        icon={<Upload className="h-4 w-4" />}
        action={
          <label className="btn-gold cursor-pointer text-xs">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
              accept="image/*,application/pdf,text/*,.doc,.docx,.txt"
            />
          </label>
        }
      />

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
        </div>
      ) : attachments.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-6 w-6" />}
          title="No files uploaded"
          subtitle="Upload images, documents, or screenshots (max 10 MB)."
        />
      ) : (
        <div className="divide-y divide-white/5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-ink-850">
                <FileIcon className="h-4 w-4 text-ink-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{att.filename}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                  <span>{formatBytes(att.size_bytes)}</span>
                  <span>·</span>
                  <span>{att.mime_type || 'unknown'}</span>
                  <span>·</span>
                  <span>{new Date(att.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <a
                href={getPublicUrl(att.storage_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-1.5 text-ink-300 hover:bg-gold-500/10 hover:text-gold-400"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                onClick={() => handleDelete(att)}
                className="rounded-lg p-1.5 text-ink-300 hover:bg-red-500/10 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
