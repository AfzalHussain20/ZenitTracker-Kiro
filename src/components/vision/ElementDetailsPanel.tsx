"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Star, AlertCircle, Eye, Box, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { ElementNode } from './ElementHierarchyTree';

interface LocatorStrategy {
    type: string;
    value: string;
    score: number;
    description: string;
}

interface ElementDetailsPanelProps {
    element: ElementNode | null;
}

export function ElementDetailsPanel({ element }: ElementDetailsPanelProps) {
    const { toast } = useToast();
    const [copiedStrategy, setCopiedStrategy] = useState<string | null>(null);

    if (!element) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <Box className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No Element Selected</p>
                <p className="text-sm mt-2 text-center">
                    Select an element from the hierarchy tree to view details
                </p>
            </div>
        );
    }

    const generateLocatorStrategies = (): LocatorStrategy[] => {
        const strategies: LocatorStrategy[] = [];
        const attrs = element.attributes;

        // Resource ID Strategy
        if (attrs['resource-id']) {
            strategies.push({
                type: 'Resource ID',
                value: attrs['resource-id'],
                score: 95,
                description: 'Most reliable - unique identifier'
            });
        }

        // Accessibility ID Strategy
        if (attrs['content-desc']) {
            strategies.push({
                type: 'Accessibility ID',
                value: attrs['content-desc'],
                score: 90,
                description: 'Highly reliable - accessibility label'
            });
        }

        // Text Strategy
        if (attrs.text) {
            strategies.push({
                type: 'Text',
                value: attrs.text,
                score: 70,
                description: 'Moderate reliability - may change with localization'
            });
        }

        // Class Name Strategy
        strategies.push({
            type: 'Class Name',
            value: element.class,
            score: 50,
            description: 'Low reliability - not unique'
        });

        // XPath Strategy (relative)
        const xpath = generateRelativeXPath(element);
        strategies.push({
            type: 'XPath (Relative)',
            value: xpath,
            score: 60,
            description: 'Moderate reliability - structure dependent'
        });

        // CSS Selector (for web views)
        if (attrs['resource-id']) {
            const cssSelector = `#${attrs['resource-id'].split('/').pop()}`;
            strategies.push({
                type: 'CSS Selector',
                value: cssSelector,
                score: 85,
                description: 'Good for web views'
            });
        }

        return strategies.sort((a, b) => b.score - a.score);
    };

    const generateRelativeXPath = (el: ElementNode): string => {
        const resourceId = el.attributes['resource-id'];
        if (resourceId) {
            return `//*[@resource-id="${resourceId}"]`;
        }
        const contentDesc = el.attributes['content-desc'];
        if (contentDesc) {
            return `//*[@content-desc="${contentDesc}"]`;
        }
        const text = el.attributes.text;
        if (text) {
            return `//${el.type}[@text="${text}"]`;
        }
        return `//${el.type}`;
    };

    const copyToClipboard = (text: string, strategyType: string) => {
        navigator.clipboard.writeText(text);
        setCopiedStrategy(strategyType);
        toast({
            title: 'Copied!',
            description: `${strategyType} copied to clipboard`
        });
        setTimeout(() => setCopiedStrategy(null), 2000);
    };

    const getScoreColor = (score: number) => {
        if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
        if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-rose-600 bg-rose-50 border-rose-200';
    };

    const strategies = generateLocatorStrategies();

    return (
        <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
                {/* Element Header */}
                <div>
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <h3 className="text-lg font-bold">{element.type}</h3>
                            <p className="text-sm text-muted-foreground">{element.class}</p>
                        </div>
                        <Badge variant={element.attributes.visible ? 'default' : 'secondary'}>
                            {element.attributes.visible ? (
                                <>
                                    <Eye className="w-3 h-3 mr-1" />
                                    Visible
                                </>
                            ) : (
                                'Hidden'
                            )}
                        </Badge>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="locators" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="locators">Locators</TabsTrigger>
                        <TabsTrigger value="properties">Properties</TabsTrigger>
                        <TabsTrigger value="bounds">Bounds</TabsTrigger>
                    </TabsList>

                    {/* Locators Tab */}
                    <TabsContent value="locators" className="space-y-3 mt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <Star className="w-4 h-4" />
                            <span>Strategies ranked by reliability</span>
                        </div>

                        {strategies.map((strategy, index) => (
                            <motion.div
                                key={strategy.type}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="relative overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-sm">{strategy.type}</span>
                                                    <Badge 
                                                        variant="outline" 
                                                        className={`text-xs ${getScoreColor(strategy.score)}`}
                                                    >
                                                        {strategy.score}%
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-2">
                                                    {strategy.description}
                                                </p>
                                                <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                                                    {strategy.value}
                                                </code>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => copyToClipboard(strategy.value, strategy.type)}
                                                className="ml-2"
                                            >
                                                {copiedStrategy === strategy.type ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}

                        {/* Best Practice Tip */}
                        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                            <CardContent className="p-4">
                                <div className="flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                            Best Practice
                                        </p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            Use Resource ID or Accessibility ID for most reliable automation. 
                                            Avoid XPath when possible as it&apos;s fragile to UI changes.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Properties Tab */}
                    <TabsContent value="properties" className="space-y-2 mt-4">
                        {Object.entries(element.attributes).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                <div className="flex-1">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                        {key}
                                    </div>
                                    <div className="text-sm font-mono">
                                        {typeof value === 'boolean' ? (
                                            <Badge variant={value ? 'default' : 'secondary'}>
                                                {value.toString()}
                                            </Badge>
                                        ) : (
                                            value?.toString() || 'null'
                                        )}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(value?.toString() || '', key)}
                                >
                                    {copiedStrategy === key ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                        <Copy className="w-3 h-3" />
                                    )}
                                </Button>
                            </div>
                        ))}
                    </TabsContent>

                    {/* Bounds Tab */}
                    <TabsContent value="bounds" className="space-y-4 mt-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Maximize2 className="w-4 h-4" />
                                    <span className="font-semibold">Position & Size</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <div className="text-xs text-muted-foreground mb-1">X Position</div>
                                        <div className="text-lg font-bold">{element.bounds.x}px</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <div className="text-xs text-muted-foreground mb-1">Y Position</div>
                                        <div className="text-lg font-bold">{element.bounds.y}px</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <div className="text-xs text-muted-foreground mb-1">Width</div>
                                        <div className="text-lg font-bold">{element.bounds.width}px</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <div className="text-xs text-muted-foreground mb-1">Height</div>
                                        <div className="text-lg font-bold">{element.bounds.height}px</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Visual Representation */}
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-sm font-semibold mb-3">Visual Preview</div>
                                <div className="relative w-full h-48 bg-muted/30 rounded-lg overflow-hidden">
                                    <div
                                        className="absolute bg-violet-500/20 border-2 border-violet-500"
                                        style={{
                                            left: `${(element.bounds.x / 1080) * 100}%`,
                                            top: `${(element.bounds.y / 2400) * 100}%`,
                                            width: `${(element.bounds.width / 1080) * 100}%`,
                                            height: `${(element.bounds.height / 2400) * 100}%`
                                        }}
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-violet-600">
                                            {element.type}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    Approximate position on screen (1080x2400)
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </ScrollArea>
    );
}
