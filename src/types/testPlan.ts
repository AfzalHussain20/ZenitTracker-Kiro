import { ModuleActionType } from './module';

export interface ZenitTestPlan {
  id: string;
  name: string;
  description?: string;
  suiteId?: string;
  appPackage: string;
  platform: 'android' | 'ios';
  createdAt: number;
  updatedAt: number;
  steps: TestStep[];
  dataBindingId?: string;
  tags: string[];
  lastRunStatus?: 'passed' | 'failed' | 'never';
  lastRunAt?: number;
}

export interface TestStep {
  id: string;
  order: number;
  moduleId: string;
  moduleName: string;
  action: ModuleActionType;
  inputValue?: string;
  expectedValue?: string;
  timeout?: number;
  continueOnFail?: boolean;
  runStatus?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  runLog?: string;
  locatorUsed?: string;
}
