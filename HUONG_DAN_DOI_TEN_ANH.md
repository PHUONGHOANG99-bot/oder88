# Hướng Dẫn Đổi Tên Ảnh Và Phát Hiện Trùng Lặp

## Tính năng

Script `rename_images.py` giúp bạn:

-   ✅ Đổi tên tất cả ảnh theo format nhất quán (lowercase extension)
-   ✅ Phát hiện và xóa ảnh trùng lặp (dựa trên hash MD5)
-   ✅ Tự động cập nhật `products.json` với đường dẫn mới
-   ✅ Tự động backup trước khi thay đổi

## Yêu cầu

-   Python 3.6 trở lên
-   Không cần cài đặt thêm thư viện (chỉ dùng thư viện chuẩn)

## Cách sử dụng

### 1. Chạy script

```bash
python rename_images.py
```

### 2. Script sẽ:

1. **Quét tất cả ảnh** trong thư mục `assets/image/`
2. **Tính hash MD5** để phát hiện ảnh trùng lặp
3. **Hiển thị kết quả** và hỏi xác nhận
4. **Đổi tên ảnh** theo format:
    - `quan-dai-nu/` → `qd1.jpg`, `qd2.jpg`, ...
    - `Boot-cao/` → `b1.jpg`, `b2.jpg`, ...
    - `tui-xach-nu/` → `tx1.jpg`, `tx2.jpg`, ...
    - `tui-xach-nam/` → `txn1.jpg`, `txn2.jpg`, ...
    - Extension được chuẩn hóa: `.JPG` → `.jpg`, `.jpeg` → `.jpg`
5. **Xóa ảnh trùng lặp** (giữ lại file đầu tiên)
6. **Cập nhật `products.json`** với đường dẫn mới
7. **Tạo backup** trong thư mục `backup_images/`

### 3. Kiểm tra kết quả

-   Kiểm tra website hoạt động bình thường
-   Nếu có vấn đề, khôi phục từ backup:
    -   `backup_images/` - backup ảnh
    -   `assets/products.json.backup` - backup JSON

## Ví dụ

### Trước khi chạy:

```
assets/image/quan-dai-nu/
  - qd1.JPEG
  - qd2.jpeg
  - qd3.JPG
```

### Sau khi chạy:

```
assets/image/quan-dai-nu/
  - qd1.jpg
  - qd2.jpg
  - qd3.jpg
```

## Lưu ý

⚠️ **QUAN TRỌNG:**

-   Script sẽ **xóa ảnh trùng lặp** (giữ lại file đầu tiên)
-   Luôn có **backup tự động** trước khi thay đổi
-   Kiểm tra website **kỹ lưỡng** sau khi chạy
-   Chỉ xóa thư mục `backup_images/` khi đã chắc chắn mọi thứ hoạt động tốt

## Xử lý lỗi

Nếu gặp lỗi:

1. Kiểm tra quyền truy cập file/thư mục
2. Đảm bảo không có file nào đang được mở
3. Khôi phục từ backup nếu cần

## Tùy chỉnh

Bạn có thể chỉnh sửa script để:

-   Thay đổi format tên file trong hàm `generate_new_filename()`
-   Thêm/thay đổi prefix cho các thư mục trong `prefix_map`
-   Thay đổi thư mục backup trong biến `BACKUP_DIR`
