# .workspace_tools/agent_runner.ps1
# Automates test suite execution and captures failure traces

$ErrorActionPreference = "Stop"

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "🚀 Running Project Test Suite..." -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

try {
    # Run vitest in run-once mode
    $testOutput = npm run test 2>&1
    
    # Output test log directly
    $testOutput | Out-String | Write-Host
    
    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host "✅ ALL TESTS PASSED! Ready for vibe coding." -ForegroundColor Green
    Write-Host "==========================================`n" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "`n==========================================" -ForegroundColor Red
    Write-Host "❌ TESTS FAILED!" -ForegroundColor Red
    Write-Host "==========================================`n" -ForegroundColor Red
    
    $errorLogPath = ".workspace_tools/test_failures.log"
    $errorMsg = $_.Exception.Message
    $fullTrace = $_.ScriptStackTrace
    
    # Capture failure trace and write to file
    $logContent = @"
Test Failures Log - Captured $(Get-Date)
----------------------------------------
Error Details:
$errorMsg

Stack Trace:
$fullTrace
"@
    
    $logContent | Out-File -FilePath $errorLogPath -Force
    Write-Host "Error traces saved to: $errorLogPath" -ForegroundColor Yellow
    exit 1
}
