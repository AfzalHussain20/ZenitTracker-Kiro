"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LogoIcon } from '@/components/ui/Logo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { NAV_GROUPS, getActiveHref } from './nav-config';

export default function AppSidebar() {
  const pathname = usePathname();
  const { userRole } = useAuth();
  const { setOpenMobile } = useSidebar();
  const activeHref = getActiveHref(pathname);

  // Close the mobile drawer after navigating.
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md px-1.5 py-2 hover:bg-sidebar-accent/60 transition-colors group-data-[collapsible=icon]:justify-center"
        >
          <LogoIcon className="h-7 w-7 shrink-0" />
          <span className="font-headline font-bold text-lg tracking-tight group-data-[collapsible=icon]:hidden">
            Zenit
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.leadOnly || userRole === 'lead');
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeHref === item.href}
                          tooltip={item.title}
                        >
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1.5 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          v2.4.1
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
