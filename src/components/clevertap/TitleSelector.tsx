'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TitleData } from '@/lib/smartSheetAnalyzer';
import { Card, CardContent } from '@/components/ui/card';
import { Folder, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TitleSelectorProps {
  titles: TitleData[];
  selectedTitle: TitleData | null;
  onSelectTitle: (title: TitleData) => void;
}

export function TitleSelector({ titles, selectedTitle, onSelectTitle }: TitleSelectorProps) {
  if (titles.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Select Title/Content
          </label>
          <Select 
            value={selectedTitle?.id || ''} 
            onValueChange={(value) => {
              const title = titles.find(t => t.id === value);
              if (title) onSelectTitle(title);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a title to validate..." />
            </SelectTrigger>
            <SelectContent>
              {titles.map(title => (
                <SelectItem key={title.id} value={title.id}>
                  <div className="flex items-center gap-2">
                    {title.name}
                    <Badge variant="outline" className="text-xs">
                      {title.events.length} events
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTitle && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <PlayCircle className="w-4 h-4" />
                Expected Events
              </h4>
              <div className="space-y-1">
                {selectedTitle.events.map((event, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary" />
                    {event.eventName} ({event.attributes.length} attributes)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
