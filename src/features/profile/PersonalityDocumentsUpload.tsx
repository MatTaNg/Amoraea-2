import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/data/supabase/client';
import { theme } from '@/shared/theme/theme';
import { showConfirmDialog, showSimpleAlert } from '@utilities/alerts/confirmDialog';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Supabase Storage keys must not contain spaces, quotes, unicode punctuation, etc. */
function buildPersonalityDocumentStoragePath(userId: string, fileName: string, mimeType?: string | null): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'upload';
  const dot = base.lastIndexOf('.');
  let ext =
    dot > 0 && dot < base.length - 1
      ? base.slice(dot + 1).toLowerCase()
      : '';

  ext = ext.replace(/[^a-z0-9]/g, '');
  if (!ext && mimeType) {
    const subtype = mimeType.split('/')[1]?.split('+')[0]?.toLowerCase() ?? '';
    const mimeExtMap: Record<string, string> = {
      pdf: 'pdf',
      plain: 'txt',
      csv: 'csv',
      msword: 'doc',
      'vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      jpeg: 'jpg',
      png: 'png',
      webp: 'webp',
    };
    ext = mimeExtMap[subtype] ?? subtype.replace(/[^a-z0-9]/g, '');
  }
  if (!ext) ext = 'bin';

  return `${userId}/${Date.now()}.${ext}`;
}

function inferDocumentMimeType(mimeType: string | undefined, fileName: string): string {
  if (mimeType?.includes('/')) return mimeType;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return byExt[ext] ?? 'application/octet-stream';
}

const PROCESSING_POLL_MS = 4000;
/** Offer retry if analysis has not finished within this window. */
const STALE_PROCESSING_MS = 90 * 1000;

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

interface UploadedDoc {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  processing_status: string;
  uploaded_at: string;
}

interface Props {
  userId: string;
  onUploadComplete?: () => void;
  /** Show "This step is completely optional" — intended for onboarding. */
  showOptionalNote?: boolean;
}

