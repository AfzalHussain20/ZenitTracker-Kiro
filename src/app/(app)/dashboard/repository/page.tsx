"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Library, Plus, Search, FileCheck, Trash2, ArrowLeft, Sparkles, BrainCircuit, DownloadCloud, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface TestCase {
    id: string;
    title: string;
    steps: string;
    expectedResult: string;
    platform: string;
    priority: 'High' | 'Medium' | 'Low';
    tags: string[];
    createdAt: any;
}

export default function RepositoryPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const [newCase, setNewCase] = useState({
        title: '',
        steps: '',
        expectedResult: '',
        platform: 'Android TV',
        priority: 'Medium' as const,
        tags: '',
    });

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'managedTestCases'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TestCase));
            setTestCases(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleCreateTestCase = async () => {
        if (!newCase.title || !newCase.platform) return;
        try {
            await addDoc(collection(db, 'managedTestCases'), {
                ...newCase,
                tags: newCase.tags.split(',').map(t => t.trim()).filter(t => t),
                createdBy: user?.uid,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Test Case Created", description: "Successfully added to repository" });
            setIsAddDialogOpen(false);
            setNewCase({ title: '', steps: '', expectedResult: '', platform: 'Android TV', priority: 'Medium', tags: '' });
        } catch (e) {
            toast({ title: "Error", description: "Failed to create test case", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this test case?")) return;
        try {
            await deleteDoc(doc(db, 'managedTestCases', id));
            toast({ title: "Deleted", description: "Test case removed" });
        } catch {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    const filteredData = testCases.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'High': return 'from-rose-500 to-red-600';
            case 'Medium': return 'from-amber-500 to-orange-600';
            default: return 'from-emerald-500 to-green-600';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 p-8">
                    <div className="relative z-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
                            <Link href="/apps">
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-medium mb-3">
                                    <Library className="w-3 h-3" />
                                    Test Repository
                                </div>
                                <h1 className="text-4xl font-bold tracking-tight">
                                    <span className="text-gradient">Repository</span>
                                </h1>
                                <p className="text-muted-foreground text-lg mt-2">
                                    Master test case library
                                </p>
                            </div>
                        </motion.div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
                </div>

                {/* Priority Distribution Visual */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'High Priority', value: testCases.filter(t => t.priority === 'High').length, color: 'from-rose-500 to-red-600' },
                        { label: 'Medium Priority', value: testCases.filter(t => t.priority === 'Medium').length, color: 'from-amber-500 to-orange-600' },
                        { label: 'Low Priority', value: testCases.filter(t => t.priority === 'Low').length, color: 'from-emerald-500 to-green-600' },
                    ].map((s) => (
                        <Card key={s.label} className="relative overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-10`} />
                            <CardContent className="p-6 text-center">
                                <div className="text-4xl font-bold mb-1">{s.value}</div>
                                <div className="text-sm text-muted-foreground">{s.label}</div>
                                <div className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${s.color}`} style={{ width: `${testCases.length ? (s.value / testCases.length) * 100 : 0}%`, margin: '0 auto' }} />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Cases', value: testCases.length, gradient: 'from-purple-500 to-indigo-600' },
                        { label: 'High Priority', value: testCases.filter(t => t.priority === 'High').length, gradient: 'from-rose-500 to-red-600' },
                        { label: 'Medium Priority', value: testCases.filter(t => t.priority === 'Medium').length, gradient: 'from-amber-500 to-orange-600' },
                        { label: 'Low Priority', value: testCases.filter(t => t.priority === 'Low').length, gradient: 'from-emerald-500 to-green-600' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                            <Card className="relative overflow-hidden group hover:shadow-xl transition-all">
                                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                                <CardContent className="p-6 relative">
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Search & Actions */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search test cases..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-gradient-to-r from-purple-500 to-indigo-600">
                                        <Plus className="w-4 h-4 mr-2" /> Create Test Case
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Create Test Case</DialogTitle>
                                        <DialogDescription>Add a new test case to the repository</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Title</Label>
                                            <Input
                                                placeholder="Test case title..."
                                                value={newCase.title}
                                                onChange={e => setNewCase({ ...newCase, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Platform</Label>
                                                <Select value={newCase.platform} onValueChange={v => setNewCase({ ...newCase, platform: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {["Android TV", "Apple TV", "Web", "Mobile (iOS)", "Mobile (Android)"].map(p => (
                                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Priority</Label>
                                                <Select value={newCase.priority} onValueChange={v => setNewCase({ ...newCase, priority: v as any })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {["High", "Medium", "Low"].map(p => (
                                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Steps</Label>
                                            <Textarea
                                                placeholder="1. Step one&#10;2. Step two..."
                                                value={newCase.steps}
                                                onChange={e => setNewCase({ ...newCase, steps: e.target.value })}
                                                rows={4}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Expected Result</Label>
                                            <Textarea
                                                placeholder="Expected outcome..."
                                                value={newCase.expectedResult}
                                                onChange={e => setNewCase({ ...newCase, expectedResult: e.target.value })}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tags (comma separated)</Label>
                                            <Input
                                                placeholder="regression, smoke, critical"
                                                value={newCase.tags}
                                                onChange={e => setNewCase({ ...newCase, tags: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleCreateTestCase} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600">
                                            Create Test Case
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                {/* Test Cases Grid */}
                <div className="grid gap-4">
                    {filteredData.map((testCase, i) => (
                        <motion.div
                            key={testCase.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="group hover:shadow-xl transition-all">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`p-2 rounded-lg bg-gradient-to-br ${getPriorityColor(testCase.priority)}`}>
                                                    <FileCheck className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold truncate">{testCase.title}</h3>
                                                    <p className="text-sm text-muted-foreground">{testCase.platform}</p>
                                                </div>
                                                <Badge className={`bg-gradient-to-r ${getPriorityColor(testCase.priority)} text-white border-0`}>
                                                    {testCase.priority}
                                                </Badge>
                                            </div>
                                            {testCase.steps && (
                                                <div className="mb-3">
                                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Steps:</p>
                                                    <p className="text-sm whitespace-pre-wrap line-clamp-3">{testCase.steps}</p>
                                                </div>
                                            )}
                                            {testCase.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {testCase.tags.map(tag => (
                                                        <Badge key={tag} variant="outline" className="text-xs">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(testCase.id)}
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {filteredData.length === 0 && !loading && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Library className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No test cases found</h3>
                            <p className="text-muted-foreground">Create your first test case to get started</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
