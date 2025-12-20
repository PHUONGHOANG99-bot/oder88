# Script tự động tăng version cho cache busting
# Chạy script này trước khi commit và push code mới

Write-Host "🔄 Đang tăng version..." -ForegroundColor Cyan

# Đọc và cập nhật sw.js
$swContent = Get-Content "sw.js" -Raw
if ($swContent -match 'const CACHE_NAME = "oder88-shop-v(\d+)";') {
    $oldVersion = [int]$matches[1]
    $newVersion = $oldVersion + 1
    $swContent = $swContent -replace 'const CACHE_NAME = "oder88-shop-v\d+";', "const CACHE_NAME = `"oder88-shop-v$newVersion`";"
    Set-Content "sw.js" -Value $swContent -NoNewline
    Write-Host "✅ sw.js: v$oldVersion → v$newVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Không tìm thấy CACHE_NAME trong sw.js" -ForegroundColor Red
    exit 1
}

# Đọc và cập nhật index.html
$htmlContent = Get-Content "index.html" -Raw
if ($htmlContent -match '\?v=(\d+)') {
    $oldVersion = [int]$matches[1]
    $newVersion = $oldVersion + 1
    # Thay thế tất cả ?v=oldVersion bằng ?v=newVersion
    $htmlContent = $htmlContent -replace "\?v=$oldVersion", "?v=$newVersion"
    Set-Content "index.html" -Value $htmlContent -NoNewline
    Write-Host "✅ index.html: v$oldVersion → v$newVersion (đã cập nhật tất cả ?v=...)" -ForegroundColor Green
} else {
    Write-Host "❌ Không tìm thấy version trong index.html" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✨ Hoàn thành! Version mới: v$newVersion" -ForegroundColor Yellow
Write-Host "📝 Bây giờ bạn có thể commit và push code:" -ForegroundColor Cyan
Write-Host "   git add sw.js index.html" -ForegroundColor Gray
Write-Host "   git commit -m 'Update version to v$newVersion'" -ForegroundColor Gray
Write-Host "   git push" -ForegroundColor Gray

