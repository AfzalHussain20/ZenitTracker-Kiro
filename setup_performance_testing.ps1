# Performance Testing Setup Script
# This script installs and configures tools needed for device performance testing

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Zenit Performance Testing Setup" -ForegroundColor Cyan
Write-Host "  Setting up device testing tools..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some installations may require elevated privileges" -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction Stop) {
            return $true
        }
    }
    catch {
        return $false
    }
}

# 1. Check for Node.js
Write-Host "1. Checking Node.js..." -ForegroundColor Yellow
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "   Please install Node.js from: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Check for npm
Write-Host "2. Checking npm..." -ForegroundColor Yellow
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Host "   ✅ npm is installed: $npmVersion" -ForegroundColor Green
}
else {
    Write-Host "   ❌ npm is not installed" -ForegroundColor Red
    exit 1
}

# 3. Install/Check ADB (Android Debug Bridge)
Write-Host "3. Checking ADB (Android Debug Bridge)..." -ForegroundColor Yellow
if (Test-Command "adb") {
    $adbVersion = adb version
    Write-Host "   ✅ ADB is already installed" -ForegroundColor Green
}
else {
    Write-Host "   ⚙️  Installing ADB..." -ForegroundColor Cyan
    
    # Check if Chocolatey is installed
    if (Test-Command "choco") {
        try {
            choco install adb -y
            Write-Host "   ✅ ADB installed successfully via Chocolatey" -ForegroundColor Green
        }
        catch {
            Write-Host "   ⚠️  Failed to install ADB via Chocolatey" -ForegroundColor Yellow
            Write-Host "   Please install Android Platform Tools manually:" -ForegroundColor Yellow
            Write-Host "   https://developer.android.com/studio/releases/platform-tools" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "   ℹ️  Chocolatey not found. Installing Chocolatey first..." -ForegroundColor Cyan
        Write-Host "   Please install Chocolatey from: https://chocolatey.org/install" -ForegroundColor Yellow
        Write-Host "   Then run this script again." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Alternative: Install Android Platform Tools manually:" -ForegroundColor Yellow
        Write-Host "   https://developer.android.com/studio/releases/platform-tools" -ForegroundColor Yellow
    }
}

# 4. Check for Python (needed for some device tools)
Write-Host "4. Checking Python..." -ForegroundColor Yellow
if (Test-Command "python") {
    $pythonVersion = python --version
    Write-Host "   ✅ Python is installed: $pythonVersion" -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  Python is not installed (optional but recommended)" -ForegroundColor Yellow
    Write-Host "   Install from: https://www.python.org/downloads/" -ForegroundColor Yellow
}

# 5. Install npm packages for performance testing
Write-Host "5. Installing npm packages..." -ForegroundColor Yellow
try {
    # Check if package.json exists
    if (Test-Path "package.json") {
        Write-Host "   ⚙️  Installing dependencies..." -ForegroundColor Cyan
        npm install
        Write-Host "   ✅ npm packages installed successfully" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  package.json not found in current directory" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "   ❌ Failed to install npm packages" -ForegroundColor Red
}

# 6. Create performance testing directories
Write-Host "6. Setting up directories..." -ForegroundColor Yellow
$dirs = @(
    "performance-reports",
    "device-logs",
    "test-recordings"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   ✅ Created directory: $dir" -ForegroundColor Green
    }
    else {
        Write-Host "   ℹ️  Directory already exists: $dir" -ForegroundColor Cyan
    }
}

# 7. Test ADB connection
Write-Host "7. Testing ADB connection..." -ForegroundColor Yellow
if (Test-Command "adb") {
    try {
        $devices = adb devices
        Write-Host "   ✅ ADB is working" -ForegroundColor Green
        Write-Host "   Connected devices:" -ForegroundColor Cyan
        Write-Host $devices -ForegroundColor Gray
        
        if ($devices -match "device$") {
            Write-Host "   ✅ Android device(s) detected!" -ForegroundColor Green
        }
        else {
            Write-Host "   ℹ️  No Android devices connected" -ForegroundColor Cyan
            Write-Host "   Connect a device with USB debugging enabled to test" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "   ⚠️  ADB is installed but not responding" -ForegroundColor Yellow
    }
}

# 8. Display iOS setup instructions
Write-Host "8. iOS Testing Setup (macOS only)" -ForegroundColor Yellow
if ($IsMacOS) {
    Write-Host "   ℹ️  For iOS testing, ensure you have:" -ForegroundColor Cyan
    Write-Host "   - Xcode installed" -ForegroundColor Gray
    Write-Host "   - ios-webkit-debug-proxy installed (brew install ios-webkit-debug-proxy)" -ForegroundColor Gray
}
else {
    Write-Host "   ℹ️  iOS testing requires macOS" -ForegroundColor Cyan
    Write-Host "   You can still test Web and Android platforms" -ForegroundColor Cyan
}

# Summary
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Setup Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. For Android testing:" -ForegroundColor Cyan
Write-Host "   - Enable USB debugging on your Android device" -ForegroundColor Gray
Write-Host "   - Connect device via USB" -ForegroundColor Gray
Write-Host "   - Run: adb devices (to verify connection)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. For Web testing:" -ForegroundColor Cyan
Write-Host "   - No additional setup required!" -ForegroundColor Gray
Write-Host "   - Just start the dev server: npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start the application:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Navigate to:" -ForegroundColor Cyan
Write-Host "   http://localhost:3000/performance" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Create a quick reference guide
$guideContent = @"
# Performance Testing Quick Reference

## Android Device Setup

1. Enable Developer Options:
   Settings → About Phone → Tap "Build Number" 7 times

2. Enable USB Debugging:
   Settings → Developer Options → USB Debugging → ON

3. Connect device via USB and authorize computer

4. Verify connection:
   adb devices

## Commands

- List devices: adb devices
- Check device info: adb shell getprop
- Start ADB server: adb start-server
- Stop ADB server: adb kill-server
- Restart ADB: adb kill-server && adb start-server

## Wireless Debugging (Android 11+)

1. Enable Wireless Debugging:
   Settings → Developer Options → Wireless Debugging → ON

2. Pair device:
   adb pair <IP>:<PORT>

3. Connect:
   adb connect <IP>:<PORT>

## Troubleshooting

- Device not showing: Check USB debugging is enabled
- Unauthorized: Accept prompt on device
- Offline: Restart ADB server
- No permissions: Run as Administrator

## Web Testing

- No setup required
- Works in any modern browser
- Chrome DevTools recommended for validation

## Performance Metrics

- CPU: < 40% good, > 70% poor
- Memory: < 50% good, > 80% poor
- FPS: 60 ideal, < 30 poor
- Load Time: < 2s good, > 3s poor

For detailed guide, see: PERFORMANCE_TESTING_GUIDE.md
"@

$guideContent | Out-File -FilePath "PERFORMANCE_TESTING_QUICK_REFERENCE.md" -Encoding UTF8
Write-Host "📄 Created: PERFORMANCE_TESTING_QUICK_REFERENCE.md" -ForegroundColor Green
Write-Host ""
