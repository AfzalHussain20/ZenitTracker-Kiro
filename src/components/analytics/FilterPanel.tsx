/**
 * FilterPanel Component - Provides filtering UI for analytics
 * Validates: Requirements 4.1, 4.4, 7.1, 7.2, 7.3, 7.5
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { TimePreset, BugType, BugSeverity } from '@/types/bug-analytics';
import { cn } from '@/lib/utils';

export interface FilterState {
  timePreset?: TimePreset;
  customDateRange?: { start: Date; end: Date };
  sprints?: string[];
  categories?: BugType[];
  severities?: BugSeverity[];
  statuses?: string[];
  priorities?: string[];
}

export interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableSprints?: Array<{ id: string; name: string }>;
  className?: string;
}

const TIME_PRESETS: Array<{ value: TimePreset; label: string }> = [
  { value: 'current_month', label: 'Current Month' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const CATEGORIES: BugType[] = ['functional', 'ui', 'performance', 'security', 'crash', 'data'];
const SEVERITIES: BugSeverity[] = ['critical', 'high', 'medium', 'low', 'trivial'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'reopened'];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

export function FilterPanel({
  filters,
  onFiltersChange,
  availableSprints = [],
  className = '',
}: FilterPanelProps) {
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>(
    filters.customDateRange?.start
  );
  const [customEnd, setCustomEnd] = useState<Date | undefined>(filters.customDateRange?.end);

  useEffect(() => {
    // Persist filters to URL query params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (filters.timePreset) params.set('timePreset', filters.timePreset);
      if (filters.sprints?.length) params.set('sprints', filters.sprints.join(','));
      if (filters.categories?.length) params.set('categories', filters.categories.join(','));
      if (filters.severities?.length) params.set('severities', filters.severities.join(','));

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [filters]);

  const handleTimePresetChange = (preset: TimePreset) => {
    if (preset === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      onFiltersChange({ ...filters, timePreset: preset, customDateRange: undefined });
    }
  };

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      onFiltersChange({
        ...filters,
        timePreset: 'custom',
        customDateRange: { start: customStart, end: customEnd },
      });
      setShowCustomDatePicker(false);
    }
  };

  const handleSprintToggle = (sprintId: string) => {
    const currentSprints = filters.sprints || [];
    const newSprints = currentSprints.includes(sprintId)
      ? currentSprints.filter(id => id !== sprintId)
      : [...currentSprints, sprintId];

    onFiltersChange({ ...filters, sprints: newSprints });
  };

  const handleCategoryToggle = (category: BugType) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];

    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleSeverityToggle = (severity: BugSeverity) => {
    const currentSeverities = filters.severities || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [...currentSeverities, severity];

    onFiltersChange({ ...filters, severities: newSeverities });
  };

  const handleStatusToggle = (status: string) => {
    const currentStatuses = filters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];

    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleReset = () => {
    onFiltersChange({
      timePreset: 'current_month',
      sprints: [],
      categories: [],
      severities: [],
      statuses: [],
      priorities: [],
    });
    setShowCustomDatePicker(false);
    setCustomStart(undefined);
    setCustomEnd(undefined);
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Filters</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <X className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Filter */}
        <div className="space-y-2">
          <Label>Time Period</Label>
          <Select
            value={filters.timePreset || 'current_month'}
            onValueChange={value => handleTimePresetChange(value as TimePreset)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              {TIME_PRESETS.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showCustomDatePicker && (
            <div className="space-y-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, 'PPP') : 'Pick start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, 'PPP') : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} />
                </PopoverContent>
              </Popover>

              <Button onClick={handleCustomDateApply} className="w-full">
                Apply Custom Range
              </Button>
            </div>
          )}
        </div>

        {/* Sprint Filter */}
        {availableSprints.length > 0 && (
          <div className="space-y-2">
            <Label>Sprints</Label>
            <div className="flex flex-wrap gap-2">
              {availableSprints.map(sprint => (
                <Button
                  key={sprint.id}
                  variant={filters.sprints?.includes(sprint.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSprintToggle(sprint.id)}
                >
                  {sprint.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="space-y-2">
          <Label>Categories</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(category => (
              <Button
                key={category}
                variant={filters.categories?.includes(category) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategoryToggle(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Severity Filter */}
        <div className="space-y-2">
          <Label>Severities</Label>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map(severity => (
              <Button
                key={severity}
                variant={filters.severities?.includes(severity) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSeverityToggle(severity)}
              >
                {severity}
              </Button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(status => (
              <Button
                key={status}
                variant={filters.statuses?.includes(status) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusToggle(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
