<#
维护清理：默认仅列出候选项；-Apply 才会把它们移入可恢复归档。
仅处理下面的明确名单，不执行递归删除，不清理账号缓存、签名或依赖。
工程路径改变后可传 -MiniRoot；APK 工程从脚本所在位置推导。
#>
[CmdletBinding()]
param(
  [string]$MiniRoot = 'E:\NJUST_companion',
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$apkRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$miniProjectRoot = [IO.Path]::GetFullPath($MiniRoot)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$projects = @(
  @{ Id='apk'; Root=$apkRoot; Backup=Join-Path $apkRoot "output/maintenance-backup/$stamp" },
  @{ Id='mini'; Root=$miniProjectRoot; Backup=Join-Path $miniProjectRoot ".maintenance-backup/$stamp" }
)
# 这里的旧文件已经经过调用/页面注册检查。新增条目之前，必须再次查引用。
$apkFiles = @(
  '.tmp-112-main.html', '.tmp-8080-root.html', '.tmp-jspublic.js', '.tmp-login-response.html',
  'server-ui-test.err.log', 'server-ui-test.out.log',
  'AUTO-LOGIN-EXPLAINED.md', 'CODE-CHANGES.md', 'FINAL-COMPLETE.md',
  'MOBILE-OCR-SOLUTION.md', 'PROJECT-COMPLETE.md', 'QUICKSTART.md',
  'README-GLM-INTEGRATION.md', 'SKIP-CAPTCHA-EXPLAINED.md', 'UI-OPTIMIZATION-COMPLETE.md',
  'test-final.js', 'test-glm-api.js', 'test-glm-captcha.js', 'test-glm-offline.js',
  '微信图片_20231021003118.png',
  'android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java',
  'android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java'
)
$miniFiles = @(
  '.tmp-ehall-app.js', '.tmp-ehall-chunk3.js', '.tmp-ehall-index.html', '.tmp-ehall-js.txt', '.tmp-ehall-vendors.js',
  'ehall2-app.js', 'ehall2-vendors.js', 'tmp-ehall-app.js', 'tmp-ehall2.html',
  'preview-cas-login.json', 'preview-cas-login.png', 'uploadCloudFunction.sh',
  'miniprogram/pages/index', 'miniprogram/pages/example', 'miniprogram/components/cloudTipModal',
  'miniprogram/envList.js', 'cloudfunctions/quickstartFunctions', 'cloudfunctions/ping',
  'cloudfunctions/njustAuth', 'cloudfunctions/njustSync',
  'miniprogram/images/ai_example1.png', 'miniprogram/images/ai_example2.png',
  'miniprogram/images/arrow.svg', 'miniprogram/images/avatar.png', 'miniprogram/images/cloud_dev.png',
  'miniprogram/images/copy.svg', 'miniprogram/images/create_cbr.png', 'miniprogram/images/create_cbrf.png',
  'miniprogram/images/create_env.png', 'miniprogram/images/database.png', 'miniprogram/images/database_add.png',
  'miniprogram/images/default-goods-image.png', 'miniprogram/images/env-select.png',
  'miniprogram/images/function_deploy.png', 'miniprogram/images/scf-enter.png'
)

function Assert-InRoot([string]$Path, [string]$Root) {
  $resolved = [IO.Path]::GetFullPath($Path)
  $prefix = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "目标不在指定工程中：$resolved"
  }
  return $resolved
}

$plan = @()
foreach ($project in $projects) {
  if (-not (Test-Path -LiteralPath $project.Root -PathType Container)) { throw "工程不存在：$($project.Root)" }
  $backupRoot = Assert-InRoot $project.Backup $project.Root
  $relativePaths = if ($project.Id -eq 'apk') { $apkFiles } else { $miniFiles }
  foreach ($relativePath in $relativePaths) {
    $source = Assert-InRoot (Join-Path $project.Root $relativePath) $project.Root
    if (-not (Test-Path -LiteralPath $source)) { continue }
    $destination = Assert-InRoot (Join-Path $backupRoot $relativePath) $backupRoot
    # 拒绝链接、联接点：不能把外部目录误当作工程内的可清理目录。
    $item = Get-Item -LiteralPath $source -Force
    $children = if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $source -Force -Recurse) } else { @($item) }
    if ((@($item) + $children | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {
      throw "候选项中存在链接，停止清理：$source"
    }
    if ($children | Where-Object { $_.Name -match '^(\.env(?:\..*)?|keystore\.properties)$|\.(?:jks|keystore)$' }) {
      throw "候选项包含环境/签名资料，停止清理：$source"
    }
    if (Test-Path -LiteralPath $destination) { throw "归档目标已存在，禁止覆盖：$destination" }
    $files = @($children | Where-Object { -not $_.PSIsContainer })
    $plan += [pscustomobject]@{ Project=$project.Id; Source=$source; Destination=$destination; Files=$files.Count; Bytes=($files | Measure-Object Length -Sum).Sum }
  }
}
$plan | Select-Object Project, Source, Files, Bytes | Format-Table -AutoSize
Write-Output "候选项：$($plan.Count)。不包括当前运行依赖、storage、签名、OCR 模型、构建工具链及独立旧 APK 仓库。"
if (-not $Apply -or -not $plan.Count) { return }

# 同一磁盘内移动；每个工程单独留 manifest，即使中断，也能找到已移走的文件。
foreach ($project in $projects) {
  $records = @($plan | Where-Object { $_.Project -eq $project.Id })
  if (-not $records.Count) { continue }
  New-Item -ItemType Directory -Path $project.Backup -Force | Out-Null
  $manifest = Join-Path $project.Backup 'manifest.json'
  @($records | ForEach-Object { [pscustomobject]@{ source=$_.Source; backup=$_.Destination; files=$_.Files; bytes=$_.Bytes; state='planned' } }) |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding utf8
  foreach ($record in $records) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $record.Destination) -Force | Out-Null
    Move-Item -LiteralPath $record.Source -Destination $record.Destination
  }
  Write-Output "已移入可恢复归档：$($project.Backup)（清单：$manifest）"
}
