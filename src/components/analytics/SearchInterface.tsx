/**
 * SearchInterface Component - Provides search UI with autocomplete
 * Validates: Requirements 6.1, 6.2, 6.3, 6.6, 6.7, 6.8, 6.9
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Save, Trash2, HelpCircle } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';

export interface SearchInterfaceProps {
  onSearch: (query: string, filters?: any) => void;
  placeholder?: string;
  showSavedSearches?: boolean;
  className?: string;
}

export function SearchInterface({
  onSearch,
  placeholder = 'Search bugs, epics, stories...',
  showSavedSearches = true,
  className = '',
}: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const {
    search,
    autocomplete,
    saveSearch,
    deleteSavedSearch,
    savedSearches,
    loading,
  } = useSearch(300);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length >= 2) {
      autocomplete(query).then(setSuggestions);
      setShowAutocomplete(true);
    } else {
      setSuggestions([]);
      setShowAutocomplete(false);
    }
  }, [query, autocomplete]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      const results = await search(query);
      onSearch(query, results);
      setShowAutocomplete(false);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowAutocomplete(false);
    setTimeout(() => handleSearch(), 100);
  };

  const handleSaveSearch = async () => {
    if (!saveName.trim() || !query.trim()) return;

    try {
      await saveSearch(saveName, query, {});
      setSaveName('');
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const handleLoadSavedSearch = (savedQuery: string) => {
    setQuery(savedQuery);
    setTimeout(() => handleSearch(), 100);
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    try {
      await deleteSavedSearch(searchId);
    } catch (error) {
      console.error('Failed to delete saved search:', error);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Search</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Help Text */}
        {showHelp && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            <p className="font-semibold mb-2">Search Syntax:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Use quotes for exact phrases: &quot;login error&quot;</li>
              <li>Use AND, OR, NOT for boolean search</li>
              <li>Search across title, description, and comments</li>
            </ul>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              Search
            </Button>
            {query && (
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(!showSaveDialog)}
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showAutocomplete && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg">
              <Command>
                <CommandList>
                  <CommandGroup heading="Suggestions">
                    {suggestions.map((suggestion, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        {/* Save Search Dialog */}
        {showSaveDialog && (
          <div className="space-y-2 p-3 border rounded-md">
            <Input
              placeholder="Enter search name"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveSearch} size="sm">
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Saved Searches */}
        {showSavedSearches && savedSearches.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Saved Searches</p>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map(saved => (
                <Badge
                  key={saved.id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80 flex items-center gap-2"
                >
                  <span onClick={() => handleLoadSavedSearch(saved.query)}>
                    {saved.name}
                  </span>
                  <Trash2
                    className="h-3 w-3 hover:text-destructive"
                    onClick={() => handleDeleteSavedSearch(saved.id)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
