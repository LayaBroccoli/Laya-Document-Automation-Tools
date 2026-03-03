param(
    [string]$windowName = "aidoc",
    [string]$buttonText = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$wCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
$allWins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $wCond)

$targetWindow = $null
foreach ($w in $allWins) {
    if ($w.Current.Name -like "*$windowName*") {
        $targetWindow = $w
        break
    }
}

if (-not $targetWindow) {
    Write-Output "ERROR: Window not found"
    exit 1
}

# 找到 MenuBar
$menuBarCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::MenuBar)
$menuBar = $targetWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $menuBarCond)

if ($menuBar) {
    # 查找MenuBar下的Button元素
    $ctrlCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsControlElementProperty, $true)
    $buttons = $menuBar.FindAll([System.Windows.Automation.TreeScope]::Children, $ctrlCond)

    foreach ($btn in $buttons) {
        $name = $btn.Current.Name
        if ($buttonText -and -not $name.Contains($buttonText)) { continue }
        $r = $btn.Current.BoundingRectangle
        if ($r.Width -gt 0 -and $r.Height -gt 0) {
            $cx = [math]::Round($r.X + $r.Width / 2)
            $cy = [math]::Round($r.Y + $r.Height / 2)
            Write-Output "$($name)|$($r.X)|$($r.Y)|$($r.Width)|$($r.Height)|$cx|$cy"
        }
    }
}
