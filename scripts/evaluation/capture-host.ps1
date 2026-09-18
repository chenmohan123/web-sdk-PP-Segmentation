# 仅记录本次桌面硬件与驱动；浏览器实际适配器另由公共验收脚本探测。
$ErrorActionPreference = 'Stop'
$acceptanceHost = [ordered]@{
  capturedAt = [DateTime]::UtcNow.ToString('o')
  operatingSystem = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber
  processors = @(Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors)
  displayAdapters = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion)
}
$acceptanceHost | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$PSScriptRoot/../../reports/2026-09-18-image-sdk/host.json" -Encoding utf8
