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

const fs = require("fs");
const path = require("path");

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

    // Cập nhật video cho boot-nu từ BN1 tới hết
    {
        category: "boot-nu",
        startIndex: 0,
        links: [
            "https://www.youtube.com/shorts/qpZI5E0H4s4",
            "https://youtube.com/shorts/LwewmVHmCi0",
            "https://youtube.com/shorts/u_1d_CAwXh8",
            "https://youtube.com/shorts/LVzNM1UwN98",
            "https://youtube.com/shorts/EQpe8mgjHkM",
            "https://youtube.com/shorts/JGeYGbS7uF0",
            "https://youtube.com/shorts/83pfdR_ATag",
            "https://youtube.com/shorts/MuyXf1KY4ps",
            "https://youtube.com/shorts/77VReYR-R1M",
            "https://youtube.com/shorts/vwpI3E6PBHI",
            "https://youtube.com/shorts/AwE9kV5VusQ",
            "https://youtube.com/shorts/DydGf2ei0Xs",
            "https://youtube.com/shorts/YCcetkXvqK8",
            "https://youtube.com/shorts/Az41AMIAhSI",
            "https://youtube.com/shorts/Rz5aUNvpREk",
            "https://youtube.com/shorts/sDqYi9do8os",
        ],
    },

    // Cập nhật video cho chan-vay từ CV1 tới CV12
    {
        category: "chan-vay",
        startIndex: 0,
        links: [
            "https://www.youtube.com/shorts/B3ZR21aUEIA",
            "https://www.youtube.com/shorts/YRQ4rvG3ls8",
            "https://www.youtube.com/shorts/J9pjB8ypQbk",
            "https://www.youtube.com/shorts/gS_8LG2kgMA",
            "https://www.youtube.com/shorts/aM_4SpCzw-U",
            "https://www.youtube.com/shorts/B3cI5l6phuA",
            "https://www.youtube.com/shorts/G3RUSeMnZMg",
            "https://www.youtube.com/shorts/N_dUI996Y1k",
            "https://www.youtube.com/shorts/9kly7LFTnw8",
            "https://www.youtube.com/shorts/61O6ID4IggU",
            "https://www.youtube.com/shorts/zqqmn257UDI",
            "https://www.youtube.com/shorts/BBlsjNFcYJ8",
        ],
    },

    // Cập nhật video cho chan-vay từ CV13 tới CV24
    {
        category: "chan-vay",
        startIndex: 12,
        links: [
            "https://www.youtube.com/shorts/uLgG_2H64Co",
            "https://www.youtube.com/shorts/nv0UMd9frik",
            "https://www.youtube.com/shorts/gr28uX7Xvm8",
            "https://www.youtube.com/shorts/e2ze0AZyT0w",
            "https://www.youtube.com/shorts/SBcFJwhDZVE",
            "https://www.youtube.com/shorts/4xF4Ovj55ig",
            "https://www.youtube.com/shorts/YeU64EUrTHs",
            "https://www.youtube.com/shorts/CuMdI4947Os",
            "https://www.youtube.com/shorts/bKPdatDK1T8",
            "https://www.youtube.com/shorts/RHdYcrALAqw",
            "https://www.youtube.com/shorts/XRublwsp74E",
            "https://www.youtube.com/shorts/csm5QWzr97k",
        ],
    },
    
    // Cập nhật video cho chan-vay từ CV25 tới CV44
    {
        category: "chan-vay",
        startIndex: 24,
        links: [
            "https://www.youtube.com/shorts/eWUfa9mMgtk",
            "https://www.youtube.com/shorts/GFWGw1DMKMY",
            "https://www.youtube.com/shorts/6vegsVQt7kk",
            "https://www.youtube.com/shorts/69hOGdbzQKI",
            "https://www.youtube.com/shorts/4132Ds-YA1A",
            "https://www.youtube.com/shorts/qIzjkIQi5T4",
            "https://www.youtube.com/shorts/Pvd78HGb2Cc",
            "https://www.youtube.com/shorts/dpM_C4v15FU",
            "https://www.youtube.com/shorts/qjw11ME1B5g",
            "https://www.youtube.com/shorts/uqEKlDGRAOI",
            "https://www.youtube.com/shorts/aSleEoSRh4g",
            "https://www.youtube.com/shorts/RSKNZuK8Zf0",
            "https://www.youtube.com/shorts/43SouBTcRQw",
            "https://www.youtube.com/shorts/yAKXtbrvOzs",
            "https://www.youtube.com/shorts/7QEKsqrdaJQ",
            "https://www.youtube.com/shorts/uCqikW2JxgA",
            "https://www.youtube.com/shorts/i_2BX4SrD_c",
            "https://www.youtube.com/shorts/GIHIOuwBdcs",
            "https://www.youtube.com/shorts/BNo4FHoKqNA",
            "https://www.youtube.com/shorts/YuRw_yJWKC0",
        ],
    },
];

// ==================== HÀM XỬ LÝ ====================

/**
 * Chuyển đổi link YouTube sang format embed
 */
