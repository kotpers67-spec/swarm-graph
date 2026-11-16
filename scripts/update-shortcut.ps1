$sh = New-Object -ComObject WScript.Shell

$desktops = @(
    "C:\Users\kotpe\OneDrive\Desktop",
    "C:\Users\kotpe\Desktop"
)

$targetExe = "C:\swarmgraph-app\SwarmGraph.exe"
$workDir = "C:\swarmgraph-app"

foreach ($d in $desktops) {
    if (Test-Path $d) {
        $lnkPath = Join-Path $d "SwarmGraph.lnk"
        $shortcut = $sh.CreateShortcut($lnkPath)
        $shortcut.TargetPath = $targetExe
        $shortcut.WorkingDirectory = $workDir
        $shortcut.Description = "SwarmGraph — Графы работы агентов и роя"
        $shortcut.IconLocation = "$targetExe,0"
        $shortcut.Save()
        Write-Output "✓ Ярлык успешно обновлен: $lnkPath -> $targetExe"
    }
}
