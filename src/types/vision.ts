/**
 * ZENIT VISION - INTERMEDIATE ACTION MODEL (IAM)
 * This schema defines how recorded actions are stored before being converted
 * to framework-specific scripts (Antigravity) or documentation.
 */

export type ActionType =
    | 'CLICK'
    | 'TYPE'
    | 'SWIPE'
    | 'LONG_PRESS'
    | 'ASSERT_VISIBLE'
    | 'ASSERT_TEXT'
    | 'WAIT_FOR'
    | 'PLAY_CONTENT'
    | 'PAUSE_PLAYBACK'
    | 'SEEK_TO';

export interface ElementLocator {
    accessibilityId?: string;
    resourceId?: string;
    xpath?: string;
    className?: string;
    text?: string;
    index?: number;
}

export interface VisionAction {
    id: string;
    timestamp: number;
    type: ActionType;
    locator: ElementLocator;
    value?: string; // For TYPE or SEEK_TO
    screenshot?: string; // Base64 or URL
    description: string; // Human readable
    elementId?: string; // Optional ID for display
    componentName?: string; // Optional component name
    metadata?: Record<string, any>;
}

export interface VisionSession {
    id: string;
    appName: string;
    platform: 'ANDROID' | 'IOS';
    startTime: number;
    actions: VisionAction[];
    deviceInfo: {
        name: string;
        osVersion: string;
        udid: string;
    };
}
