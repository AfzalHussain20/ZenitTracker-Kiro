"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from '@/components/ui/dropdown-menu';
import { LogOut, UserCircle, LayoutDashboard, Sun, Moon, Monitor, Settings, ChevronDown, ClipboardList, Info, BookOpen } from 'lucide-react';
import { LogoIcon } from '@/components/ui/Logo';

export default function AppHeader() {
  const { user, userRole } = useAuth();
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const hideHeaderRoutes = ['/dashboard/vision', '/automation'];
  const shouldHide = hideHeaderRoutes.some(route => pathname?.startsWith(route));

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "firebase-auth-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return (names[0][0] + (names[names.length - 1]?.[0] || '')).toUpperCase();
  };

  if (shouldHide) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LogoIcon className="h-8 w-8" />
          <span className="font-bold text-xl hidden sm:inline-block">Zenit</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/apps">
            <Button variant={pathname === '/apps' ? 'secondary' : 'ghost'} size="sm">
              Apps
            </Button>
          </Link>
          <Link href="/bugs">
            <Button variant={pathname === '/bugs' ? 'secondary' : 'ghost'} size="sm">
              Jira Dashboard
            </Button>
          </Link>
          <Link href="/analytics/bugs">
            <Button variant={pathname?.startsWith('/analytics/bugs') ? 'secondary' : 'ghost'} size="sm">
              Jira Overview
            </Button>
          </Link>
          <Link href="/confluence">
            <Button variant={pathname === '/confluence' ? 'secondary' : 'ghost'} size="sm">
              <BookOpen className="h-4 w-4 mr-2" />
              Docs
            </Button>
          </Link>
          <Link href="/about">
            <Button variant={pathname === '/about' ? 'secondary' : 'ghost'} size="sm">
              <Info className="h-4 w-4 mr-2" />
              About
            </Button>
          </Link>
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                  <AvatarFallback className="text-xs">{getInitials(user?.displayName)}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline-block text-sm">{user?.displayName?.split(' ')[0] || 'User'}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/about" className="cursor-pointer">
                  <Info className="mr-2 h-4 w-4" />
                  About
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === 'light' ? <Sun className="mr-2 h-4 w-4" /> : 
                   theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : 
                   <Monitor className="mr-2 h-4 w-4" />}
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme('light')}>
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('system')}>
                      <Monitor className="mr-2 h-4 w-4" />
                      System
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
