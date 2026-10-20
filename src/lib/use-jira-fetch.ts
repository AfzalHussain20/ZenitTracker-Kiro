"use client";

import { useEffect, useRef, useState } from 'react';

const BUG_KEY = /^[A-Z]{2,10}-\d+$/;

/**
 * Debounced Jira issue lookup. As the id becomes a valid key, fetches the issue
 * summary so the UI can show "ID — description" while typing. Shared by the test
 * runner and the lead-editable results report so both behave identically.
 */
export function useJiraFetch(bugId: string) {
  const [bugTitle, setBugTitle] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBugTitle(null);
    setFetchError(null);
    const trimmed = bugId?.trim() || '';
    if (!trimmed || !BUG_KEY.test(trimmed)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/jira/issue/${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const d = await res.json();
          setBugTitle(d.summary || 'Untitled');
        } else {
          const e = await res.json().catch(() => ({}));
          setFetchError(e.error || `Error ${res.status}`);
        }
      } catch {
        setFetchError('Network error');
      } finally {
        setFetching(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [bugId]);

  return { bugTitle, fetching, fetchError };
}

export function isValidBugKey(id: string): boolean {
  return BUG_KEY.test((id || '').trim());
}
