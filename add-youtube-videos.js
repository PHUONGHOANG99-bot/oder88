/**
 * Script để thêm link video YouTube vào products.json
 * 
 * Cách sử dụng:
 * 1. Mở file này và chỉnh sửa mảng videos bên dưới
 * 2. Chạy: node add-youtube-videos.js
 * 
 * Format videos:
 * - Cách 1: Danh sách link theo thứ tự (sẽ gắn vào các sản phẩm liên tiếp)
 *   videos = [
 *     { startProductId: 1, links: ["link1", "link2", ...] }
 *   ]
 * 
 * - Cách 2: Gắn link vào sản phẩm cụ thể theo ID
 *   videos = [
 *     { productId: 1, link: "link1" },
 *     { productId: 2, link: "link2" }
 *   ]
 * 
 * - Cách 3: Gắn link vào sản phẩm theo category và thứ tự
 *   videos = [
 *     { category: "ao-thu-dong", startIndex: 0, links: ["link1", "link2", ...] }
 *   ]
 */

const fs = require('fs');
const path = require('path');

// ==================== CẤU HÌNH ====================
// Chỉnh sửa phần này với link video của bạn

const videos = [
    // Ví dụ 1: Gắn link vào sản phẩm cụ thể theo ID
    // { productId: 1, link: "https://www.youtube.com/watch?v=VIDEO_ID" },
    // { productId: 2, link: "https://youtu.be/VIDEO_ID" },
    
    // Ví dụ 2: Gắn link vào các sản phẩm liên tiếp bắt đầu từ ID
    // { startProductId: 100, links: [
    //     "https://www.youtube.com/watch?v=VIDEO_ID_1",
    //     "https://youtu.be/VIDEO_ID_2",
    //     "https://www.youtube.com/embed/VIDEO_ID_3"
    // ]},
    
    // Ví dụ 3: Gắn link vào sản phẩm trong category cụ thể
    // { category: "tui-xach-nu", startIndex: 0, links: [
    //     "https://www.youtube.com/watch?v=VIDEO_ID_1",
    //     "https://youtu.be/VIDEO_ID_2"
    // ]}
    
    // THÊM LINK CỦA BẠN VÀO ĐÂY:
];

// ==================== HÀM XỬ LÝ ====================

/**
 * Chuyển đổi link YouTube sang format embed
 */
function convertToEmbedUrl(url) {
    if (!url) return null;
    
    // Nếu đã là embed URL, trả về luôn
    if (url.includes('youtube.com/embed/')) {
        return url.split('?')[0]; // Lấy URL gốc không có params
    }
    
    // Extract video ID từ các format khác nhau
    let videoId = null;
    
    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
    if (watchMatch) {
        videoId = watchMatch[1];
    }
    // youtu.be/VIDEO_ID
    else {
        const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
        if (shortMatch) {
            videoId = shortMatch[1];
        }
    }
    
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    
    return null;
}

/**
 * Đọc và parse products.json
 */
