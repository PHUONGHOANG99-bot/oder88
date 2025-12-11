# 🛍️ ODER 88 - Website Bán Hàng Thời Trang

Website bán hàng thời trang nam nữ với giao diện hiện đại, responsive và hỗ trợ PWA.

## ✨ Tính năng

- 🎨 Giao diện đẹp, responsive trên mọi thiết bị
- 🔍 Tìm kiếm và lọc sản phẩm theo danh mục
- 📱 Progressive Web App (PWA) - cài đặt như app
- 🌙 Dark mode / Light mode
- 🖼️ Gallery hình ảnh sản phẩm
- 📦 291+ sản phẩm đa dạng
- 💬 Tích hợp Messenger để đặt hàng
- ⚡ Tối ưu hiệu suất với Service Worker

## 🚀 Chạy thử trên GitHub Pages

### Cách 1: Bật GitHub Pages qua Web Interface

1. Vào repository: https://github.com/PHUONGHOANG99-bot/oder88
2. Click **Settings** (Cài đặt)
3. Scroll xuống phần **Pages** (bên trái)
4. Trong **Source**, chọn:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**
6. Đợi vài phút, website sẽ có tại:
   ```
   https://PHUONGHOANG99-bot.github.io/oder88/
   ```

### Cách 2: Sử dụng GitHub CLI

```bash
gh repo edit PHUONGHOANG99-bot/oder88 --enable-pages
gh api repos/PHUONGHOANG99-bot/oder88/pages -X POST -f source[branch]=main -f source[path]=/
```

## 📁 Cấu trúc dự án

```
REAL-TAOBAO/
├── index.html              # Trang chủ
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── assets/
│   ├── style.css          # Stylesheet chính
│   ├── script.js          # JavaScript logic
│   ├── products.json       # Dữ liệu sản phẩm
│   ├── image/             # Hình ảnh sản phẩm
│   └── logo/              # Logo và icon
└── backup_images/         # Backup hình ảnh
```

## 🛠️ Cài đặt và chạy local

### Yêu cầu
- Web server (hoặc dùng Live Server extension trong VS Code)

### Cách chạy

1. Clone repository:
```bash
git clone https://github.com/PHUONGHOANG99-bot/oder88.git
cd oder88
```

2. Mở với Live Server hoặc Python:
```bash
# Python 3
python -m http.server 8000

# Hoặc Python 2
python -m SimpleHTTPServer 8000
```

3. Truy cập: `http://localhost:8000`

## 📝 Danh mục sản phẩm

- 👔 Áo Nam (Áo đông nam)
- 👗 Áo Nữ (Áo đông nữ)
- 👖 Quần dài nữ
- 👠 Giày Nữ (Boot nữ, Giày Sneaker)
- 👟 Giày Nam (Giày Sneaker)
- 👜 Túi xách (Túi xách nam, Túi xách nữ)
- 👗 Váy (Chân váy)

## 🔧 Công nghệ sử dụng

- HTML5
- CSS3 (Flexbox, Grid, Custom Properties)
- Vanilla JavaScript (ES6+)
- Progressive Web App (PWA)
- Service Worker API
- Font Awesome Icons

## 📱 PWA Features

- ✅ Có thể cài đặt trên mobile/desktop
- ✅ Hoạt động offline (với cache)
- ✅ Responsive design
- ✅ Fast loading

## 🔗 Liên kết

- **GitHub Repository**: https://github.com/PHUONGHOANG99-bot/oder88
- **GitHub Pages**: https://PHUONGHOANG99-bot.github.io/oder88/ (sau khi bật Pages)
- **Messenger**: https://www.facebook.com/messages/t/117640791273059

## 📄 License

Dự án này được tạo cho mục đích thương mại.

## 👤 Tác giả

ODER 88 Shop

---

⭐ Nếu thấy hữu ích, hãy star repository này!

