# Hướng dẫn đẩy code lên GitHub

## Bước 1: Cài đặt Git (nếu chưa có)

1. Tải Git từ: https://git-scm.com/download/win
2. Cài đặt Git với các tùy chọn mặc định
3. Mở lại terminal/PowerShell sau khi cài đặt

## Bước 2: Cấu hình Git (lần đầu tiên)

```bash
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

## Bước 3: Khởi tạo repository và đẩy code

Mở PowerShell/Terminal trong thư mục `C:\HTML\REAL-TAOBAO` và chạy các lệnh sau:

```bash
# 1. Khởi tạo git repository
git init

# 2. Thêm tất cả files vào staging
git add .

# 3. Commit code
git commit -m "Initial commit: Oder88 Shop"

# 4. Thêm remote repository
git remote add origin https://github.com/PHUONGHOANG99-bot/oder88.git

# 5. Đổi tên branch chính thành main (nếu cần)
git branch -M main

# 6. Đẩy code lên GitHub
git push -u origin main
```

## Nếu gặp lỗi authentication:

GitHub yêu cầu xác thực. Bạn có thể:

### Cách 1: Sử dụng Personal Access Token (Khuyến nghị)

1. Vào GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Tạo token mới với quyền `repo`
3. Khi push, dùng token thay vì mật khẩu:
   ```
   Username: PHUONGHOANG99-bot
   Password: [paste token của bạn]
   ```

### Cách 2: Sử dụng GitHub CLI

```bash
# Cài đặt GitHub CLI
winget install GitHub.cli

# Đăng nhập
gh auth login

# Sau đó push bình thường
git push -u origin main
```

## Các lệnh hữu ích khác:

```bash
# Xem trạng thái
git status

# Xem các thay đổi
git diff

# Xem lịch sử commit
git log

# Cập nhật code từ GitHub
git pull origin main

# Thêm file mới và commit
git add .
git commit -m "Mô tả thay đổi"
git push origin main
```


