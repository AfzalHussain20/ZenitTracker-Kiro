import { ZenitModule, ModuleLocator, ModuleActionType } from '@/types/module';
import { TestStep } from '@/types/testPlan';

export interface HealingResult {
  found: boolean;
  locatorUsed: ModuleLocator | null;
  healingOccurred: boolean;
  suggestedPrimary?: ModuleLocator;
  confidence: number;
}

export function resolveLocator(module: ZenitModule, hierarchy: any): HealingResult {
  const sorted = [...module.locators].sort((a, b) => b.confidence - a.confidence);
  let primaryAttempted = false;
  let healingOccurred = false;

  for (const locator of sorted) {
    if (searchHierarchy(hierarchy, locator)) {
      if (primaryAttempted) healingOccurred = true;
      return {
        found: true,
        locatorUsed: locator,
        healingOccurred,
        suggestedPrimary: healingOccurred ? locator : undefined,
        confidence: locator.confidence,
      };
    }
    primaryAttempted = true;
  }
  return { found: false, locatorUsed: null, healingOccurred: false, confidence: 0 };
}

function searchHierarchy(node: any, locator: ModuleLocator): boolean {
  if (!node) return false;
  const attrs = node.attributes || {};
  switch (locator.strategy) {
    case 'resourceId':
      if (attrs.resourceId === locator.value) return true;
      break;
    case 'accessibilityId':
      if (attrs.contentDesc === locator.value) return true;
      break;
    case 'text':
      if (attrs.text === locator.value) return true;
      break;
    case 'xpath':
      return true; // pass through to device
  }
  for (const child of node.children || []) {
    if (searchHierarchy(child, locator)) return true;
  }
  return false;
}

export function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export function buildActionPayload(
  step: TestStep,
  locator: ModuleLocator,
  variables: Record<string, string> = {},
): object | null {
  const inputValue = step.inputValue
    ? substituteVariables(step.inputValue, variables)
    : undefined;

  switch (step.action) {
    case 'click':
      if (locator.strategy === 'resourceId')
        return { action: 'tap_by_id', resourceId: locator.value };
      if (locator.strategy === 'accessibilityId')
        return { action: 'tap_by_accessibility_id', accessibilityId: locator.value };
      if (locator.strategy === 'text')
        return { action: 'tap_by_text', text: locator.value };
      return { action: 'tap_by_xpath', xpath: locator.value };
    case 'type':
      return { action: 'type_into', locatorStrategy: locator.strategy,
               locatorValue: locator.value, text: inputValue || '' };
    case 'longPress':
      return { action: 'longpress_by', locatorStrategy: locator.strategy,
               locatorValue: locator.value, duration: 1500 };
    case 'assertVisible':
      return { action: 'assert_visible', locatorStrategy: locator.strategy,
               locatorValue: locator.value };
    case 'assertText':
      return { action: 'assert_text', locatorStrategy: locator.strategy,
               locatorValue: locator.value, expected: inputValue || step.expectedValue || '' };
    case 'scroll':
      return { action: 'swipe', ratioX1: 0.5, ratioY1: 0.5,
               ratioX2: 0.5, ratioY2: inputValue === 'up' ? 0.2 : 0.8, duration: 300 };
    default:
      return null;
  }
}

export function buildLocatorsFromElement(el: any): ModuleLocator[] {
  const locators: ModuleLocator[] = [];
  const attrs = el.attributes || {};
  const cls = el.type?.split('.').pop() || '*';

  if (attrs.resourceId)
    locators.push({ strategy: 'resourceId', value: attrs.resourceId,
                    confidence: 0.95, verified: true });
  if (attrs.contentDesc)
    locators.push({ strategy: 'accessibilityId', value: attrs.contentDesc,
                    confidence: 0.85, verified: true });
  if (attrs.text)
    locators.push({ strategy: 'text', value: attrs.text,
                    confidence: 0.70, verified: true });

  const xp = attrs.resourceId
    ? `//${cls}[@resource-id='${attrs.resourceId}']`
    : attrs.contentDesc
    ? `//${cls}[@content-desc='${attrs.contentDesc}']`
    : attrs.text
    ? `//${cls}[@text='${attrs.text}']`
    : `//${cls}`;
  locators.push({ strategy: 'xpath', value: xp, confidence: 0.55, verified: true });

  return locators;
}

export function inferSupportedActions(el: any): ModuleActionType[] {
  const t = (el.type || '').toLowerCase();
  const attrs = el.attributes || {};
  const actions: ModuleActionType[] = ['assertVisible'];
  if (attrs.clickable) actions.push('click', 'longPress', 'doubleTap');
  if (t.includes('edit') || t.includes('input')) actions.push('type', 'clear');
  if (attrs.text) actions.push('assertText');
  if (t.includes('recycler') || t.includes('scroll')) actions.push('scroll');
  return actions;
}
