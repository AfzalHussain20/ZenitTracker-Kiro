"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

export interface RecordedAction {
    id: string;
    timestamp: string;
    type: 'tap' | 'swipe' | 'type' | 'long_press' | 'scroll' | 'wait' | 'assert';
    elementId?: string;
    elementType?: string;
    elementText?: string;
    locator?: string;
    inputValue?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    duration?: number;
    screenshot?: string;
    expectedResult?: string;
}

interface VisionContextType {
    isRecording: boolean;
    recordedActions: RecordedAction[];
    currentSession: string | null;
    startRecording: () => void;
    stopRecording: () => void;
    pauseRecording: () => void;
    resumeRecording: () => void;
    addAction: (action: Omit<RecordedAction, 'id' | 'timestamp'>) => void;
    clearActions: () => void;
    removeAction: (actionId: string) => void;
    updateAction: (actionId: string, updates: Partial<RecordedAction>) => void;
}

const VisionContext = createContext<VisionContextType | undefined>(undefined);

export function VisionProvider({ children }: { children: ReactNode }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordedActions, setRecordedActions] = useState<RecordedAction[]>([]);
    const [currentSession, setCurrentSession] = useState<string | null>(null);

    const startRecording = () => {
        setIsRecording(true);
        setIsPaused(false);
        setCurrentSession(`session_${Date.now()}`);
        setRecordedActions([]);
    };

    const stopRecording = () => {
        setIsRecording(false);
        setIsPaused(false);
    };

    const pauseRecording = () => {
        setIsPaused(true);
    };

    const resumeRecording = () => {
        setIsPaused(false);
    };

    const addAction = (action: Omit<RecordedAction, 'id' | 'timestamp'>) => {
        if (!isRecording || isPaused) return;

        const newAction: RecordedAction = {
            ...action,
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
        };

        setRecordedActions(prev => [...prev, newAction]);
    };

    const clearActions = () => {
        setRecordedActions([]);
    };

    const removeAction = (actionId: string) => {
        setRecordedActions(prev => prev.filter(a => a.id !== actionId));
    };

    const updateAction = (actionId: string, updates: Partial<RecordedAction>) => {
        setRecordedActions(prev =>
            prev.map(action =>
                action.id === actionId ? { ...action, ...updates } : action
            )
        );
    };

    return (
        <VisionContext.Provider
            value={{
                isRecording,
                recordedActions,
                currentSession,
                startRecording,
                stopRecording,
                pauseRecording,
                resumeRecording,
                addAction,
                clearActions,
                removeAction,
                updateAction
            }}
        >
            {children}
        </VisionContext.Provider>
    );
}

export function useVision() {
    const context = useContext(VisionContext);
    if (context === undefined) {
        throw new Error('useVision must be used within a VisionProvider');
    }
    return context;
}
