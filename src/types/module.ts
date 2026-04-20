export interface ZenitModule {
  id: string;
  name: string;
  description?: string;
  category: string;
  appPackage: string;
  screenshot?: string;
  capturedAt: number;
  locators: ModuleLocator[];
  supportedActions: ModuleActionType[];
  bounds?: { x: number; y: number; width: number; height: number };
  tags: string[];
}

export interface ModuleLocator {
  strategy: 'resourceId' | 'accessibilityId' | 'text' | 'xpath' | 'imageMatch';
  value: string;
  confidence: number;
  verified: boolean;
}

export type ModuleActionType =
  | 'click' | 'longPress' | 'doubleTap' | 'type' | 'clear'
  | 'scroll' | 'swipe' | 'assertVisible' | 'assertText' | 'assertEnabled';
