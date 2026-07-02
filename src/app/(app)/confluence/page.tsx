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
  ExternalLink,
  Monitor,
  Tv,
  Palette,
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

// Strip Confluence storage format macros for clean HTML rendering + restructure
function cleanStorageFormat(html: string): string {
  if (!html) return '';
  let cleaned = html
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
    // Clean up empty paragraphs and br noise
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '');

  // Ensure tables have proper structure and width
  cleaned = cleaned.replace(/<table/gi, '<table style="width:100%;border-collapse:collapse"');

  // Add visual section breaks before h1/h2 headings
  cleaned = cleaned.replace(/(<h[12][^>]*>)/gi, '<hr class="my-8 border-border/30"/>$1');
  cleaned = cleaned.replace(/^\s*<hr[^>]*\/>/, ''); // remove leading hr

  // Convert sequences of short <p> tags into bullet lists
  cleaned = cleaned.replace(
    /(<p>[^<]{1,90}<\/p>\s*){4,}/gi,
    (match) => {
      const items = [...match.matchAll(/<p>([^<]+)<\/p>/gi)];
      if (!items || items.length < 4) return match;
      const texts = items.map(i => i[1].trim()).filter(Boolean);
      const avgLen = texts.reduce((a, t) => a + t.length, 0) / texts.length;
      // Only convert if items are short (look like list items) and don't contain URLs
      if (avgLen > 80 || texts.some(t => t.includes('http'))) return match;
      const listItems = texts.map(t => `<li>${t}</li>`).join('');
      return `<ul class="list-disc pl-6 space-y-1">${listItems}</ul>`;
    }
  );

  return cleaned.trim();
}

// ─── Extract design/mockup URLs from the page body ───────────────────────────
interface DesignLink {
  url: string;
  label: string;
  platform: 'adobe-xd' | 'figma' | 'zeplin' | 'sketch' | 'generic';
  category: string; // "Web", "TV", "Mobile", etc.
}

