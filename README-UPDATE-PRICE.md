# 📝 Hướng dẫn cập nhật giá sản phẩm - Tránh lỗi encoding

## ⚠️ Vấn đề thường gặp

Khi chỉnh sửa file `assets/products.json` bằng các editor không hỗ trợ UTF-8 đúng cách (như Notepad trên Windows), ký tự **¥** (Unicode U+00A5) có thể bị lưu sai và trở thành **Â¥**, gây lỗi hiển thị trên web.

## ✅ Giải pháp - 2 cách an toàn

### Cách 1: Dùng script cập nhật giá tự động (KHUYẾN NGHỊ)

Dùng script `update-price-safe.js` để cập nhật giá một cách an toàn:

```bash
# Cập nhật giá sản phẩm ID=1 thành 2500 yên
node update-price-safe.js 1 2500

# Hoặc có thể nhập ký hiệu ¥
node update-price-safe.js 1 ¥2500
```

**Ưu điểm:**
- ✅ Tự động đảm bảo encoding UTF-8 đúng
- ✅ Tự động loại bỏ ký tự "Â" nếu có
- ✅ Tự động tạo backup trước khi sửa
- ✅ Format giá đúng chuẩn: `¥{số}`

### Cách 2: Chỉnh sửa thủ công + Normalize sau

Nếu bạn muốn chỉnh sửa nhiều giá cùng lúc bằng editor:

1. **Mở file `assets/products.json`** bằng editor hỗ trợ UTF-8 tốt:
   - ✅ **VS Code** (khuyến nghị)
   - ✅ **Notepad++** (chọn Encoding: UTF-8)
   - ✅ **Sublime Text**
   - ❌ **KHÔNG dùng Notepad** (Windows) - dễ bị lỗi encoding

2. **Chỉnh sửa giá** (đảm bảo format: `"¥2402"`)

3. **Chạy script normalize** để tự động sửa mọi lỗi encoding:
   ```bash
   node normalize-products-json.js
   ```

Script này sẽ:
- ✅ Loại bỏ UTF-8 BOM nếu có
- ✅ Sửa tất cả chuỗi bị mojibake
- ✅ Loại bỏ "Â" trước ký hiệu ¥
- ✅ Đảm bảo format giá đúng: `¥{số}`
- ✅ Tạo backup trước khi sửa

## 🔍 Kiểm tra encoding file

Để kiểm tra file có bị lỗi encoding không:

```bash
node -e "const fs=require('fs'); const text=fs.readFileSync('assets/products.json','utf8'); console.log('Has BOM:', text.charCodeAt(0)===0xFEFF ? 'Có (LỖI)' : 'Không (OK)'); const data=JSON.parse(text.replace(/^\uFEFF/,'')); const sample=data[0]; console.log('Sample price:', sample.price); console.log('Has Â:', sample.price.includes('Â') ? 'CÓ LỖI' : 'OK');"
```

## 📌 Lưu ý quan trọng

1. **Luôn chạy normalize script** sau khi chỉnh sửa file JSON thủ công
2. **Dùng VS Code** thay vì Notepad để chỉnh sửa JSON
3. **Kiểm tra encoding** trước khi commit code
4. File sẽ được lưu với **UTF-8 không BOM** (chuẩn cho JSON)

## 🛠️ Scripts có sẵn

- `update-price-safe.js` - Cập nhật giá an toàn cho 1 sản phẩm
- `normalize-products-json.js` - Normalize toàn bộ file JSON sau khi chỉnh sửa

