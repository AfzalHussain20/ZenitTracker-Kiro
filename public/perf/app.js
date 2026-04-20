// ZenitPerf - Standalone Performance Profiler
// Polling-based with RAF rendering (no WebSocket dependency)

// --- STATE ---
let pollInterval = null;
let rafId = null;
let status = 'idle';
let platform = 'android';
let startTime = 0;
let elapsed = 0;
let autoStop = true;
let duration = 60;

// Network baseline tracking
let netRxBase = 0;
let netTxBase = 0;
let netRxPrev = 0;
let netTxPrev = 0;

// Data storage
const metrics = [];
const current = {
  cpu: 0, threads: 0, memTotal: 0, memJava: 0, memNative: 0, memGfx: 0,
  netRx: 0, netTx: 0, fps: 60, jank: 0, battLevel: 0, battTemp: 0, devTemp: 0
};

// Config
let deviceId = '';
let packageId = '';
let targetUrl = '';

// Chart
let chartCtx = null;
const chartData = { cpu: [], mem: [] };

// DOM refs
const $ = (id) => document.getElementById(id);

// --- INIT ---
function init() {
  const statusDot = $('statusDot');
  const timerText = $('timerText');
  const startBtn = $('startBtn');
  const resetBtn = $('resetBtn');
  const deviceSelect = $('deviceSelect');
  const packageSelect = $('packageSelect');
  const urlInput = $('urlInput');
  const autoStopCheck = $('autoStopCheck');
  const durationSlider = $('durationSlider');
  const durationValue = $('durationValue');
  const androidConfig = $('androidConfig');
  const webConfig = $('webConfig');
  const chart = $('chart');

  // Chart setup
  chartCtx = chart.getContext('2d');
  chart.width = chart.offsetWidth * window.devicePixelRatio;
  chart.height = chart.offsetHeight * window.devicePixelRatio;
  chartCtx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Platform tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      platform = btn.dataset.platform;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (platform === 'android') {
        androidConfig.style.display = 'block';
        webConfig.style.display = 'none';
      } else {
        androidConfig.style.display = 'none';
        webConfig.style.display = 'block';
      }
    });
  });

  startBtn.addEventListener('click', () => {
    if (status === 'running') stop();
    else start();
  });

  resetBtn.addEventListener('click', reset);
  autoStopCheck.addEventListener('change', (e) => { autoStop = e.target.checked; });
  durationSlider.addEventListener('input', (e) => {
    duration = parseInt(e.target.value);
    durationValue.textContent = duration;
  });

  deviceSelect.addEventListener('change', (e) => {
    deviceId = e.target.value;
    if (deviceId) loadPackages();
  });

  packageSelect.addEventListener('change', (e) => { packageId = e.target.value; });

  loadDevices();
  renderLoop();
}

// --- API CALLS ---
async function loadDevices() {
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    const deviceSelect = $('deviceSelect');
    
    if (data.devices && data.devices.length > 0) {
      deviceSelect.innerHTML = data.devices.map(d => 
        `<option value="${d.id}">${d.model || 'Android Device'}</option>`
      ).join('');
      deviceId = data.devices[0].id;
      loadPackages();
    } else {
      deviceSelect.innerHTML = '<option value="">No devices found</option>';
    }
  } catch (err) {
    showError('Failed to load devices');
  }
}

async function loadPackages() {
  if (!deviceId) return;
  
  try {
    const res = await fetch(`/api/adb?action=list-packages&deviceId=${deviceId}`);
    const data = await res.json();
    const packageSelect = $('packageSelect');
    
    if (data.packages && data.packages.length > 0) {
      packageSelect.innerHTML = data.packages.map(p => 
        `<option value="${p}">${p}</option>`
      ).join('');
      packageId = data.packages[0];
    } else {
      packageSelect.innerHTML = '<option value="">No packages found</option>';
    }
  } catch (err) {
    showError('Failed to load packages');
  }
}

async function fetchMetric() {
  if (platform === 'android') {
    if (!packageId) return null;
    
    try {
      const res = await fetch(`/api/adb?action=monitor&deviceId=${deviceId}&packageId=${packageId}`);
      const d = await res.json();

      const rx = d.network?.rx || 0;
      const tx = d.network?.tx || 0;

      if (netRxPrev === 0) netRxPrev = rx;
      if (netTxPrev === 0) netTxPrev = tx;

      const rxDiff = Math.max(0, (rx - netRxPrev) / 1024);
      const txDiff = Math.max(0, (tx - netTxPrev) / 1024);

      netRxPrev = rx;
      netTxPrev = tx;

      const toMB = (n) => n > 0 ? n / 1024 : 0;

      return {
        cpu: d.cpu || 0,
        threads: d.threads || 0,
        memTotal: toMB(d.memory?.total || 0),
        memJava: toMB(d.memory?.java || 0),
        memNative: toMB(d.memory?.native || 0),
        memGfx: toMB(d.memory?.graphics || 0),
        netRx: rxDiff,
        netTx: txDiff,
        fps: 60,
        jank: d.jank || 0,
        battLevel: d.battery?.level || 0,
        battVolt: d.battery?.voltage || 0,
        battTemp: d.battery?.temp || 0,
        devTemp: d.temperature || 0
      };
    } catch {
      return null;
    }
  }
  return null;
}

