"use client";

import { useEffect, useRef, createContext, useContext, useCallback, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { zenitAnalytics, ZenitTrackOptions, type ZenitEventName } from '@/lib/clevertap-analytics';

interface AnalyticsContextType {
  track: (opts: ZenitTrackOptions) => Promise<void>;
  pageView: (currentPage: string, previousPage?: string, source?: string) => Promise<void>;
  login: (userId: string, userName: string, source?: 'email' | 'google', isNewUser?: boolean) => Promise<void>;
  logout: (userId: string, userName?: string) => Promise<void>;
  testCaseExecuted: (
    userId: string,
    caseId: string,
    caseTitle: string,
    status: string,
    suiteName?: string,
  ) => Promise<void>;
  bugReported: (userId: string, bugId: string, bugTitle: string, severity: string) => Promise<void>;
  exportDownloaded: (format: 'csv' | 'xlsx', recordCount: number) => Promise<void>;
  sessionId: string;
  isCleverTapEnabled: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { user, userRole, displayName } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const userId = user?.uid || 'anonymous';
  const userName = displayName || user?.email?.split('@')[0] || 'anonymous';
  const userRef = useRef({ userId, userName });
  userRef.current = { userId, userName };

  const track = useCallback((opts: ZenitTrackOptions) => {
    return zenitAnalytics.track({
      ...opts,
      userId: opts.userId || userRef.current.userId,
      userName: opts.userName || userRef.current.userName,
    });
  }, []);

  const pageView = useCallback(
    (currentPage: string, previousPage?: string, source?: string) => {
      return zenitAnalytics.pageView(currentPage, previousPage, source);
    },
    [],
  );

  const login = useCallback(
    (id: string, name: string, source: 'email' | 'google' = 'email', isNewUser = false) => {
      return zenitAnalytics.login(id, name, source, isNewUser);
    },
    [],
  );

  const logout = useCallback((id: string, name?: string) => {
    return zenitAnalytics.logout(id, name);
  }, []);

  const testCaseExecuted = useCallback(
    (caseId: string, caseTitle: string, status: string, suiteName?: string) => {
      return zenitAnalytics.testCaseExecuted(
        userRef.current.userId,
        caseId,
        caseTitle,
        status as any,
        suiteName,
      );
    },
    [],
  );

  const bugReported = useCallback((bugId: string, bugTitle: string, severity: string) => {
    return zenitAnalytics.bugReported(userRef.current.userId, bugId, bugTitle, severity);
  }, []);

  const exportDownloaded = useCallback((format: 'csv' | 'xlsx', recordCount: number) => {
    return zenitAnalytics.exportDownloaded(userRef.current.userId, format, recordCount);
  }, []);

  // ━━ Auto page-view tracking on route change ━━
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname) return;
    const previous = prevPathRef.current;
    prevPathRef.current = pathname;
    // Skip the initial mount (App_Launched fires separately) — track transitions only.
    if (previous && previous !== pathname) {
      const source = searchParams.get('source') || undefined;
      void pageView(pathname, previous, source);
    }
  }, [pathname, searchParams, pageView]);

  const value: AnalyticsContextType = {
    track,
    pageView,
    login,
    logout,
    testCaseExecuted,
    bugReported,
    exportDownloaded,
    sessionId: zenitAnalytics.getSessionId(),
    isCleverTapEnabled: zenitAnalytics.isCleverTapEnabled(),
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export const useAnalytics = (): AnalyticsContextType => {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return ctx;
};