function loadProducts() {
    const filePath = path.join(__dirname, 'assets', 'products.json');
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

/**
 * Lưu products.json
 */
function saveProducts(products) {
    const filePath = path.join(__dirname, 'assets', 'products.json');
    const content = JSON.stringify(products, null, 4);
    fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Tìm sản phẩm theo ID
 */
function findProductById(products, id) {
    return products.findIndex(p => p.id === id);
}

/**
 * Tìm sản phẩm theo category
 */
function findProductsByCategory(products, category) {
    return products
        .map((p, index) => ({ product: p, index }))
        .filter(({ product }) => product.category === category);
}

/**
 * Xử lý thêm video vào sản phẩm
 */
function processVideos(products, videos) {
    let updated = 0;
    let errors = [];
    
    for (const videoConfig of videos) {
        try {
            // Cách 1: Gắn vào sản phẩm cụ thể theo ID
            if (videoConfig.productId && videoConfig.link) {
                const embedUrl = convertToEmbedUrl(videoConfig.link);
                if (!embedUrl) {
                    errors.push(`Link không hợp lệ cho productId ${videoConfig.productId}: ${videoConfig.link}`);
                    continue;
                }
                
                const index = findProductById(products, videoConfig.productId);
                if (index === -1) {
                    errors.push(`Không tìm thấy sản phẩm với ID: ${videoConfig.productId}`);
                    continue;
                }
                
                products[index].video = embedUrl;
                updated++;
                console.log(`✓ Đã thêm video vào sản phẩm ID ${videoConfig.productId}`);
            }
            // Cách 2: Gắn vào các sản phẩm liên tiếp bắt đầu từ ID
            else if (videoConfig.startProductId && videoConfig.links) {
                let currentId = videoConfig.startProductId;
                
                for (const link of videoConfig.links) {
                    const embedUrl = convertToEmbedUrl(link);
                    if (!embedUrl) {
                        errors.push(`Link không hợp lệ: ${link}`);
                        continue;
                    }
                    
                    const index = findProductById(products, currentId);
                    if (index === -1) {
                        errors.push(`Không tìm thấy sản phẩm với ID: ${currentId}`);
                        currentId++;
                        continue;
                    }
                    
                    products[index].video = embedUrl;
                    updated++;
                    console.log(`✓ Đã thêm video vào sản phẩm ID ${currentId}`);
                    currentId++;
                }
            }
            // Cách 3: Gắn vào sản phẩm trong category
            else if (videoConfig.category && videoConfig.links) {
                const categoryProducts = findProductsByCategory(products, videoConfig.category);
                const startIndex = videoConfig.startIndex || 0;
                
                if (categoryProducts.length === 0) {
                    errors.push(`Không tìm thấy sản phẩm nào trong category: ${videoConfig.category}`);
                    continue;
                }
                
                if (startIndex >= categoryProducts.length) {
                    errors.push(`startIndex ${startIndex} vượt quá số sản phẩm trong category ${videoConfig.category} (${categoryProducts.length})`);
                    continue;
                }
                
                for (let i = 0; i < videoConfig.links.length && (startIndex + i) < categoryProducts.length; i++) {
                    const link = videoConfig.links[i];
                    const embedUrl = convertToEmbedUrl(link);
                    if (!embedUrl) {
                        errors.push(`Link không hợp lệ: ${link}`);
                        continue;
                    }
                    
                    const { index, product } = categoryProducts[startIndex + i];
                    products[index].video = embedUrl;
                    updated++;
                    console.log(`✓ Đã thêm video vào sản phẩm ID ${product.id} (${product.name}) trong category ${videoConfig.category}`);
                }
            }
            else {
                errors.push(`Cấu hình không hợp lệ: ${JSON.stringify(videoConfig)}`);
            }
        } catch (error) {
            errors.push(`Lỗi khi xử lý: ${error.message}`);
        }
    }
    
    return { updated, errors };
}

// ==================== THỰC THI ====================

function main() {
    console.log('🚀 Bắt đầu thêm video YouTube vào products.json...\n');
    
    if (videos.length === 0) {
        console.log('⚠️  Chưa có video nào được cấu hình!');
        console.log('   Vui lòng chỉnh sửa mảng "videos" trong file này.\n');
        return;
    }
    
    try {
        // Đọc products.json
        const products = loadProducts();
        console.log(`📦 Đã load ${products.length} sản phẩm\n`);
        
        // Xử lý thêm video
        const { updated, errors } = processVideos(products, videos);
        
        // Hiển thị kết quả
        console.log(`\n✅ Hoàn thành! Đã cập nhật ${updated} sản phẩm.`);
        
        if (errors.length > 0) {
            console.log(`\n⚠️  Có ${errors.length} lỗi:`);
            errors.forEach(err => console.log(`   - ${err}`));
        }
        
        // Lưu file
        if (updated > 0) {
            saveProducts(products);
            console.log('\n💾 Đã lưu products.json');
        } else {
            console.log('\n⚠️  Không có thay đổi nào được lưu.');
        }
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
}

// Chạy script
main();