export function PersonalityDocumentsUpload({
  userId,
  onUploadComplete,
  showOptionalNote = false,
}: Props) {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    if (!userId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_personality_documents')
      .select('id, file_name, file_type, storage_path, processing_status, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('[PersonalityDocs] fetch error:', error);
    }
    setDocs(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void fetchDocs();
  }, [fetchDocs]);

  const hasInFlightDocs = docs.some(
    (d) => d.processing_status === 'pending' || d.processing_status === 'processing',
  );

  useEffect(() => {
    if (!userId || !hasInFlightDocs) return;
    const interval = setInterval(() => {
      void fetchDocs();
    }, PROCESSING_POLL_MS);
    return () => clearInterval(interval);
  }, [userId, hasInFlightDocs, fetchDocs]);

  async function triggerDocumentProcessing(doc: Pick<UploadedDoc, 'storage_path' | 'file_name' | 'file_type'>) {
    const mime = inferDocumentMimeType(doc.file_type, doc.file_name);
    const { data, error } = await supabase.functions.invoke('process-personality-document', {
      body: {
        userId,
        storagePath: doc.storage_path,
        fileName: doc.file_name,
        fileType: mime,
      },
    });

    if (error) {
      console.error('[PersonalityDocs] processing invoke failed:', error);
      console.log('[PersonalityDocs] error details:', {
        name: error.name,
        message: error.message,
        details: (error as any).details,
        status: (error as any).status,
      });

      let msg = error.message;

      // Attempt to extract more info from the response body if available
      const context = (error as any).context;
      if (context instanceof Response) {
        try {
          const body = await context.clone().json();
          console.log('[PersonalityDocs] server error body:', body);
          if (body.message) msg = body.message;
          else if (body.error) msg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
        } catch (e) {
          try {
            const text = await context.clone().text();
            console.log('[PersonalityDocs] server error text:', text);
          } catch (e2) {
            // ignore
          }
        }
      }
      
      const details = (error as any).details;
      if (details && !context) {
        if (typeof details === 'string') msg = details;
        else if (typeof details === 'object') msg = details.message || details.error || msg;
      }
      return { ok: false as const, message: msg };
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      const msg = typeof data.error === 'string' ? data.error : 'Processing could not start';
      return { ok: false as const, message: msg };
    }

    return { ok: true as const };
  }

  async function retryProcessing(doc: UploadedDoc) {
    await supabase
      .from('user_personality_documents')
      .update({ processing_status: 'pending' })
      .eq('id', doc.id);

    setDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, processing_status: 'pending' } : d)),
    );

    const result = await triggerDocumentProcessing(doc);
    if (!result.ok) {
      showSimpleAlert(
        'Processing failed',
        result.message || 'Could not start processing. Try again in a moment.',
      );
    }
    void fetchDocs();
  }

  function shouldOfferRetry(doc: UploadedDoc): boolean {
    if (doc.processing_status === 'failed') return true;
    if (doc.processing_status !== 'processing' && doc.processing_status !== 'pending') {
      return false;
    }
    const ageMs = Date.now() - new Date(doc.uploaded_at).getTime();
    return ageMs > STALE_PROCESSING_MS;
  }

  async function uploadFile(file: DocumentPicker.DocumentPickerAsset) {
    if (file.size != null && file.size > MAX_FILE_BYTES) {
      showSimpleAlert(
        'File too large',
        `${file.name} exceeds the 20MB limit. Please choose a smaller file.`,
      );
      return;
    }

    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = buildPersonalityDocumentStoragePath(userId, file.name, file.mimeType);

    const response = await fetch(file.uri);
    const blob = await response.blob();

    if (blob.size > MAX_FILE_BYTES) {
      showSimpleAlert(
        'File too large',
        `${file.name} exceeds the 20MB limit. Please choose a smaller file.`,
      );
      return;
    }

    const { error: storageError } = await supabase.storage
      .from('personality-documents')
      .upload(storagePath, blob, {
        contentType: file.mimeType ?? 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      console.error('[PersonalityDocs] storage upload failed:', storageError);
      showSimpleAlert(
        'Upload failed',
        storageError.message || 'Could not upload this file. Please try again.',
      );
      return;
    }

    const mime = inferDocumentMimeType(file.mimeType ?? undefined, file.name);

    const { error: dbError } = await supabase.from('user_personality_documents').insert({
      user_id: userId,
      file_name: file.name,
      file_type: mime,
      storage_path: storagePath,
      processing_status: 'pending',
    });

    if (dbError) {
      console.error('[PersonalityDocs] db insert failed:', dbError);
      await supabase.storage.from('personality-documents').remove([storagePath]);
      throw dbError;
    }

    const processResult = await triggerDocumentProcessing({
      storage_path: storagePath,
      file_name: file.name,
      file_type: mime,
    });

    if (!processResult.ok) {
      showSimpleAlert(
        'Uploaded, processing delayed',
        'Your file was saved but analysis could not start. Tap Retry on the file to try again.',
      );
    }

    console.log('[PersonalityDocs] uploaded:', file.name);
  }

  async function handleUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_MIME_TYPES],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setUploading(true);

      for (const file of result.assets) {
        await uploadFile(file);
      }

      await fetchDocs();
      onUploadComplete?.();
    } catch (err) {
      console.error('[PersonalityDocs] upload error:', err);
      showSimpleAlert('Upload failed', 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(docId: string, storagePath: string) {
    showConfirmDialog(
      {
        title: 'Remove document',
        message: 'This will remove the document and any insights extracted from it.',
        confirmText: 'Remove',
      },
      () => {
        void (async () => {
          const { error: storageError } = await supabase.storage
            .from('personality-documents')
            .remove([storagePath]);

          if (storageError) {
            console.error('[PersonalityDocs] storage delete failed:', storageError);
            showSimpleAlert('Could not remove', storageError.message);
            return;
          }

          const { error: dbError } = await supabase
            .from('user_personality_documents')
            .delete()
            .eq('id', docId);

          if (dbError) {
            console.error('[PersonalityDocs] db delete failed:', dbError);
            showSimpleAlert('Could not remove', dbError.message);
            return;
          }

          setDocs((prev) => prev.filter((d) => d.id !== docId));
        })();
      },
    );
  }

  function statusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Processing...';
      case 'complete':
        return 'Ready';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }

  function statusColor(status: string): string {
    switch (status) {
      case 'complete':
        return '#22c55e';
      case 'failed':
        return theme.colors.error;
      case 'processing':
        return '#f59e0b';
      default:
        return theme.colors.textSecondary;
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help us get to know you better</Text>
      <Text style={styles.body}>
        Upload anything that shows who you are — text conversations, social media posts, a resume,
        ChatGPT chats, journal entries, anything. The more context you give us, the better your
        matches will be. Nothing you share here is shown to other users.
      </Text>

      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={() => void handleUpload()}
        disabled={uploading || !userId}
      >
        {uploading ? (
          <View style={styles.uploadButtonInner}>
            <ActivityIndicator color={theme.colors.text} size="small" />
            <Text style={styles.uploadButtonText}>Uploading...</Text>
          </View>
        ) : (
          <View style={styles.uploadButtonInner}>
            <Text style={styles.uploadButtonIcon}>↑</Text>
            <Text style={styles.uploadButtonText}>Upload files</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>PDF, Word, images, text files — up to 20MB each</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.textSecondary} style={styles.loader} />
      ) : docs.length > 0 ? (
        <View style={styles.docList}>
          {docs.map((doc) => {
            const showRetry = shouldOfferRetry(doc);
            return (
              <View key={doc.id} style={styles.docRow}>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.file_name}
                  </Text>
                  <Text style={[styles.docStatus, { color: statusColor(doc.processing_status) }]}>
                    {statusLabel(doc.processing_status)}
                  </Text>
                </View>
                {showRetry ? (
                  <TouchableOpacity
                    onPress={() => void retryProcessing(doc)}
                    style={styles.retryButton}
                    accessibilityLabel={`Retry processing ${doc.file_name}`}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => handleDelete(doc.id, doc.storage_path)}
                  style={styles.deleteButton}
                  accessibilityLabel={`Remove ${doc.file_name}`}
                >
                  <Text style={styles.deleteIcon}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}

      {showOptionalNote ? (
        <Text style={styles.optional}>This step is completely optional</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Platform.OS === 'web' ? 0 : theme.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonIcon: {
    fontSize: 18,
    color: theme.colors.text,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.75,
  },
  loader: {
    marginTop: 16,
  },
  docList: {
    marginTop: 8,
    gap: 8,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 2,
  },
  docStatus: {
    fontSize: 11,
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteIcon: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  optional: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.65,
  },
});
