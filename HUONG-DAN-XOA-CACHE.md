# Hướng dẫn xóa cache khi ảnh không cập nhật

## Vấn đề
Khi bạn thêm/xóa ảnh mới, trình duyệt có thể vẫn hiển thị ảnh cũ do Service Worker đã cache ảnh đó.

## Giải pháp

### Cách 1: Tăng version Service Worker (Đã tự động)
Script đã tự động tăng version Service Worker từ v85 lên v86. Khi bạn refresh trang, cache cũ sẽ được xóa tự động.

### Cách 2: Xóa cache thủ công trong trình duyệt

#### Chrome/Edge:
1. Nhấn `F12` để mở DevTools
2. Vào tab **Application**
3. Ở menu bên trái, chọn **Storage**
4. Nhấn nút **Clear site data**
5. Hoặc vào **Service Workers** và nhấn **Unregister**

#### Firefox:
1. Nhấn `F12` để mở DevTools
2. Vào tab **Storage**
3. Nhấn chuột phải vào domain của bạn
4. Chọn **Delete All**

#### Safari:
1. Vào **Develop** > **Empty Caches**
2. Hoặc: **Safari** > **Preferences** > **Advanced** > **Show Develop menu**

### Cách 3: Hard Refresh
- **Windows/Linux**: `Ctrl + Shift + R` hoặc `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Cách 4: Xóa cache cho một ảnh cụ thể
Nếu chỉ muốn xóa cache của một ảnh:
1. Mở DevTools (`F12`)
2. Vào tab **Network**
3. Tick vào **Disable cache**
4. Refresh trang

## Lưu ý
- Sau khi tăng version Service Worker, người dùng sẽ tự động nhận cache mới khi refresh trang
- Cache cũ sẽ được xóa tự động sau 24-48 giờ nếu không có tương tác
- Để force clear cache ngay, dùng Cách 2 hoặc 3

## Xử lý lỗi ERR_QUIC_PROTOCOL_ERROR trên Chrome

Nếu bạn gặp lỗi "ERR_QUIC_PROTOCOL_ERROR" khi truy cập từ Facebook trên Chrome desktop:

### Giải pháp 1: Xóa cache và cookies (Khuyến nghị)
1. Nhấn `Ctrl + Shift + Delete` (Windows) hoặc `Cmd + Shift + Delete` (Mac)
2. Chọn "Cookies và dữ liệu trang web khác" và "Hình ảnh và tệp được lưu trong bộ nhớ đệm"
3. Chọn "Tất cả thời gian"
4. Nhấn **Xóa dữ liệu**
5. Thử truy cập lại trang web

### Giải pháp 2: Tắt QUIC protocol trong Chrome (Tạm thời)
1. Mở Chrome và vào: `chrome://flags/#enable-quic`
2. Tìm "Experimental QUIC protocol"
3. Chọn **Disabled**
4. Khởi động lại Chrome
5. Thử truy cập lại

### Giải pháp 3: Sử dụng chế độ ẩn danh (Incognito)
Nhấn `Ctrl + Shift + N` (Windows) hoặc `Cmd + Shift + N` (Mac) để mở cửa sổ ẩn danh và thử truy cập lại.

### Giải pháp 4: Sử dụng trình duyệt khác
Trong khi chờ Chrome khắc phục, bạn có thể sử dụng Cốc Cốc, Firefox, hoặc Edge.