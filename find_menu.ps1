param(
    [string]$itemText = "",
    [string]$windowName = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement

# 确定搜索范围：指定窗口 or 全局
$scope = $root
if ($windowName -ne "") {
    $wCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
    $allWins = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $wCond)
    foreach ($w in $allWins) {
        if ($w.Current.Name -like "*$windowName*") { $scope = $w; break }
    }
}

# 搜 MenuItem + MenuBar + Menu
$ctypes = @([System.Windows.Automation.ControlType]::MenuItem, [System.Windows.Automation.ControlType]::MenuBar, [System.Windows.Automation.ControlType]::Menu)
foreach ($ct in $ctypes) {
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $ct)
    $items = $scope.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
    foreach ($item in $items) {
        $n = $item.Current.Name
        $r = $item.Current.BoundingRectangle
        if ($r.Width -gt 0 -and $r.Height -gt 0) {
            if ($itemText -eq "" -or $n -like "*$itemText*") {
                $tag = $ct.ProgrammaticName -replace "ControlType\.", ""
                Write-Output "$tag|$n|$([int]$r.X)|$([int]$r.Y)|$([int]$r.Width)|$([int]$r.Height)"
            }
        }
    }
}
