import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Compass, LayoutDashboard, Search } from 'lucide-react';

/**
 * In-shell 404 for the authenticated app. Keeps the sidebar + topbar visible
 * so a bad in-app link (or a not-found resource) does not drop the user out to
 * the bare root not-found page.
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/15">
            <Compass className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t find what you were looking for. It may have been moved or deleted.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/apps">
                <Search className="mr-2 h-4 w-4" />
                Browse Apps
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
