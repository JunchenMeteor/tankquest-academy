$ErrorActionPreference = 'Stop'

$executable = Resolve-Path 'apps/desktop/src-tauri/target/release/tankquest-academy.exe'
$process = Start-Process -FilePath $executable -PassThru

try {
    Start-Sleep -Seconds 10
    $process.Refresh()
    if ($process.HasExited) {
        throw "TankQuest Academy exited during the Windows startup smoke test with code $($process.ExitCode)."
    }
    if (-not $process.WaitForInputIdle(10000)) {
        throw 'TankQuest Academy did not reach an idle desktop message loop.'
    }

    $process.Refresh()
    if ($process.MainWindowHandle -eq 0) {
        throw 'TankQuest Academy did not create its main desktop window.'
    }
    if (-not $process.Responding) {
        throw 'TankQuest Academy created a window but stopped responding.'
    }

    Write-Output "Verified TankQuest Academy remains responsive in its safe startup state."
}
finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}