function extractDesignLinks(body: string): DesignLink[] {
  const seen = new Set<string>();
  const links: DesignLink[] = [];

  // FIRST PASS: extract links that have anchor text (the proper names)
  // Pattern: <a href="https://xd.adobe.com/view/...">Link Text</a>
  const anchorRegex = /<a[^>]*href=["'](https?:\/\/(?:xd\.adobe\.com\/view|(?:www\.)?figma\.com\/(?:file|proto|design)|app\.zeplin\.io)\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;

  // Determine current category from context — parse the whole body structure
  const textBody = body.replace(/<[^>]+>/g, '|');
  const lines = textBody.split('|').map(s => s.trim()).filter(Boolean);

  // Build category map: find where "Web:", "TV:", "Mobile:" headers appear relative to URLs
  let currentCategory = 'General';
  const urlCategoryMap = new Map<string, string>();
  for (const line of lines) {
    if (/^(Web|TV|Mobile|mweb and Tablet):?$/i.test(line) && line.toLowerCase() !== 'designs') {
      currentCategory = line.replace(/:$/, '');
    }
    const urlMatch = line.match(/https?:\/\/xd\.adobe\.com\/view\/[^\s|]+/i);
    if (urlMatch) {
      urlCategoryMap.set(urlMatch[0].replace(/[|"',;)]+$/, ''), currentCategory);
    }
  }

  // Now extract with proper names from anchor tags
  while ((match = anchorRegex.exec(body)) !== null) {
    const url = match[1].replace(/[",;)]+$/, '');
    const anchorText = match[2].trim();
    if (seen.has(url)) continue;
    seen.add(url);

    // Use anchor text as the label (this is the actual mockup name!)
    let label = anchorText;
    // If anchor text is just the URL itself, fallback
    if (label.startsWith('http')) label = '';

    const category = urlCategoryMap.get(url) || 'General';

    let platform: DesignLink['platform'] = 'generic';
    if (url.includes('xd.adobe.com')) platform = 'adobe-xd';
    else if (url.includes('figma.com')) platform = 'figma';
    else if (url.includes('zeplin.io')) platform = 'zeplin';

    if (!label) {
      const catCount = links.filter(l => l.category === category).length + 1;
      label = `${category} Prototype ${catCount}`;
    }

    links.push({ url, label, platform, category });
  }

  // SECOND PASS: pick up bare URLs that weren't in anchor tags
  const bareUrlRegex = /https?:\/\/(?:xd\.adobe\.com\/view|(?:www\.)?figma\.com\/(?:file|proto|design)|app\.zeplin\.io)\/[^\s"<|)]+/gi;
  let bareMatch;
  while ((bareMatch = bareUrlRegex.exec(textBody)) !== null) {
    const url = bareMatch[0].replace(/[|"',;)]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);

    const category = urlCategoryMap.get(url) || 'General';
    const catCount = links.filter(l => l.category === category).length + 1;

    let platform: DesignLink['platform'] = 'generic';
    if (url.includes('xd.adobe.com')) platform = 'adobe-xd';
    else if (url.includes('figma.com')) platform = 'figma';

    // Try to find a label from surrounding text
    const idx = textBody.indexOf(url.substring(0, 40));
    const before = idx > 0 ? textBody.substring(Math.max(0, idx - 100), idx) : '';
    const segs = before.split('|').filter(s => s.trim() && !s.trim().startsWith('http'));
    const lastSeg = segs[segs.length - 1]?.trim().replace(/[-–—:]+$/, '').trim() || '';
    const label = (lastSeg && lastSeg.length < 60 && lastSeg.length > 2) ? lastSeg : `${category} Prototype ${catCount}`;

    links.push({ url, label, platform, category });
  }

  // Convert /view/ URLs to /embed/ for iframe embedding
  for (const link of links) {
    if (link.url.includes('/view/')) {
      link.url = link.url.replace('/view/', '/embed/');
    }
  }

  // Merge "General" into the nearest real category or rename it to "Mobile" 
  // (since named links typically come from the Mobile ordered list section)
  const hasGeneral = links.some(l => l.category === 'General');
  if (hasGeneral) {
    const generalLinks = links.filter(l => l.category === 'General');
    const hasMobile = links.some(l => l.category === 'Mobile');
    // If there's a Mobile category, merge General into it; otherwise rename General to Mobile
    for (const link of generalLinks) {
      link.category = hasMobile ? 'Mobile' : 'Mobile';
    }
  }

  return links;
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
    const designLinks = extractDesignLinks(selectedPage.body || '');
    const mockupCount = imageAttachments.length + designLinks.length;

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

          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {space && (
              <Badge variant="outline" className={`text-xs ${getSpaceColor(space.key)}`}>
                {space.name}
              </Badge>
            )}
            {selectedPage.lastUpdated && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(selectedPage.lastUpdated)}
              </span>
            )}
            {mockupCount > 0 && (
              <span className="flex items-center gap-1">
                <Palette className="h-3.5 w-3.5" />
                {mockupCount} design{mockupCount !== 1 ? 's' : ''}
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
            <Palette className="h-4 w-4" />
            Mockups
            {mockupCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {mockupCount}
              </Badge>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'document' ? (
          <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm shadow-sm">
            <div className="p-6 md:p-10 lg:p-12 overflow-x-auto">
              <article
                className="prose prose-invert prose-sm sm:prose-base max-w-none
                  [&_table]:w-full [&_table]:border-collapse [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:text-sm [&_table]:my-6
                  [&_th]:bg-muted/50 [&_th]:border [&_th]:border-border/40 [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground
                  [&_td]:border [&_td]:border-border/40 [&_td]:p-3 [&_td]:text-foreground
                  [&_tr:nth-child(even)_td]:bg-muted/10
                  prose-headings:text-foreground prose-headings:font-bold prose-headings:mb-4
                  prose-h1:text-2xl prose-h1:pb-3 prose-h1:border-b prose-h1:border-border/30
                  prose-h2:text-xl prose-h2:mt-10 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/20
                  prose-h3:text-lg prose-h3:mt-8
                  prose-p:text-muted-foreground prose-p:leading-[1.75] prose-p:mb-3
                  prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-code:text-orange-300 prose-code:bg-orange-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                  prose-pre:bg-zinc-900/80 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-xl prose-pre:p-4
                  prose-li:text-muted-foreground prose-li:mb-1 prose-li:leading-relaxed
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:my-4
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:my-4
                  prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-border/20
                  [&_hr]:border-border/20 [&_hr]:my-8"
                dangerouslySetInnerHTML={{ __html: cleanStorageFormat(selectedPage.body) }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Full-page mockup viewer overlay — uses /embed/ URL which Adobe allows */}
            {lightboxImage && (
              <div className="fixed inset-0 z-[100] bg-background flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setLightboxImage(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-foreground">{lightboxImage.title}</p>
                      <p className="text-xs text-muted-foreground">Adobe XD Prototype</p>
                    </div>
                  </div>
                  <a href={lightboxImage.downloadUrl.replace('/embed/', '/view/')} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors">
                    <ExternalLink className="h-3 w-3" />
                    Open in new tab
                  </a>
                </div>
                <div className="flex-1">
                  <iframe
                    src={lightboxImage.downloadUrl}
                    title={lightboxImage.title}
                    className="w-full h-full border-0"
                    allow="fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Mockup cards grouped by category */}
            {designLinks.length > 0 ? (
              <>
                {Object.entries(
                  designLinks.reduce((acc, link) => {
                    if (!acc[link.category]) acc[link.category] = [];
                    acc[link.category].push(link);
                    return acc;
                  }, {} as Record<string, DesignLink[]>)
                ).map(([category, catLinks]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-4">
                      {category.toLowerCase().includes('tv') ? <Tv className="h-4 w-4 text-purple-400" /> :
                       category.toLowerCase().includes('mobile') ? <Palette className="h-4 w-4 text-emerald-400" /> :
                       <Monitor className="h-4 w-4 text-blue-400" />}
                      <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{catLinks.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catLinks.map((link, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxImage({ id: String(i), title: link.label, mediaType: 'text/html', downloadUrl: link.url })}
                          className="group text-left p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-muted/40 hover:border-primary/40 hover:shadow-lg transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                              <Palette className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {link.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {link.platform === 'adobe-xd' ? 'Adobe XD' : link.platform} • {category} • Click to preview
                              </p>
                            </div>
                            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-16 rounded-2xl border border-border/30 bg-card/20">
                <Palette className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No designs or mockups in this document</p>
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
