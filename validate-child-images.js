const fs = require('fs');
const path = require('path');

// Đường dẫn đến file products.json
const productsJsonPath = path.join(__dirname, 'assets', 'products.json');
// Đường dẫn đến thư mục chứa ảnh con
const childImagesDir = path.join(__dirname, 'assets', 'image', 'ao-nam', 'anh-adn');

// Đọc file products.json
const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));

// Đọc danh sách file ảnh con thực tế
const existingImageFiles = new Set(
    fs.readdirSync(childImagesDir)
        .filter(file => file.endsWith('.jpg') || file.endsWith('.JPG'))
        .map(file => file.toLowerCase())
);

console.log(`Tổng số file ảnh thực tế trong anh-adn: ${existingImageFiles.size}`);

// Kiểm tra và loại bỏ ảnh không tồn tại
let totalRemoved = 0;
let productsUpdated = 0;

productsData.forEach(product => {
    if (product.category === 'ao-dong-nam' && product.images && Array.isArray(product.images)) {
        const validImages = [];
        let hasChanges = false;

        product.images.forEach(imagePath => {
            // Nếu là ảnh từ thư mục anh-adn, kiểm tra xem file có tồn tại không
            if (imagePath.includes('/anh-adn/')) {
                const fileName = path.basename(imagePath).toLowerCase();
                if (existingImageFiles.has(fileName)) {
                    validImages.push(imagePath);
                } else {
                    console.log(`  ❌ Xóa ảnh không tồn tại: ${imagePath}`);
                    hasChanges = true;
                    totalRemoved++;
                }
            } else {
                // Giữ lại ảnh chính (không phải từ anh-adn)
                validImages.push(imagePath);
            }
        });

        if (hasChanges) {
            product.images = validImages;
            productsUpdated++;
            console.log(`✓ Cập nhật sản phẩm: ${product.name} (còn ${validImages.length} ảnh)`);
        }
    }
});

// Ghi lại file products.json nếu có thay đổi
if (totalRemoved > 0) {
    fs.writeFileSync(productsJsonPath, JSON.stringify(productsData, null, 4), 'utf8');
    console.log(`\n✅ Hoàn thành! Đã xóa ${totalRemoved} ảnh không tồn tại từ ${productsUpdated} sản phẩm.`);
    console.log(`\n⚠️  Lưu ý: Bạn cần xóa cache của Service Worker để xem thay đổi.`);
    console.log(`   - Nhấn F12 -> Application -> Storage -> Clear site data`);
    console.log(`   - Hoặc: Application -> Service Workers -> Unregister`);
} else {
    console.log(`\n✅ Tất cả ảnh trong JSON đều tồn tại. Không cần cập nhật.`);
}
