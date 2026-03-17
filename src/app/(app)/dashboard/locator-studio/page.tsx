"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Cpu, Globe, Copy, Zap, FileCode, MousePointerClick, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { fetchUrlSource } from '@/app/actions';

const extractInteractiveElements = (html: string) => {
    const candidates: { tag: string, attrStr: string, content: string, label: string, icon: any }[] = [];
    const tagRegex = /<(button|input|a|select|textarea|img|div|span)([^>]*)>(.*?)<\/\1>|<(input|img)([^>]*)\/>/gi;
    let match;
    let count = 0;

    while ((match = tagRegex.exec(html)) !== null && count < 300) {
        const tagName = (match[1] || match[4]).toLowerCase();
        const attrs = (match[2] || match[5] || '').trim();
        const content = match[3] || '';

        if (attrs && (attrs.match(/(id|class|name|href|data-|role|placeholder|aria-label)=/))) {
            let label = "";
            const cleanContent = content.replace(/<[^>]*>/g, '').trim();
            const aria = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
            const placeholder = attrs.match(/placeholder=["']([^"']+)["']/i)?.[1];
            const title = attrs.match(/(title|alt)=["']([^"']+)["']/i)?.[2];
            const innerText = cleanContent.length > 0 && cleanContent.length < 40 ? cleanContent : "";
            const name = attrs.match(/(name|id|data-testid)=["']([^"']+)["']/i)?.[2];

            if (aria) label = aria;
            else if (placeholder) label = placeholder;
            else if (innerText) label = innerText;
            else if (title) label = title;
            else if (name) label = name;
            else label = `Unnamed ${tagName}`;

            candidates.push({
                tag: tagName,
                attrStr: attrs,
                content: content.substring(0, 50).trim(),
                label: label,
                icon: MousePointerClick
            });
            count++;
        }
    }
    return candidates;
};

const getBestStrategy = (tag: string, attrs: string, content: string) => {
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    if (idMatch) return { type: 'ID', val: `#${idMatch[1]}`, score: 100, color: 'text-green-600' };

    const testIdMatch = attrs.match(/data-test.*?=["']([^"']+)["']/i);
    if (testIdMatch) return { type: 'TestID', val: `[data-testid="${testIdMatch[1]}"]`, score: 95, color: 'text-green-600' };

    const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
    if (nameMatch) return { type: 'Name', val: `[name="${nameMatch[1]}"]`, score: 85, color: 'text-blue-600' };

    const cleanText = content.replace(/<[^>]*>/g, '').trim();
    if (cleanText.length > 2 && cleanText.length < 40) {
        return { type: 'Text', val: `//${tag}[contains(text(), '${cleanText}')]`, score: 70, color: 'text-yellow-600' };
    }

    return null;
};

export default function LocatorStudioPage() {
    const [targetUrl, setTargetUrl] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [foundElements, setFoundElements] = useState<any[]>([]);

    const handleQuickScan = async () => {
        if (!targetUrl) return;
        setIsScanning(true);
        setFoundElements([]);
        try {
            const result = await fetchUrlSource(targetUrl);
            if (result.success && result.data) {
                const rawElements = extractInteractiveElements(result.data as string);
                const processed = rawElements.map(el => {
                    const strategy = getBestStrategy(el.tag, el.attrStr, el.content);
                    return strategy ? { ...strategy, tag: el.tag, label: el.label, Icon: el.icon } : null;
                }).filter(Boolean);
                const unique = Array.from(new Map(processed.map(item => [item?.val, item])).values());
                setFoundElements(unique);
                toast({ title: "Scan Complete", description: `Found ${unique.length} elements` });
            } else {
                toast({ title: "Fetch Failed", description: result.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to process URL", variant: "destructive" });
        } finally {
            setIsScanning(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    return (
        <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/10 border border-cyan-500/20 p-8">
                    <div className="relative z-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
                            <Link href="/apps">
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium mb-3">
                                    <Cpu className="w-3 h-3" />
                                    Automation Tool
                                </div>
                                <h1 className="text-4xl font-bold tracking-tight">
                                    <span className="text-gradient">Locator Lab</span>
                                </h1>
                                <p className="text-muted-foreground text-lg mt-2">
                                    Extract automation selectors instantly
                                </p>
                            </div>
                        </motion.div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
                </div>

                {/* Scan Status Visual */}
                <Card>
                    <CardContent className="p-6 flex items-center gap-6">
                        <div className="relative w-16 h-16 shrink-0">
                            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/30" />
                            <div className={`absolute inset-1 rounded-full border-4 border-t-cyan-500 ${isScanning ? 'animate-spin' : ''}`} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Cpu className={`w-6 h-6 ${isScanning ? 'text-cyan-500' : 'text-muted-foreground'}`} />
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold">{isScanning ? 'Scanning page...' : foundElements.length > 0 ? `Found ${foundElements.length} elements` : 'Ready to scan'}</p>
                            <p className="text-sm text-muted-foreground">Enter a URL below to extract automation selectors</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Search Bar */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <Globe className="w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="https://example.com"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleQuickScan()}
                                className="flex-1 text-lg"
                            />
                            <Button
                                onClick={handleQuickScan}
                                disabled={isScanning || !targetUrl}
                                className="bg-gradient-to-r from-cyan-500 to-blue-600"
                            >
                                {isScanning ? <Zap className="w-4 h-4 animate-spin" /> : "Scan"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Grid */}
                {foundElements.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {foundElements.map((el, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.02 }}
                            >
                                <Card className="group hover:shadow-xl transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                                                    <el.Icon className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-sm truncate">{el.label}</h3>
                                                    <Badge variant="outline" className="text-xs mt-1">
                                                        {el.tag}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Badge className={`${el.color} text-xs`}>
                                                {el.score}%
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                                            <FileCode className="w-3 h-3 text-muted-foreground shrink-0" />
                                            <code className={`flex-1 text-xs font-mono truncate ${el.color}`} title={el.val}>
                                                {el.val}
                                            </code>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => copyToClipboard(el.val)}
                                            >
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {!isScanning && foundElements.length === 0 && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Cpu className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Ready to scan</h3>
                            <p className="text-muted-foreground">Enter a URL above to extract automation selectors</p>
                        </CardContent>
                    </Card>
                )}
        </div>
    );
}