function convertToEmbedUrl(url) {
    if (!url) return null;

    // Nếu đã là embed URL, trả về luôn
    if (url.includes("youtube.com/embed/")) {
        return url.split("?")[0]; // Lấy URL gốc không có params
    }

    // Extract video ID từ các format khác nhau
    let videoId = null;

    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
    if (watchMatch) {
        videoId = watchMatch[1];
    }
    // youtube.com/shorts/VIDEO_ID
    else {
        const shortsMatch = url.match(/youtube\.com\/shorts\/([^?&#]+)/);
        if (shortsMatch) {
            videoId = shortsMatch[1];
        }
        // youtu.be/VIDEO_ID
        else {
            const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
            if (shortMatch) {
                videoId = shortMatch[1];
            }
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
    const filePath = path.join(__dirname, "assets", "products.json");
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
}

/**
 * Lưu products.json
 */
function saveProducts(products) {
    const filePath = path.join(__dirname, "assets", "products.json");
    const content = JSON.stringify(products, null, 4);
    fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Tìm sản phẩm theo ID
 */
function findProductById(products, id) {
    return products.findIndex((p) => p.id === id);
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
 * Extract số BN từ tên sản phẩm (ví dụ: "Boot Nữ BN1" -> 1)
 */
function extractBNNumber(productName) {
    const match = productName.match(/BN(\d+)/);
    return match ? parseInt(match[1], 10) : 999; // 999 để đẩy các sản phẩm không có BN về cuối
}

/**
 * Sắp xếp sản phẩm boot-nu theo số BN
 */
function sortBootNuByBN(categoryProducts) {
    return categoryProducts.sort((a, b) => {
        const numA = extractBNNumber(a.product.name);
        const numB = extractBNNumber(b.product.name);
        return numA - numB;
    });
}

/**
 * Extract số CV từ tên sản phẩm (ví dụ: "Chân Váy CV1" -> 1)
 */
function extractCVNumber(productName) {
    const match = productName.match(/CV(\d+)/);
    return match ? parseInt(match[1], 10) : 999; // 999 để đẩy các sản phẩm không có CV về cuối
}

/**
 * Sắp xếp sản phẩm chan-vay theo số CV
 */
function sortChanVayByCV(categoryProducts) {
    return categoryProducts.sort((a, b) => {
        const numA = extractCVNumber(a.product.name);
        const numB = extractCVNumber(b.product.name);
        return numA - numB;
    });
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
                    errors.push(
                        `Link không hợp lệ cho productId ${videoConfig.productId}: ${videoConfig.link}`
                    );
                    continue;
                }

                const index = findProductById(products, videoConfig.productId);
                if (index === -1) {
                    errors.push(
                        `Không tìm thấy sản phẩm với ID: ${videoConfig.productId}`
                    );
                    continue;
                }

                products[index].video = embedUrl;
                updated++;
                console.log(
                    `✓ Đã thêm video vào sản phẩm ID ${videoConfig.productId}`
                );
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
                        errors.push(
                            `Không tìm thấy sản phẩm với ID: ${currentId}`
                        );
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
                let categoryProducts = findProductsByCategory(
                    products,
                    videoConfig.category
                );

                // Sắp xếp boot-nu theo số BN
                if (videoConfig.category === "boot-nu") {
                    categoryProducts = sortBootNuByBN(categoryProducts);
                }
                // Sắp xếp chan-vay theo số CV
                else if (videoConfig.category === "chan-vay") {
                    categoryProducts = sortChanVayByCV(categoryProducts);
                }

                const startIndex = videoConfig.startIndex || 0;

                if (categoryProducts.length === 0) {
                    errors.push(
                        `Không tìm thấy sản phẩm nào trong category: ${videoConfig.category}`
                    );
                    continue;
                }

                if (startIndex >= categoryProducts.length) {
                    errors.push(
                        `startIndex ${startIndex} vượt quá số sản phẩm trong category ${videoConfig.category} (${categoryProducts.length})`
                    );
                    continue;
                }

                for (
                    let i = 0;
                    i < videoConfig.links.length &&
                    startIndex + i < categoryProducts.length;
                    i++
                ) {
                    const link = videoConfig.links[i];
                    const embedUrl = convertToEmbedUrl(link);
                    if (!embedUrl) {
                        errors.push(`Link không hợp lệ: ${link}`);
                        continue;
                    }

                    const { index, product } = categoryProducts[startIndex + i];
                    products[index].video = embedUrl;
                    updated++;
                    console.log(
                        `✓ Đã thêm video vào sản phẩm ID ${product.id} (${product.name}) trong category ${videoConfig.category}`
                    );
                }
            } else {
                errors.push(
                    `Cấu hình không hợp lệ: ${JSON.stringify(videoConfig)}`
                );
            }
        } catch (error) {
            errors.push(`Lỗi khi xử lý: ${error.message}`);
        }
    }

    return { updated, errors };
}

// ==================== THỰC THI ====================

function main() {
    console.log("🚀 Bắt đầu thêm video YouTube vào products.json...\n");

    if (videos.length === 0) {
        console.log("⚠️  Chưa có video nào được cấu hình!");
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
            errors.forEach((err) => console.log(`   - ${err}`));
        }

        // Lưu file
        if (updated > 0) {
            saveProducts(products);
            console.log("\n💾 Đã lưu products.json");
        } else {
            console.log("\n⚠️  Không có thay đổi nào được lưu.");
        }
    } catch (error) {
        console.error("❌ Lỗi:", error.message);
        process.exit(1);
    }
}

// Chạy script
main();
