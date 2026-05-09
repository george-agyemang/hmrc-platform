import { useState, useEffect, useCallback, useRef } from 'react';
;

const WORKER = 'https://nserewa-api.fragrant-sea-e1f1.workers.dev';
const AUTO_SAVE_MS = 30_000;

export function useDraft({ type, businessId, periodKey, emptyState }) {
  const [formData, setFormData]  = useState(emptyState);
  const [draftStatus, setStatus] = useState('idle'); // idle | saving | saved | error
  const [hasDraft, setHasDraft]  = useState(false);
  const [savedAt, setSavedAt]    = useState(null);
  const autoSaveTimer            = useRef(null);

  // Load draft on mount
  useEffect(() => {
    if (!periodKey) return;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const params = businessId ? `?businessId=${businessId}` : '';
        const res = await fetch(
          `${WORKER}/drafts/${type}/${encodeURIComponent(periodKey)}${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const draft = await res.json();
        if (draft?.data) {
          setFormData(prev => ({ ...prev, ...draft.data }));
          setSavedAt(new Date(draft.saved_at));
          setHasDraft(true);
        }
      } catch (e) {
        console.warn('useDraft: failed to load draft', e);
      }
    })();
  }, [type, businessId, periodKey]);

  // Manual save
  const save = useCallback(async (data) => {
    setStatus('saving');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${WORKER}/drafts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, businessId, periodKey, data }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedAt(new Date());
      setHasDraft(true);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }, [type, businessId, periodKey]);

  // Debounced auto-save
  const triggerAutoSave = useCallback((data) => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(data), AUTO_SAVE_MS);
  }, [save]);

  useEffect(() => () => clearTimeout(autoSaveTimer.current), []);

  // Clear draft after submission
  const clearDraft = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${WORKER}/drafts/${type}/${encodeURIComponent(periodKey)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setHasDraft(false);
      setSavedAt(null);
    } catch (e) {
      console.warn('useDraft: failed to clear draft', e);
    }
  }, [type, periodKey]);

  return { formData, setFormData, save, clearDraft, triggerAutoSave, draftStatus, hasDraft, savedAt };
}
