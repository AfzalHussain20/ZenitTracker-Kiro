"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Search, Eye, EyeOff, Box } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ElementNode {
    id: string;
    type: string;
    class: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    attributes: {
        [key: string]: any;
    };
    children: ElementNode[];
}

interface ElementHierarchyTreeProps {
    hierarchy: ElementNode | null;
    selectedElementId: string | null;
    onElementSelect: (element: ElementNode) => void;
    onElementHighlight: (elementId: string) => void;
}

export function ElementHierarchyTree({
    hierarchy,
    selectedElementId,
    onElementSelect,
    onElementHighlight
}: ElementHierarchyTreeProps) {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

    const toggleNode = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const matchesSearch = (node: ElementNode): boolean => {
        if (!searchQuery) return true;
        
        const query = searchQuery.toLowerCase();
        const typeMatch = node.type.toLowerCase().includes(query);
        const classMatch = node.class.toLowerCase().includes(query);
        const idMatch = node.attributes['resource-id']?.toLowerCase().includes(query);
        const textMatch = node.attributes.text?.toLowerCase().includes(query);
        const descMatch = node.attributes['content-desc']?.toLowerCase().includes(query);
        
        return typeMatch || classMatch || idMatch || textMatch || descMatch;
    };

    const filterTree = (node: ElementNode): ElementNode | null => {
        if (!searchQuery) return node;
        
        const matches = matchesSearch(node);
        const filteredChildren = node.children
            .map(child => filterTree(child))
            .filter(Boolean) as ElementNode[];
        
        if (matches || filteredChildren.length > 0) {
            return {
                ...node,
                children: filteredChildren
            };
        }
        
        return null;
    };

    const renderNode = (node: ElementNode, depth: number = 0): JSX.Element => {
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = selectedElementId === node.id;
        const isHovered = hoveredElementId === node.id;
        const hasChildren = node.children && node.children.length > 0;
        
        const getElementIcon = () => {
            const type = node.type.toLowerCase();
            if (type.includes('button')) return '🔘';
            if (type.includes('text') || type.includes('label')) return '📝';
            if (type.includes('image')) return '🖼️';
            if (type.includes('input') || type.includes('edit')) return '✏️';
            if (type.includes('scroll') || type.includes('list')) return '📜';
            if (type.includes('view') || type.includes('layout')) return '📦';
            return '⬜';
        };

        const getElementLabel = () => {
            const resourceId = node.attributes['resource-id'];
            const text = node.attributes.text;
            const contentDesc = node.attributes['content-desc'];
            
            if (resourceId) {
                const parts = resourceId.split('/');
                return parts[parts.length - 1] || resourceId;
            }
            if (text && text.length < 30) return text;
            if (contentDesc && contentDesc.length < 30) return contentDesc;
            return node.type;
        };

        return (
            <div key={node.id}>
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`
                        flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer
                        transition-colors group
                        ${isSelected ? 'bg-violet-500/20 border border-violet-500/50' : ''}
                        ${isHovered && !isSelected ? 'bg-muted/50' : ''}
                        hover:bg-muted/70
                    `}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => onElementSelect(node)}
                    onMouseEnter={() => {
                        setHoveredElementId(node.id);
                        onElementHighlight(node.id);
                    }}
                    onMouseLeave={() => setHoveredElementId(null)}
                >
                    {/* Expand/Collapse Icon */}
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(node.id);
                            }}
                            className="p-0.5 hover:bg-muted rounded"
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                            ) : (
                                <ChevronRight className="w-4 h-4" />
                            )}
                        </button>
                    ) : (
                        <div className="w-5" />
                    )}

                    {/* Element Icon */}
                    <span className="text-sm">{getElementIcon()}</span>

                    {/* Element Label */}
                    <span className="text-sm font-medium flex-1 truncate">
                        {getElementLabel()}
                    </span>

                    {/* Element Type Badge */}
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {node.type}
                    </Badge>

                    {/* Visibility Indicator */}
                    {node.attributes.visible ? (
                        <Eye className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                        <EyeOff className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </motion.div>

                {/* Children */}
                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {node.children.map(child => renderNode(child, depth + 1))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const filteredHierarchy = hierarchy ? filterTree(hierarchy) : null;

    // Auto-expand nodes when searching
    if (searchQuery && filteredHierarchy) {
        const expandAll = (node: ElementNode) => {
            expandedNodes.add(node.id);
            node.children.forEach(child => expandAll(child));
        };
        expandAll(filteredHierarchy);
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search elements..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Tree View */}
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {!hierarchy ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No hierarchy available</p>
                            <p className="text-sm mt-1">Connect to a device to view elements</p>
                        </div>
                    ) : filteredHierarchy ? (
                        renderNode(filteredHierarchy)
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No elements match your search</p>
                            <p className="text-sm mt-1">Try a different search term</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Stats Footer */}
            {hierarchy && (
                <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Total Elements: {countElements(hierarchy)}</span>
                    <span>Depth: {getMaxDepth(hierarchy)}</span>
                </div>
            )}
        </div>
    );
}

// Helper functions
function countElements(node: ElementNode): number {
    let count = 1;
    if (node.children) {
        node.children.forEach(child => {
            count += countElements(child);
        });
    }
    return count;
}

function getMaxDepth(node: ElementNode, currentDepth: number = 0): number {
    if (!node.children || node.children.length === 0) {
        return currentDepth;
    }
    return Math.max(...node.children.map(child => getMaxDepth(child, currentDepth + 1)));
}
