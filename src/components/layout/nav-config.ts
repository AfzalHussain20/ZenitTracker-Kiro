import type { ComponentType } from 'react';
import {
  BarChart3,
  Brain,
  Grid3x3,
  Info,
  LayoutDashboard,
  Layers,
  Play,
  StickyNote,
  UserCircle,
  Users,
} from 'lucide-react';

export type NavIcon = ComponentType<{ className?: string; style?: React.CSSProperties }>;

export interface NavItem {
  title: string;
  href: string;
  icon: NavIcon;
  /** Only shown to users with the `lead` role. */
  leadOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Apps', href: '/apps', icon: Grid3x3 },
    ],
  },
  {
    label: 'Testing',
    items: [
      { title: 'Repository', href: '/dashboard/repository', icon: Layers },
      { title: 'New Session', href: '/dashboard/new-session', icon: Play },
    ],
  },
  {
    label: 'Quality',
    items: [{ title: 'Jira KPI', href: '/analytics/bugs', icon: BarChart3 }],
  },
  {
    label: 'Workspace',
    items: [
      { title: 'Notes', href: '/notes', icon: StickyNote },
      { title: 'Team', href: '/team', icon: Users, leadOnly: true },
    ],
  },
  {
    label: 'Account',
    items: [
      { title: 'Profile', href: '/profile', icon: UserCircle },
      { title: 'AI Settings', href: '/ai-settings', icon: Brain },
      { title: 'About', href: '/about', icon: Info },
    ],
  },
];

/**
 * Routes that are intentionally hidden from the app navigation. They remain
 * reachable by direct URL, but no global/sidebar navigation links to them.
 */
export const HIDDEN_ROUTES = [
  '/performance',
  '/bugs',
  '/test-suite',
  '/dashboard/sessions',
  '/analytics/leaderboard',
  '/wrklog',
  '/investigations',
  '/keepr',
  '/nexus',
  '/confluence',
  '/dashboard/clevertap-tracker',
  '/dashboard/locator-studio',
  '/tasks',
  '/integrations',
  '/billing',
  '/kpi',
  '/onboarding',
];

const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

/**
 * Returns the single most specific href matching the current pathname.
 * Prevents a parent route (e.g. `/dashboard`) from staying active on a
 * more specific child route (e.g. `/dashboard/repository`).
 */
export function getActiveHref(pathname: string | null): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

export function getActiveGroupLabel(pathname: string | null): string | null {
  const active = getActiveHref(pathname);
  if (!active) return null;
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === active));
  return group?.label ?? null;
}
