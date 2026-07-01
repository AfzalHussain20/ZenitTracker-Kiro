'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Calendar,
  X,
  Maximize2,
  BookOpen,
  Layers,
} from 'lucide-react';

// Types
interface Space {
  id: string;
  key: string;
  name: string;
  type: string;
  icon: string | null;
}

interface PageSummary {
  id: string;
  title: string;
  spaceId: string | null;
  spaceName: string | null;
  spaceKey: string | null;
  lastUpdated: string | null;
  excerpt: string;
}

interface Attachment {
  id: string;
  title: string;
  mediaType: string;
  downloadUrl: string;
}

interface PageDetail {
  id: string;
  title: string;
  body: string;
  lastUpdated: string | null;
  space: { id: string };
  attachments: Attachment[];
}

// Space color mapping for pills
const SPACE_COLORS: Record<string, string> = {
  SunNXT: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  techott: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'afzal.hussain': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

function getSpaceColor(key: string | null): string {
  if (!key) return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
  return SPACE_COLORS[key] || 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Strip Confluence storage format macros for clean HTML rendering
function cleanStorageFormat(html: string): string {
  if (!html) return '';
  return html
    // Remove structured macros entirely
    .replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/gi, '')
    // Remove ac:* tags but keep inner content
    .replace(/<ac:rich-text-body>/gi, '')
    .replace(/<\/ac:rich-text-body>/gi, '')
    .replace(/<ac:parameter[^>]*>[\s\S]*?<\/ac:parameter>/gi, '')
    .replace(/<ac:[^>]*\/>/gi, '')
    .replace(/<ac:[^>]*>/gi, '')
    .replace(/<\/ac:[^>]*>/gi, '')
    // Remove ri:* tags
    .replace(/<ri:[^>]*\/>/gi, '')
    .replace(/<ri:[^>]*>[\s\S]*?<\/ri:[^>]*>/gi, '')
    // Clean up empty paragraphs
    .replace(/<p>\s*<\/p>/gi, '')
    // Keep everything else as-is for prose rendering
    .trim();
}

export default function ConfluencePage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'document' | 'mockups'>('document');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<Attachment | null>(null);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch spaces on mount
  useEffect(() => {
    fetchSpaces();
    fetchPages();
  }, []);

  const fetchSpaces = async () => {
    try {
      setSpacesLoading(true);
      const res = await fetch('/api/confluence/spaces');
      const data = await res.json();
      if (data.spaces) setSpaces(data.spaces);
    } catch (err) {
      console.error('Failed to fetch spaces:', err);
    } finally {
      setSpacesLoading(false);
    }
  };

  const fetchPages = async (spaceId?: string | null, query?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (spaceId) params.set('spaceId', spaceId);
      if (query) params.set('q', query);
      const res = await fetch(`/api/confluence/pages?${params.toString()}`);
      const data = await res.json();
      if (data.pages) setPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPageDetail = async (pageId: string) => {
    try {
      setPageLoading(true);
      const res = await fetch(`/api/confluence/pages/${pageId}`);
      const data = await res.json();
      if (data.page) {
        setSelectedPage(data.page);
        setActiveTab('document');
      }
    } catch (err) {
      console.error('Failed to fetch page detail:', err);
    } finally {
      setPageLoading(false);
    }
  };

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        fetchPages(activeSpaceId, value || undefined);
      }, 400);
    },
    [activeSpaceId]
  );

  const handleSpaceFilter = (spaceId: string | null) => {
    setActiveSpaceId(spaceId);
    fetchPages(spaceId, searchQuery || undefined);
  };

  const handleBack = () => {
    setSelectedPage(null);
    setLightboxImage(null);
  };

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxImage]);

  // Find space info for a page
  const getSpaceForPage = (page: PageSummary | PageDetail) => {
    const spaceId = 'spaceId' in page ? page.spaceId : (page as PageDetail).space?.id;
    return spaces.find((s) => s.id === spaceId) || null;
  };

  // READ STATE
  if (selectedPage) {
    const space = getSpaceForPage(selectedPage);
    const imageAttachments = selectedPage.attachments || [];

    return (
      <div className="min-h-screen">
        {/* Lightbox */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={lightboxImage.downloadUrl}
              alt={lightboxImage.title}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm">
              {lightboxImage.title}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to documents
          </Button>

          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            {selectedPage.title}
          </h1>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {space && (
              <Badge
                variant="outline"
                className={`text-xs ${getSpaceColor(space.key)}`}
              >
                {space.name}
              </Badge>
            )}
            {selectedPage.lastUpdated && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(selectedPage.lastUpdated)}
              </span>
            )}
            {imageAttachments.length > 0 && (
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" />
                {imageAttachments.length} mockup{imageAttachments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border/50">
          <button
            onClick={() => setActiveTab('document')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'document'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            Document
          </button>
          <button
            onClick={() => setActiveTab('mockups')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'mockups'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Mockups
            {imageAttachments.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {imageAttachments.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'document' ? (
          <article
            className="prose prose-invert prose-sm sm:prose-base max-w-none
              prose-headings:text-foreground prose-headings:font-semibold
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground
              prose-code:text-orange-300 prose-code:bg-orange-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-border/50
              prose-table:border-collapse prose-th:border prose-th:border-border/50 prose-th:p-2 prose-th:bg-muted/30
              prose-td:border prose-td:border-border/50 prose-td:p-2
              prose-li:text-muted-foreground
              prose-img:rounded-lg prose-img:shadow-md"
            dangerouslySetInnerHTML={{ __html: cleanStorageFormat(selectedPage.body) }}
          />
        ) : (
          <div>
            {imageAttachments.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No mockups attached to this document</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="group relative bg-muted/30 border border-border/50 rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
                    onClick={() => setLightboxImage(att)}
                  >
                    <div className="aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden">
                      <img
                        src={att.downloadUrl}
                        alt={att.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {att.title}
                      </p>
                      <Maximize2 className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // BROWSE STATE
  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Documents
          </h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">
          Browse PRDs, specs, and mockups from Confluence
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search PRDs, specs, mockups..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-11 h-12 bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground/60 rounded-xl text-sm focus-visible:ring-primary/30"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              fetchPages(activeSpaceId);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Space Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => handleSpaceFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            activeSpaceId === null
              ? 'bg-primary/20 text-primary border-primary/40'
              : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
          }`}
        >
          <Layers className="h-3 w-3 inline mr-1.5" />
          All Spaces
        </button>
        {spacesLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))
          : spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => handleSpaceFilter(space.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  activeSpaceId === space.id
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : `${getSpaceColor(space.key)} hover:opacity-80`
                }`}
              >
                {space.name}
              </button>
            ))}
      </div>

      {/* Pages Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-border/50 bg-muted/20"
            >
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-1/3 mb-4" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No documents match your search' : 'No documents found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => {
            const space = getSpaceForPage(page);
            return (
              <button
                key={page.id}
                onClick={() => fetchPageDetail(page.id)}
                className="text-left p-5 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-border hover:shadow-lg hover:shadow-black/5 transition-all group"
              >
                <h3 className="font-semibold text-foreground text-sm leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {page.title}
                </h3>

                <div className="flex items-center gap-2 mb-3">
                  {(space || page.spaceName || page.spaceKey) && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${getSpaceColor(
                        space?.key || page.spaceKey
                      )}`}
                    >
                      {space?.name || page.spaceName || page.spaceKey || 'Space'}
                    </Badge>
                  )}
                  {page.lastUpdated && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(page.lastUpdated)}
                    </span>
                  )}
                </div>

                {page.excerpt && (
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                    {page.excerpt}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading overlay for page detail */}
      {pageLoading && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading document...</p>
          </div>
        </div>
      )}
    </div>
  );
}
