# Script tự động đẩy code lên GitHub
# Chạy script này sau khi đã cài đặt Git

Write-Host "🚀 Bắt đầu đẩy code lên GitHub..." -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Git đã được cài đặt chưa
try {
    $gitVersion = git --version
    Write-Host "✅ Git đã được cài đặt: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git chưa được cài đặt!" -ForegroundColor Red
    Write-Host "   Vui lòng cài đặt Git từ: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 1. Kiểm tra xem đã có .git chưa
if (Test-Path .git) {
    Write-Host "📁 Repository đã được khởi tạo" -ForegroundColor Green
} else {
    Write-Host "📁 Đang khởi tạo Git repository..." -ForegroundColor Cyan
    git init
    Write-Host "✅ Đã khởi tạo repository" -ForegroundColor Green
}

Write-Host ""

# 2. Kiểm tra remote
$remoteExists = git remote get-url origin 2>$null
if ($remoteExists) {
    Write-Host "🔗 Remote đã được cấu hình: $remoteExists" -ForegroundColor Green
    $updateRemote = Read-Host "Bạn có muốn cập nhật remote? (y/n)"
    if ($updateRemote -eq "y" -or $updateRemote -eq "Y") {
        git remote set-url origin https://github.com/PHUONGHOANG99-bot/oder88.git
        Write-Host "✅ Đã cập nhật remote" -ForegroundColor Green
    }
} else {
    Write-Host "🔗 Đang thêm remote repository..." -ForegroundColor Cyan
    git remote add origin https://github.com/PHUONGHOANG99-bot/oder88.git
    Write-Host "✅ Đã thêm remote" -ForegroundColor Green
}

Write-Host ""

# 3. Thêm tất cả files
Write-Host "📦 Đang thêm files vào staging..." -ForegroundColor Cyan
git add .
Write-Host "✅ Đã thêm files" -ForegroundColor Green

Write-Host ""

# 4. Kiểm tra có thay đổi để commit không
$status = git status --porcelain
if ($status) {
    Write-Host "💾 Đang commit code..." -ForegroundColor Cyan
    $commitMessage = Read-Host "Nhập message cho commit (hoặc Enter để dùng mặc định)"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Update: Oder88 Shop"
    }
    git commit -m $commitMessage
    Write-Host "✅ Đã commit code" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Không có thay đổi để commit" -ForegroundColor Yellow
}

Write-Host ""

# 5. Đổi tên branch thành main (nếu cần)
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "🌿 Đang đổi tên branch thành main..." -ForegroundColor Cyan
    git branch -M main
    Write-Host "✅ Đã đổi tên branch thành main" -ForegroundColor Green
    Write-Host ""
}

# 6. Push lên GitHub
Write-Host "⬆️  Đang đẩy code lên GitHub..." -ForegroundColor Cyan
Write-Host "⚠️  Lưu ý: Bạn sẽ cần nhập username và Personal Access Token" -ForegroundColor Yellow
Write-Host "   Username: PHUONGHOANG99-bot" -ForegroundColor White
Write-Host "   Password: [Dán Personal Access Token của bạn]" -ForegroundColor White
Write-Host ""

$pushConfirm = Read-Host "Bạn có muốn push ngay bây giờ? (y/n)"
if ($pushConfirm -eq "y" -or $pushConfirm -eq "Y") {
    try {
        git push -u origin main
        Write-Host ""
        Write-Host "✅ Đã đẩy code lên GitHub thành công!" -ForegroundColor Green
        Write-Host "🔗 Xem tại: https://github.com/PHUONGHOANG99-bot/oder88" -ForegroundColor Cyan
    } catch {
        Write-Host ""
        Write-Host "❌ Có lỗi xảy ra khi push" -ForegroundColor Red
        Write-Host "   Vui lòng kiểm tra lại authentication" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  Bạn có thể push sau bằng lệnh:" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor White
}

Write-Host ""
Write-Host "✨ Hoàn tất!" -ForegroundColor Green


