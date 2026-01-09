const fs = require('fs');
const path = require('path');

// Đường dẫn đến file products.json
const productsJsonPath = path.join(__dirname, 'assets', 'products.json');
// Đường dẫn đến thư mục chứa ảnh con
const childImagesDir = path.join(__dirname, 'assets', 'image', 'ao-nam', 'anh-adn');

// Đọc file products.json
const productsData = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));

// Đọc danh sách file ảnh con
const childImageFiles = fs.readdirSync(childImagesDir)
    .filter(file => file.endsWith('.jpg') || file.endsWith('.JPG'))
    .sort((a, b) => {
        // Sắp xếp theo số trước dấu chấm, sau đó theo số sau dấu chấm
        const numA = parseFloat(a.split('.')[0]);
        const numB = parseFloat(b.split('.')[0]);
        if (numA !== numB) return numA - numB;
        const subNumA = parseFloat(a.split('.')[1]) || 0;
        const subNumB = parseFloat(b.split('.')[1]) || 0;
        return subNumA - subNumB;
    });

console.log(`Tìm thấy ${childImageFiles.length} file ảnh con trong thư mục anh-adn`);

// Tạo map từ số ảnh chính đến danh sách ảnh con
const childImagesMap = {};
childImageFiles.forEach(file => {
    // Lấy số trước dấu chấm (ví dụ: "1.1.jpg" -> "1")
    const mainNumber = file.split('.')[0];
    if (!childImagesMap[mainNumber]) {
        childImagesMap[mainNumber] = [];
    }
    const imagePath = `assets/image/ao-nam/anh-adn/${file}`;
    childImagesMap[mainNumber].push(imagePath);
});

// Cập nhật các sản phẩm ao-dong-nam
let updatedCount = 0;
productsData.forEach(product => {
    if (product.category === 'ao-dong-nam' && product.image) {
        // Lấy số từ tên file ảnh chính (ví dụ: "adt1.jpg" -> "1")
        const imageMatch = product.image.match(/adt(\d+)\.jpg/i);
        if (imageMatch) {
            const imageNumber = imageMatch[1];
            const childImages = childImagesMap[imageNumber] || [];
            
            if (childImages.length > 0) {
                // Tạo mảng images với ảnh chính đầu tiên, sau đó là ảnh con
                product.images = [product.image, ...childImages];
                updatedCount++;
                console.log(`✓ Sản phẩm ${product.name} (${product.image}): Thêm ${childImages.length} ảnh con`);
            }
        }
    }
});

// Ghi lại file products.json
fs.writeFileSync(productsJsonPath, JSON.stringify(productsData, null, 4), 'utf8');

console.log(`\nHoàn thành! Đã cập nhật ${updatedCount} sản phẩm với ảnh con.`);