// --- CONTROL FUNCTIONS ---
async function start() {
  if (platform === 'android' && !packageId) {
    showError('Please select an app package');
    return;
  }
  
  const urlInput = $('urlInput');
  if (platform === 'web' && !urlInput.value) {
    showError('Please enter a target URL');
    return;
  }
  
  targetUrl = urlInput.value;
  
  metrics.length = 0;
  chartData.cpu.length = 0;
  chartData.mem.length = 0;
  elapsed = 0;
  startTime = Date.now();
  netRxPrev = 0;
  netTxPrev = 0;
  
  status = 'running';
  $('statusDot').classList.add('running');
  $('startBtn').innerHTML = '⏹ Stop test';
  $('startBtn').classList.remove('btn-primary');
  $('startBtn').classList.add('btn-danger');
  $('idleState').style.display = 'none';
  hideError();
  
  pollInterval = setInterval(async () => {
    const m = await fetchMetric();
    if (m) {
      Object.assign(current, m);
      metrics.push({ ...m, timestamp: Date.now() });
      if (metrics.length > 300) metrics.shift();
      
      chartData.cpu.push(m.cpu);
      chartData.mem.push(m.memTotal);
      if (chartData.cpu.length > 60) chartData.cpu.shift();
      if (chartData.mem.length > 60) chartData.mem.shift();
    }
  }, 1000);
}

function stop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  
  status = 'completed';
  $('statusDot').classList.remove('running');
  $('startBtn').innerHTML = '▶ Start test';
  $('startBtn').classList.remove('btn-danger');
  $('startBtn').classList.add('btn-primary');
  
  if (metrics.length > 0) generateReport();
}

function reset() {
  if (status === 'running') stop();
  
  status = 'idle';
  elapsed = 0;
  metrics.length = 0;
  chartData.cpu.length = 0;
  chartData.mem.length = 0;
  
  Object.keys(current).forEach(k => current[k] = 0);
  current.fps = 60;
  
  $('timerText').textContent = '00:00';
  $('idleState').style.display = 'flex';
  hideError();
}

// --- REPORT GENERATION ---
function generateReport() {
  const avgCpu = metrics.reduce((a, b) => a + b.cpu, 0) / metrics.length;
  const peakMem = Math.max(...metrics.map(m => m.memTotal));
  const totalNet = metrics.reduce((a, b) => a + b.netRx + b.netTx, 0) / 1024;
  const maxTemp = Math.max(...metrics.map(m => m.devTemp));
  
  const report = {
    timestamp: new Date().toISOString(),
    platform,
    duration: elapsed,
    avgCpu: avgCpu.toFixed(1),
    peakMem: peakMem.toFixed(0),
    totalNet: totalNet.toFixed(1),
    maxTemp: maxTemp.toFixed(1),
    score: Math.max(0, 100 - (avgCpu * 0.4) - (peakMem * 0.05)).toFixed(0)
  };
  
  console.log('Performance Report:', report);
}

// --- RAF RENDERING ---
function renderLoop() {
  if (status === 'running') {
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    $('timerText').textContent = `${mins}:${secs}`;
    
    if (autoStop && elapsed >= duration) stop();
  }
  
  $('cpuValue').textContent = current.cpu.toFixed(0);
  $('cpuSub').textContent = `Threads: ${current.threads}`;
  
  $('memValue').textContent = current.memTotal.toFixed(0);
  const peakMem = metrics.length > 0 ? Math.max(...metrics.map(m => m.memTotal)) : 0;
  $('memSub').textContent = `Peak: ${peakMem.toFixed(0)} MB`;
  
  $('netValue').textContent = (current.netRx + current.netTx).toFixed(0);
  const totalNet = metrics.reduce((a, b) => a + b.netRx + b.netTx, 0) / 1024;
  $('netSub').textContent = `Total: ${totalNet.toFixed(1)} MB`;
  
  $('tempValue').textContent = current.devTemp.toFixed(0);
  $('tempSub').textContent = `Battery: ${current.battLevel}%`;
  
  renderChart();
  rafId = requestAnimationFrame(renderLoop);
}

function renderChart() {
  if (!chartCtx || chartData.cpu.length === 0) return;
  
  const width = $('chart').offsetWidth;
  const height = $('chart').offsetHeight;
  
  chartCtx.clearRect(0, 0, width, height);
  
  chartCtx.strokeStyle = 'rgba(128, 128, 128, 0.1)';
  chartCtx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);
    chartCtx.stroke();
  }
  
  drawLine(chartData.cpu, '#6366f1', 100);
  drawLine(chartData.mem, '#8b5cf6', 1024);
}

function drawLine(data, color, maxValue) {
  if (data.length < 2) return;
  
  const width = $('chart').offsetWidth;
  const height = $('chart').offsetHeight;
  const stepX = width / (data.length - 1);
  
  chartCtx.strokeStyle = color;
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();
  
  data.forEach((value, i) => {
    const x = i * stepX;
    const y = height - (value / maxValue) * height;
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  
  chartCtx.stroke();
}

function showError(msg) {
  $('errorText').textContent = msg;
  $('errorBar').style.display = 'flex';
}

function hideError() {
  $('errorBar').style.display = 'none';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
