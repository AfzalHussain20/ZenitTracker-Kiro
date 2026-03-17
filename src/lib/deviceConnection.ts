/**
 * Device Connection Utilities for Performance Testing
 * Handles device detection and connection for Web, Android, and iOS platforms
 */

export interface DeviceInfo {
    id: string;
    name: string;
    platform: 'web' | 'android' | 'ios';
    model: string;
    os: string;
    status: 'connected' | 'disconnected' | 'testing';
    battery?: number;
    signal?: number;
}

/**
 * Detect Web Browser as a testing device
 */
export async function detectWebDevice(): Promise<DeviceInfo> {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown Browser';

    if (userAgent.includes('Chrome')) browserName = 'Chrome';
    else if (userAgent.includes('Firefox')) browserName = 'Firefox';
    else if (userAgent.includes('Safari')) browserName = 'Safari';
    else if (userAgent.includes('Edge')) browserName = 'Edge';

    const platform = navigator.platform;

    return {
        id: 'web-browser',
        name: `${browserName} Desktop`,
        platform: 'web',
        model: 'Desktop Browser',
        os: platform,
        status: 'connected',
        battery: 100,
        signal: 100
    };
}

/**
 * Detect Android devices via ADB
 * Note: This requires a backend service running ADB commands
 */
export async function detectAndroidDevices(): Promise<DeviceInfo[]> {
    try {
        // In a real implementation, this would call a backend API
        // that executes: adb devices -l
        const response = await fetch('/api/devices/android');
        const devices = await response.json();

        return devices.map((device: any) => ({
            id: `android-${device.serial}`,
            name: device.model || 'Android Device',
            platform: 'android' as const,
            model: device.model || 'Unknown',
            os: `Android ${device.version || 'Unknown'}`,
            status: 'disconnected' as const,
            battery: device.battery,
            signal: device.signal
        }));
    } catch (error) {
        console.error('Failed to detect Android devices:', error);
        return [];
    }
}

/**
 * Detect iOS devices via ios-webkit-debug-proxy
 * Note: This requires ios-webkit-debug-proxy running
 */
export async function detectIOSDevices(): Promise<DeviceInfo[]> {
    try {
        // In a real implementation, this would call a backend API
        // that communicates with ios-webkit-debug-proxy
        const response = await fetch('/api/devices/ios');
        const devices = await response.json();

        return devices.map((device: any) => ({
            id: `ios-${device.udid}`,
            name: device.name || 'iOS Device',
            platform: 'ios' as const,
            model: device.model || 'iPhone',
            os: `iOS ${device.version || 'Unknown'}`,
            status: 'disconnected' as const,
            battery: device.battery,
            signal: device.signal
        }));
    } catch (error) {
        console.error('Failed to detect iOS devices:', error);
        return [];
    }
}

/**
 * Connect to a device for testing
 */
export async function connectToDevice(deviceId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/devices/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
        });

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Failed to connect to device:', error);
        return false;
    }
}

/**
 * Disconnect from a device
 */
export async function disconnectFromDevice(deviceId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/devices/disconnect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
        });

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Failed to disconnect from device:', error);
        return false;
    }
}

/**
 * Get device performance capabilities
 */
export async function getDeviceCapabilities(deviceId: string) {
    try {
        const response = await fetch(`/api/devices/capabilities?deviceId=${deviceId}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to get device capabilities:', error);
        return null;
    }
}

/**
 * Check if ADB is available (for Android testing)
 */
export async function checkADBAvailability(): Promise<boolean> {
    try {
        const response = await fetch('/api/devices/check-adb');
        const result = await response.json();
        return result.available;
    } catch (error) {
        return false;
    }
}

/**
 * Check if iOS WebKit Debug Proxy is available (for iOS testing)
 */
export async function checkIOSProxyAvailability(): Promise<boolean> {
    try {
        const response = await fetch('/api/devices/check-ios-proxy');
        const result = await response.json();
        return result.available;
    } catch (error) {
        return false;
    }
}

/**
 * Performance Metrics Collection
 */
export interface PerformanceMetrics {
    cpu: number;
    memory: number;
    network: number;
    fps: number;
    battery?: number;
    loadTime?: number;
}

/**
 * Collect performance metrics from browser
 */
export async function collectBrowserMetrics(): Promise<PerformanceMetrics> {
    // CPU usage (approximation using performance API)
    const cpuUsage = await estimateCPUUsage();

    // Memory usage
    const memory = (performance as any).memory;
    const memoryUsage = memory
        ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        : 0;

    // Network usage
    const networkUsage = await estimateNetworkUsage();

    // FPS
    const fps = await measureFPS();

    // Load time
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;

    return {
        cpu: cpuUsage,
        memory: memoryUsage,
        network: networkUsage,
        fps: fps,
        loadTime: loadTime / 1000 // Convert to seconds
    };
}

/**
 * Estimate CPU usage
 */
async function estimateCPUUsage(): Promise<number> {
    const start = performance.now();
    let iterations = 0;

    // Run a CPU-intensive task for a short time
    while (performance.now() - start < 100) {
        iterations++;
        Math.sqrt(Math.random());
    }

    // Normalize to percentage (this is a rough approximation)
    const baselineIterations = 1000000;
    return Math.min(100, (baselineIterations / iterations) * 100);
}

/**
 * Estimate network usage
 */
async function estimateNetworkUsage(): Promise<number> {
    if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        const downlink = connection.downlink || 0; // Mbps
        return downlink;
    }
    return 0;
}

/**
 * Measure FPS
 */
async function measureFPS(): Promise<number> {
    return new Promise((resolve) => {
        let lastTime = performance.now();
        let frames = 0;

        function countFrame() {
            frames++;
            const currentTime = performance.now();

            if (currentTime >= lastTime + 1000) {
                resolve(frames);
            } else {
                requestAnimationFrame(countFrame);
            }
        }

        requestAnimationFrame(countFrame);
    });
}

/**
 * Start performance monitoring session
 */
export async function startPerformanceMonitoring(
    deviceId: string,
    testUrl: string,
    duration: number,
    onMetrics: (metrics: PerformanceMetrics) => void
): Promise<() => void> {
    const interval = setInterval(async () => {
        const metrics = await collectBrowserMetrics();
        onMetrics(metrics);
    }, 1000);

    // Return cleanup function
    return () => clearInterval(interval);
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(metrics: PerformanceMetrics[]) {
    const avgCPU = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;
    const avgFPS = metrics.reduce((sum, m) => sum + m.fps, 0) / metrics.length;
    const avgNetwork = metrics.reduce((sum, m) => sum + m.network, 0) / metrics.length;

    const score = Math.round(
        (100 - avgCPU) * 0.3 +
        (100 - avgMemory) * 0.3 +
        (avgFPS / 60 * 100) * 0.4
    );

    return {
        score,
        averages: {
            cpu: avgCPU,
            memory: avgMemory,
            fps: avgFPS,
            network: avgNetwork
        },
        status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
        recommendations: generateRecommendations(avgCPU, avgMemory, avgFPS)
    };
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(cpu: number, memory: number, fps: number): string[] {
    const recommendations: string[] = [];

    if (cpu > 70) {
        recommendations.push('High CPU usage detected. Consider optimizing JavaScript execution and reducing animations.');
    }

    if (memory > 80) {
        recommendations.push('High memory usage detected. Check for memory leaks and optimize image/asset loading.');
    }

    if (fps < 30) {
        recommendations.push('Low FPS detected. Optimize animations and reduce DOM complexity.');
    }

    if (recommendations.length === 0) {
        recommendations.push('Performance is good! No major issues detected.');
    }

    return recommendations;
}
