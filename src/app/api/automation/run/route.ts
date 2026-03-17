
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Store logs and state globally for persistence across the same run
let currentProcess: any = null;
let commandOutput: string[] = [];
let isRunning = false;
let startTime: number = 0;

export async function POST(req: NextRequest) {
    // Legacy support for POST if needed, but we prefer streaming GET now
    return NextResponse.json({ message: 'Use GET with EventSource for streaming logs' });
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');

    // ─── List Reports Action ──────────────────────────────────────────────
    if (action === 'list_reports') {
        const reportsDir = path.resolve(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) return NextResponse.json({ reports: [] });

        const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json')).reverse();
        const reports = files.map(file => {
            try {
                const content = fs.readFileSync(path.join(reportsDir, file), 'utf-8');
                return JSON.parse(content);
            } catch (e) { return null; }
        }).filter(Boolean);

        return NextResponse.json({ reports });
    }

    // ─── Streaming Execution Action ────────────────────────────────────────
    if (isRunning) {
        return new Response('data: [SYSTEM] A test is already running. Please wait for completion.\n\n', {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
        });
    }

    const mode = searchParams.get('mode') || 'signup_only';
    const primaryPlan = searchParams.get('primaryPlan') || '2';
    const secondaryPlan = searchParams.get('secondaryPlan') || '0';
    const loginEmail = searchParams.get('loginEmail') || '';
    const loginPass = searchParams.get('loginPass') || '';
    const headless = searchParams.get('headless') === 'true';
    const count = searchParams.get('count') || '1';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            const sendEvent = (msg: string) => {
                controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
            };

            // Reset state
            commandOutput = [];
            isRunning = true;
            startTime = Date.now();

            sendEvent(`══ ZENIT ENGINE INITIATED ══`);
            sendEvent(`Mode      : ${mode.toUpperCase()}`);
            sendEvent(`Target(s) : ${count}`);
            sendEvent(`Engine    : ${headless ? 'HEADLESS' : 'VISUAL — Browser will open'}`);
            sendEvent(`════════════════════════`);

            const automationDir = path.resolve(process.cwd(), 'Zenit-Web-Auto');
            const javaHome = 'C:\\Program Files\\Microsoft\\jdk-17.0.14.7-hotspot'; // High-perf Java 17
            const mavenHome = 'C:\\maven'; // Path from user's env earlier

            let env = { ...process.env, JAVA_HOME: javaHome } as any;
            const platformPathSeparator = process.platform === 'win32' ? ';' : ':';
            env.PATH = `${path.join(mavenHome, 'bin')}${platformPathSeparator}${path.join(javaHome, 'bin')}${platformPathSeparator}${process.env.PATH}`;

            const mvnCommand = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';

            const args = [
                'test',
                `-Dtest=TC01_DynamicWorkflow`,
                `-Dmode=${mode}`,
                `-DrunCount=${count}`,
                `-DprimaryPlanIndex=${primaryPlan}`,
                `-DsecondaryPlanIndex=${secondaryPlan}`,
                `-Dheadless=${headless}`,
                `-DloginEmail=${loginEmail}`,
                `-DloginPass=${loginPass}`
            ];

            sendEvent(`Spawning Execution Engine...`);

            currentProcess = spawn(mvnCommand, args, {
                cwd: automationDir,
                shell: true,
                env: env
            });

            currentProcess.stdout.on('data', (data: any) => {
                const lines = data.toString().split('\n');
                lines.forEach((line: string) => {
                    const trimmed = line.trim();
                    if (trimmed) {
                        commandOutput.push(trimmed);
                        sendEvent(trimmed);
                    }
                });
            });

            currentProcess.stderr.on('data', (data: any) => {
                const lines = data.toString().split('\n');
                lines.forEach((line: string) => {
                    const trimmed = line.trim();
                    if (trimmed) {
                        commandOutput.push(`[ERROR] ${trimmed}`);
                        sendEvent(`✗ ${trimmed}`);
                    }
                });
            });

            currentProcess.on('close', (code: number) => {
                isRunning = false;
                const status = code === 0 ? 'SUCCESS' : 'FAILED';
                sendEvent(`════════════════════════`);
                sendEvent(`STATUS    : ${status}`);
                sendEvent(`COMPLETED : ${new Date().toLocaleTimeString()}`);

                saveReport(commandOutput, status, mode, `Plan ${primaryPlan}`);
                currentProcess = null;
                controller.close();
            });
        },
        cancel() {
            if (currentProcess) {
                currentProcess.kill();
                currentProcess = null;
                isRunning = false;
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

function saveReport(logs: string[], status: string, testCase: string, plan: string) {
    try {
        const reportsDir = path.resolve(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const reportId = `run-${Date.now()}`;

        const report = {
            id: reportId,
            timestamp: new Date().toISOString(),
            status,
            duration: `${duration}s`,
            testCase,
            plan,
            totalLogs: logs.length,
            logs: logs
        };

        fs.writeFileSync(path.join(reportsDir, `${reportId}.json`), JSON.stringify(report, null, 2));
    } catch (e) {
        console.error("Failed to save report", e);
    }
}
