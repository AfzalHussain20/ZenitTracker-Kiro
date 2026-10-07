export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
    try {
        const reportsDir = path.resolve(process.cwd(), 'reports');

        if (!fs.existsSync(reportsDir)) {
            return NextResponse.json({
                tests: [],
                suites: [],
                summary: { total: 0, passed: 0, failed: 0, running: 0, avgDuration: 0 }
            });
        }

        const files = fs.readdirSync(reportsDir)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => {
                const timeA = parseInt(a.replace('run-', '').replace('.json', ''));
                const timeB = parseInt(b.replace('run-', '').replace('.json', ''));
                return timeB - timeA;
            })
            .slice(0, 50); // Last 50 reports

        const reports = files.map(file => {
            try {
                const content = fs.readFileSync(path.join(reportsDir, file), 'utf-8');
                return JSON.parse(content);
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        // Transform reports into test cases
        const tests = reports.map((report, idx) => {
            const duration = parseFloat(report.duration) * 1000; // Convert to ms
            const isPassed = report.status === 'SUCCESS';
            const isFailed = report.status === 'FAILED';

            // Extract test suite from logs
            let suite = 'Automation';
            if (report.fullLogs) {
                const authLog = report.fullLogs.find((l: string) => l.includes('Auth') || l.includes('Login'));
                const paymentLog = report.fullLogs.find((l: string) => l.includes('Payment') || l.includes('Subscription'));
                const performanceLog = report.fullLogs.find((l: string) => l.includes('Performance') || l.includes('Load'));

                if (authLog) suite = 'Authentication';
                else if (paymentLog) suite = 'Payment';
                else if (performanceLog) suite = 'Performance';
            }

            // Calculate flakiness based on historical data
            const sameTestReports = reports.filter(r => {
                const rLogs = r.fullLogs || [];
                const currentLogs = report.fullLogs || [];
                return rLogs.length > 0 && currentLogs.length > 0;
            });

            const failureRate = sameTestReports.length > 0
                ? (sameTestReports.filter(r => r.status === 'FAILED').length / sameTestReports.length) * 100
                : 0;

            return {
                id: report.id,
                name: `Automation Run #${reports.length - idx}`,
                suite,
                status: isPassed ? 'passed' : isFailed ? 'failed' : 'pending',
                duration,
                lastRun: formatTimestamp(report.timestamp),
                flakiness: Math.round(failureRate),
                priority: suite === 'Authentication' || suite === 'Payment' ? 'critical' : 'high',
                steps: report.stepsCovered || [],
                logs: report.fullLogs || []
            };
        });

        // Group by suite
        const suiteMap = new Map();
        tests.forEach(test => {
            if (!suiteMap.has(test.suite)) {
                suiteMap.set(test.suite, {
                    name: test.suite,
                    total: 0,
                    passed: 0,
                    failed: 0,
                    running: 0,
                    duration: 0
                });
            }

            const suite = suiteMap.get(test.suite);
            suite.total++;
            suite.duration += test.duration;
            if (test.status === 'passed') suite.passed++;
            if (test.status === 'failed') suite.failed++;
        });

        const suites = Array.from(suiteMap.values());

        // Calculate summary
        const summary = {
            total: tests.length,
            passed: tests.filter(t => t.status === 'passed').length,
            failed: tests.filter(t => t.status === 'failed').length,
            running: 0,
            avgDuration: tests.reduce((sum, t) => sum + t.duration, 0) / tests.length || 0
        };

        return NextResponse.json({ tests, suites, summary });

    } catch (error: any) {
        console.error('Error fetching test data:', error);
        return NextResponse.json({
            error: error.message,
            tests: [],
            suites: [],
            summary: { total: 0, passed: 0, failed: 0, running: 0, avgDuration: 0 }
        }, { status: 500 });
    }
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}
