"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, StopCircle, Pause, Trash2, Download, Code } from 'lucide-react';
import { useVision } from '@/contexts/VisionContext';

interface RecordingControlsProps {
    onGenerateScript?: () => void;
    onExport?: () => void;
}

export function RecordingControls({ onGenerateScript, onExport }: RecordingControlsProps) {
    const { 
        isRecording, 
        recordedActions, 
        startRecording, 
        stopRecording, 
        clearActions 
    } = useVision();

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Recording</h3>
                        {isRecording && (
                            <Badge className="bg-red-500 animate-pulse">
                                REC
                            </Badge>
                        )}
                    </div>
                    <Badge variant="outline">
                        {recordedActions.length} actions
                    </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!isRecording ? (
                        <Button
                            onClick={startRecording}
                            className="bg-gradient-to-r from-red-500 to-rose-600"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Start Recording
                        </Button>
                    ) : (
                        <Button
                            onClick={stopRecording}
                            variant="outline"
                        >
                            <StopCircle className="w-4 h-4 mr-2" />
                            Stop
                        </Button>
                    )}

                    {recordedActions.length > 0 && (
                        <>
                            <Button
                                onClick={onGenerateScript}
                                variant="outline"
                            >
                                <Code className="w-4 h-4 mr-2" />
                                Generate Script
                            </Button>
                            <Button
                                onClick={onExport}
                                variant="outline"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
