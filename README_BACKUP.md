# 🔄 HỆ THỐNG BACKUP CODE - ODER 88 WEBSITE

## 📋 Tổng quan

Hệ thống backup này giúp bạn lưu trữ và khôi phục code một cách dễ dàng.

## 🚀 Cách tạo backup

### Cách 1: Sử dụng Batch Script (Windows)
```bash
# Double-click vào file hoặc chạy trong CMD:
create_backup.bat
```

### Cách 2: Sử dụng Python Script
```bash
python create_backup.py
```

### Cách 3: Copy thủ công
Copy 3 file sau vào một thư mục backup:
- `index.html`
- `assets/style.css`
- `assets/script.js`

## 🔧 Cách khôi phục

### Cách 1: Sử dụng Python Script
```bash
python restore_backup.py BACKUP_FULL_CODE_YYYYMMDD_HHMMSS.json
```

### Cách 2: Copy thủ công
Copy các file từ thư mục backup về vị trí gốc:
- `backup_YYYYMMDD_HHMMSS/index.html` → `index.html`
- `backup_YYYYMMDD_HHMMSS/assets/style.css` → `assets/style.css`
- `backup_YYYYMMDD_HHMMSS/assets/script.js` → `assets/script.js`

## 📁 Cấu trúc file

```
REAL-TAOBAO/
├── index.html              (823 dòng - File HTML chính)
├── assets/
│   ├── style.css           (5193 dòng - File CSS)
│   └── script.js           (3766 dòng - File JavaScript)
├── create_backup.bat       (Script tạo backup - Windows)
├── create_backup.py        (Script tạo backup - Python)
├── restore_backup.py       (Script khôi phục - Python)
└── BACKUP_INSTRUCTIONS.txt (Hướng dẫn chi tiết)
```

## ⚠️ Lưu ý quan trọng

1. **Luôn tạo backup trước khi chỉnh sửa lớn**
2. **Kiểm tra file backup trước khi xóa code cũ**
3. **Lưu file backup ở nơi an toàn** (cloud, USB, v.v.)
4. **Đặt tên backup rõ ràng** với ngày tháng để dễ quản lý

## 📝 Thông tin phiên bản

- **Ngày tạo backup system:** 2025-12-13
- **Phiên bản:** 1.0
- **Tính năng hiện tại:**
  - ✅ Gallery modal fullscreen với ảnh lớn nhất
  - ✅ Pinch-to-zoom cho mobile (2 ngón tay)
  - ✅ Thông tin sản phẩm và nút đặt hàng bên dưới ảnh
  - ✅ Hiển thị thời gian ship 7-10 ngày

## 🆘 Khôi phục khẩn cấp

Nếu code bị lỗi nghiêm trọng:

1. **Tìm file backup mới nhất:**
   - Tìm thư mục `backup_YYYYMMDD_HHMMSS` hoặc
   - Tìm file `BACKUP_FULL_CODE_YYYYMMDD_HHMMSS.json`

2. **Khôi phục:**
   ```bash
   # Nếu có file JSON:
   python restore_backup.py BACKUP_FULL_CODE_YYYYMMDD_HHMMSS.json
   
   # Nếu có thư mục backup:
   # Copy thủ công các file từ thư mục backup về vị trí gốc
   ```

3. **Kiểm tra:**
   - Mở `index.html` trong trình duyệt
   - Kiểm tra console để xem có lỗi không

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy:
1. Kiểm tra file backup có tồn tại không
2. Kiểm tra encoding của file (phải là UTF-8)
3. Kiểm tra quyền ghi file trong thư mục

---

**Lưu ý:** File backup này chứa toàn bộ code hiện tại. Hãy bảo quản cẩn thận!

