Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WR {
    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr h, int n);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int L, T, R, B; }
}
"@
$p = Get-Process LayaAirIDE -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
if (!$p) { Write-Output "0,0,0,0"; exit }
$h = $p.MainWindowHandle
[WR]::ShowWindow($h, 9) | Out-Null
[WR]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 300
$r = New-Object WR+RECT
[WR]::DwmGetWindowAttribute($h, 9, [ref]$r, [System.Runtime.InteropServices.Marshal]::SizeOf($r)) | Out-Null
Write-Output "$($r.L),$($r.T),$($r.R),$($r.B)"
