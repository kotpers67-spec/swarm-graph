$sh = New-Object -ComObject WScript.Shell
$sc = $sh.CreateShortcut("C:\Users\kotpe\OneDrive\Desktop\SwarmGraph.lnk")
[PSCustomObject]@{
    FullName = "C:\Users\kotpe\OneDrive\Desktop\SwarmGraph.lnk"
    TargetPath = $sc.TargetPath
    WorkingDirectory = $sc.WorkingDirectory
    Description = $sc.Description
    IconLocation = $sc.IconLocation
} | Format-List
