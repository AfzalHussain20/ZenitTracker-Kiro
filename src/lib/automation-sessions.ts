
export interface RunSession {
    id: string;
    timestamp: string;
    status: 'PASSED' | 'FAILED' | 'SUCCESS';
    duration: string;
    testCase: string;
    plan: string;
    region: string;
    headless: boolean;
    accountsCreated?: number;
    logs: string[];
}

let sessions: RunSession[] = [];

export function loadSessions(): RunSession[] {
    return sessions;
}

export function clearSessions(): void {
    sessions = [];
}
