/**
 * useSearch Hook - React hook for search functionality (simplified without Algolia)
 * Validates: Requirements 6.1, 6.2, 6.3, 6.8, 6.9
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { EnhancedBug, Epic, Story } from '@/types/bug-analytics';

interface SearchFilters {
  category?: string;
  severity?: string;
  status?: string;
  assignee?: string;
  dateRange?: { start: Date; end: Date };
}

interface SearchResult {
  bugs: EnhancedBug[];
  epics: Epic[];
  stories: Story[];
  totalCount: number;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: Date;
}

interface UseSearchReturn {
  search: (query: string, filters?: SearchFilters) => Promise<SearchResult>;
  autocomplete: (query: string) => Promise<string[]>;
  saveSearch: (name: string, query: string, filters: SearchFilters) => Promise<void>;
  deleteSavedSearch: (searchId: string) => Promise<void>;
  savedSearches: SavedSearch[];
  results: SearchResult | null;
  loading: boolean;
  error: Error | null;
}

export function useSearch(debounceMs: number = 300): UseSearchReturn {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connector] = useState(() => new FirebaseConnector());
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Load saved searches on mount
  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      const searches = await connector.query<SavedSearch>('saved_searches', {
        orderBy: { field: 'createdAt', direction: 'desc' },
      });
      setSavedSearches(searches);
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  };

  const search = useCallback(
    (query: string, filters?: SearchFilters): Promise<SearchResult> => {
      return new Promise((resolve, reject) => {
        // Clear existing timer
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        // Set new timer
        debounceTimer.current = setTimeout(async () => {
          setLoading(true);
          setError(null);

          try {
            const searchQuery = query.toLowerCase().trim();

            // Search bugs
            const bugsQuery: any = {
              orderBy: { field: 'createdAt', direction: 'desc' },
            };

            const bugs = await connector.query<EnhancedBug>('bugs', bugsQuery);
            const filteredBugs = bugs.filter(bug => {
              // Text search
              const matchesQuery =
                !searchQuery ||
                bug.title?.toLowerCase().includes(searchQuery) ||
                bug.description?.toLowerCase().includes(searchQuery) ||
                bug.searchableText?.toLowerCase().includes(searchQuery);

              // Apply filters
              if (filters?.category && bug.category !== filters.category) return false;
              if (filters?.severity && bug.severity !== filters.severity) return false;
              if (filters?.status && bug.status !== filters.status) return false;
              if (filters?.assignee && bug.assignedTo !== filters.assignee) return false;

              return matchesQuery;
            });

            // Search epics
            const epics = await connector.query<Epic>('epics', {
              orderBy: { field: 'createdAt', direction: 'desc' },
            });
            const filteredEpics = epics.filter(epic => {
              return (
                !searchQuery ||
                epic.title?.toLowerCase().includes(searchQuery) ||
                epic.description?.toLowerCase().includes(searchQuery) ||
                epic.searchableText?.toLowerCase().includes(searchQuery)
              );
            });

            // Search stories
            const stories = await connector.query<Story>('stories', {
              orderBy: { field: 'createdAt', direction: 'desc' },
            });
            const filteredStories = stories.filter(story => {
              return (
                !searchQuery ||
                story.title?.toLowerCase().includes(searchQuery) ||
                story.description?.toLowerCase().includes(searchQuery) ||
                story.searchableText?.toLowerCase().includes(searchQuery)
              );
            });

            const result: SearchResult = {
              bugs: filteredBugs,
              epics: filteredEpics,
              stories: filteredStories,
              totalCount: filteredBugs.length + filteredEpics.length + filteredStories.length,
            };

            setResults(result);
            resolve(result);
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Search failed');
            setError(error);
            reject(error);
          } finally {
            setLoading(false);
          }
        }, debounceMs);
      });
    },
    [connector, debounceMs]
  );

  const autocomplete = useCallback(
    async (query: string): Promise<string[]> => {
      if (!query || query.length < 2) return [];

      try {
        const searchQuery = query.toLowerCase().trim();

        // Get recent bugs for autocomplete
        const bugs = await connector.query<EnhancedBug>('bugs', {
          orderBy: { field: 'createdAt', direction: 'desc' },
          limit: 50,
        });

        const suggestions = new Set<string>();

        bugs.forEach(bug => {
          if (bug.title?.toLowerCase().includes(searchQuery)) {
            suggestions.add(bug.title);
          }
          bug.tags?.forEach(tag => {
            if (tag.toLowerCase().includes(searchQuery)) {
              suggestions.add(tag);
            }
          });
        });

        return Array.from(suggestions).slice(0, 10);
      } catch (err) {
        console.error('Autocomplete failed:', err);
        return [];
      }
    },
    [connector]
  );

  const saveSearch = useCallback(
    async (name: string, query: string, filters: SearchFilters) => {
      setLoading(true);
      setError(null);

      try {
        const searchData: Omit<SavedSearch, 'id'> = {
          name,
          query,
          filters,
          createdAt: new Date(),
        };

        await connector.create('saved_searches', searchData);
        await loadSavedSearches();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to save search');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [connector]
  );

  const deleteSavedSearch = useCallback(
    async (searchId: string) => {
      setLoading(true);
      setError(null);

      try {
        await connector.delete('saved_searches', searchId);
        await loadSavedSearches();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete saved search');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [connector]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    search,
    autocomplete,
    saveSearch,
    deleteSavedSearch,
    savedSearches,
    results,
    loading,
    error,
  };
}
