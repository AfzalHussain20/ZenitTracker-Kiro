import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileText, Copy, Download, FileCode, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Documentation() {
    const [cases, setCases] = useState([]);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [doc, setDoc] = useState(null);
    const [generating, setGenerating] = useState(false);

    const loadCases = useCallback(async () => {
        const r = await api.getTestCases();
        setCases(r.data);
    }, []);

    useEffect(() => { loadCases(); }, [loadCases]);

    const handleGenerate = async () => {
        if (!selectedCaseId) { toast.error('Select a test case'); return; }
        setGenerating(true);
        try {
            const r = await api.generateDocs(selectedCaseId);
            setDoc(r.data);
            toast.success('Documentation generated');
        } catch { toast.error('Failed to generate docs'); }
        setGenerating(false);
    };

    const handleCopy = () => {
        if (!doc) return;
        navigator.clipboard.writeText(doc.content);
        toast.success('Copied to clipboard');
    };

    const handleDownload = () => {
        if (!doc) return;
        const blob = new Blob([doc.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test_case_${doc.test_case_name.toLowerCase().replace(/\s+/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded documentation');
    };

    return (
        <div className="p-6 md:p-8 animate-fade-in" data-testid="documentation-page">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-barlow text-3xl md:text-4xl font-bold tracking-tight text-zinc-100 uppercase">
                        <FileText size={28} className="inline mr-2 text-cyan-400" />Documentation
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Generate comprehensive test documentation for Sun NXT</p>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                    <SelectTrigger data-testid="doc-case-select" className="w-[360px] bg-zinc-950 border-zinc-800 text-sm">
                        <SelectValue placeholder="Select test case to document..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                        {cases.map(tc => <SelectItem key={tc.id} value={tc.id} className="text-sm">{tc.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Button data-testid="generate-doc-btn" onClick={handleGenerate} disabled={generating} className="bg-cyan-500 hover:bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    {generating ? 'Generating...' : <><FileCode size={14} className="mr-2" /> Generate Docs</>}
                </Button>

                {doc && (
                    <div className="flex gap-2 ml-auto">
                        <Button data-testid="copy-doc-btn" variant="outline" onClick={handleCopy} className="border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
                            <Copy size={14} className="mr-2" /> Copy Markdown
                        </Button>
                        <Button data-testid="download-doc-btn" variant="outline" onClick={handleDownload} className="border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
                            <Download size={14} className="mr-2" /> Download .md
                        </Button>
                    </div>
                )}
            </div>

            {doc ? (
                <Card className="bg-[#121215] border-zinc-800 animate-fade-in" data-testid="doc-viewer">
                    <CardHeader className="py-3 px-6 border-b border-zinc-800/40 flex flex-row items-center justify-between">
                        <CardTitle className="font-barlow text-xs tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                            <CheckCircle2 size={12} className="text-green-500" /> Preview: {doc.test_case_name}
                        </CardTitle>
                        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">MARKDOWN</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[calc(100vh-320px)] w-full">
                            <div className="p-8 prose prose-invert prose-zinc max-w-none prose-sm prose-headings:font-barlow prose-headings:uppercase prose-headings:tracking-wider prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2 prose-table:border prose-table:border-zinc-800 prose-table:rounded-lg">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {doc.content}
                                </ReactMarkdown>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            ) : (
                <div className="h-[400px] flex items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-600">
                    <div className="text-center">
                        <FileText size={48} className="mx-auto mb-3 text-zinc-800" />
                        <p className="text-sm">Select a test case and generate documentation</p>
                        <p className="text-xs text-zinc-700 mt-1">Exports to Markdown and PDF compatible formats</p>
                    </div>
                </div>
            )}
        </div>
    );
}
