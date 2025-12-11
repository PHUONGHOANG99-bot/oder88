# 📖 Hướng dẫn chi tiết: Chạy website trên GitHub Pages

## 🎯 Mục tiêu
Đưa website ODER 88 lên GitHub Pages để có thể truy cập công khai qua URL: `https://PHUONGHOANG99-bot.github.io/oder88/`

## 📋 Bước 1: Bật GitHub Pages

### Cách làm qua Web Interface (Dễ nhất)

1. **Truy cập repository trên GitHub:**
   - Vào: https://github.com/PHUONGHOANG99-bot/oder88

2. **Vào phần Settings:**
   - Click vào tab **Settings** ở menu trên cùng của repository

3. **Tìm phần Pages:**
   - Scroll xuống menu bên trái, tìm mục **Pages**
   - Hoặc scroll xuống dưới cùng trang Settings

4. **Cấu hình Source:**
   - Trong phần **Source**, chọn:
     - **Branch**: `main`
     - **Folder**: `/ (root)` hoặc `/root`
   - Click nút **Save**

5. **Đợi deployment:**
   - GitHub sẽ tự động build và deploy website
   - Thời gian: 1-5 phút
   - Bạn sẽ thấy thông báo: "Your site is live at..."

6. **Truy cập website:**
   - URL sẽ là: `https://PHUONGHOANG99-bot.github.io/oder88/`
   - Lưu ý: URL có format: `https://[username].github.io/[repository-name]/`

## 🔍 Kiểm tra website

Sau khi bật GitHub Pages, kiểm tra:

1. **Xem trạng thái deployment:**
   - Vào tab **Actions** trong repository
   - Xem workflow "pages build and deployment"
   - Nếu thành công sẽ có dấu ✅ màu xanh

2. **Test website:**
   - Mở URL: `https://PHUONGHOANG99-bot.github.io/oder88/`
   - Kiểm tra:
     - ✅ Trang chủ load được
     - ✅ Hình ảnh hiển thị đúng
     - ✅ Tìm kiếm hoạt động
     - ✅ Lọc danh mục hoạt động
     - ✅ Responsive trên mobile

## ⚠️ Lưu ý quan trọng

### 1. Đường dẫn tương đối
Website đã được cấu hình với đường dẫn tương đối (`assets/...`), nên sẽ hoạt động tốt trên GitHub Pages.

### 2. Service Worker
- Service Worker sẽ hoạt động trên HTTPS (GitHub Pages tự động có HTTPS)
- Cache sẽ được lưu trong trình duyệt

### 3. Cập nhật website
Mỗi khi push code mới lên GitHub:
```bash
git add .
git commit -m "Cập nhật website"
git push origin main
```
- GitHub Pages sẽ tự động rebuild
- Thời gian: 1-5 phút để cập nhật

### 4. Custom Domain (Tùy chọn)
Nếu muốn dùng tên miền riêng:
1. Vào Settings → Pages
2. Nhập domain vào phần **Custom domain**
3. Cấu hình DNS theo hướng dẫn của GitHub

## 🐛 Xử lý lỗi thường gặp

### Lỗi 404 - Page not found
- **Nguyên nhân**: Chưa bật GitHub Pages hoặc chọn sai branch/folder
- **Giải pháp**: Kiểm tra lại Settings → Pages

### Hình ảnh không hiển thị
- **Nguyên nhân**: Đường dẫn hình ảnh sai
- **Giải pháp**: Kiểm tra đường dẫn trong `products.json` và `script.js`

### Website không cập nhật
- **Nguyên nhân**: Cache của trình duyệt
- **Giải pháp**: 
  - Hard refresh: `Ctrl + F5` (Windows) hoặc `Cmd + Shift + R` (Mac)
  - Xóa cache trình duyệt

### Service Worker không hoạt động
- **Nguyên nhân**: Service Worker chỉ hoạt động trên HTTPS
- **Giải pháp**: GitHub Pages tự động có HTTPS, không cần làm gì

## 📱 Test trên Mobile

1. Mở URL trên điện thoại
2. Kiểm tra responsive design
3. Test PWA: Thêm vào màn hình chính (Add to Home Screen)

## 🔄 Cập nhật website

Mỗi khi thay đổi code:

```bash
# 1. Kiểm tra thay đổi
git status

# 2. Thêm thay đổi
git add .

# 3. Commit
git commit -m "Mô tả thay đổi"

# 4. Push lên GitHub
git push origin main
```

Sau khi push, GitHub Pages sẽ tự động rebuild trong 1-5 phút.

## 📊 Monitoring

Để theo dõi website:
- **GitHub Actions**: Xem log deployment
- **GitHub Insights**: Xem traffic và analytics (nếu bật)

## ✅ Checklist

Sau khi setup, đảm bảo:

- [ ] GitHub Pages đã được bật
- [ ] Website truy cập được qua URL
- [ ] Tất cả hình ảnh hiển thị đúng
- [ ] Tìm kiếm hoạt động
- [ ] Lọc danh mục hoạt động
- [ ] Responsive trên mobile
- [ ] PWA có thể cài đặt
- [ ] Service Worker hoạt động

## 🎉 Hoàn thành!

Website của bạn giờ đã live trên:
**https://PHUONGHOANG99-bot.github.io/oder88/**

Chia sẻ link này với khách hàng để họ có thể xem và đặt hàng!

---

💡 **Tip**: Bookmark URL này để dễ truy cập sau này!

