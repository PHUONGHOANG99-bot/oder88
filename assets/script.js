// ==================== BIẾN TOÀN CỤC ====================
let products = []; // Sẽ được load từ JSON
let originalProducts = []; // Lưu bản gốc để shuffle lại
let currentCategory = "all";
let searchQuery = "";
let currentPage = 1;
// Infinite scroll: mặc định hiển thị 50 sản phẩm, cuộn xuống sẽ tự tải thêm 50
const productsPerPage = 50;

// Infinite scroll state
let visibleProductsCount = productsPerPage;
let currentRenderList = [];
let loadMoreObserver = null;
const LOAD_MORE_SENTINEL_ID = "productsLoadMoreSentinel";
const LOAD_MORE_SPINNER_ID = "productsLoadMoreSpinner";
const PRELOAD_BATCH_SIZE = 12; // preload trước 12 ảnh để user vuốt xuống là ảnh có sẵn
let isLoadingMore = false;
const preloadedImageUrls = new Set();
let currentSlide = 0;
const itemsPerSlide = 3;

// ==================== FIX TEXT ENCODING (MOJIBAKE) ====================
// Nhiều file JSON bị lỗi kiểu: "Quáº§n dÃ i..." hoặc giá "Â¥2402"
// Nguyên nhân phổ biến: chuỗi UTF-8 bị đọc nhầm theo Latin-1 (ISO-8859-1) rồi lưu lại.
// Convert string that was (wrongly) decoded as a single-byte encoding back to bytes.
// Supports ISO-8859-1 AND Windows-1252 (needed because bytes 0x80-0x9F map to chars like ™, ƒ,...)
const WIN1252_CHAR_TO_BYTE = {
    "\u20AC": 0x80, // €
    "\u201A": 0x82, // ‚
    "\u0192": 0x83, // ƒ
    "\u201E": 0x84, // „
    "\u2026": 0x85, // …
    "\u2020": 0x86, // †
    "\u2021": 0x87, // ‡
    "\u02C6": 0x88, // ˆ
    "\u2030": 0x89, // ‰
    "\u0160": 0x8a, // Š
    "\u2039": 0x8b, // ‹
    "\u0152": 0x8c, // Œ
    "\u017D": 0x8e, // Ž
    "\u2018": 0x91, // ‘
    "\u2019": 0x92, // ’
    "\u201C": 0x93, // “
    "\u201D": 0x94, // ”
    "\u2022": 0x95, // •
    "\u2013": 0x96, // –
    "\u2014": 0x97, // —
    "\u02DC": 0x98, // ˜
    "\u2122": 0x99, // ™
    "\u0161": 0x9a, // š
    "\u203A": 0x9b, // ›
    "\u0153": 0x9c, // œ
    "\u017E": 0x9e, // ž
    "\u0178": 0x9f, // Ÿ
};

function singleByteBytesFromString(str) {
    if (typeof str !== "string") return null;
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 255) {
            bytes[i] = code;
            continue;
        }
        const mapped = WIN1252_CHAR_TO_BYTE[str[i]];
        if (mapped === undefined) return null;
        bytes[i] = mapped;
    }
    return bytes;
}

function repairUtf8Mojibake(input) {
    if (typeof input !== "string") return input;

    // Quick checks để tránh tốn CPU trên dữ liệu sạch
    const looksBroken =
        /Ã|Â|Ä|Å|Æ|Ç|Ð|Ñ|Ø|Þ/.test(input) ||
        input.includes("áº") ||
        input.includes("á»") ||
        input.includes("�");
    if (!looksBroken) return input;

    try {
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const bytes = singleByteBytesFromString(input);

        // Nếu chuỗi có ký tự > 255 (ví dụ ™), ta thử repair theo từng đoạn <=255
        // để vẫn cứu được phần mojibake mà không phá ký tự Unicode hợp lệ.
        let decoded = "";
        if (bytes) {
            decoded = decoder.decode(bytes);
        } else {
            let out = "";
            let chunk = [];
            for (let i = 0; i < input.length; i++) {
                const code = input.charCodeAt(i);
                const mapped =
                    code <= 255 ? code : WIN1252_CHAR_TO_BYTE[input[i]];
                if (mapped !== undefined) {
                    chunk.push(mapped);
                } else {
                    if (chunk.length) {
                        out += decoder.decode(Uint8Array.from(chunk));
                        chunk = [];
                    }
                    out += input[i];
                }
            }
            if (chunk.length) {
                out += decoder.decode(Uint8Array.from(chunk));
            }
            decoded = out;
        }

        if (!decoded || decoded === input) return input;

        // Heuristic: nếu decoded giảm "dấu hiệu lỗi" thì nhận
        const score = (s) =>
            (s.match(/Ã/g) || []).length +
            (s.match(/Â/g) || []).length +
            (s.match(/áº/g) || []).length +
            (s.match(/á»/g) || []).length +
            (s.includes("�") ? 10 : 0);
        return score(decoded) < score(input) ? decoded : input;
    } catch (e) {
        return input;
    }
}

function normalizeWhitespace(str) {
    if (typeof str !== "string") return str;
    // NBSP (U+00A0) hay gây ra "Â " khi bị sai encoding.
    return str
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizePriceString(price) {
    if (price === undefined || price === null) return price;
    let s = normalizeWhitespace(repairUtf8Mojibake(String(price)));

    // Chỉ xoá "Â" khi nó xuất hiện như ký tự rác trước ký hiệu tiền tệ
    // (tránh xoá chữ "Â" hợp lệ trong tiếng Việt nếu có)
    s = s.replace(/Â(?=\s*[¥₫đ])/g, "");

    return s;
}

function sanitizeProduct(product) {
    if (!product || typeof product !== "object") return product;
    return {
        ...product,
        name: normalizeWhitespace(repairUtf8Mojibake(product.name ?? "")),
        categoryName: normalizeWhitespace(
            repairUtf8Mojibake(product.categoryName ?? "")
        ),
        keywords: normalizeWhitespace(
            repairUtf8Mojibake(product.keywords ?? "")
        ),
        price: normalizePriceString(product.price ?? ""),
    };
}

// ==================== HÀM FORMAT GIÁ TIỀN ====================
// Tỷ giá: 1¥ = 170 VND (theo App dcom)
const YEN_TO_VND_RATE = 170;

// Hàm lấy số Yên từ chuỗi giá
function getYenAmount(price) {
    if (!price) return 0;
    let priceStr = String(price);
    // Loại bỏ tất cả ký tự không phải số
    priceStr = priceStr.replace(/[^0-9]/g, "");
    return parseInt(priceStr) || 0;
}

// Hàm quy đổi Yên sang VND
function convertYenToVND(yenAmount) {
    return Math.round(yenAmount * YEN_TO_VND_RATE);
}

// Hàm format số VND với dấu chấm ngăn cách
function formatVND(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Hàm format giá Yên (giữ nguyên format hiện tại)
function formatPriceToYen(price) {
    if (!price) return "¥0";

    // Chuyển đổi từ VND sang Yên Nhật
    // Loại bỏ các ký tự không phải số và dấu chấm
    let priceStr = normalizePriceString(String(price));

    // Nếu đã có ký hiệu yên (¥ hoặc y), giữ nguyên
    if (
        priceStr.includes("¥") ||
        priceStr.includes("y") ||
        priceStr.includes("Y")
    ) {
        // Thay "y" hoặc "Y" thành "¥"
        priceStr = priceStr.replace(/[yY]/g, "¥");
        // Đảm bảo "¥" ở đầu
        if (!priceStr.startsWith("¥")) {
            priceStr = priceStr.replace(/¥/g, "").replace(/[đ₫]/g, "");
            return `¥${priceStr}`;
        }
        return priceStr;
    }

    // Loại bỏ ký hiệu VND (đ, ₫)
    priceStr = priceStr.replace(/[đ₫]/g, "").trim();

    // Thêm ký hiệu yên ở đầu
    return `¥${priceStr}`;
}

// Hàm format giá hiển thị cả Yên và VND
function formatPriceWithVND(price) {
    const yenAmount = getYenAmount(price);
    const yenFormatted = formatPriceToYen(price);
    const vndAmount = convertYenToVND(yenAmount);
    const vndFormatted = formatVND(vndAmount);

    return {
        yen: yenFormatted,
        vnd: `VND ${vndFormatted}`,
    };
}

// Intersection Observer instances
let scrollObserver = null;
let imageObserver = null;

// ==================== LOAD DỮ LIỆU TỪ JSON ====================
// Hàm lấy base path
function getBasePath() {
    // Lấy pathname hiện tại
    const pathname = window.location.pathname;
    // Tách pathname thành các phần
    const parts = pathname.split("/").filter((p) => p);
    // Nếu có subdirectory trong path (không phải root domain)
    if (parts.length > 0 && parts[0] !== "index.html") {
        // Trả về base path với dấu / ở đầu
        return "/" + parts[0];
    }
    // Nếu là root domain hoặc localhost, trả về rỗng
    return "";
}

// Hàm normalize đường dẫn
function normalizePath(path) {
    if (!path) return path;
    // Nếu đã là đường dẫn tuyệt đối (bắt đầu bằng http), giữ nguyên
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    // Nếu bắt đầu bằng /, thêm base path
    if (path.startsWith("/")) {
        const basePath = getBasePath();
        return basePath + path;
    }
    // Nếu là đường dẫn tương đối, thêm base path
    const basePath = getBasePath();
    return basePath + "/" + path;
}

// ==================== TỐI ƯU TẢI ẢNH - MODERN WEB APP ====================
// Kiểm tra hỗ trợ WebP
function supportsWebP() {
    if (typeof supportsWebP.cached !== "undefined") {
        return supportsWebP.cached;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    supportsWebP.cached =
        canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    return supportsWebP.cached;
}

// Tạo blur placeholder (base64 data URI nhỏ)
function createBlurPlaceholder() {
    // SVG blur placeholder - siêu nhẹ, tải ngay lập tức
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cfilter id='blur'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Crect width='400' height='400' fill='%23f0f0f0' filter='url(%23blur)'/%3E%3C/svg%3E";
}

// Tạo responsive image với WebP và fallback
function createOptimizedImageSrc(imagePath, options = {}) {
    const { width = 400, height = 400, quality = 85 } = options;
    const normalizedPath = normalizePath(imagePath);

    // Nếu là URL ngoài, không xử lý
    if (
        normalizedPath.startsWith("http://") ||
        normalizedPath.startsWith("https://")
    ) {
        return {
            src: normalizedPath,
            srcset: "",
            placeholder: createBlurPlaceholder(),
        };
    }

    // Tạo srcset cho responsive images
    const sizes = [200, 400, 600, 800];
    const srcset = sizes
        .map((size) => {
            const ratio = size / width;
            const h = Math.round(height * ratio);
            return `${normalizedPath}?w=${size}&h=${h}&q=${quality} ${size}w`;
        })
        .join(", ");

    return {
        src: normalizedPath,
        srcset: srcset,
        sizes: "(max-width: 480px) 50vw, (max-width: 768px) 33vw, 25vw",
        placeholder: createBlurPlaceholder(),
    };
}

// Tối ưu image element với lazy loading thông minh
function createOptimizedImageElement(product, index, isSlider = false) {
    const imagePath = product.image;
    const optimized = createOptimizedImageSrc(imagePath);
    const isEager = isSlider ? index < 3 : index < 4;
    const className = isSlider ? "slider-img" : "product-image";

    // Sử dụng img với srcset cho responsive images
    // WebP sẽ được thêm sau khi có hệ thống convert ảnh
    // Hiện tại dùng responsive srcset để tối ưu bandwidth
    const srcsetAttr = optimized.srcset ? `srcset="${optimized.srcset}"` : "";
    const sizesAttr = optimized.sizes ? `sizes="${optimized.sizes}"` : "";

    return `
        <img 
            src="${optimized.src}" 
            ${srcsetAttr}
            ${sizesAttr}
            alt="${getCategoryDisplayName(
                product.category,
                product.categoryName
            )} - ${formatPriceToYen(product.price)}" 
            class="${className} image-optimized" 
            data-product-id="${product.id}"
            loading="${isEager ? "eager" : "lazy"}"
            decoding="async"
            fetchpriority="${isEager ? "high" : "auto"}"
            width="400"
            height="400"
            onerror="handleImageError(this)"
            style="cursor: pointer; background: url('${
                optimized.placeholder
            }') center/cover; transition: opacity 0.3s ease; opacity: 0;"
            onload="this.style.opacity='1'; this.style.background='transparent'; this.classList.add('image-loaded');">
    `;
}

async function loadProducts() {
    try {
        console.log("Đang load sản phẩm từ JSON...");
        const basePath = getBasePath();
        const jsonPath = `${basePath}/assets/products.json`.replace("//", "/");
        console.log("Loading from:", jsonPath);

        const response = await fetch(jsonPath);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // NOTE: `products.json` có thể có UTF-8 BOM (\uFEFF) -> một số môi trường parse JSON sẽ lỗi.
        const text = await response.text();
        const safeText = text.replace(/^\uFEFF/, "");
        const raw = JSON.parse(safeText);
        products = Array.isArray(raw) ? raw.map(sanitizeProduct) : [];

        // Tự động thêm số lượt mua ngẫu nhiên cho sản phẩm chưa có và điều chỉnh giá
        products = products.map((product) => {
            // Điều chỉnh giá cho áo đông nam và áo khoác đông nữ: trừ 800 yên
            if (
                product.category === "ao-dong-nam" ||
                product.category === "ao-dong-nu"
            ) {
                const currentYen = getYenAmount(product.price);
                if (currentYen > 800) {
                    const newYen = currentYen - 800;
                    product.price = `¥${newYen}`;
                }
            }

            if (!product.purchases) {
                // Tạo số lượt mua ngẫu nhiên là số chẵn: 100, 200, 300, 400, 500, 600, 700, 800
                const randomMultiplier = Math.floor(Math.random() * 8) + 1; // 1-8
                product.purchases = randomMultiplier * 100;
            } else {
                // Làm tròn số lượt mua hiện có thành số chẵn gần nhất (làm tròn xuống)
                const currentPurchases =
                    parseInt(
                        String(product.purchases).replace(/[^0-9]/g, ""),
                        10
                    ) || 0;
                if (currentPurchases > 0) {
                    product.purchases =
                        Math.floor(currentPurchases / 100) * 100 || 100;
                }
            }
            return product;
        });

        originalProducts = [...products]; // Lưu bản gốc
        console.log(`✅ Đã load ${products.length} sản phẩm từ JSON`);

        // Kiểm tra dữ liệu
        if (!Array.isArray(products) || products.length === 0) {
            console.warn("⚠️ File JSON rỗng hoặc không đúng định dạng");
            products = getDefaultProducts();
            originalProducts = [...products];
        }
    } catch (error) {
        console.error("❌ Lỗi khi load JSON:", error);
        products = getDefaultProducts();
        originalProducts = [...products];
        console.log("🔄 Đang sử dụng dữ liệu mặc định...");
    }
}

// Dữ liệu mặc định nếu load JSON thất bại
function getDefaultProducts() {
    return [
        {
            id: 1,
            name: "Áo Thun Nam Basic Cotton Cao Cấp",
            price: "199.000đ",
            category: "ao-nam",
            categoryName: "Áo nam",
            image: "assets/image/1.jpeg",
            bestSeller: true,
        },
        {
            id: 2,
            name: "Quần Jean Nữ Skinny Co Giãn",
            price: "350.000đ",
            category: "quan-nu",
            categoryName: "Quần nữ",
            image: "assets/image/2.jpeg",
            bestSeller: true,
        },
        {
            id: 3,
            name: "Áo Sơ Mi Nam Công Sở Cao Cấp",
            price: "299.000đ",
            category: "ao-nam",
            categoryName: "Áo nam",
            image: "assets/image/3.jpeg",
            bestSeller: true,
        },
    ];
}

// ==================== HÀM HIỂN THỊ SẢN PHẨM MỚI ====================
// ==================== KHỞI TẠO ỨNG DỤNG ====================
async function initializeApp() {
    try {
        // 1. Show loading spinner
        showPageLoader();

        // 2. Show loading skeleton
        showLoadingSkeleton(20);

        // 3. Load sản phẩm từ JSON
        await loadProducts();

        // 4. Khởi tạo các component
        initSlider();
        initCategories();
        initMobileCategories();
        filterProducts();
        updateCategoryIndicator();

        // 5. Gắn sự kiện
        setupEventListeners();

        // 5.1 Desktop: thu gọn/mở search bằng nút kính lúp (mobile giữ nguyên)
        initDesktopHeaderSearchToggle();

        // 6. Init scroll to top
        initScrollToTop();

        // 7. Init bottom navigation
        initBottomNav();

        // 8. Init back button
        updateBackButton();

        // 9. Init product gallery
        initProductGallery();

        // 9. Init pull to refresh
        initPullToRefresh();

        // 10. Load shopping cart
        loadCart();

        console.log("✅ Ứng dụng đã khởi tạo thành công!");
        // Đã tắt thông báo khi load sản phẩm
    } catch (error) {
        console.error("❌ Lỗi khi khởi tạo ứng dụng:", error);
    } finally {
        // 11. Hide loading spinner - LUÔN gọi để đảm bảo không bị kẹt loading
        hidePageLoader();
    }
}

// ==================== HÀM XỬ LÝ ẢNH ====================
function handleImageError(img) {
    img.onerror = null;
    img.classList.add("image-loading");

    const width = 400;
    const height = 400;

    img.src = `https://via.placeholder.com/${width}x${height}/FF6B6B/ffffff?text=Fashion+Item`;
    img.style.objectFit = "cover";
    img.alt = img.alt || "Sản phẩm thời trang";

    img.onload = () => {
        img.classList.remove("image-loading");
    };
}

// ==================== HÀM ESCAPE MESSAGE CHO HTML ====================
function escapeMessageForHTML(message) {
    // Escape cho việc sử dụng trong single-quoted string
    return message
        .replace(/\\/g, "\\\\") // Escape backslashes trước
        .replace(/'/g, "\\'") // Escape single quotes
        .replace(/\n/g, "\\n") // Escape newlines
        .replace(/\r/g, "\\r"); // Escape carriage returns
}

// ==================== HÀM MỞ MESSENGER APP ====================
function openMessengerApp(message = "") {
    // Facebook page username của oder88.comshop
    const pageUsername = "oder88.comshop";

    // URL để mở Messenger page (m.me tự động mở app nếu có, nếu không thì mở web)
    let messengerUrl = `https://m.me/${pageUsername}`;

    // Thêm message vào URL nếu có
    if (message) {
        const encodedMessage = encodeURIComponent(message);
        messengerUrl += `?text=${encodedMessage}`;
    }

    // Kiểm tra xem có phải mobile không
    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );

    // Trên mobile, sử dụng window.location.href để đảm bảo mở được Messenger app
    // Trên desktop, sử dụng window.open để mở tab mới
    if (isMobile) {
        // Trên mobile: chuyển hướng trực tiếp để mở Messenger app
        window.location.href = messengerUrl;
    } else {
        // Trên desktop: mở tab mới
        window.open(messengerUrl, "_blank");
    }
}

// ==================== HÀM TẠO LINK MESSENGER ====================
function createMessengerOrderLink(productName, productPrice, categoryName) {
    const message = `Xin chào ODER 88! Tôi muốn đặt hàng:\n\n👕 Sản phẩm: ${productName}\n💰 Giá: ${productPrice}\n🏷️ Danh mục: ${categoryName}\n\nVui lòng liên hệ lại với tôi để xác nhận đơn hàng.`;
    return message;
}

function getCategoryDisplayName(categoryId, fallbackName) {
    const map = {
        "quan-dai-nu": "Quần Nữ",
        "quan-nam": "Quần Nam",
        "quan-jean-nam": "Jean Nam",
        "phu-kien": "Phụ Kiện",
        "non-nam": "Nón nam",
        "non-nu": "Nón nữ",
        khan: "Khăn",
        "no-buoc-toc": "Nơ Buộc tóc",
        tat: "Tất",
    };
    return map[categoryId] || fallbackName || "Sản phẩm";
}

// ==================== HÀM LOADING SPINNER ====================
function showPageLoader() {
    const loader = document.getElementById("pageLoader");
    if (loader) {
        loader.classList.add("active");
    }
}

function hidePageLoader() {
    const loader = document.getElementById("pageLoader");
    if (loader) {
        loader.classList.remove("active");
    }
}

// ==================== HÀM TOAST NOTIFICATION ====================
function showToast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");

    const icons = {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        info: "fa-info-circle",
    };

    toast.innerHTML = `
        <i class="fas ${
            icons[type] || icons.info
        } toast-icon" aria-hidden="true"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Đóng thông báo" type="button">
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector(".toast-close");
    const closeToast = () => {
        toast.classList.add("hiding");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    };

    closeBtn.addEventListener("click", closeToast);

    if (duration > 0) {
        setTimeout(closeToast, duration);
    }

    return toast;
}

// ==================== HÀM SCROLL TO TOP ====================
function scrollToTop() {
    // Đảm bảo cart được lưu trước khi scroll
    saveCart();

    // Đóng menu mobile categories nếu đang mở
    const mobileCategories = document.getElementById("mobileCategories");
    const overlay = document.getElementById("mobileOverlay");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    if (mobileCategories && mobileCategories.classList.contains("show")) {
        mobileCategories.classList.remove("show");
        mobileCategories.setAttribute("aria-hidden", "true");
        if (overlay) overlay.classList.remove("show");
        if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
    }

    // Reset về trang chủ - hiển thị tất cả sản phẩm
    resetToHome();

    // Reload slider với sản phẩm ngẫu nhiên từ 30 sản phẩm bán chạy nhất
    initSlider();

    // Scroll lên đầu trang
    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });

    // Đã tắt thông báo khi load sản phẩm

    // Update active state
    updateBottomNavActive("home");
}

// ==================== HÀM SHUFFLE SẢN PHẨM ====================
// Seeded random number generator để đảm bảo cùng seed cho cùng kết quả
function seededRandom(seed) {
    let value = seed;
    return function () {
        value = (value * 9301 + 49297) % 233280;
        return value / 233280;
    };
}

// Hàm shuffle có seed để đảm bảo thứ tự cố định
function seededShuffle(array, seed) {
    const shuffled = [...array];
    const random = seededRandom(seed);

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

// Lấy hoặc tạo seed cho shuffle tab "Tất cả"
function getShuffleSeed() {
    const STORAGE_KEY = "allTabShuffleSeed";
    let seed = localStorage.getItem(STORAGE_KEY);

    if (!seed) {
        // Tạo seed mới dựa trên timestamp và lưu vào localStorage
        seed = Date.now().toString().slice(-9); // Lấy 9 chữ số cuối
        localStorage.setItem(STORAGE_KEY, seed);
    }

    return parseInt(seed);
}

function shuffleProducts() {
    if (originalProducts.length === 0) {
        // Nếu chưa có originalProducts, dùng products hiện tại
        originalProducts = [...products];
    }

    // Tạo bản sao và shuffle
    const shuffled = [...originalProducts];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Cập nhật products với bản đã shuffle
    products = shuffled;
    console.log("🔄 Đã shuffle sản phẩm - hiển thị thứ tự mới");
}

// ==================== HÀM RELOAD TRANG ====================
function reloadPage() {
    // Đảm bảo cart được lưu trước khi reload
    saveCart();
    // Reload trang - slider sẽ tự động random lại khi trang load (trong initializeApp)
    // Cart sẽ được load lại từ localStorage trong initializeApp()
    window.location.reload();
}

// ==================== HÀM SCROLL TO PRODUCTS ====================
function scrollToProducts() {
    // Reload slider với sản phẩm ngẫu nhiên từ 30 sản phẩm bán chạy nhất
    initSlider();

    // Shuffle sản phẩm để hiển thị thứ tự khác nhau
    shuffleProducts();

    // Reset về category "all" và trang 1
    currentCategory = "all";
    currentPage = 1;
    searchQuery = "";

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.value = "";
    }

    // Hide clear button
    const searchClearBtn = document.getElementById("searchClearBtn");
    if (searchClearBtn) {
        searchClearBtn.style.display = "none";
    }

    // Reset active category buttons
    document
        .querySelectorAll(".category-option, .mobile-category-btn")
        .forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-selected", "false");
        });

    // Set "Tất cả" button as active
    const allButtons = document.querySelectorAll('[data-category="all"]');
    allButtons.forEach((btn) => {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
    });

    // Update category indicator
    updateCategoryIndicator();

    // Cập nhật hiển thị nút quay lại
    updateBackButton();

    // Filter và hiển thị sản phẩm đã shuffle
    filterProducts();

    // Scroll đến phần sản phẩm
    const productsSection = document.querySelector(".products-section");
    if (productsSection) {
        setTimeout(() => {
            window.scrollTo({
                top: productsSection.offsetTop - 80,
                behavior: "smooth",
            });
        }, 100);
    }

    // Đã tắt thông báo khi load sản phẩm
}

// Hàm quay lại trang chủ
function goBackToHome() {
    // Reset category về "all"
    currentCategory = "all";
    currentPage = 1;
    searchQuery = "";

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.value = "";
    }

    // Hide clear button
    const searchClearBtn = document.getElementById("searchClearBtn");
    if (searchClearBtn) {
        searchClearBtn.style.display = "none";
    }

    // Reset active category buttons
    document
        .querySelectorAll(
            ".category-option, .mobile-category-btn, .category-item"
        )
        .forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-selected", "false");
        });

    // Set "Tất cả" button as active
    const allButtons = document.querySelectorAll('[data-category="all"]');
    allButtons.forEach((btn) => {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
    });

    // Update category indicator
    updateCategoryIndicator();

    // Ẩn subcategories panel khi về "all" - giữ nguyên layout
    // renderSubcategories("all");
    const subcategoriesPanel = document.getElementById("subcategoriesPanel");
    const categoriesWrapper = document.querySelector(".categories-wrapper");
    if (subcategoriesPanel && categoriesWrapper) {
        subcategoriesPanel.classList.remove("active");
        categoriesWrapper.classList.remove("has-subcategories");
        subcategoriesPanel.innerHTML = "";
    }

    // Filter và hiển thị sản phẩm
    filterProducts();

    // Scroll to top
    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });

    // Update back button visibility
    updateBackButton();
}

// Hàm reset về trang chủ - hiển thị tất cả sản phẩm
function resetToHome() {
    // Reset category về "all"
    currentCategory = "all";

    // Reset search query
    searchQuery = "";
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.value = "";
    }

    // Hide clear button
    const searchClearBtn = document.getElementById("searchClearBtn");
    if (searchClearBtn) {
        searchClearBtn.style.display = "none";
    }

    // Reset về trang 1
    currentPage = 1;

    // Reset active category buttons
    document
        .querySelectorAll(".category-option, .mobile-category-btn")
        .forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-selected", "false");
        });

    // Set "Tất cả" button as active
    const allButtons = document.querySelectorAll('[data-category="all"]');
    allButtons.forEach((btn) => {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
    });

    // Update category indicator
    updateCategoryIndicator();

    // Ẩn subcategories panel khi về "all" - giữ nguyên layout
    // renderSubcategories("all");
    const subcategoriesPanel = document.getElementById("subcategoriesPanel");
    const categoriesWrapper = document.querySelector(".categories-wrapper");
    if (subcategoriesPanel && categoriesWrapper) {
        subcategoriesPanel.classList.remove("active");
        categoriesWrapper.classList.remove("has-subcategories");
        subcategoriesPanel.innerHTML = "";
    }

    // Cập nhật hiển thị nút quay lại
    updateBackButton();

    // Filter và hiển thị tất cả sản phẩm
    filterProducts();
}

function initScrollToTop() {
    const scrollBtn = document.getElementById("scrollToTop");
    if (!scrollBtn) return;

    const toggleScrollButton = () => {
        if (window.scrollY > 300) {
            scrollBtn.classList.add("show");
        } else {
            scrollBtn.classList.remove("show");
        }
    };

    window.addEventListener("scroll", toggleScrollButton);
    toggleScrollButton();

    scrollBtn.addEventListener("click", scrollToTop);
}

// ==================== HÀM BOTTOM NAVIGATION ====================
function updateBottomNavActive(activeItem) {
    const navItems = document.querySelectorAll(".bottom-nav-item");
    navItems.forEach((item) => {
        item.classList.remove("active");
    });

    const activeElement = document.querySelector(
        `.bottom-nav-item[aria-label="${getActiveLabel(activeItem)}"]`
    );
    if (activeElement) {
        activeElement.classList.add("active");
    }
}

function getActiveLabel(item) {
    const labels = {
        home: "Trang chủ",
        category: "Danh mục",
        search: "Tìm kiếm",
        contact: "Liên hệ",
        fanpage: "Fanpage",
        random: "Ngẫu nhiên",
        cart: "Giỏ hàng",
    };
    return labels[item] || "Trang chủ";
}

// ==================== DESKTOP HEADER SEARCH TOGGLE ====================
function isDesktopHeaderSearchMode() {
    return window.matchMedia && window.matchMedia("(min-width: 993px)").matches;
}

function setDesktopHeaderSearchOpen(isOpen, options = {}) {
    const { focusInput = false } = options;

    const headerRight = document.querySelector(".header-right");
    const toggleBtn = document.getElementById("headerSearchToggleBtn");
    const searchInput = document.getElementById("searchInput");

    if (!headerRight || !toggleBtn) return;

    // Mobile/tablet: luôn để search theo layout sẵn có, và reset trạng thái toggle
    if (!isDesktopHeaderSearchMode()) {
        headerRight.classList.remove("search-open");
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.setAttribute("aria-label", "Mở tìm kiếm");
        const icon = toggleBtn.querySelector("i");
        if (icon) {
            icon.classList.add("fa-search");
            icon.classList.remove("fa-times");
        }
        return;
    }

    headerRight.classList.toggle("search-open", Boolean(isOpen));
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleBtn.setAttribute(
        "aria-label",
        isOpen ? "Đóng tìm kiếm" : "Mở tìm kiếm"
    );

    const icon = toggleBtn.querySelector("i");
    if (icon) {
        icon.classList.toggle("fa-search", !isOpen);
        icon.classList.toggle("fa-times", isOpen);
    }

    if (isOpen && focusInput && searchInput) {
        // Chờ layout update để focus không bị fail khi vừa mở
        setTimeout(() => {
            searchInput.focus();
        }, 0);
    }
}

function initDesktopHeaderSearchToggle() {
    const headerRight = document.querySelector(".header-right");
    const toggleBtn = document.getElementById("headerSearchToggleBtn");

    if (!headerRight || !toggleBtn) return;

    // Default: gọn (đóng search) trên desktop
    setDesktopHeaderSearchOpen(false);

    toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = headerRight.classList.contains("search-open");
        setDesktopHeaderSearchOpen(!isOpen, { focusInput: !isOpen });
    });

    // ESC đóng
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!isDesktopHeaderSearchMode()) return;
        if (!headerRight.classList.contains("search-open")) return;
        setDesktopHeaderSearchOpen(false);
    });

    // Click ra ngoài đóng (chỉ desktop)
    document.addEventListener("click", (e) => {
        if (!isDesktopHeaderSearchMode()) return;
        if (!headerRight.classList.contains("search-open")) return;

        const headerCenter = headerRight.querySelector(".header-center");
        if (toggleBtn.contains(e.target)) return;
        if (headerCenter && headerCenter.contains(e.target)) return;

        setDesktopHeaderSearchOpen(false);
    });

    // Resize qua breakpoint: reset trạng thái cho đúng
    window.addEventListener("resize", () => {
        setDesktopHeaderSearchOpen(
            headerRight.classList.contains("search-open")
        );
    });
}

function focusSearch() {
    // Nếu desktop đang thu gọn search, tự mở ra rồi focus
    if (isDesktopHeaderSearchMode()) {
        setDesktopHeaderSearchOpen(true, { focusInput: true });
    }

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.focus();
        searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        updateBottomNavActive("search");
        // Đã tắt thông báo
    }
}

// Update active state on scroll
function handleScrollForBottomNav() {
    if (typeof isCartOpen === "function" && isCartOpen()) return;
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // If at top, set home as active
    if (scrollY < 100) {
        updateBottomNavActive("home");
    }
}

// Initialize bottom nav
function initBottomNav() {
    // Set home as default active
    updateBottomNavActive("home");

    // Nếu đang mở giỏ hàng mà bấm các nút bottom-nav khác thì đóng giỏ trước
    // (dùng capture để chạy trước inline onclick như scrollToTop/focusSearch...)
    const bottomNav = document.getElementById("bottomNav");
    if (bottomNav) {
        bottomNav.addEventListener(
            "click",
            (e) => {
                if (!isCartOpen()) return;

                const cartBtn = document.getElementById("cartBtn");
                if (cartBtn && cartBtn.contains(e.target)) return; // để nút giỏ tự toggle

                // đóng giỏ nhưng KHÔNG restore active state (vì nút mới sẽ set active)
                closeCart(false);
            },
            { capture: true }
        );
    }

    // Update on scroll
    window.addEventListener("scroll", handleScrollForBottomNav);

    // Handle clicks on bottom nav items
    document.querySelectorAll(".bottom-nav-item").forEach((item) => {
        item.addEventListener("click", function () {
            const label = this.getAttribute("aria-label");
            if (label === "Trang chủ") {
                updateBottomNavActive("home");
            } else if (label === "Danh mục") {
                updateBottomNavActive("category");
            } else if (label === "Liên hệ") {
                updateBottomNavActive("contact");
            } else if (label === "Fanpage") {
                updateBottomNavActive("fanpage");
            } else if (label === "Ngẫu nhiên") {
                updateBottomNavActive("random");
            } else if (label === "Giỏ hàng") {
                updateBottomNavActive("cart");
            }
        });
    });
}

// ==================== HÀM LOADING SKELETON ====================
function createSkeletonCard() {
    return `
        <div class="product-card skeleton-card">
            <div class="skeleton skeleton-image"></div>
            <div class="product-info">
                <div class="skeleton skeleton-text short" style="margin-bottom: 15px;"></div>
                <div class="skeleton skeleton-text medium" style="margin-bottom: 15px;"></div>
                <div class="skeleton skeleton-button"></div>
            </div>
        </div>
    `;
}

function showLoadingSkeleton(count = 12) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    grid.innerHTML = Array.from({ length: count }, () =>
        createSkeletonCard()
    ).join("");
}

// ==================== HÀM MENU MOBILE ====================
function toggleMobileMenu() {
    const mobileCategories = document.getElementById("mobileCategories");
    if (!mobileCategories) return;
    const overlay = document.getElementById("mobileOverlay") || createOverlay();
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const isOpen = mobileCategories.classList.contains("show");

    mobileCategories.classList.toggle("show");
    overlay.classList.toggle("show");
    // Không set body overflow hidden để không ảnh hưởng đến categories section
    // document.body.style.overflow = isOpen ? "" : "hidden";

    // Update ARIA attributes
    if (mobileCategories) {
        mobileCategories.setAttribute("aria-hidden", isOpen ? "true" : "false");
    }
    if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    }

    // Khi mở menu, tự động hiển thị tất cả mục con cho "Tất cả"
    if (!isOpen) {
        // Đảm bảo "Tất cả" button được set active
        const allButton = document.querySelector(
            '.mobile-category-btn[data-category="all"]'
        );
        if (allButton) {
            // Remove active từ tất cả buttons
            document.querySelectorAll(".mobile-category-btn").forEach((btn) => {
                btn.classList.remove("active");
                btn.setAttribute("aria-selected", "false");
            });
            // Set active cho "Tất cả"
            allButton.classList.add("active");
            allButton.setAttribute("aria-selected", "true");
        }
        // Hiển thị tất cả mục con bên phải
        setTimeout(() => {
            renderMobileSubcategories("all");
        }, 100); // Delay nhỏ để đảm bảo menu đã render xong
    }

    overlay.onclick = () => {
        mobileCategories.classList.remove("show");
        overlay.classList.remove("show");
        // document.body.style.overflow = "";
        if (mobileCategories)
            mobileCategories.setAttribute("aria-hidden", "true");
        if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
    };
}

function createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "mobileOverlay";
    overlay.style.transition = "opacity 0.3s ease";
    document.body.appendChild(overlay);
    return overlay;
}

// ==================== HÀM DANH MỤC ====================
function toggleCategoryDropdown() {
    const dropdown = document.getElementById("categoriesDropdown");
    const toggleBtn = document.getElementById("categoryToggleBtn");

    const isOpen = dropdown.classList.contains("show");
    dropdown.classList.toggle("show");
    toggleBtn.classList.toggle("active");

    // Update ARIA
    if (toggleBtn) {
        toggleBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    }

    const arrow = toggleBtn.querySelector(".toggle-arrow");
    if (arrow) {
        arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
    }
}

function selectCategory(category, categoryName) {
    // Đóng menu mobile
    const mobileCategories = document.getElementById("mobileCategories");
    const overlay = document.getElementById("mobileOverlay");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    if (mobileCategories && mobileCategories.classList.contains("show")) {
        mobileCategories.classList.remove("show");
        mobileCategories.setAttribute("aria-hidden", "true");
        if (overlay) overlay.classList.remove("show");
        if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
        // Không cần set body overflow vì đã bỏ overflow hidden khi mở menu
        // document.body.style.overflow = "";
    }

    // Đóng dropdown desktop
    const dropdown = document.getElementById("categoriesDropdown");
    if (dropdown) {
        dropdown.classList.remove("show");
        const toggleBtn = document.getElementById("categoryToggleBtn");
        if (toggleBtn) {
            toggleBtn.classList.remove("active");
            toggleBtn.setAttribute("aria-expanded", "false");
            const arrow = toggleBtn.querySelector(".toggle-arrow");
            if (arrow) arrow.style.transform = "rotate(0deg)";
        }
    }

    // Cập nhật active - bao gồm cả category-item và subcategory-item
    document
        .querySelectorAll(
            ".category-option, .mobile-category-btn, .category-item, .subcategory-item"
        )
        .forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-selected", "false");
        });

    const activeSelectors = `.category-option[data-category="${category}"], .mobile-category-btn[data-category="${category}"], .category-item[data-category="${category}"], .subcategory-item[data-category="${category}"]`;
    document.querySelectorAll(activeSelectors).forEach((btn) => {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
    });

    // Cập nhật category
    currentCategory = category;
    updateCategoryIndicator();

    // Không hiển thị subcategories panel - giữ nguyên layout categories section
    // renderSubcategories(category);
    // Đảm bảo subcategories panel luôn ẩn và không để lại khoảng trắng
    const subcategoriesPanel = document.getElementById("subcategoriesPanel");
    const categoriesWrapper = document.querySelector(".categories-wrapper");
    if (subcategoriesPanel && categoriesWrapper) {
        // Xóa class và nội dung trước
        subcategoriesPanel.classList.remove("active");
        categoriesWrapper.classList.remove("has-subcategories");
        subcategoriesPanel.innerHTML = "";
        // Đảm bảo panel không chiếm không gian
        subcategoriesPanel.style.width = "0";
        subcategoriesPanel.style.maxWidth = "0";
        subcategoriesPanel.style.padding = "0";
        subcategoriesPanel.style.margin = "0";
    }

    // Cập nhật hiển thị nút quay lại
    updateBackButton();

    // Đã tắt thông báo khi load sản phẩm

    filterProducts();

    // Scroll đến phần hiển thị sản phẩm (products section hoặc products-tabs)
    setTimeout(() => {
        // Ưu tiên scroll đến products-tabs (phần tabs + grid)
        const productsTabs = document.querySelector(".products-tabs");
        const productsGrid = document.getElementById("productsGrid");
        const productsSection = document.querySelector(".products-section");

        let targetElement = productsTabs || productsGrid || productsSection;

        if (targetElement) {
            const targetPosition =
                targetElement.getBoundingClientRect().top +
                window.pageYOffset -
                80;
            window.scrollTo({
                top: targetPosition,
                behavior: "smooth",
            });
        }
    }, 150);
}

// Hàm cập nhật hiển thị nút quay lại
function updateBackButton() {
    const backBtn = document.getElementById("backBtn");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");

    if (!backBtn || !mobileMenuBtn) return;

    // Chỉ hiển thị nút quay lại khi có tìm kiếm, không hiển thị khi chọn danh mục
    if (searchQuery !== "") {
        backBtn.style.display = "flex";
        mobileMenuBtn.style.display = "none";
    } else {
        backBtn.style.display = "none";
        mobileMenuBtn.style.display = "flex";
    }
}

function updateCategoryIndicator() {
    const categoryIndicator = document.getElementById("currentCategory");
    const sectionTitle = document.getElementById("sectionTitle");

    let categoryName = "Tất cả";
    const categoryMap = {
        "quan-dai-nu": "Quần Nữ",
        "quan-nam": "Quần Nam",
        "quan-jean-nam": "Jean Nam",
        "ao-nu": "Áo nữ",
        "ao-dong-nu": "Áo Khoác đông nữ",
        "ao-thu-dong": "Thu Đông Nữ",
        "tui-xach": "Túi xách",
        "tui-xach-nam": "Túi xách nam",
        "tui-xach-nu": "Túi xách nữ",
        giay: "Giày",
        "giay-nu": "Giày nữ",
        "giay-nam": "Giày Nam",
        "boot-nu": "Boot nữ",
        "giay-the-thao": "Sneaker Nữ",
        "giay-sneaker-nam": "Giày Sneaker",
        vay: "Váy",
        "chan-vay": "Chân váy",
        "set-do": "Sét Đồ",
        "set-do-nu": "Sét Đồ Nữ",
        "set-do-nam": "Sét Đồ Nam",
        "phu-kien": "Phụ Kiện",
        "non-nam": "Nón nam",
        "non-nu": "Nón nữ",
        khan: "Khăn",
        "no-buoc-toc": "Nơ Buộc tóc",
        tat: "Tất",
    };

    if (categoryMap[currentCategory]) {
        categoryName = categoryMap[currentCategory];
    }

    // Cập nhật category indicator - chỉ hiển thị tên danh mục và icon mũi tên
    if (categoryIndicator) {
        categoryIndicator.innerHTML = `<span>${categoryName}</span><i class="fas fa-chevron-down" style="font-size: 0.8rem; margin-left: 5px;"></i>`;
    }

    // Cập nhật tiêu đề section
    if (sectionTitle) {
        const iconMap = {
            all: "fa-star",
            "quan-dai-nu": "fa-female",
            "quan-nam": "fa-user",
            "quan-jean-nam": "fa-user",
            "ao-nu": "fa-tshirt",
            "phu-kien": "fa-gift",
            "non-nam": "fa-hat-cowboy",
            "non-nu": "fa-hat-cowboy",
            khan: "fa-scarf",
            "no-buoc-toc": "fa-ribbon",
            tat: "fa-socks",
            "ao-dong-nu": "fa-tshirt",
            "ao-thu-dong": "fa-tshirt",
            giay: "fa-shoe-prints",
            "giay-nu": "fa-heart",
            "giay-nam": "fa-shoe-prints",
            "boot-nu": "fa-shoe-prints",
            "giay-the-thao": "fa-running",
            "giay-sneaker-nam": "fa-running",
            vay: "fa-heart",
            "chan-vay": "fa-heart",
            "tui-xach": "fa-shopping-bag",
            "set-do": "fa-tshirt",
            "set-do-nu": "fa-tshirt",
            "set-do-nam": "fa-tshirt",
            "tui-xach-nam": "fa-briefcase",
            "tui-xach-nu": "fa-handbag",
        };

        const icon = iconMap[currentCategory] || "fa-star";
        // Chỉ hiển thị tên danh mục, không có từ thừa
        sectionTitle.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i> ${categoryName}`;
    }
}

// ==================== HÀM CATEGORIES ====================
function initCategories() {
    const categoriesGrid = document.getElementById("categoriesGrid");
    if (!categoriesGrid) return;

    // Định nghĩa categories với hình ảnh đại diện
    const categories = [
        {
            id: "all",
            name: "Tất cả",
            icon: "fa-border-all",
            image: "assets/logo/tatca.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "set-do",
            name: "Sét Đồ",
            icon: "fa-tshirt",
            image: "assets/logo/setdonu.JPG",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "ao-nu",
            name: "Áo nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/ao-dong-nu/adg1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-dong-nu",
            name: "Áo Khoác đông nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/ao-dong-nu/adg1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-thu-dong",
            name: "Thu Đông Nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/thu-dong-nu/TDG1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-nam",
            name: "Áo Nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adt1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "ao-dong-nam",
            name: "Áo đông nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adt1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "tui-xach",
            name: "Túi xách",
            icon: "fa-shopping-bag",
            image: "assets/logo/logotuixachnu.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "giay",
            name: "Giày",
            icon: "fa-shoe-prints",
            image: "assets/logo/logogiay.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "boot-nu",
            name: "Boot nữ",
            icon: "fa-shoe-prints",
            image: "assets/image/giay-nu/boot-nu/bn1.jpg",
            color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        },
        {
            id: "giay-the-thao",
            name: "Sneaker Nữ",
            icon: "fa-running",
            image: "assets/image/giay-nu/giay-the-thao/gsg1.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "vay",
            name: "Váy",
            icon: "fa-heart",
            image: "assets/image/vay/chan-vay/cv1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "giay-sneaker-nam",
            name: "Sneaker Nam",
            icon: "fa-running",
            image: "assets/image/giay-nam/giay-sneaker-nam/GST1.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "quan-nam",
            name: "Quần Nam",
            icon: "fa-user",
            image: "assets/logo/quannam.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "quan-jean-nam",
            name: "Jean Nam",
            icon: "fa-user",
            image: "assets/logo/quannam.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "quan-dai-nu",
            name: "Quần Nữ",
            icon: "fa-female",
            image: "assets/image/quan-dai-nu/qd1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "phu-kien",
            name: "Phụ Kiện",
            icon: "fa-gift",
            image: "assets/image/phu-kien/mu/IMG_1236.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
    ];

    // Render categories (bỏ qua các subcategories như boot-nu, giay-the-thao, ao-dong-nu, ao-dong-nam, giay-sneaker-nam, quan-jean-nam)
    categoriesGrid.innerHTML = categories
        .map((category) => {
            // Bỏ qua boot-nu, giay-the-thao, ao-dong-nu, ao-thu-dong, ao-dong-nam, giay-sneaker-nam, giay-nu, giay-nam, quan-jean-nam, non, khan, no-buoc-toc, tat vì chúng là subcategories
            if (
                category.id === "boot-nu" ||
                category.id === "giay-the-thao" ||
                category.id === "ao-dong-nu" ||
                category.id === "ao-thu-dong" ||
                category.id === "ao-dong-nam" ||
                category.id === "giay-sneaker-nam" ||
                category.id === "giay-nu" ||
                category.id === "giay-nam" ||
                category.id === "quan-jean-nam" ||
                category.id === "non" ||
                category.id === "khan" ||
                category.id === "no-buoc-toc" ||
                category.id === "tat"
            ) {
                return "";
            }
            return `
        <div class="category-item" data-category="${
            category.id
        }" role="button" tabindex="0">
            <div class="category-image-wrapper">
                <div class="category-image-bg" style="background: ${
                    category.color
                }"></div>
                <img 
                    src="${normalizePath(category.image)}" 
                    alt="${category.name}"
                    class="category-image"
                    loading="lazy"
                    decoding="async"
                    width="200"
                    height="200"
                    onerror="this.style.display='none'; this.parentElement.querySelector('.category-icon').style.display='flex';"
                >
                <div class="category-icon" style="display: none;">
                    <i class="fas ${category.icon}"></i>
                </div>
            </div>
            <div class="category-name">${category.name}</div>
        </div>
    `;
        })
        .filter((html) => html !== "") // Loại bỏ các HTML rỗng
        .join("");

    // Event listeners sẽ được gắn trong setupEventListeners()

    // Đảm bảo subcategories panel được ẩn ban đầu
    const subcategoriesPanel = document.getElementById("subcategoriesPanel");
    const categoriesWrapper = document.querySelector(".categories-wrapper");
    if (subcategoriesPanel && categoriesWrapper) {
        subcategoriesPanel.classList.remove("active");
        categoriesWrapper.classList.remove("has-subcategories");
    }
}

// Hàm render subcategories bên phải
function renderSubcategories(categoryId) {
    const subcategoriesPanel = document.getElementById("subcategoriesPanel");
    const categoriesWrapper = document.querySelector(".categories-wrapper");
    if (!subcategoriesPanel || !categoriesWrapper) {
        console.warn(
            "Subcategories panel hoặc categories wrapper không tìm thấy!"
        );
        return;
    }
    console.log("renderSubcategories được gọi với categoryId:", categoryId);

    // Định nghĩa subcategories cho mỗi category
    const subcategoriesMap = {
        "set-do": [
            {
                id: "set-do-nu",
                name: "Sét Đồ Nữ",
                icon: "fa-tshirt",
                image: "assets/logo/setdonu.JPG",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
            {
                id: "set-do-nam",
                name: "Sét Đồ Nam",
                icon: "fa-tshirt",
                image: "assets/image/set-do-nu/sd1.jpg",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
        ],
        "tui-xach": [
            {
                id: "tui-xach-nam",
                name: "Túi xách nam",
                icon: "fa-briefcase",
                image: "assets/logo/logotuixachnam.JPG",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
            {
                id: "tui-xach-nu",
                name: "Túi xách nữ",
                icon: "fa-handbag",
                image: "assets/logo/logotuixachnu.JPG",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
        ],
        giay: [
            {
                id: "boot-nu",
                name: "Boot nữ",
                icon: "fa-shoe-prints",
                image: "assets/image/giay-nu/boot-nu/bn1.jpg",
                color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            },
            {
                id: "giay-the-thao",
                name: "Sneaker Nữ",
                icon: "fa-running",
                image: "assets/image/giay-nu/giay-the-thao/gsg1.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "giay-sneaker-nam",
                name: "Sneaker Nam",
                icon: "fa-running",
                image: "assets/image/giay-nam/giay-sneaker-nam/GST1.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
        ],
        "ao-nam": [
            {
                id: "ao-dong-nam",
                name: "Áo đông nam",
                icon: "fa-tshirt",
                image: "assets/image/ao-nam/ao-dong-nam/adt1.jpg",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
        ],
        "ao-nu": [
            {
                id: "ao-dong-nu",
                name: "Áo Khoác đông nữ",
                icon: "fa-tshirt",
                image: "assets/image/ao-nu/ao-dong-nu/adg1.jpg",
                color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
            },
            {
                id: "ao-thu-dong",
                name: "Thu Đông Nữ",
                icon: "fa-tshirt",
                image: "assets/image/ao-nu/thu-dong-nu/TDG1.jpg",
                color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
            },
        ],
        "quan-nam": [
            {
                id: "quan-jean-nam",
                name: "Jean Nam",
                icon: "fa-user",
                image: "assets/logo/quannam.JPG",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
        ],
        "phu-kien": [
            {
                id: "non-nam",
                name: "Nón nam",
                icon: "fa-hat-cowboy",
                image: "assets/image/phu-kien/mu/IMG_1236.JPG",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "non-nu",
                name: "Nón nữ",
                icon: "fa-hat-cowboy",
                image: "assets/image/phu-kien/non-nu/NG1.jpg",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
            {
                id: "khan",
                name: "Khăn",
                icon: "fa-scarf",
                image: "assets/logo/tatca.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "no-buoc-toc",
                name: "Nơ Buộc tóc",
                icon: "fa-ribbon",
                image: "assets/image/phu-kien/no-toc/IMG_1182.JPG",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "tat",
                name: "Tất",
                icon: "fa-socks",
                image: "assets/logo/tatca.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
        ],
        vay: [
            {
                id: "chan-vay",
                name: "Chân váy",
                icon: "fa-tshirt",
                image: "assets/image/vay/chan-vay/cv1.jpg",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
        ],
    };

    let subcategories = subcategoriesMap[categoryId];

    // Nếu là "all", gom tất cả subcategories từ tất cả categories
    if (categoryId === "all") {
        subcategories = [];
        Object.values(subcategoriesMap).forEach((subcats) => {
            subcategories.push(...subcats);
        });
    }

    if (subcategories && subcategories.length > 0) {
        // Render subcategories
        const subcategoriesHTML = subcategories
            .map(
                (sub) => `
            <div class="subcategory-item" data-category="${
                sub.id
            }" role="button" tabindex="0">
                <div class="category-image-wrapper">
                    <div class="category-image-bg" style="background: ${
                        sub.color
                    }"></div>
                    <img 
                        src="${normalizePath(sub.image)}" 
                        alt="${sub.name}"
                        class="category-image"
                        loading="lazy"
                        onerror="this.style.display='none'; this.parentElement.querySelector('.category-icon').style.display='flex';"
                    >
                    <div class="category-icon" style="display: none;">
                        <i class="fas ${sub.icon}"></i>
                    </div>
                </div>
                <div class="category-name">${sub.name}</div>
            </div>
        `
            )
            .join("");

        subcategoriesPanel.innerHTML = `<div class="subcategories-panel-content">${subcategoriesHTML}</div>`;
        subcategoriesPanel.classList.add("active");
        categoriesWrapper.classList.add("has-subcategories");

        // Gắn event listeners cho subcategories
        subcategoriesPanel
            .querySelectorAll(".subcategory-item")
            .forEach((item) => {
                item.addEventListener("click", () => {
                    const subCategory = item.dataset.category;
                    const subCategoryName =
                        subcategories.find((s) => s.id === subCategory)?.name ||
                        "";
                    selectCategory(subCategory, subCategoryName);
                });
                item.addEventListener("keypress", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const subCategory = item.dataset.category;
                        const subCategoryName =
                            subcategories.find((s) => s.id === subCategory)
                                ?.name || "";
                        selectCategory(subCategory, subCategoryName);
                    }
                });
            });
    } else {
        // Ẩn subcategories panel nếu không có subcategories
        subcategoriesPanel.classList.remove("active");
        categoriesWrapper.classList.remove("has-subcategories");
        subcategoriesPanel.innerHTML = "";
    }
}

// ==================== HÀM MOBILE CATEGORIES ====================
function initMobileCategories() {
    // Setup event listeners for mobile category buttons (HTML is already in index.html)
    setupMobileCategoryListeners();
}

// OLD CODE - Keeping for reference but not used anymore
function initMobileCategories_OLD() {
    const mobileCategoriesList = document.querySelector(
        ".mobile-categories-list"
    );
    if (!mobileCategoriesList) return;

    // Định nghĩa categories với hình ảnh đại diện
    const categories = [
        {
            id: "all",
            name: "Tất cả",
            icon: "fa-border-all",
            image: "assets/logo/tatca.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "set-do",
            name: "Sét Đồ",
            icon: "fa-tshirt",
            image: "assets/logo/setdonu.JPG",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "set-do-nu",
            name: "Sét Đồ Nữ",
            icon: "fa-tshirt",
            image: "assets/logo/setdonu.JPG",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "set-do-nam",
            name: "Sét Đồ Nam",
            icon: "fa-tshirt",
            image: "assets/image/set-do-nu/sd1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "ao-nu",
            name: "Áo nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/ao-dong-nu/adg1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-dong-nu",
            name: "Áo Khoác đông nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/ao-dong-nu/adg1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-thu-dong",
            name: "Thu Đông Nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/thu-dong-nu/TDG1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-nam",
            name: "Áo Nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adt1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "ao-dong-nam",
            name: "Áo đông nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adt1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "tui-xach",
            name: "Túi xách",
            icon: "fa-shopping-bag",
            image: "assets/logo/logotuixachnu.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "giay",
            name: "Giày",
            icon: "fa-shoe-prints",
            image: "assets/logo/logogiay.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "boot-nu",
            name: "Boot nữ",
            icon: "fa-shoe-prints",
            image: "assets/image/giay-nu/boot-nu/bn1.jpg",
            color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        },
        {
            id: "giay-the-thao",
            name: "Sneaker Nữ",
            icon: "fa-running",
            image: "assets/image/giay-nu/giay-the-thao/gsg1.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "vay",
            name: "Váy",
            icon: "fa-heart",
            image: "assets/image/vay/chan-vay/cv1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "giay-sneaker-nam",
            name: "Sneaker Nam",
            icon: "fa-running",
            image: "assets/image/giay-nam/giay-sneaker-nam/GST1.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "quan-dai-nu",
            name: "Quần Nữ",
            icon: "fa-female",
            image: "assets/image/quan-dai-nu/qd1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "quan-nam",
            name: "Quần Nam",
            icon: "fa-user",
            image: "assets/logo/quannam.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "quan-jean-nam",
            name: "Jean Nam",
            icon: "fa-user",
            image: "assets/logo/quannam.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "phu-kien",
            name: "Phụ Kiện",
            icon: "fa-gift",
            image: "assets/image/phu-kien/mu/IMG_1236.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "non",
            name: "Mũ",
            icon: "fa-hat-cowboy",
            image: "assets/image/phu-kien/mu/IMG_1236.JPG",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "khan",
            name: "Khăn",
            icon: "fa-scarf",
            image: "assets/logo/tatca.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "no-buoc-toc",
            name: "Nơ Buộc tóc",
            icon: "fa-ribbon",
            image: "assets/logo/tatca.jpg",
            color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        },
        {
            id: "tat",
            name: "Tất",
            icon: "fa-socks",
            image: "assets/logo/tatca.jpg",
            color: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
        },
    ];

    // Render categories với hình ảnh và subcategories
    const categoriesHTML = categories
        .map((category, index) => {
            // Mục "Tất cả" không có subcategories
            if (category.id === "all") {
                return `
                <button class="mobile-category-btn ${
                    index === 0 ? "active" : ""
                }" data-category="${category.id}">
                    <div class="mobile-category-image">
                        <img src="${normalizePath(category.image)}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                        <div class="mobile-category-icon-fallback" style="background: ${
                            category.color
                        }; display: none;">
                            <i class="fas ${category.icon}"></i>
                        </div>
                    </div>
                    <span class="mobile-category-text">${category.name}</span>
                </button>
            `;
            }

            // Tất cả mục khác đều có subcategories
            if (category.id === "tui-xach") {
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="tuiXachBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${category.image}" alt="${category.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${category.name}</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="tuiXachSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="tui-xach"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${category.image}" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="tui-xach-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="assets/logo/logotuixachnam.JPG" alt="Túi xách nam" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); display: none;">
                                    <i class="fas fa-briefcase"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Túi xách nam</span>
                        </button>
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="tui-xach-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="assets/logo/logotuixachnu.JPG" alt="Túi xách nữ" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: none;">
                                    <i class="fas fa-handbag"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Túi xách nữ</span>
                        </button>
                    </div>
                </div>
            `;
            } else if (category.id === "quan-dai-nu") {
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="quanDaiNuBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${category.image}" alt="${category.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${category.name}</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="quanDaiNuSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="quan-dai-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${category.image}" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                    </div>
                </div>
            `;
            } else if (category.id === "quan-nam") {
                const quanJeanNam = categories.find(
                    (c) => c.id === "quan-jean-nam"
                );
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="quanNamBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${category.image}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${
                                category.color
                            }; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${
                            category.name
                        }</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="quanNamSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="quan-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${
                                    category.image
                                }" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${
                                    category.color
                                }; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                        ${
                            quanJeanNam
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="quan-jean-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${quanJeanNam.image}" alt="${quanJeanNam.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${quanJeanNam.color}; display: none;">
                                    <i class="fas ${quanJeanNam.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${quanJeanNam.name}</span>
                        </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
            } else if (category.id === "ao-nu") {
                // Tìm các subcategories
                const aoDongNu = categories.find((c) => c.id === "ao-dong-nu");
                const aoThuDong = categories.find(
                    (c) => c.id === "ao-thu-dong"
                );

                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="aoNuBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${normalizePath(category.image)}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${
                                category.color
                            }; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${
                            category.name
                        }</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="aoNuSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="ao-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${
                                    category.image
                                }" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${
                                    category.color
                                }; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                        ${
                            aoDongNu
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="ao-dong-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${aoDongNu.image}" alt="${aoDongNu.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${aoDongNu.color}; display: none;">
                                    <i class="fas ${aoDongNu.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${aoDongNu.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            aoThuDong
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="ao-thu-dong"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${aoThuDong.image}" alt="${aoThuDong.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${aoThuDong.color}; display: none;">
                                    <i class="fas ${aoThuDong.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${aoThuDong.name}</span>
                        </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
            } else if (category.id === "giay") {
                // Tìm các subcategories
                const giayNu = categories.find((c) => c.id === "giay-nu");
                const bootNu = categories.find((c) => c.id === "boot-nu");
                const giayTheThao = categories.find(
                    (c) => c.id === "giay-the-thao"
                );
                const giayNam = categories.find((c) => c.id === "giay-nam");
                const giaySneakerNam = categories.find(
                    (c) => c.id === "giay-sneaker-nam"
                );

                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="giayBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${normalizePath(category.image)}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${
                                category.color
                            }; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${
                            category.name
                        }</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="giaySubcategories"
                        style="display: none"
                    >
                        ${
                            giayNu
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="giay-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${giayNu.image}" alt="${giayNu.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${giayNu.color}; display: none;">
                                    <i class="fas ${giayNu.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${giayNu.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            bootNu
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="boot-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${bootNu.image}" alt="${bootNu.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${bootNu.color}; display: none;">
                                    <i class="fas ${bootNu.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${bootNu.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            giayTheThao
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="giay-the-thao"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${giayTheThao.image}" alt="${giayTheThao.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${giayTheThao.color}; display: none;">
                                    <i class="fas ${giayTheThao.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${giayTheThao.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            giayNam
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="giay-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${giayNam.image}" alt="${giayNam.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${giayNam.color}; display: none;">
                                    <i class="fas ${giayNam.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${giayNam.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            giaySneakerNam
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="giay-sneaker-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${giaySneakerNam.image}" alt="${giaySneakerNam.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${giaySneakerNam.color}; display: none;">
                                    <i class="fas ${giaySneakerNam.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${giaySneakerNam.name}</span>
                        </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
            } else if (category.id === "vay") {
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="vayBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${category.image}" alt="${category.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${category.name}</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="vaySubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="vay"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${category.image}" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="chan-vay"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="assets/image/vay/chan-vay/cv1.jpg" alt="Chân váy" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: none;">
                                    <i class="fas fa-tshirt"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Chân váy</span>
                        </button>
                    </div>
                </div>
            `;
            } else if (category.id === "set-do") {
                // Tìm các subcategories
                const setDoNu = categories.find((c) => c.id === "set-do-nu");
                const setDoNam = categories.find((c) => c.id === "set-do-nam");

                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="setDoBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${normalizePath(category.image)}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${
                                category.color
                            }; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${
                            category.name
                        }</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="setDoSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="set-do"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${
                                    category.image
                                }" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${
                                    category.color
                                }; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                        ${
                            setDoNu
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="set-do-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${setDoNu.image}" alt="${setDoNu.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${setDoNu.color}; display: none;">
                                    <i class="fas ${setDoNu.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${setDoNu.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            setDoNam
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="set-do-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${setDoNam.image}" alt="${setDoNam.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${setDoNam.color}; display: none;">
                                    <i class="fas ${setDoNam.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${setDoNam.name}</span>
                        </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
            } else if (category.id === "ao-nam") {
                const aoDongNam = categories.find(
                    (c) => c.id === "ao-dong-nam"
                );
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="aoNamBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${category.image}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${
                                category.color
                            }; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${
                            category.name
                        }</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="aoNamSubcategories"
                        style="display: none"
                    >
                        ${
                            aoDongNam
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="ao-dong-nam"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${aoDongNam.image}" alt="${aoDongNam.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${aoDongNam.color}; display: none;">
                                    <i class="fas ${aoDongNam.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${aoDongNam.name}</span>
                        </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
            } else if (category.id === "giay-nam") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay"
                return "";
            } else if (category.id === "boot-nu") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay"
                return "";
            } else if (category.id === "giay-the-thao") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay"
                return "";
            } else if (category.id === "phu-kien") {
                // Tìm các subcategories
                const non = categories.find((c) => c.id === "non");
                const khan = categories.find((c) => c.id === "khan");
                const noBuocToc = categories.find(
                    (c) => c.id === "no-buoc-toc"
                );
                const tat = categories.find((c) => c.id === "tat");

                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="phuKienBtn"
                        type="button"
                    >
                        <div class="mobile-category-image">
                            <img src="${normalizePath(category.image)}" alt="${
                    category.name
                }" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                            <div class="mobile-category-icon-fallback" style="background: ${
                                category.color
                            }; display: none;">
                                <i class="fas ${category.icon}"></i>
                            </div>
                        </div>
                        <span class="mobile-category-text">${
                            category.name
                        }</span>
                        <i class="fas fa-chevron-right subcategory-arrow"></i>
                    </button>
                    <div
                        class="subcategories"
                        id="phuKienSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="phu-kien"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${
                                    category.image
                                }" alt="Tất cả" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${
                                    category.color
                                }; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả</span>
                        </button>
                        ${
                            non
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="non"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${non.image}" alt="${non.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${non.color}; display: none;">
                                    <i class="fas ${non.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${non.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            khan
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="khan"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${khan.image}" alt="${khan.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${khan.color}; display: none;">
                                    <i class="fas ${khan.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${khan.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            noBuocToc
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="no-buoc-toc"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${noBuocToc.image}" alt="${noBuocToc.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${noBuocToc.color}; display: none;">
                                    <i class="fas ${noBuocToc.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${noBuocToc.name}</span>
                        </button>
                        `
                                : ""
                        }
                        ${
                            tat
                                ? `
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="tat"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${tat.image}" alt="${tat.name}" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${tat.color}; display: none;">
                                    <i class="fas ${tat.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">${tat.name}</span>
                        </button>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
            } else if (category.id === "ao-dong-nu") {
                // Bỏ qua category này vì đã được render trong subcategories của "ao-nu"
                return "";
            } else if (category.id === "ao-dong-nam") {
                // Bỏ qua category này vì đã được render trong subcategories của "ao-nam"
                return "";
            } else if (category.id === "giay-sneaker-nam") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay"
                return "";
            } else if (category.id === "giay-nu") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay"
                return "";
            } else if (category.id === "quan-jean-nam") {
                // Bỏ qua category này vì đã được render trong subcategories của "quan-nam"
                return "";
            } else if (
                category.id === "non" ||
                category.id === "khan" ||
                category.id === "no-buoc-toc" ||
                category.id === "tat"
            ) {
                // Bỏ qua các subcategories của phụ kiện vì đã được render trong subcategories của "phu-kien"
                return "";
            }
        })
        .filter((html) => html !== "") // Loại bỏ các HTML rỗng
        .join("");

    // Cập nhật HTML
    mobileCategoriesList.innerHTML = categoriesHTML;

    // Setup event listeners for mobile category buttons
    setupMobileCategoryListeners();
}

// Function to render mobile subcategories in the right panel
function renderMobileSubcategories(categoryId) {
    const subcategoriesPanel = document.getElementById(
        "mobileSubcategoriesPanel"
    );
    if (!subcategoriesPanel) return;

    // Use the same subcategoriesMap from renderSubcategories function
    const subcategoriesMap = {
        "set-do": [
            {
                id: "set-do-nu",
                name: "Sét Đồ Nữ",
                icon: "fa-tshirt",
                image: "assets/logo/setdonu.JPG",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
            {
                id: "set-do-nam",
                name: "Sét Đồ Nam",
                icon: "fa-tshirt",
                image: "assets/image/set-do-nu/sd1.jpg",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
        ],
        "tui-xach": [
            {
                id: "tui-xach-nam",
                name: "Túi xách nam",
                icon: "fa-briefcase",
                image: "assets/logo/logotuixachnam.JPG",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
            {
                id: "tui-xach-nu",
                name: "Túi xách nữ",
                icon: "fa-handbag",
                image: "assets/logo/logotuixachnu.JPG",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
        ],
        giay: [
            {
                id: "boot-nu",
                name: "Boot nữ",
                icon: "fa-shoe-prints",
                image: "assets/image/giay-nu/boot-nu/bn1.jpg",
                color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            },
            {
                id: "giay-the-thao",
                name: "Sneaker Nữ",
                icon: "fa-running",
                image: "assets/image/giay-nu/giay-the-thao/gsg1.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "giay-sneaker-nam",
                name: "Sneaker Nam",
                icon: "fa-running",
                image: "assets/image/giay-nam/giay-sneaker-nam/GST1.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
        ],
        "ao-nam": [
            {
                id: "ao-dong-nam",
                name: "Áo đông nam",
                icon: "fa-tshirt",
                image: "assets/image/ao-nam/ao-dong-nam/adt1.jpg",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
        ],
        "ao-nu": [
            {
                id: "ao-dong-nu",
                name: "Áo Khoác đông nữ",
                icon: "fa-tshirt",
                image: "assets/image/ao-nu/ao-dong-nu/adg1.jpg",
                color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
            },
            {
                id: "ao-thu-dong",
                name: "Thu Đông Nữ",
                icon: "fa-tshirt",
                image: "assets/image/ao-nu/thu-dong-nu/TDG1.jpg",
                color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
            },
        ],
        vay: [
            {
                id: "chan-vay",
                name: "Chân váy",
                icon: "fa-tshirt",
                image: "assets/image/vay/chan-vay/cv1.jpg",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
        ],
        "quan-nam": [
            {
                id: "quan-jean-nam",
                name: "Jean Nam",
                icon: "fa-user",
                image: "assets/logo/quannam.JPG",
                color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
        ],
        "phu-kien": [
            {
                id: "non-nam",
                name: "Nón nam",
                icon: "fa-hat-cowboy",
                image: "assets/image/phu-kien/mu/IMG_1236.JPG",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "non-nu",
                name: "Nón nữ",
                icon: "fa-hat-cowboy",
                image: "assets/image/phu-kien/non-nu/NG1.jpg",
                color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
            {
                id: "khan",
                name: "Khăn",
                icon: "fa-scarf",
                image: "assets/logo/tatca.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "no-buoc-toc",
                name: "Nơ Buộc tóc",
                icon: "fa-ribbon",
                image: "assets/image/phu-kien/no-toc/IMG_1182.JPG",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "tat",
                name: "Tất",
                icon: "fa-socks",
                image: "assets/logo/tatca.jpg",
                color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
        ],
    };

    let subcategories = subcategoriesMap[categoryId];

    // Nếu là "all", gom tất cả subcategories từ tất cả categories
    if (categoryId === "all") {
        subcategories = [];
        Object.values(subcategoriesMap).forEach((subcats) => {
            subcategories.push(...subcats);
        });
    }

    if (subcategories && subcategories.length > 0) {
        // Render subcategories in grid format
        const subcategoriesHTML = `
            <div class="mobile-subcategories-grid">
                ${subcategories
                    .map(
                        (sub) => `
                    <div class="mobile-subcategory-item" data-category="${
                        sub.id
                    }" role="button" tabindex="0">
                        <div class="subcategory-image-wrapper">
                            <img 
                                src="${normalizePath(sub.image)}" 
                                alt="${sub.name}"
                                class="subcategory-image"
                                loading="lazy"
                                onerror="this.style.display='none';"
                            >
                        </div>
                        <div class="subcategory-name">${sub.name}</div>
                    </div>
                `
                    )
                    .join("")}
            </div>
        `;

        subcategoriesPanel.innerHTML = subcategoriesHTML;
        subcategoriesPanel.classList.add("active");

        // Add event listeners for subcategory items
        subcategoriesPanel
            .querySelectorAll(".mobile-subcategory-item")
            .forEach((item) => {
                item.addEventListener("click", () => {
                    const subCategory = item.dataset.category;
                    const subCategoryName =
                        subcategories.find((s) => s.id === subCategory)?.name ||
                        "";
                    // Close mobile menu và overlay
                    const mobileCategories =
                        document.getElementById("mobileCategories");
                    const overlay = document.getElementById("mobileOverlay");
                    const mobileMenuBtn =
                        document.getElementById("mobileMenuBtn");

                    if (mobileCategories) {
                        mobileCategories.classList.remove("show");
                        mobileCategories.setAttribute("aria-hidden", "true");
                    }
                    if (overlay) {
                        overlay.classList.remove("show");
                    }
                    if (mobileMenuBtn) {
                        mobileMenuBtn.setAttribute("aria-expanded", "false");
                    }
                    // Select category
                    selectCategory(subCategory, subCategoryName);
                });
                item.addEventListener("keypress", (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        item.click();
                    }
                });
            });
    } else {
        // Hide panel if no subcategories
        subcategoriesPanel.classList.remove("active");
        subcategoriesPanel.innerHTML = "";
    }
}

// Setup event listeners for mobile category buttons
function setupMobileCategoryListeners() {
    const mobileCategoryButtons = document.querySelectorAll(
        ".mobile-categories-list .mobile-category-btn"
    );

    // Categories that don't have subcategories (should close menu and select category)
    const categoriesWithoutSubcategories = ["quan-dai-nu"];

    mobileCategoryButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault(); // Ngăn chặn hành vi mặc định
            const categoryId = btn.dataset.category;
            const categoryName = btn.textContent.trim();

            // Update active state
            mobileCategoryButtons.forEach((b) => {
                b.classList.remove("active");
                b.setAttribute("aria-selected", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");

            // Xử lý đặc biệt cho "Tất cả" - hiển thị tất cả mục con bên phải
            if (categoryId === "all") {
                // Hiển thị tất cả subcategories bên phải
                renderMobileSubcategories(categoryId);
                return;
            }

            // Chỉ hiển thị subcategories panel, KHÔNG mở sản phẩm
            // Chỉ mở sản phẩm khi click vào subcategory
            if (categoriesWithoutSubcategories.includes(categoryId)) {
                // Categories không có subcategories: đóng menu và chọn category
                const subcategoriesPanel = document.getElementById(
                    "mobileSubcategoriesPanel"
                );
                if (subcategoriesPanel) {
                    subcategoriesPanel.classList.remove("active");
                    subcategoriesPanel.innerHTML = "";
                }

                // Close mobile menu và overlay
                const mobileCategories =
                    document.getElementById("mobileCategories");
                const overlay = document.getElementById("mobileOverlay");
                const mobileMenuBtn = document.getElementById("mobileMenuBtn");

                if (mobileCategories) {
                    mobileCategories.classList.remove("show");
                    mobileCategories.setAttribute("aria-hidden", "true");
                }
                if (overlay) {
                    overlay.classList.remove("show");
                }
                if (mobileMenuBtn) {
                    mobileMenuBtn.setAttribute("aria-expanded", "false");
                }

                // Chỉ select category cho các category không có subcategories
                selectCategory(categoryId, categoryName);
            } else {
                // Categories có subcategories: CHỈ hiển thị subcategories panel
                // KHÔNG gọi selectCategory() - chỉ hiển thị panel để user chọn subcategory
                renderMobileSubcategories(categoryId);
            }
        });
    });
}

// ==================== HELPERS ====================
function getPurchaseCount(product) {
    if (product == null) return 0;
    const val = product.purchases;
    if (val === undefined || val === null) {
        return product.bestSeller ? 1 : 0;
    }
    const num = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(num)) return product.bestSeller ? 1 : 0;
    return num;
}

// ==================== HÀM SLIDER ====================
function getBestSellers() {
    const totalTopProducts = 30; // Lấy 30 sản phẩm bán chạy nhất
    const displayProducts = 20; // Hiển thị 20 sản phẩm ngẫu nhiên từ 30 sản phẩm đó

    const sortedByPurchases = [...products].sort((a, b) => {
        const diff = getPurchaseCount(b) - getPurchaseCount(a);
        if (diff !== 0) return diff;
        // Nếu bằng nhau, ưu tiên bestSeller
        return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
    });

    // Lấy 30 sản phẩm bán chạy nhất
    const top30Products = sortedByPurchases.slice(0, totalTopProducts);

    // Shuffle ngẫu nhiên và lấy 20 sản phẩm đầu tiên
    const shuffled = [...top30Products];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, displayProducts);
}

function initSlider() {
    const bestSellers = getBestSellers();
    const sliderTrack = document.getElementById("sliderTrack");
    const sliderDots = document.getElementById("sliderDots");

    if (!sliderTrack || bestSellers.length === 0) return;

    sliderTrack.innerHTML = bestSellers
        .map(
            (product, index) => `
        <div class="slider-item" data-id="${
            product.id
        }" role="listitem" aria-label="Sản phẩm ${getCategoryDisplayName(
                product.category,
                product.categoryName
            )}">
            <div class="image-container">
                ${createOptimizedImageElement(product, index, true)}
            </div>
            <div class="slider-info">
                <div class="slider-price-container">
                    <div class="slider-price">${formatPriceToYen(
                        product.price
                    )}</div>
                    <div class="slider-price-vnd">${
                        formatPriceWithVND(product.price).vnd
                    }</div>
                </div>
                <div class="product-actions">
                    <button 
                       onclick="addToCartById(${product.id}, event);"
                       class="add-to-cart-btn"
                       aria-label="Thêm vào giỏ hàng"
                       type="button">
                        <span class="cart-icon-wrap" aria-hidden="true">
                            <i class="fas fa-shopping-cart"></i>
                            <span class="cart-plus-badge">+</span>
                        </span>
                    </button>
                    <a href="javascript:void(0)" 
                       onclick="openMessengerApp('${escapeMessageForHTML(
                           createMessengerOrderLink(
                               product.name,
                               formatPriceToYen(product.price),
                               getCategoryDisplayName(
                                   product.category,
                                   product.categoryName
                               )
                           )
                       )}'); return false;"
                       class="order-btn"
                       aria-label="Đặt hàng ${getCategoryDisplayName(
                           product.category,
                           product.categoryName
                       )}">
ORDER NGAY
                    </a>
                </div>
            </div>
        </div>
    `
        )
        .join("");

    // Tạo dots
    const totalSlides = Math.ceil(bestSellers.length / itemsPerSlide);
    if (sliderDots) {
        sliderDots.innerHTML = Array.from(
            { length: totalSlides },
            (_, i) =>
                `<div class="dot ${
                    i === 0 ? "active" : ""
                }" data-slide="${i}"></div>`
        ).join("");
    }

    // Gắn sự kiện dots
    document.querySelectorAll(".dot").forEach((dot) => {
        dot.addEventListener("click", () => {
            goToSlide(parseInt(dot.dataset.slide));
        });
    });

    setTimeout(updateSliderWidth, 100);
}

function updateSliderWidth() {
    const sliderTrack = document.getElementById("sliderTrack");
    if (!sliderTrack || !sliderTrack.children.length) return;
    const items = sliderTrack.children;
    const itemWidth = items[0].offsetWidth || 280;
    const gap = 20; // Match CSS gap
    sliderTrack.style.width = `${(itemWidth + gap) * items.length - gap}px`;

    // Recalculate current slide position after resize
    const bestSellers = getBestSellers();
    const maxSlide = Math.ceil(bestSellers.length / itemsPerSlide) - 1;
    if (currentSlide > maxSlide) {
        goToSlide(maxSlide);
    } else {
        goToSlide(currentSlide);
    }
}

function goToSlide(slideIndex) {
    const sliderTrack = document.getElementById("sliderTrack");
    const items = sliderTrack?.children;
    if (!items || !items.length) return;

    const itemWidth = items[0].offsetWidth || 280;
    const gap = 20; // Match CSS gap
    const bestSellers = getBestSellers();
    const maxSlide = Math.ceil(bestSellers.length / itemsPerSlide) - 1;

    // Prevent going out of bounds
    currentSlide = Math.max(0, Math.min(slideIndex, maxSlide));

    // Calculate smooth transition
    const translateX = -currentSlide * (itemWidth + gap) * itemsPerSlide;

    // Add smooth transition class
    sliderTrack.style.transition =
        "transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    sliderTrack.style.transform = `translateX(${translateX}px)`;
    sliderTrack.style.willChange = "transform";

    // Update dots with smooth animation
    document.querySelectorAll(".dot").forEach((dot, index) => {
        const wasActive = dot.classList.contains("active");
        const isActive = index === currentSlide;

        if (wasActive !== isActive) {
            dot.style.transition =
                "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            dot.classList.toggle("active", isActive);
            if (isActive) {
                dot.style.transform = "scale(1.3)";
            } else {
                dot.style.transform = "scale(1)";
            }
        }
    });
}

function nextSlide() {
    const bestSellers = getBestSellers();
    const maxSlide = Math.ceil(bestSellers.length / itemsPerSlide) - 1;
    goToSlide(currentSlide + 1 > maxSlide ? 0 : currentSlide + 1);
}

function prevSlide() {
    const bestSellers = getBestSellers();
    const maxSlide = Math.ceil(bestSellers.length / itemsPerSlide) - 1;
    goToSlide(currentSlide - 1 < 0 ? maxSlide : currentSlide - 1);
}

// ==================== HÀM HIỂN THỊ SẢN PHẨM ====================
function displayProductsPaginated(productsToShow) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    // Đảm bảo productsGrid được hiển thị
    grid.style.display = "grid";

    // Infinite scroll: reset state mỗi lần lọc/tìm kiếm
    currentRenderList = Array.isArray(productsToShow) ? productsToShow : [];
    visibleProductsCount = Math.min(productsPerPage, currentRenderList.length);
    currentPage = 1; // dùng cho 1 số optimization (prefetch) phía dưới

    // Ẩn pagination số
    displayPagination(
        currentRenderList.length,
        Math.ceil(currentRenderList.length / productsPerPage)
    );

    if (currentRenderList.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" role="status" aria-live="polite">
                <i class="fas fa-search" style="font-size: 3rem; color: #FF6B6B; margin-bottom: 15px;" aria-hidden="true"></i>
                <h3 style="color: #333; margin-bottom: 10px; font-size: 1.2rem;">Không tìm thấy sản phẩm</h3>
                <p style="color: #666;">Vui lòng thử từ khóa khác hoặc chọn danh mục khác</p>
            </div>
        `;
        teardownLoadMoreObserver();
        ensureLoadMoreSentinel(false);
    } else {
        // Batch DOM updates for better performance
        requestAnimationFrame(() => {
            const initialProducts = currentRenderList.slice(
                0,
                visibleProductsCount
            );
            grid.innerHTML = initialProducts
                .map((product, index) => renderProductCard(product, index))
                .join("");

            // Observe new product cards for animation after DOM update
            requestAnimationFrame(() => {
                if (scrollObserver) {
                    document
                        .querySelectorAll(".product-card")
                        .forEach((card) => {
                            if (!card.classList.contains("animate-in")) {
                                scrollObserver.observe(card);
                            }
                        });
                }
                applyContentVisibilityHints();
            });

            // Setup infinite scroll sentinel
            setupLoadMoreObserver();

            // Preload batch tiếp theo ngay sau khi render đợt đầu
            if ("requestIdleCallback" in window) {
                requestIdleCallback(() => preloadNextBatchImages(), {
                    timeout: 1500,
                });
            } else {
                setTimeout(() => preloadNextBatchImages(), 300);
            }
        });
    }
}


function renderProductCard(product, index) {
    return `
            <div class="product-card" role="listitem" aria-label="Sản phẩm ${
                product.categoryName
            }" data-index="${index}">
                <div class="image-container">
                    ${createOptimizedImageElement(product, index, false)}
                </div>
                <div class="product-info">
                    <div class="product-price-wrapper">
                        <div class="product-price-container">
                            <div class="product-price">${formatPriceToYen(
                                product.price
                            )}</div>
                            <div class="product-price-vnd">${
                                formatPriceWithVND(product.price).vnd
                            }</div>
                        </div>
                        <div class="product-meta-info">
                            ${
                                product.purchases
                                    ? `<div class="product-purchases">
                                        <i class="fas fa-users" aria-hidden="true"></i>
                                        <span>${product.purchases}+ đã mua</span>
                                    </div>`
                                    : ""
                            }
                            <div class="product-delivery">
                                <i class="fas fa-shipping-fast" aria-hidden="true"></i>
                                <span>7-10 ngày</span>
                            </div>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button 
                           onclick="addToCartById(${product.id}, event);"
                           class="add-to-cart-btn"
                           aria-label="Thêm vào giỏ hàng"
                           type="button">
                            <span class="cart-icon-wrap" aria-hidden="true">
                                <i class="fas fa-shopping-cart"></i>
                                <span class="cart-plus-badge">+</span>
                            </span>
                        </button>
                        <a href="javascript:void(0)" 
                           onclick="openMessengerApp('${escapeMessageForHTML(
                               createMessengerOrderLink(
                                   product.name,
                                   formatPriceToYen(product.price),
                                   getCategoryDisplayName(
                                       product.category,
                                       product.categoryName
                                   )
                               )
                           )}'); return false;"
                           class="order-btn"
                           aria-label="Đặt hàng ${getCategoryDisplayName(
                               product.category,
                               product.categoryName
                           )}">
    ORDER NGAY
                        </a>
                    </div>
                </div>
            </div>
        `;
}

function displayPagination(totalProducts, totalPages) {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    // Bỏ phần số chuyển trang: ẩn hoàn toàn pagination
    pagination.innerHTML = "";
    pagination.style.display = "none";
    return;

    let paginationHTML = "";

    // Nút Previous
    paginationHTML += `
        <button class="page-btn ${currentPage === 1 ? "disabled" : ""}" 
                onclick="changePage(${currentPage - 1})" ${
        currentPage === 1 ? "disabled" : ""
    }>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // Các nút trang
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 ||
            i === totalPages ||
            (i >= currentPage - 1 && i <= currentPage + 1)
        ) {
            paginationHTML += `
                <button class="page-btn ${i === currentPage ? "active" : ""}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            paginationHTML += `<span class="page-dots">...</span>`;
        }
    }

    // Nút Next
    paginationHTML += `
        <button class="page-btn ${
            currentPage === totalPages ? "disabled" : ""
        }" 
                onclick="changePage(${currentPage + 1})" ${
        currentPage === totalPages ? "disabled" : ""
    }>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    // Thêm số lượng sản phẩm
    paginationHTML += `
        <div style="margin-left: 15px; color: #666; font-size: 0.9rem;">
            ${totalProducts} sản phẩm
        </div>
    `;

    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    const filtered = filterProducts();
    const totalPages = Math.ceil(filtered.length / productsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;

    // Scroll to products tabs section immediately (before loading)
    const productsTabs = document.querySelector(".products-tabs");
    if (productsTabs) {
        const tabsPosition =
            productsTabs.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
            top: tabsPosition - 100,
            behavior: "smooth",
        });
    }

    // Không show loading spinner khi chuyển trang - render quá nhanh, không cần thiết
    // (chỉ giữ loading khi load trang đầu tiên)

    displayProductsPaginated(filtered);

    // Ensure scroll position after products are rendered
    requestAnimationFrame(() => {
        const productsTabs = document.querySelector(".products-tabs");
        if (productsTabs) {
            const tabsPosition =
                productsTabs.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
                top: tabsPosition - 100,
                behavior: "smooth",
            });
        }
    });
}

function ensureLoadMoreSentinel(shouldExist = true) {
    const grid = document.getElementById("productsGrid");
    if (!grid) return null;

    // Spinner hiển thị khi đang preload/append
    let spinner = document.getElementById(LOAD_MORE_SPINNER_ID);
    let sentinel = document.getElementById(LOAD_MORE_SENTINEL_ID);
    if (!shouldExist) {
        if (spinner && spinner.parentNode)
            spinner.parentNode.removeChild(spinner);
        if (sentinel && sentinel.parentNode)
            sentinel.parentNode.removeChild(sentinel);
        return null;
    }

    if (!sentinel) {
        if (!spinner) {
            spinner = document.createElement("div");
            spinner.id = LOAD_MORE_SPINNER_ID;
            spinner.className = "load-more-spinner";
            spinner.setAttribute("role", "status");
            spinner.setAttribute("aria-live", "polite");
            spinner.style.display = "none";
            spinner.innerHTML = `
                <div class="spinner-ring" aria-hidden="true"></div>
                <div class="spinner-text">Đang tải thêm sản phẩm...</div>
            `;
            grid.insertAdjacentElement("afterend", spinner);
        }

        sentinel = document.createElement("div");
        sentinel.id = LOAD_MORE_SENTINEL_ID;
        sentinel.setAttribute("aria-hidden", "true");
        sentinel.style.width = "100%";
        sentinel.style.height = "1px";
        sentinel.style.marginTop = "1px";
        // Sentinel luôn nằm sau spinner
        (spinner || grid).insertAdjacentElement("afterend", sentinel);
    }
    return sentinel;
}

function teardownLoadMoreObserver() {
    if (loadMoreObserver) {
        loadMoreObserver.disconnect();
        loadMoreObserver = null;
    }
}

function setupLoadMoreObserver() {
    teardownLoadMoreObserver();
    const sentinel = ensureLoadMoreSentinel(true);
    if (!sentinel) return;

    if (!("IntersectionObserver" in window)) {
        // Fallback: không có IO thì không tự load thêm (tránh nặng scroll handler)
        return;
    }

    loadMoreObserver = new IntersectionObserver(
        (entries) => {
            const entry = entries && entries[0];
            if (!entry || !entry.isIntersecting) return;
            // Trigger sớm để preload trước khi user chạm đáy
            loadMoreIfNeeded();
        },
        { root: null, rootMargin: "1200px 0px", threshold: 0 }
    );

    loadMoreObserver.observe(sentinel);
}

async function loadMoreIfNeeded() {
    if (isLoadingMore) return;
    if (!currentRenderList || currentRenderList.length === 0) return;
    if (visibleProductsCount >= currentRenderList.length) return;

    isLoadingMore = true;
    const spinner = document.getElementById(LOAD_MORE_SPINNER_ID);
    if (spinner) spinner.style.display = "flex";

    // Preload ảnh của batch tiếp theo trước khi append
    try {
        await preloadNextBatchImages();
    } catch (e) {
        // ignore preload errors (network/cache)
    }

    appendMoreProducts();

    if (spinner) spinner.style.display = "none";
    isLoadingMore = false;
}

function getProductImageUrl(product) {
    if (!product || !product.image) return null;
    return normalizePath(product.image);
}

function preloadImages(urls, concurrency = 6) {
    const list = (urls || []).filter(Boolean);
    if (list.length === 0) return Promise.resolve();

    let idx = 0;
    let active = 0;
    let resolved = 0;
    const total = list.length;

    return new Promise((resolve) => {
        const next = () => {
            if (resolved >= total) return resolve();
            while (active < concurrency && idx < total) {
                const url = list[idx++];
                if (!url || preloadedImageUrls.has(url)) {
                    resolved++;
                    continue;
                }
                preloadedImageUrls.add(url);
                active++;
                const img = new Image();
                img.decoding = "async";
                img.onload = img.onerror = () => {
                    active--;
                    resolved++;
                    next();
                };
                img.src = url;
            }
            if (idx >= total && active === 0) resolve();
        };
        next();
    });
}

function preloadNextBatchImages() {
    if (!currentRenderList || currentRenderList.length === 0)
        return Promise.resolve();
    if (visibleProductsCount >= currentRenderList.length)
        return Promise.resolve();

    const start = visibleProductsCount;
    const end = Math.min(start + productsPerPage, currentRenderList.length);
    const batch = currentRenderList.slice(start, end);

    // Chỉ preload một phần ảnh để tránh tốn băng thông quá nhiều
    const urls = batch
        .slice(0, PRELOAD_BATCH_SIZE)
        .map(getProductImageUrl)
        .filter(Boolean);

    // Preload + timeout để không treo UI nếu mạng chậm
    const timeoutMs = 2000;
    return Promise.race([
        preloadImages(urls, 6),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
}

function appendMoreProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    if (!currentRenderList || currentRenderList.length === 0) return;

    if (visibleProductsCount >= currentRenderList.length) {
        teardownLoadMoreObserver();
        return;
    }

    const start = visibleProductsCount;
    const end = Math.min(
        visibleProductsCount + productsPerPage,
        currentRenderList.length
    );
    const more = currentRenderList.slice(start, end);
    const html = more.map((p, i) => renderProductCard(p, start + i)).join("");
    grid.insertAdjacentHTML("beforeend", html);

    visibleProductsCount = end;
    currentPage = Math.floor(visibleProductsCount / productsPerPage);

    // Observe newly added cards
    requestAnimationFrame(() => {
        if (scrollObserver) {
            document.querySelectorAll(".product-card").forEach((card) => {
                if (!card.classList.contains("animate-in")) {
                    scrollObserver.observe(card);
                }
            });
        }
        applyContentVisibilityHints();
    });

    if (visibleProductsCount >= currentRenderList.length) {
        teardownLoadMoreObserver();
    }

    // Sau khi append xong, lên lịch preload batch kế tiếp (khi browser rảnh)
    if (visibleProductsCount < currentRenderList.length) {
        if ("requestIdleCallback" in window) {
            requestIdleCallback(() => preloadNextBatchImages(), {
                timeout: 1500,
            });
        } else {
            setTimeout(() => preloadNextBatchImages(), 300);
        }
    }
}

function applyContentVisibilityHints() {
    // Apply Content Visibility for off-screen items; include newly appended cards too
    if (!("IntersectionObserver" in window)) return;
    const productCards = document.querySelectorAll(".product-card");
    productCards.forEach((card, index) => {
        if (index > 20) {
            card.style.contentVisibility = "auto";
            card.style.containIntrinsicSize = "300px 400px";
        }
    });
}

// ==================== HÀM LỌC & TÌM KIẾM ====================
// Hàm loại bỏ dấu tiếng Việt để tìm kiếm dễ hơn
function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    return str;
}

// Hàm tạo từ khóa tìm kiếm từ sản phẩm
function getProductSearchKeywords(product) {
    if (!product) return "";

    // Nếu sản phẩm đã có keywords (từ JSON), sử dụng luôn để tối ưu hiệu năng
    if (product.keywords) {
        return product.keywords.toLowerCase();
    }

    const keywords = [];

    // Thêm tên sản phẩm
    keywords.push(product.name || "");
    keywords.push(removeVietnameseTones(product.name || ""));

    // Thêm category name
    keywords.push(product.categoryName || "");
    keywords.push(removeVietnameseTones(product.categoryName || ""));

    // Thêm category ID
    keywords.push(product.category || "");

    // Thêm từ khóa liên quan dựa trên category
    const categoryKeywords = {
        "quan-dai-nu": [
            "quần",
            "quan",
            "nữ",
            "nu",
            "dài",
            "dai",
            "cargo",
            "jean",
            "kaki",
            "thun",
            "vải",
            "vai",
            "ống",
            "ong",
            "rộng",
            "rong",
            "ống rộng",
            "ong rong",
            "quần nữ",
            "quan nu",
        ],
        "quan-nam": [
            "quần",
            "quan",
            "nam",
            "dài",
            "dai",
            "cargo",
            "jean",
            "kaki",
            "thun",
            "quần nam",
            "quan nam",
        ],
        "quan-jean-nam": [
            "quần",
            "quan",
            "jean",
            "nam",
            "quần jean",
            "quan jean",
            "jean nam",
        ],
        "ao-nam": [
            "áo",
            "ao",
            "nam",
            "sơ mi",
            "so mi",
            "thun",
            "polo",
            "áo nam",
            "ao nam",
            "áo đông",
            "ao dong",
        ],
        "ao-dong-nam": [
            "áo",
            "ao",
            "đông",
            "dong",
            "nam",
            "áo đông",
            "ao dong",
            "áo khoác",
            "ao khoac",
            "jacket",
            "hoodie",
        ],
        "ao-nu": [
            "áo",
            "ao",
            "nữ",
            "nu",
            "sơ mi",
            "so mi",
            "thun",
            "áo nữ",
            "ao nu",
            "áo đông",
            "ao dong",
        ],
        "ao-dong-nu": [
            "áo",
            "ao",
            "đông",
            "dong",
            "nữ",
            "nu",
            "áo đông",
            "ao dong",
            "áo khoác",
            "ao khoac",
            "jacket",
            "hoodie",
        ],
        "giay-nu": [
            "giày",
            "giay",
            "nữ",
            "nu",
            "dép",
            "dep",
            "giày nữ",
            "giay nu",
            "sneaker",
            "thể thao",
            "the thao",
        ],
        "giay-nam": [
            "giày",
            "giay",
            "nam",
            "dép",
            "dep",
            "giày nam",
            "giay nam",
            "sneaker",
            "thể thao",
            "the thao",
        ],
        "giay-the-thao": [
            "giày",
            "giay",
            "sneaker",
            "thể thao",
            "the thao",
            "nữ",
            "nu",
            "sneaker nữ",
            "sneaker nu",
            "giày thể thao",
            "giay the thao",
            "running",
            "sport",
            "athletic",
        ],
        "giay-sneaker-nam": [
            "giày",
            "giay",
            "sneaker",
            "nam",
            "sneaker nam",
            "thể thao",
            "the thao",
            "giày thể thao",
            "giay the thao",
            "running",
            "sport",
            "athletic",
        ],
        "boot-nu": [
            "boot",
            "bốt",
            "bot",
            "nữ",
            "nu",
            "boot nữ",
            "boot nu",
            "bốt nữ",
            "bot nu",
            "giày boot",
            "giay boot",
        ],
        "tui-xach": [
            "túi",
            "tui",
            "xách",
            "xach",
            "túi xách",
            "tui xach",
            "bag",
            "handbag",
            "backpack",
            "balo",
        ],
        "tui-xach-nam": [
            "túi",
            "tui",
            "xách",
            "xach",
            "nam",
            "túi nam",
            "tui nam",
            "túi xách nam",
            "tui xach nam",
            "bag",
            "backpack",
            "balo",
            "briefcase",
        ],
        "tui-xach-nu": [
            "túi",
            "tui",
            "xách",
            "xach",
            "nữ",
            "nu",
            "túi nữ",
            "tui nu",
            "túi xách nữ",
            "tui xach nu",
            "bag",
            "handbag",
            "purse",
            "clutch",
        ],
        "phu-kien": ["phụ kiện", "phu kien", "accessories", "accessory"],
        non: [
            "nón",
            "non",
            "mũ",
            "mu",
            "cap",
            "hat",
            "nón lưỡi trai",
            "non luoi trai",
            "baseball cap",
        ],
        khan: [
            "khăn",
            "khan",
            "scarf",
            "khăn quàng",
            "khan quang",
            "khăn choàng",
            "khan choang",
        ],
        "no-buoc-toc": [
            "nơ",
            "no",
            "buộc tóc",
            "buoc toc",
            "hair",
            "hair accessory",
            "hair tie",
            "ribbon",
            "bow",
        ],
        tat: [
            "tất",
            "tat",
            "vớ",
            "vo",
            "socks",
            "stockings",
            "tất dài",
            "tat dai",
            "tất ngắn",
            "tat ngan",
        ],
        vay: [
            "váy",
            "vay",
            "đầm",
            "dam",
            "váy đầm",
            "vay dam",
            "dress",
            "skirt",
        ],
        "chan-vay": [
            "chân",
            "chan",
            "váy",
            "vay",
            "chân váy",
            "chan vay",
            "skirt",
            "mini skirt",
            "maxi skirt",
        ],
        "set-do-nu": [
            "set",
            "đồ",
            "do",
            "nữ",
            "nu",
            "set đồ",
            "set do",
            "bộ",
            "bo",
            "outfit",
            "combo",
        ],
    };

    const relatedKeywords = categoryKeywords[product.category] || [];
    keywords.push(...relatedKeywords);

    // Tách từ trong tên sản phẩm
    const nameWords = (product.name || "").toLowerCase().split(/\s+/);
    keywords.push(...nameWords);
    keywords.push(...nameWords.map((w) => removeVietnameseTones(w)));

    // Loại bỏ các từ quá ngắn và trùng lặp
    const uniqueKeywords = [...new Set(keywords)]
        .filter((k) => k && k.length > 1)
        .join(" ");

    return uniqueKeywords.toLowerCase();
}

// Hàm kiểm tra sản phẩm có khớp với từ khóa tìm kiếm không
function productMatchesSearch(product, searchQuery) {
    if (!searchQuery) return true;

    const query = removeVietnameseTones(searchQuery.toLowerCase().trim());
    const searchKeywords = getProductSearchKeywords(product);

    // Tìm kiếm trong tất cả từ khóa
    if (searchKeywords.includes(query)) return true;

    // Tìm kiếm từng từ trong query
    const queryWords = query.split(/\s+/).filter((w) => w.length > 1);
    if (queryWords.length > 0) {
        const allWordsMatch = queryWords.every((word) =>
            searchKeywords.includes(word)
        );
        if (allWordsMatch) return true;
    }

    // Tìm kiếm một phần của từ
    if (query.length >= 2) {
        const searchableText = searchKeywords;
        if (searchableText.includes(query)) return true;
    }

    return false;
}

function filterProducts() {
    // KHÔNG show loading spinner trong filterProducts() vì:
    // - Nó được gọi từ nhiều nơi (search, category change, page change)
    // - Loading spinner nên được show ở các hàm gọi filterProducts() khi cần
    // - Tránh hiển thị loading mỗi khi nhấn space trong search box

    let filtered = products;
    if (currentCategory !== "all") {
        // Xử lý subcategories của Túi xách
        if (currentCategory === "tui-xach") {
            // Hiển thị tất cả túi xách (cả nam và nữ)
            filtered = filtered.filter(
                (p) =>
                    p.category === "tui-xach" ||
                    p.category === "tui-xach-nam" ||
                    p.category === "tui-xach-nu"
            );
        } else if (currentCategory === "vay") {
            // Hiển thị tất cả váy (bao gồm chân váy)
            filtered = filtered.filter(
                (p) => p.category === "vay" || p.category === "chan-vay"
            );
        } else if (currentCategory === "ao-nu") {
            // Hiển thị tất cả áo nữ (bao gồm áo khoác đông nữ và thu đông nữ)
            filtered = filtered.filter(
                (p) =>
                    p.category === "ao-nu" ||
                    p.category === "ao-dong-nu" ||
                    p.category === "ao-thu-dong"
            );
        } else if (currentCategory === "ao-nam") {
            // Hiển thị tất cả áo nam (bao gồm áo đông nam)
            filtered = filtered.filter(
                (p) => p.category === "ao-nam" || p.category === "ao-dong-nam"
            );
        } else if (currentCategory === "set-do") {
            // Hiển thị tất cả sét đồ (bao gồm sét đồ nữ và sét đồ nam)
            filtered = filtered.filter(
                (p) => p.category === "set-do-nu" || p.category === "set-do-nam"
            );
        } else if (currentCategory === "giay") {
            // Hiển thị tất cả giày (bao gồm giày nam, giày nữ, boot nữ và giày sneaker)
            filtered = filtered.filter(
                (p) =>
                    p.category === "giay-nu" ||
                    p.category === "giay-nam" ||
                    p.category === "boot-nu" ||
                    p.category === "giay-the-thao" ||
                    p.category === "giay-sneaker-nam"
            );
        } else if (currentCategory === "phu-kien") {
            // Hiển thị tất cả phụ kiện (bao gồm nón, khăn, nơ buộc tóc, tất)
            filtered = filtered.filter(
                (p) =>
                    p.category === "phu-kien" ||
                    p.category === "non" ||
                    p.category === "khan" ||
                    p.category === "no-buoc-toc" ||
                    p.category === "tat"
            );
        } else if (currentCategory === "quan-nam") {
            // Hiển thị tất cả quần nam (bao gồm quần jean nam)
            filtered = filtered.filter(
                (p) =>
                    p.category === "quan-nam" || p.category === "quan-jean-nam"
            );
        } else {
            filtered = filtered.filter((p) => p.category === currentCategory);
        }
    }

    // Apply tab filter if active
    const activeTab = document.querySelector(".tab-btn.active");
    let activeTabName = "all";
    if (activeTab) {
        const tab = activeTab.dataset.tab;
        activeTabName = tab;
        if (tab === "hot") {
            filtered = [...filtered]
                .sort((a, b) => {
                    const diff = getPurchaseCount(b) - getPurchaseCount(a);
                    if (diff !== 0) return diff;
                    return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
                })
                .slice(0, Math.min(filtered.length, 30));
        } else if (tab === "trending") {
            // Sản phẩm xu hướng - lấy top 30 sản phẩm bán chạy nhất, sau đó shuffle ngẫu nhiên
            filtered = [...filtered]
                .sort((a, b) => {
                    const diff = getPurchaseCount(b) - getPurchaseCount(a);
                    if (diff !== 0) return diff;
                    return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
                })
                .slice(0, Math.min(filtered.length, 30))
                .sort(() => Math.random() - 0.5); // Shuffle ngẫu nhiên
        } else if (tab === "recommended") {
            // Shuffle and take top products
            filtered = [...filtered]
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.min(filtered.length, 30));
        }
    }

    // Shuffle ngẫu nhiên khi ở tab "Tất cả" và danh mục "all" - sử dụng seed cố định
    if (currentCategory === "all" && activeTabName === "all") {
        const seed = getShuffleSeed();
        filtered = seededShuffle(filtered, seed);
    }

    // Khi chọn danh mục (không phải "all") và tab là "all", sắp xếp lẫn lộn nhưng ưu tiên sản phẩm bán chạy
    if (currentCategory !== "all" && activeTabName === "all") {
        // Tách thành 2 nhóm: sản phẩm bán chạy và sản phẩm khác
        const hotProducts = [];
        const otherProducts = [];

        filtered.forEach((product) => {
            const purchaseCount = getPurchaseCount(product);
            // Sản phẩm bán chạy: có bestSeller = true hoặc purchaseCount >= 100
            if (product.bestSeller || purchaseCount >= 100) {
                hotProducts.push(product);
            } else {
                otherProducts.push(product);
            }
        });

        // Shuffle mỗi nhóm ngẫu nhiên
        const shuffledHot = [...hotProducts].sort(() => Math.random() - 0.5);
        const shuffledOther = [...otherProducts].sort(
            () => Math.random() - 0.5
        );

        // Ghép lại: nhóm bán chạy ở trước, nhóm khác ở sau
        filtered = [...shuffledHot, ...shuffledOther];
    }

    if (searchQuery)
        filtered = filtered.filter((p) => productMatchesSearch(p, searchQuery));
    currentPage = 1;

    // Update ARIA live region
    const grid = document.getElementById("productsGrid");
    if (grid) {
        grid.setAttribute(
            "aria-label",
            `Danh sách ${filtered.length} sản phẩm`
        );
    }

    // Hiển thị products grid
    const productsGrid = document.getElementById("productsGrid");
    if (productsGrid) productsGrid.style.display = "grid";
    displayProductsPaginated(filtered);

    // Không cần hide loading spinner vì không show loading khi filter/search
    // (loading spinner chỉ hiển thị khi load trang đầu tiên)

    return filtered;
}

function handleSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    const newQuery = searchInput.value.trim();

    // Bỏ qua nếu query không thay đổi (sau khi trim)
    if (newQuery === searchQuery) return;

    // Bỏ qua nếu query chỉ là khoảng trắng hoặc rỗng và query cũ cũng rỗng
    if (!newQuery && !searchQuery) return;

    searchQuery = newQuery;

    const filtered = filterProducts();

    // Cập nhật hiển thị nút quay lại
    updateBackButton();

    // Sau khi tìm kiếm xong: nếu đang ở phía trên khu vực sản phẩm,
    // tự cuộn xuống để hiển thị từ phần tab trở xuống.
    setTimeout(() => {
        const productsTabs =
            document.getElementById("productsTabs") ||
            document.querySelector(".products-tabs");
        if (!productsTabs) return;

        const rect = productsTabs.getBoundingClientRect();
        // Chỉ kéo xuống nếu tabs còn nằm phía dưới (tránh kéo ngược lên khi user đang xem sản phẩm)
        if (rect.top > 120) {
            const targetTop = rect.top + window.pageYOffset - 10;
            window.scrollTo({ top: targetTop, behavior: "smooth" });
        }
    }, 120);

    // Đã tắt thông báo khi tìm kiếm
}

// ==================== PRODUCT IMAGE GALLERY ====================
let currentGalleryImages = [];
let currentGalleryIndex = 0;
let currentGalleryProductId = null;
let galleryZoomLevel = 1;
let panX = 0;
let panY = 0;

function getProductImages(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) return [];

    // Nếu có mảng images, dùng nó (chỉ trả về ảnh thực tế)
    if (
        product.images &&
        Array.isArray(product.images) &&
        product.images.length > 0
    ) {
        return product.images; // Trả về tất cả ảnh thực tế, không giới hạn
    }

    // Nếu không có mảng images, chỉ trả về ảnh chính của sản phẩm
    // Không tạo thêm ảnh giả để tránh hiển thị ảnh không liên quan
    if (product.image) {
        return [product.image];
    }

    // Nếu không có ảnh nào, trả về mảng rỗng
    return [];
}

function openProductGallery(productId, imageIndex = 0) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    currentGalleryImages = getProductImages(productId);
    currentGalleryProductId = productId; // Store current product ID
    if (currentGalleryImages.length === 0) {
        // Đã tắt thông báo
        return;
    }

    currentGalleryIndex = Math.max(
        0,
        Math.min(imageIndex, currentGalleryImages.length - 1)
    );
    galleryZoomLevel = 1;
    panX = 0;
    panY = 0;

    const modal = document.getElementById("productGalleryModal");
    const mainImage = document.getElementById("galleryMainImage");
    const productName = document.getElementById("galleryProductName");
    const productPrice = document.getElementById("galleryProductPrice");
    const currentIndexSpan = document.getElementById("galleryCurrentIndex");
    const totalImagesSpan = document.getElementById("galleryTotalImages");
    const thumbnailsContainer = document.getElementById("galleryThumbnails");
    const orderBtn = document.getElementById("galleryOrderBtn");
    const addToCartBtn = document.getElementById("galleryAddToCartBtn");

    if (!modal || !mainImage) return;

    // Set product info
    if (productName) productName.textContent = product.name;
    if (productPrice) {
        const priceData = formatPriceWithVND(product.price);
        productPrice.innerHTML = `
            <span class="gallery-price-yen">${priceData.yen}</span>
            <span class="gallery-price-vnd">${priceData.vnd}</span>
        `;
    }
    if (currentIndexSpan)
        currentIndexSpan.textContent = currentGalleryIndex + 1;
    if (totalImagesSpan)
        totalImagesSpan.textContent = currentGalleryImages.length;

    // Set order button link
    if (orderBtn) {
        const message = createMessengerOrderLink(
            product.name,
            formatPriceToYen(product.price),
            getCategoryDisplayName(product.category, product.categoryName)
        );
        orderBtn.href = "javascript:void(0)";
        orderBtn.onclick = function (e) {
            e.preventDefault();
            openMessengerApp(message);
            return false;
        };
    }

    // Set add-to-cart button
    if (addToCartBtn) {
        addToCartBtn.onclick = function (e) {
            e.preventDefault();
            addToCartById(productId, e);
            return false;
        };
    }

    // Handle video if product has video - show video first instead of image
    const mainVideo = document.getElementById("galleryMainVideo");
    const mainVideoIframe = document.getElementById("galleryMainVideoIframe");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const videoToggle = document.getElementById("galleryVideoToggle");

    if (product.video && videoContainer && videoPlayOverlay) {
        const videoUrl = normalizePath(product.video);
        const isYouTube = isYouTubeUrl(videoUrl);

        // Show video container, hide image
        videoContainer.style.display = "flex";
        mainImage.style.display = "none";
        // Show play overlay for regular videos only, hide for YouTube
        if (isYouTube) {
            // Hide play overlay for YouTube - YouTube has its own controls
            videoPlayOverlay.classList.remove("youtube-style");
            videoPlayOverlay.style.display = "none";
        } else {
            // Show play overlay for regular videos
            videoPlayOverlay.classList.remove("youtube-style");
            videoPlayOverlay.style.display = "flex";
        }

        if (isYouTube) {
            // Handle YouTube video with iframe
            if (mainVideoIframe) {
                // Hide regular video element, show iframe
                if (mainVideo) mainVideo.style.display = "none";
                // Load iframe without autoplay to show thumbnail
                mainVideoIframe.style.display = "block";

                // Load iframe with autoplay=0 to show thumbnail
                const embedUrl = convertToYouTubeEmbed(videoUrl, false);
                mainVideoIframe.src = embedUrl;
                mainVideoIframe._embedUrl = embedUrl;

                // KHÔNG sử dụng message listener để tránh CAPTCHA
                // YouTube sẽ tự xử lý video playback mà không cần enablejsapi
                // Người dùng có thể click vào video để phát trực tiếp

                // Also setup click handler on iframe container to show iframe when play button is clicked
                // This is handled in handlePlayVideo function
            }
        } else {
            // Handle regular video file with video element
            if (mainVideo) {
                // Hide iframe, show video element
                if (mainVideoIframe) mainVideoIframe.style.display = "none";
                mainVideo.style.display = "block";

                // Set video source and poster (first image as thumbnail)
                mainVideo.src = videoUrl;
                mainVideo.poster = normalizePath(currentGalleryImages[0]);
                mainVideo.controls = false; // Hide controls initially
                mainVideo.muted = false; // Ensure video is not muted so sound plays

                // Also allow clicking on video to play
                mainVideo.onclick = function (e) {
                    e.stopPropagation();
                    if (mainVideo.paused) {
                        playVideo();
                    }
                };

                // Hide play overlay when video starts playing
                mainVideo.addEventListener("play", function () {
                    videoPlayOverlay.style.display = "none";
                    mainVideo.controls = true;
                });

                // Don't show play overlay for regular videos - use native controls
                mainVideo.addEventListener("pause", function () {
                    videoPlayOverlay.style.display = "none";
                    mainVideo.controls = true;
                });

                // Don't show play overlay when video ends
                mainVideo.addEventListener("ended", function () {
                    videoPlayOverlay.style.display = "none";
                    mainVideo.controls = true;
                    mainVideo.currentTime = 0;
                });

                // Limit video playback to 10 seconds maximum (only for regular videos, not YouTube)
                mainVideo.addEventListener("timeupdate", function () {
                    if (mainVideo.currentTime >= 10) {
                        mainVideo.pause();
                        mainVideo.currentTime = 0;
                        if (videoPlayOverlay) {
                            videoPlayOverlay.style.display = "none";
                        }
                        mainVideo.controls = true;
                    }
                });
            }
        }

        // Show toggle button to switch back to image
        if (videoToggle) {
            videoToggle.style.display = "flex";
            videoToggle.innerHTML =
                '<i class="fas fa-image" aria-hidden="true"></i><span>Xem ảnh</span>';
            videoToggle.onclick = function (e) {
                e.stopPropagation();
                switchToImage();
            };
        }

        // Function to handle video play (used for both click and touch)
        // Store original videoUrl in closure to use when playing
        const handlePlayVideo = function (e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (isYouTube && mainVideoIframe) {
                // Show iframe and load video with autoplay
                mainVideoIframe.style.display = "block";
                // Create URL without autoplay (user clicked play, video will play when clicked)
                const autoplayUrl = convertToYouTubeEmbed(
                    videoUrl,
                    false,
                    false
                );
                mainVideoIframe.src = autoplayUrl;
                // Hide overlay to show video
                videoPlayOverlay.style.display = "none";

                // KHÔNG sử dụng postMessage để tránh CAPTCHA
                // Dựa vào autoplay parameter trong embed URL
                // Nếu autoplay không hoạt động, người dùng có thể click vào video
            } else {
                playVideo();
            }
        };

        // Add both click and touch event handlers for mobile compatibility
        // Now works for both YouTube and regular videos
        videoPlayOverlay.onclick = handlePlayVideo;
        videoPlayOverlay.ontouchstart = function (e) {
            e.preventDefault();
            e.stopPropagation();
            handlePlayVideo(e);
        };
    } else {
        // No video - show image normally
        mainImage.src = normalizePath(
            currentGalleryImages[currentGalleryIndex]
        );
        mainImage.style.transform = "scale(1)";
        mainImage.style.transformOrigin = "center center";
        mainImage.classList.remove("zoomed");
        mainImage.style.display = "block";

        if (videoContainer) videoContainer.style.display = "none";
        if (videoToggle) videoToggle.style.display = "none";
    }

    // Create thumbnails
    if (thumbnailsContainer) {
        thumbnailsContainer.innerHTML = currentGalleryImages
            .map(
                (img, index) => `
                <div class="gallery-thumbnail ${
                    index === currentGalleryIndex ? "active" : ""
                }" 
                     data-index="${index}"
                     onclick="goToGalleryImage(${index})">
                    <img src="${normalizePath(img)}" 
                         alt="Ảnh ${index + 1}" 
                         onerror="this.parentElement.style.display='none';" />
                    <div class="thumbnail-overlay"></div>
                </div>
            `
            )
            .join("");
    }

    // Show modal
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
}

function closeProductGallery() {
    const modal = document.getElementById("productGalleryModal");
    if (modal) {
        modal.classList.remove("show");
        document.body.style.overflow = "";
        galleryZoomLevel = 1;
        panX = 0;
        panY = 0;
        currentGalleryProductId = null;
        const mainImage = document.getElementById("galleryMainImage");
        const mainVideo = document.getElementById("galleryMainVideo");
        const videoContainer = document.getElementById("galleryVideoContainer");
        const videoPlayOverlay = document.getElementById(
            "galleryVideoPlayOverlay"
        );
        const mainImageWrapper = document.querySelector(
            ".gallery-main-image-wrapper"
        );
        if (mainImage) {
            mainImage.style.transform = "scale(1)";
            mainImage.style.transformOrigin = "center center";
            mainImage.classList.remove("zoomed");
            mainImage.style.display = "block";
        }
        if (mainVideo) {
            mainVideo.pause();
            mainVideo.currentTime = 0;
            mainVideo.controls = false;
        }
        const mainVideoIframe = document.getElementById(
            "galleryMainVideoIframe"
        );
        if (mainVideoIframe) {
            const currentSrc = mainVideoIframe.src;
            if (currentSrc) {
                mainVideoIframe.src = currentSrc
                    .replace(/[?&]autoplay=1/g, "")
                    .replace("autoplay=1", "");
            }
        }
        if (videoContainer) {
            videoContainer.style.display = "none";
        }
        // Don't show overlay when closing - it will be set correctly when opening gallery again
        if (videoPlayOverlay) {
            videoPlayOverlay.style.display = "none";
        }
        if (mainImageWrapper) {
            mainImageWrapper.classList.remove("panning");
        }
    }
}

function goToGalleryImage(index) {
    if (index < 0 || index >= currentGalleryImages.length) return;

    currentGalleryIndex = index;
    galleryZoomLevel = 1;
    panX = 0;
    panY = 0;

    const mainImage = document.getElementById("galleryMainImage");
    const mainVideo = document.getElementById("galleryMainVideo");
    const mainVideoIframe = document.getElementById("galleryMainVideoIframe");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const mainImageWrapper = document.querySelector(
        ".gallery-main-image-wrapper"
    );
    const currentIndexSpan = document.getElementById("galleryCurrentIndex");
    const thumbnails = document.querySelectorAll(".gallery-thumbnail");

    // Reset video if showing
    if (videoContainer && videoContainer.style.display !== "none") {
        if (mainVideo) {
            mainVideo.pause();
            mainVideo.currentTime = 0;
            mainVideo.controls = true;
        }
        if (mainVideoIframe) {
            const currentSrc = mainVideoIframe.src;
            if (currentSrc) {
                mainVideoIframe.src = currentSrc
                    .replace(/[?&]autoplay=1/g, "")
                    .replace("autoplay=1", "");
            }
        }
        // Only show play overlay for YouTube, hide for regular videos
        if (videoPlayOverlay) {
            const currentProduct = currentGalleryProductId
                ? products.find((p) => p.id === currentGalleryProductId)
                : null;
            if (currentProduct && currentProduct.video) {
                const videoUrl = normalizePath(currentProduct.video);
                const isYouTube = isYouTubeUrl(videoUrl);
                if (isYouTube) {
                    videoPlayOverlay.style.display = "none";
                } else {
                    videoPlayOverlay.style.display = "flex";
                }
            }
        }
    }

    // Get current product to check if it has video
    const currentProduct = currentGalleryProductId
        ? products.find((p) => p.id === currentGalleryProductId)
        : null;

    // If switching to first image (index 0) and product has video, show video
    if (index === 0 && currentProduct && currentProduct.video) {
        const videoUrl = normalizePath(currentProduct.video);
        const isYouTube = isYouTubeUrl(videoUrl);

        // Show video container
        if (videoContainer) {
            videoContainer.style.display = "flex";
            mainImage.style.display = "none";

            if (isYouTube && mainVideoIframe) {
                // Show YouTube iframe with thumbnail (no autoplay)
                if (mainVideo) mainVideo.style.display = "none";
                mainVideoIframe.style.display = "block";
                const embedUrl = convertToYouTubeEmbed(videoUrl, false);
                mainVideoIframe.src = embedUrl;
                mainVideoIframe._embedUrl = embedUrl;
                // Hide play overlay for YouTube - YouTube has its own controls
                if (videoPlayOverlay) {
                    videoPlayOverlay.classList.remove("youtube-style");
                    videoPlayOverlay.style.display = "none";
                }
            } else if (mainVideo) {
                // Show regular video
                if (mainVideoIframe) mainVideoIframe.style.display = "none";
                mainVideo.style.display = "block";
                mainVideo.poster = normalizePath(currentGalleryImages[0]);
                mainVideo.pause();
                mainVideo.currentTime = 0;
                mainVideo.controls = true;
                // Hide play overlay for regular videos - use native controls
                if (videoPlayOverlay) {
                    videoPlayOverlay.classList.remove("youtube-style");
                    videoPlayOverlay.style.display = "none";
                }
            }
        }
        if (mainImage) mainImage.style.display = "none";
    } else {
        // Show image for other indices
        if (videoContainer) videoContainer.style.display = "none";
        if (mainVideo) {
            mainVideo.pause();
            mainVideo.currentTime = 0;
            mainVideo.controls = false;
        }
        if (videoPlayOverlay) videoPlayOverlay.style.display = "none";

        if (mainImage) {
            mainImage.style.opacity = "0";
            setTimeout(() => {
                mainImage.src = normalizePath(
                    currentGalleryImages[currentGalleryIndex]
                );
                mainImage.style.transform = "scale(1)";
                mainImage.style.transformOrigin = "center center";
                mainImage.style.opacity = "1";
                mainImage.classList.remove("zoomed");
                mainImage.style.display = "block";
            }, 150);
        }
    }

    if (mainImageWrapper) {
        mainImageWrapper.classList.remove("panning");
    }

    if (currentIndexSpan) {
        currentIndexSpan.textContent = currentGalleryIndex + 1;
    }

    // Update thumbnails
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle("active", i === currentGalleryIndex);
    });
}

// Helper function to detect if URL is YouTube
function isYouTubeUrl(url) {
    if (!url) return false;
    return /youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=/.test(
        url
    );
}

// Helper function to convert YouTube URL to embed format
function convertToYouTubeEmbed(url, autoplay = false, mute = false) {
    if (!url) return url;

    // Extract video ID from various YouTube URL formats
    let videoId = null;

    // youtube.com/embed/VIDEO_ID hoặc youtube-nocookie.com/embed/VIDEO_ID
    const embedMatch = url.match(
        /youtube(?:-nocookie)?\.com\/embed\/([^?&#]+)/
    );
    if (embedMatch) {
        videoId = embedMatch[1];
    }
    // youtu.be/VIDEO_ID
    else {
        const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
        if (shortMatch) {
            videoId = shortMatch[1];
        }
        // youtube.com/watch?v=VIDEO_ID
        else {
            const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
            if (watchMatch) {
                videoId = watchMatch[1];
            }
        }
    }

    if (videoId) {
        // Tối thiểu hóa params để tránh YouTube CAPTCHA và yêu cầu đăng nhập
        // Chỉ sử dụng các tham số cơ bản nhất, không dùng enablejsapi
        // Sử dụng youtube-nocookie.com để tránh yêu cầu cookie/login
        const params = new URLSearchParams({
            autoplay: autoplay ? "1" : "0",
            mute: mute ? "1" : "0",
            rel: "0", // Không hiển thị video liên quan
            controls: "1", // Hiển thị controls
            playsinline: "1", // Cho phép phát inline trên mobile
        });
        
        // KHÔNG sử dụng enablejsapi=1 để tránh CAPTCHA
        // KHÔNG sử dụng modestbranding để tránh nghi ngờ
        // KHÔNG sử dụng origin parameter
        // KHÔNG sử dụng postMessage để tránh bị phát hiện

        // Sử dụng youtube-nocookie.com để tránh yêu cầu đăng nhập
        // Đây là chế độ privacy-enhanced của YouTube, không yêu cầu cookie/login
        return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    }

    return url;
}

// Hàm tryForceYouTubeQuality đã bị loại bỏ để tránh CAPTCHA
// Không sử dụng postMessage để điều khiển YouTube video
// YouTube sẽ tự động điều chỉnh chất lượng phù hợp

// Play video
function playVideo() {
    const mainVideo = document.getElementById("galleryMainVideo");
    const mainVideoIframe = document.getElementById("galleryMainVideoIframe");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");

    // Check if it's YouTube (iframe) or regular video
    if (mainVideoIframe && mainVideoIframe.style.display !== "none") {
        // YouTube iframe - get the original video URL from current product
        // This ensures we play the correct video for this product
        const currentProduct = currentGalleryProductId
            ? products.find((p) => p.id === currentGalleryProductId)
            : null;

        if (currentProduct && currentProduct.video) {
            const productVideoUrl = normalizePath(currentProduct.video);
            const isYouTube = isYouTubeUrl(productVideoUrl);
            if (isYouTube) {
                const newUrl = convertToYouTubeEmbed(
                    productVideoUrl,
                    false,
                    false
                );
                mainVideoIframe.src = newUrl;
                if (videoPlayOverlay) videoPlayOverlay.style.display = "none";

                // KHÔNG sử dụng postMessage để tránh CAPTCHA
                // Dựa vào autoplay parameter trong embed URL
                // Nếu autoplay không hoạt động, người dùng có thể click vào video
            }
        }
    } else if (mainVideo) {
        // Regular video element - ensure it's unmuted before playing
        mainVideo.muted = false;
        mainVideo.play().catch((err) => {
            console.error("Error playing video:", err);
        });
    }
}

// Switch from video to image
function switchToImage() {
    const mainImage = document.getElementById("galleryMainImage");
    const mainVideo = document.getElementById("galleryMainVideo");
    const mainVideoIframe = document.getElementById("galleryMainVideoIframe");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const videoToggle = document.getElementById("galleryVideoToggle");

    if (!mainImage || !videoContainer) return;

    // Get current product
    const currentProduct = currentGalleryProductId
        ? products.find((p) => p.id === currentGalleryProductId)
        : null;

    // Pause and reset video (regular video element)
    if (mainVideo) {
        mainVideo.pause();
        mainVideo.currentTime = 0;
        mainVideo.controls = false;
        mainVideo.style.display = "none";
    }

    // Hide YouTube iframe
    if (mainVideoIframe) {
        mainVideoIframe.style.display = "none";
    }

    // Hide play overlay
    if (videoPlayOverlay) {
        videoPlayOverlay.style.display = "none";
    }

    // Hide video container, show image
    videoContainer.style.display = "none";

    // Ensure we have images to show
    if (currentGalleryImages && currentGalleryImages.length > 0) {
        // Make sure index is valid
        const imageIndex = Math.max(
            0,
            Math.min(currentGalleryIndex, currentGalleryImages.length - 1)
        );
        mainImage.src = normalizePath(currentGalleryImages[imageIndex]);
        mainImage.style.display = "block";
        mainImage.style.transform = "scale(1)";
        mainImage.style.transformOrigin = "center center";
        mainImage.style.opacity = "1";
        mainImage.classList.remove("zoomed");
    } else {
        // If no images, try to get product image
        if (currentProduct && currentProduct.image) {
            mainImage.src = normalizePath(currentProduct.image);
            mainImage.style.display = "block";
            mainImage.style.transform = "scale(1)";
            mainImage.style.transformOrigin = "center center";
            mainImage.style.opacity = "1";
            mainImage.classList.remove("zoomed");
        }
    }

    // Update toggle button - only show if product has video
    if (videoToggle) {
        if (currentProduct && currentProduct.video) {
            videoToggle.style.display = "flex";
            videoToggle.innerHTML =
                '<i class="fas fa-video" aria-hidden="true"></i><span>Xem video</span>';
            videoToggle.onclick = function (e) {
                e.stopPropagation();
                switchToVideo();
            };
        } else {
            videoToggle.style.display = "none";
        }
    }
}

// Switch from image to video
function switchToVideo() {
    const mainImage = document.getElementById("galleryMainImage");
    const mainVideo = document.getElementById("galleryMainVideo");
    const mainVideoIframe = document.getElementById("galleryMainVideoIframe");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const videoToggle = document.getElementById("galleryVideoToggle");

    if (!mainImage || !videoContainer) return;

    // Get current product to check video type
    const currentProduct = currentGalleryProductId
        ? products.find((p) => p.id === currentGalleryProductId)
        : null;

    if (!currentProduct || !currentProduct.video) {
        // No video available, don't switch
        return;
    }

    const videoUrl = normalizePath(currentProduct.video);
    const isYouTube = isYouTubeUrl(videoUrl);

    // Hide image, show video container
    mainImage.style.display = "none";
    videoContainer.style.display = "flex";

    if (isYouTube && mainVideoIframe) {
        // Show YouTube iframe with thumbnail (no autoplay)
        if (mainVideo) mainVideo.style.display = "none";
        mainVideoIframe.style.display = "block";
        const embedUrl = convertToYouTubeEmbed(videoUrl, false);
        mainVideoIframe.src = embedUrl;
        mainVideoIframe._embedUrl = embedUrl;
        // Hide play overlay for YouTube - YouTube has its own controls
        if (videoPlayOverlay) {
            videoPlayOverlay.classList.remove("youtube-style");
            videoPlayOverlay.style.display = "none";
        }
    } else if (mainVideo) {
        // Show regular video
        if (mainVideoIframe) mainVideoIframe.style.display = "none";
        mainVideo.style.display = "block";
        mainVideo.src = videoUrl;
        mainVideo.poster = normalizePath(
            currentGalleryImages && currentGalleryImages.length > 0
                ? currentGalleryImages[0]
                : currentProduct.image
        );
        mainVideo.pause();
        mainVideo.currentTime = 0;
        mainVideo.controls = true;
        // Hide play overlay for regular videos - use native controls
        if (videoPlayOverlay) {
            videoPlayOverlay.classList.remove("youtube-style");
            videoPlayOverlay.style.display = "none";
        }
    }

    // Update toggle button
    if (videoToggle) {
        videoToggle.style.display = "flex";
        videoToggle.innerHTML =
            '<i class="fas fa-image" aria-hidden="true"></i><span>Xem ảnh</span>';
        videoToggle.onclick = function (e) {
            e.stopPropagation();
            switchToImage();
        };
    }
}

function nextGalleryImage() {
    const nextIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
    goToGalleryImage(nextIndex);
}

function prevGalleryImage() {
    const prevIndex =
        (currentGalleryIndex - 1 + currentGalleryImages.length) %
        currentGalleryImages.length;
    goToGalleryImage(prevIndex);
}

function zoomGalleryImage(direction) {
    const mainImage = document.getElementById("galleryMainImage");
    if (!mainImage) return;

    if (direction === "in") {
        galleryZoomLevel = Math.min(galleryZoomLevel + 0.25, 5);
    } else if (direction === "out") {
        galleryZoomLevel = Math.max(galleryZoomLevel - 0.25, 1);
    } else if (direction === "reset") {
        galleryZoomLevel = 1;
        panX = 0;
        panY = 0;
    }

    if (galleryZoomLevel <= 1) {
        panX = 0;
        panY = 0;
        mainImage.style.transform = "scale(1)";
        mainImage.classList.remove("zoomed");
    } else {
        mainImage.style.transform = `scale(${galleryZoomLevel}) translate(${
            panX / galleryZoomLevel
        }px, ${panY / galleryZoomLevel}px)`;
        mainImage.classList.add("zoomed");
    }

    mainImage.style.transition = "transform 0.3s ease";
}

// Initialize gallery event listeners
function initProductGallery() {
    // Click on product images
    document.addEventListener("click", (e) => {
        if (
            e.target.classList.contains("product-image") ||
            e.target.classList.contains("slider-img")
        ) {
            const productId = parseInt(
                e.target.getAttribute("data-product-id")
            );
            if (productId) {
                openProductGallery(productId, 0);
            }
        }
    });

    // Gallery controls
    document
        .querySelector(".gallery-close-btn")
        ?.addEventListener("click", closeProductGallery);
    document
        .querySelector(".gallery-next")
        ?.addEventListener("click", nextGalleryImage);
    document
        .querySelector(".gallery-prev")
        ?.addEventListener("click", prevGalleryImage);
    document
        .getElementById("galleryZoomIn")
        ?.addEventListener("click", () => zoomGalleryImage("in"));
    document
        .getElementById("galleryZoomOut")
        ?.addEventListener("click", () => zoomGalleryImage("out"));
    document
        .getElementById("galleryZoomReset")
        ?.addEventListener("click", () => zoomGalleryImage("reset"));

    // Close on overlay click
    document
        .querySelector(".gallery-modal-overlay")
        ?.addEventListener("click", closeProductGallery);

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
        const modal = document.getElementById("productGalleryModal");
        if (!modal || !modal.classList.contains("show")) return;

        if (e.key === "Escape") {
            closeProductGallery();
        } else if (e.key === "ArrowLeft") {
            prevGalleryImage();
        } else if (e.key === "ArrowRight") {
            nextGalleryImage();
        } else if (e.key === "+" || e.key === "=") {
            zoomGalleryImage("in");
        } else if (e.key === "-") {
            zoomGalleryImage("out");
        }
    });

    // Pinch-to-zoom and pan for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    let initialDistance = 0;
    let initialZoom = 1;
    let isPinching = false;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let lastTouchTime = 0;

    const mainImageWrapper = document.querySelector(
        ".gallery-main-image-wrapper"
    );
    const mainImage = document.getElementById("galleryMainImage");

    // Calculate distance between two touch points
    function getDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate center point between two touches
    function getCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
        };
    }

    if (mainImageWrapper && mainImage) {
        // Touch start
        mainImageWrapper.addEventListener(
            "touchstart",
            (e) => {
                const touches = e.touches;

                if (touches.length === 1) {
                    // Single touch - prepare for swipe or pan
                    touchStartX = touches[0].clientX;
                    touchStartY = touches[0].clientY;
                    panStartX = panX;
                    panStartY = panY;

                    // Double tap to zoom
                    const currentTime = Date.now();
                    const timeDiff = currentTime - lastTouchTime;
                    if (timeDiff < 300 && timeDiff > 0) {
                        // Double tap detected
                        if (galleryZoomLevel === 1) {
                            galleryZoomLevel = 2;
                            panX = 0;
                            panY = 0;
                        } else {
                            galleryZoomLevel = 1;
                            panX = 0;
                            panY = 0;
                        }
                        updateImageTransform();
                        e.preventDefault();
                    }
                    lastTouchTime = currentTime;

                    if (galleryZoomLevel > 1) {
                        isPanning = true;
                        mainImageWrapper.classList.add("panning");
                    }
                } else if (touches.length === 2) {
                    // Two touches - pinch to zoom
                    isPinching = true;
                    isPanning = false;
                    initialDistance = getDistance(touches[0], touches[1]);
                    initialZoom = galleryZoomLevel;

                    const center = getCenter(touches[0], touches[1]);
                    const rect = mainImageWrapper.getBoundingClientRect();
                    const centerX = center.x - rect.left - rect.width / 2;
                    const centerY = center.y - rect.top - rect.height / 2;

                    // Set transform origin to pinch center
                    mainImage.style.transformOrigin = `${center.x}px ${center.y}px`;

                    e.preventDefault();
                }
            },
            { passive: false }
        );

        // Touch move
        mainImageWrapper.addEventListener(
            "touchmove",
            (e) => {
                const touches = e.touches;

                if (touches.length === 2 && isPinching) {
                    // Pinch zoom
                    const currentDistance = getDistance(touches[0], touches[1]);
                    const scale = currentDistance / initialDistance;
                    galleryZoomLevel = Math.max(
                        1,
                        Math.min(initialZoom * scale, 5)
                    );

                    updateImageTransform();
                    e.preventDefault();
                } else if (
                    touches.length === 1 &&
                    isPanning &&
                    galleryZoomLevel > 1
                ) {
                    // Pan when zoomed
                    const deltaX = touches[0].clientX - touchStartX;
                    const deltaY = touches[0].clientY - touchStartY;

                    panX = panStartX + deltaX;
                    panY = panStartY + deltaY;

                    // Limit pan to image bounds
                    const rect = mainImage.getBoundingClientRect();
                    const maxPanX =
                        (rect.width * galleryZoomLevel - rect.width) / 2;
                    const maxPanY =
                        (rect.height * galleryZoomLevel - rect.height) / 2;

                    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
                    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));

                    updateImageTransform();
                    e.preventDefault();
                }
            },
            { passive: false }
        );

        // Touch end
        mainImageWrapper.addEventListener(
            "touchend",
            (e) => {
                const touches = e.changedTouches;

                if (isPinching && touches.length < 2) {
                    // Pinch ended
                    isPinching = false;
                    mainImage.style.transformOrigin = "center center";

                    // Reset pan if zoomed out to 1
                    if (galleryZoomLevel <= 1) {
                        galleryZoomLevel = 1;
                        panX = 0;
                        panY = 0;
                        updateImageTransform();
                    }
                }

                if (isPanning && touches.length === 0) {
                    // Pan ended - check for swipe
                    touchEndX = touchStartX;
                    touchEndY = touchStartY;

                    if (e.changedTouches.length > 0) {
                        touchEndX = e.changedTouches[0].clientX;
                        touchEndY = e.changedTouches[0].clientY;
                    }

                    const diffX = touchStartX - touchEndX;
                    const diffY = touchStartY - touchEndY;

                    // Only swipe if not zoomed or if horizontal swipe is much larger than vertical
                    if (
                        galleryZoomLevel === 1 &&
                        Math.abs(diffX) > 50 &&
                        Math.abs(diffX) > Math.abs(diffY) * 1.5
                    ) {
                        if (diffX > 0) {
                            nextGalleryImage();
                        } else {
                            prevGalleryImage();
                        }
                    }

                    // Close on swipe down when not zoomed
                    if (
                        galleryZoomLevel === 1 &&
                        diffY > 100 &&
                        Math.abs(diffY) > Math.abs(diffX) * 1.5
                    ) {
                        closeProductGallery();
                    }

                    isPanning = false;
                    mainImageWrapper.classList.remove("panning");
                }
            },
            { passive: true }
        );
    }

    // Update image transform
    function updateImageTransform() {
        if (!mainImage) return;

        if (galleryZoomLevel > 1) {
            mainImage.style.transform = `scale(${galleryZoomLevel}) translate(${
                panX / galleryZoomLevel
            }px, ${panY / galleryZoomLevel}px)`;
            mainImage.classList.add("zoomed");
            mainImage.style.transition = "none";
        } else {
            mainImage.style.transform = "scale(1)";
            mainImage.classList.remove("zoomed");
            mainImage.style.transition =
                "transform 0.3s ease, opacity 0.3s ease";
        }
    }

    // Mouse drag for desktop
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let currentX = 0;
    let currentY = 0;
    const mainImageDesktop = document.getElementById("galleryMainImage");

    if (mainImageDesktop) {
        mainImageDesktop.addEventListener("mousedown", (e) => {
            if (galleryZoomLevel > 1) {
                isDragging = true;
                dragStartX = e.clientX - currentX;
                dragStartY = e.clientY - currentY;
                mainImageDesktop.style.cursor = "grabbing";
                mainImageDesktop.classList.add("panning");
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging && galleryZoomLevel > 1) {
                e.preventDefault();
                currentX = e.clientX - dragStartX;
                currentY = e.clientY - dragStartY;
                panX = currentX;
                panY = currentY;

                // Limit pan to image bounds
                const rect = mainImageDesktop.getBoundingClientRect();
                const maxPanX =
                    (rect.width * galleryZoomLevel - rect.width) / 2;
                const maxPanY =
                    (rect.height * galleryZoomLevel - rect.height) / 2;

                panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
                panY = Math.max(-maxPanY, Math.min(maxPanY, panY));

                mainImageDesktop.style.transform = `scale(${galleryZoomLevel}) translate(${
                    panX / galleryZoomLevel
                }px, ${panY / galleryZoomLevel}px)`;
                mainImageDesktop.style.transition = "none";
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                mainImageDesktop.style.cursor =
                    galleryZoomLevel > 1 ? "grab" : "move";
                mainImageDesktop.style.transition = "transform 0.3s ease";
                mainImageDesktop.classList.remove("panning");
            }
        });
    }
}

// ==================== GẮN SỰ KIỆN ====================
function setupEventListeners() {
    // Mobile menu
    document
        .querySelector(".mobile-menu-btn")
        ?.addEventListener("click", toggleMobileMenu);
    document
        .querySelector(".close-mobile-menu")
        ?.addEventListener("click", toggleMobileMenu);

    // Category indicator click - mở menu chọn danh mục
    const categoryIndicator = document.getElementById("currentCategory");
    if (categoryIndicator) {
        const openCategoryMenu = () => {
            // Mở mobile categories menu để chọn danh mục
            toggleMobileMenu();
        };

        categoryIndicator.addEventListener("click", openCategoryMenu);
        categoryIndicator.addEventListener("keypress", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCategoryMenu();
            }
        });
        categoryIndicator.style.cursor = "pointer";
    }

    // Dropdown - Removed (using mobile menu instead)
    // const categoryToggleBtn = document.getElementById("categoryToggleBtn");
    // if (categoryToggleBtn) {
    //     categoryToggleBtn.addEventListener("click", toggleCategoryDropdown);
    // }

    // Category selection - bao gồm cả category-item trong categories section
    // LƯU Ý: .mobile-category-btn trong mobile menu đã có event listener riêng trong setupMobileCategoryListeners()
    // Nên chỉ gắn event listener cho .category-option và .category-item (KHÔNG gắn cho .mobile-category-btn)
    document
        .querySelectorAll(".category-option, .category-item")
        .forEach((btn) => {
            // Bỏ qua nếu là mobile-category-btn (đã có handler riêng trong setupMobileCategoryListeners)
            if (btn.classList.contains("mobile-category-btn")) {
                return;
            }

            btn.setAttribute("role", "button");
            btn.setAttribute("tabindex", "0");
            btn.setAttribute(
                "aria-selected",
                btn.classList.contains("active") ? "true" : "false"
            );

            const handleCategoryClick = (e) => {
                const category = btn.dataset.category;
                if (!category) return;

                // Định nghĩa subcategoryMap ở ngoài để có thể dùng ở nhiều nơi
                const subcategoryMap = {
                    "tui-xach": {
                        btnId: "tuiXachBtn",
                        subId: "tuiXachSubcategories",
                    },
                    "quan-dai-nu": {
                        btnId: "quanDaiNuBtn",
                        subId: "quanDaiNuSubcategories",
                    },
                    "quan-nam": {
                        btnId: "quanNamBtn",
                        subId: "quanNamSubcategories",
                    },
                    "ao-nu": {
                        btnId: "aoNuBtn",
                        subId: "aoNuSubcategories",
                    },
                    giay: {
                        btnId: "giayBtn",
                        subId: "giaySubcategories",
                    },
                    vay: {
                        btnId: "vayBtn",
                        subId: "vaySubcategories",
                    },
                    "phu-kien": {
                        btnId: "phuKienBtn",
                        subId: "phuKienSubcategories",
                    },
                    "ao-nam": {
                        btnId: "aoNamBtn",
                        subId: "aoNamSubcategories",
                    },
                    "set-do": {
                        btnId: "setDoBtn",
                        subId: "setDoSubcategories",
                    },
                };

                // Kiểm tra nếu button này có subcategory arrow (là button chính có subcategories)
                const arrow = btn.querySelector(".subcategory-arrow");
                if (arrow) {
                    e.preventDefault();
                    e.stopPropagation();

                    const subInfo = subcategoryMap[category];
                    if (subInfo) {
                        const subcategories = document.getElementById(
                            subInfo.subId
                        );
                        if (subcategories) {
                            const isVisible =
                                subcategories.style.display !== "none" &&
                                subcategories.style.display !== "";

                            // Đóng tất cả subcategories khác trước
                            Object.values(subcategoryMap).forEach(
                                (otherSubInfo) => {
                                    if (otherSubInfo.subId !== subInfo.subId) {
                                        const otherSubcategories =
                                            document.getElementById(
                                                otherSubInfo.subId
                                            );
                                        if (otherSubcategories) {
                                            otherSubcategories.style.display =
                                                "none";
                                            const otherParentBtn =
                                                document.getElementById(
                                                    otherSubInfo.btnId
                                                );
                                            if (otherParentBtn) {
                                                const otherArrow =
                                                    otherParentBtn.querySelector(
                                                        ".subcategory-arrow"
                                                    );
                                                if (otherArrow) {
                                                    otherArrow.style.transform =
                                                        "rotate(0deg)";
                                                }
                                            }
                                        }
                                    }
                                }
                            );

                            // Toggle subcategory hiện tại
                            subcategories.style.display = isVisible
                                ? "none"
                                : "block";
                            arrow.style.transform = isVisible
                                ? "rotate(0deg)"
                                : "rotate(90deg)";
                            return; // Không filter, chỉ toggle subcategories
                        }
                    }
                }

                let categoryName = "";

                const categoryNames = {
                    all: "Tất cả thời trang",
                    "quan-dai-nu": "Quần Nữ",
                    "quan-nam": "Quần Nam",
                    "quan-jean-nam": "Jean Nam",
                    "tui-xach": "Túi xách",
                    "tui-xach-nam": "Túi xách nam",
                    "tui-xach-nu": "Túi xách nữ",
                    giay: "Giày",
                    "giay-nu": "Giày nữ",
                    "giay-nam": "Giày Nam",
                    "ao-nam": "Áo Nam",
                    "ao-dong-nam": "Áo đông nam",
                    "giay-sneaker-nam": "Sneaker Nam",
                    "boot-nu": "Boot nữ",
                    "giay-the-thao": "Sneaker Nữ",
                    "set-do": "Sét Đồ",
                    "set-do-nu": "Sét Đồ Nữ",
                    "set-do-nam": "Sét Đồ Nam",
                    "phu-kien": "Phụ Kiện",
                    non: "Mũ",
                    khan: "Khăn",
                    "no-buoc-toc": "Nơ Buộc tóc",
                    tat: "Tất",
                };

                categoryName = categoryNames[category] || "Thời trang";

                // Đóng tất cả subcategories khi chọn category
                Object.values(subcategoryMap).forEach((subInfo) => {
                    const subcategories = document.getElementById(
                        subInfo.subId
                    );
                    if (subcategories) {
                        subcategories.style.display = "none";
                        const parentBtn = document.getElementById(
                            subInfo.btnId
                        );
                        if (parentBtn) {
                            const arrow =
                                parentBtn.querySelector(".subcategory-arrow");
                            if (arrow) {
                                arrow.style.transform = "rotate(0deg)";
                            }
                        }
                    }
                });

                // Luôn chọn category trực tiếp - hiển thị tất cả sản phẩm của category đó
                // Không hiển thị subcategories panel
                selectCategory(category, categoryName);

                // Scroll to products nếu là category-item (từ categories section)
                if (btn.classList.contains("category-item")) {
                    setTimeout(() => {
                        document
                            .querySelector(".products-section")
                            ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                            });
                    }, 100);
                }
            };

            btn.addEventListener("click", handleCategoryClick);
            btn.addEventListener("keypress", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCategoryClick();
                }
            });
        });

    // Tabs handling - TAOBAO STYLE
    const tabButtons = document.querySelectorAll(".tab-btn");
    let currentTab = "all";

    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            currentTab = tab;

            // Update active state
            tabButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            // Filter products based on tab
            let filtered = products;

            // Nếu tab là "all", luôn hiển thị tất cả sản phẩm (bỏ qua category filter)
            if (tab === "all") {
                // Hiển thị tất cả sản phẩm, không filter theo category
                filtered = products;
            } else if (currentCategory !== "all") {
                // Nếu tab khác "all", vẫn filter theo category hiện tại
                if (currentCategory === "tui-xach") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "tui-xach" ||
                            p.category === "tui-xach-nam" ||
                            p.category === "tui-xach-nu"
                    );
                } else if (currentCategory === "vay") {
                    filtered = filtered.filter(
                        (p) => p.category === "vay" || p.category === "chan-vay"
                    );
                } else if (currentCategory === "ao-nu") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "ao-nu" ||
                            p.category === "ao-dong-nu" ||
                            p.category === "ao-thu-dong"
                    );
                } else if (currentCategory === "ao-nam") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "ao-nam" ||
                            p.category === "ao-dong-nam"
                    );
                } else if (currentCategory === "set-do") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "set-do-nu" ||
                            p.category === "set-do-nam"
                    );
                } else if (currentCategory === "giay-nu") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "giay-nu" ||
                            p.category === "boot-nu" ||
                            p.category === "giay-the-thao"
                    );
                } else if (currentCategory === "giay-nam") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "giay-nam" ||
                            p.category === "giay-sneaker-nam"
                    );
                } else {
                    filtered = filtered.filter(
                        (p) => p.category === currentCategory
                    );
                }
            }

            // Apply tab filter
            if (tab === "hot") {
                filtered = [...filtered]
                    .sort((a, b) => {
                        const diff = getPurchaseCount(b) - getPurchaseCount(a);
                        if (diff !== 0) return diff;
                        return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
                    })
                    .slice(0, Math.min(filtered.length, 30));
            } else if (tab === "trending") {
                // Sản phẩm xu hướng - lấy top 30 sản phẩm bán chạy nhất, sau đó shuffle ngẫu nhiên
                filtered = [...filtered]
                    .sort((a, b) => {
                        const diff = getPurchaseCount(b) - getPurchaseCount(a);
                        if (diff !== 0) return diff;
                        return (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0);
                    })
                    .slice(0, Math.min(filtered.length, 30))
                    .sort(() => Math.random() - 0.5); // Shuffle ngẫu nhiên
            } else if (tab === "recommended") {
                // Shuffle and take top products
                filtered = [...filtered]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Math.min(filtered.length, 30));
            } else if (tab === "all") {
                // Shuffle ngẫu nhiên với seed cố định cho tab "Tất cả"
                const seed = getShuffleSeed();
                filtered = seededShuffle(filtered, seed);
            }

            // Apply search if any
            if (searchQuery) {
                filtered = filtered.filter((p) =>
                    productMatchesSearch(p, searchQuery)
                );
            }

            currentPage = 1;

            // Hiển thị products grid
            const productsGrid = document.getElementById("productsGrid");
            if (productsGrid) productsGrid.style.display = "grid";
            displayProductsPaginated(filtered);

            // Khi đang lướt giữa danh sách mà bấm tab:
            // render lại và cuộn về đầu danh sách (ngay dưới thanh tabs) để xem từ trên xuống.
            requestAnimationFrame(() => {
                try {
                    const tabs =
                        document.getElementById("productsTabs") ||
                        document.querySelector(".products-tabs");
                    const grid = document.getElementById("productsGrid");
                    if (!tabs && !grid) return;

                    const tabsTopCss = tabs
                        ? Number.parseFloat(getComputedStyle(tabs).top) || 0
                        : 0;
                    const tabsHeight = tabs ? tabs.offsetHeight || 0 : 0;
                    const offset = tabsTopCss + tabsHeight + 10;

                    const targetEl = grid || tabs;
                    const targetTop =
                        targetEl.getBoundingClientRect().top +
                        window.pageYOffset -
                        offset;

                    window.scrollTo({
                        top: Math.max(0, targetTop),
                        behavior: "smooth",
                    });
                } catch (e) {
                    // ignore
                }
            });
        });
    });

    // Đóng dropdown khi click ra ngoài
    document.addEventListener("click", function (e) {
        const dropdown = document.getElementById("categoriesDropdown");
        const toggleBtn = document.getElementById("categoryToggleBtn");
        if (
            dropdown &&
            toggleBtn &&
            !toggleBtn.contains(e.target) &&
            !dropdown.contains(e.target)
        ) {
            dropdown.classList.remove("show");
            toggleBtn.classList.remove("active");
            const arrow = toggleBtn.querySelector(".toggle-arrow");
            if (arrow) arrow.style.transform = "rotate(0deg)";
        }
    });

    // Search
    let searchTimeout;
    const searchInput = document.getElementById("searchInput");
    const searchClearBtn = document.getElementById("searchClearBtn");

    // Function to toggle clear button visibility
    function toggleClearButton() {
        if (searchInput && searchClearBtn) {
            if (searchInput.value.trim().length > 0) {
                searchClearBtn.style.display = "flex";
            } else {
                searchClearBtn.style.display = "none";
            }
        }
    }

    // Clear button click handler
    searchClearBtn?.addEventListener("click", function () {
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
            toggleClearButton();
            // Clear search immediately
            searchQuery = "";
            const filtered = filterProducts();
            updateBackButton();
        }
    });

    document
        .getElementById("searchBtn")
        ?.addEventListener("click", handleSearch);

    // Xử lý Enter key để tìm kiếm (hỗ trợ cả keypress và keydown)
    const searchInputElement = document.getElementById("searchInput");
    if (searchInputElement) {
        // keypress cho desktop
        searchInputElement.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
            }
        });

        // keydown cho mobile (một số thiết bị mobile không trigger keypress)
        searchInputElement.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.keyCode === 13) {
                e.preventDefault();
                handleSearch();
                // Ẩn bàn phím trên mobile sau khi search
                if (window.innerWidth < 768) {
                    searchInputElement.blur();
                }
            }
        });
    }
    document
        .getElementById("searchInput")
        ?.addEventListener("input", function (e) {
            toggleClearButton();
            clearTimeout(searchTimeout);
            // Debounce search với delay 500ms, nhưng chỉ search khi có nội dung thực sự
            const currentValue = e.target.value.trim();
            if (currentValue || searchQuery) {
                // Chỉ search nếu có text hoặc đang clear search
                searchTimeout = setTimeout(handleSearch, 500);
            } else {
                // Nếu đang xóa hết, reset ngay lập tức không cần debounce
                searchQuery = "";
                const filtered = filterProducts();
                updateBackButton();
            }
        });

    // Initialize clear button visibility on page load
    toggleClearButton();

    // Slider controls
    document.querySelector(".next-btn")?.addEventListener("click", nextSlide);
    document.querySelector(".prev-btn")?.addEventListener("click", prevSlide);

    // Auto slide with smooth transition
    let slideInterval = setInterval(() => {
        nextSlide();
    }, 2000); // 2 seconds for faster slide transition

    const sliderContainer = document.querySelector(".slider-container");
    if (sliderContainer) {
        sliderContainer.addEventListener("mouseenter", () => {
            clearInterval(slideInterval);
        });
        sliderContainer.addEventListener("mouseleave", () => {
            clearInterval(slideInterval);
            slideInterval = setInterval(() => {
                nextSlide();
            }, 2000);
        });
    }

    // Resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateSliderWidth, 250);
    });

    // Touch support
    if ("ontouchstart" in window) {
        document
            .querySelectorAll(
                ".order-btn, .page-btn, .mobile-menu-btn, .category-option, .mobile-category-btn"
            )
            .forEach((btn) => {
                btn.style.cursor = "pointer";
            });

        // Touch slider
        const sliderTrack = document.getElementById("sliderTrack");
        if (sliderTrack) {
            let touchStartX = 0;
            let touchEndX = 0;

            sliderTrack.addEventListener("touchstart", (e) => {
                touchStartX = e.changedTouches[0].screenX;
                clearInterval(slideInterval);
            });

            sliderTrack.addEventListener("touchend", (e) => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchStartX - touchEndX > 50) nextSlide();
                if (touchEndX - touchStartX > 50) prevSlide();
                slideInterval = setInterval(nextSlide, 2000);
            });
        }
    }
}

// ==================== KHỞI ĐỘNG ỨNG DỤNG ====================
document.addEventListener("DOMContentLoaded", function () {
    // Load cart ngay lập tức để đảm bảo không mất khi reload
    loadCart();

    // Tạo overlay
    createOverlay();

    // Xử lý ảnh loading
    document
        .querySelectorAll("img.product-image, img.slider-img")
        .forEach((img) => {
            if (!img.complete || img.naturalHeight === 0) {
                img.classList.add("image-loading");
            }
            img.addEventListener("error", () => handleImageError(img));
        });

    // Khởi tạo app
    initializeApp();

    // ==================== DISABLE iOS PINCH/DOUBLE-TAP ZOOM (theo yêu cầu) ====================
    // Lưu ý: iOS Safari/PWA vẫn có thể zoom bằng gesture ngay cả khi chỉ "lướt".
    // Chặn gesture events để tránh phóng to ngoài ý muốn.
    try {
        // Pinch zoom on iOS (Safari)
        ["gesturestart", "gesturechange", "gestureend"].forEach((evt) => {
            document.addEventListener(
                evt,
                (e) => {
                    e.preventDefault();
                },
                { passive: false }
            );
        });

        // Double-tap zoom (một số trường hợp)
        let lastTouchEnd = 0;
        document.addEventListener(
            "touchend",
            (e) => {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            },
            { passive: false }
        );
    } catch (e) {
        // ignore
    }

    // Initialize modern features
    initThemeToggle();
    initIntersectionObserver();
    initPerformanceOptimizations();
    initPWAInstall();
    initShareAPI();

    // Thêm CSS cho page dots và skeleton - ULTRA OPTIMIZED
    const style = document.createElement("style");
    style.textContent = `
        .page-dots {
            padding: 0 10px;
            color: #666;
            display: flex;
            align-items: center;
            user-select: none;
        }
        
        @keyframes fadeIn {
            from { 
                opacity: 0; 
                transform: translateY(10px) translateZ(0); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) translateZ(0); 
            }
        }
        
        .product-card, .slider-item {
            animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            will-change: transform, opacity;
        }
        
        .skeleton-card {
            pointer-events: none;
            contain: layout style paint;
        }
        
        .skeleton-card .product-info {
            padding: 20px;
        }
        
        /* Optimize rendering performance */
        .products-grid {
            contain: layout style;
        }
        
        .slider-track {
            contain: layout style paint;
        }
    `;
    document.head.appendChild(style);
});

// ==================== THEME TOGGLE ====================
function initThemeToggle() {
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");

    if (!themeToggle || !themeIcon) return;

    const updateThemeIcon = (theme) => {
        themeIcon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    };

    const toggleTheme = () => {
        const currentTheme =
            document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        updateThemeIcon(newTheme);

        // Animate theme transition
        document.body.style.transition =
            "background-color 0.3s ease, color 0.3s ease";
    };

    themeToggle.addEventListener("click", toggleTheme);

    // Initialize icon
    const currentTheme = document.documentElement.getAttribute("data-theme");
    updateThemeIcon(currentTheme);

    // Listen for system theme changes
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
            if (!localStorage.getItem("theme")) {
                const theme = e.matches ? "dark" : "light";
                document.documentElement.setAttribute("data-theme", theme);
                updateThemeIcon(theme);
            }
        });
}

// ==================== INTERSECTION OBSERVER ====================
function initIntersectionObserver() {
    // Scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
    };

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("animate-in");
                scrollObserver?.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements with animation class
    document
        .querySelectorAll(".product-card, .slider-item, .section-header")
        .forEach((el) => {
            scrollObserver.observe(el);
        });

    // Lazy load images with Intersection Observer - Ultra Optimized version
    if ("IntersectionObserver" in window) {
        // Sử dụng Performance Observer để tối ưu
        const imageLoadQueue = [];
        let isProcessingQueue = false;

        const processImageQueue = () => {
            if (isProcessingQueue || imageLoadQueue.length === 0) return;
            isProcessingQueue = true;

            requestAnimationFrame(() => {
                const batch = imageLoadQueue.splice(0, 5); // Load 5 ảnh mỗi frame
                batch.forEach((img) => {
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute("data-src");
                    }
                    img.classList.remove("image-loading");
                    img.classList.add("image-loaded");
                    imageObserver?.unobserve(img);
                });
                isProcessingQueue = false;
                if (imageLoadQueue.length > 0) {
                    processImageQueue();
                }
            });
        };

        imageObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        // Thêm vào queue để load theo batch
                        if (!imageLoadQueue.includes(img)) {
                            imageLoadQueue.push(img);
                        }
                        processImageQueue();
                    }
                });
            },
            {
                rootMargin: "150px", // Load sớm hơn cho trải nghiệm mượt
                threshold: 0.01,
            }
        );

        // Observe all images with data-src
        document.querySelectorAll("img[data-src]").forEach((img) => {
            imageObserver.observe(img);
        });

        // Observe lazy-loaded images và picture elements
        document
            .querySelectorAll("img[loading='lazy'], picture img")
            .forEach((img) => {
                if (!img.complete && !img.dataset.src) {
                    imageObserver.observe(img);
                }
            });

        // Preload images trong viewport ngay lập tức
        requestIdleCallback(
            () => {
                document
                    .querySelectorAll(
                        "img[loading='eager'], img[fetchpriority='high']"
                    )
                    .forEach((img) => {
                        if (img.tagName === "IMG" && img.src && !img.complete) {
                            const link = document.createElement("link");
                            link.rel = "preload";
                            link.as = "image";
                            link.href = img.src;
                            if (img.srcset)
                                link.setAttribute("imagesrcset", img.srcset);
                            if (img.sizes)
                                link.setAttribute("imagesizes", img.sizes);
                            document.head.appendChild(link);
                        }
                    });
            },
            { timeout: 1000 }
        );
    }
}

// ==================== PERFORMANCE OPTIMIZATIONS - ULTRA MODERN ====================
function initPerformanceOptimizations() {
    // Use requestIdleCallback for non-critical tasks
    if ("requestIdleCallback" in window) {
        requestIdleCallback(
            () => {
                // Preload next page images
                preloadNextPageImages();
                // Prefetch likely next resources
                prefetchLikelyResources();
            },
            { timeout: 2000 }
        );
    }

    // Ultra-smooth scroll with RAF and passive listeners
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollEffects = () => {
        const currentScrollY = window.scrollY;
        // Update scroll-to-top button
        const scrollToTopBtn = document.getElementById("scrollToTop");
        if (scrollToTopBtn) {
            if (currentScrollY > 300) {
                scrollToTopBtn.style.display = "flex";
            } else {
                scrollToTopBtn.style.display = "none";
            }
        }

        // Update header on scroll (optional: add shrink effect)
        const header = document.querySelector(".header");
        if (header && currentScrollY > 50) {
            header.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.15)";
        } else if (header) {
            header.style.boxShadow =
                "0 4px 20px rgba(255, 102, 0, 0.3), 0 2px 10px rgba(0, 0, 0, 0.2)";
        }

        // When products tabs are sticky, move Facebook button down to avoid overlap
        try {
            const tabs =
                document.getElementById("productsTabs") ||
                document.querySelector(".products-tabs");
            if (tabs) {
                const rect = tabs.getBoundingClientRect();
                const cs = window.getComputedStyle(tabs);
                const topCss = Number.parseFloat(cs.top) || 0;
                // Tabs được coi là stuck khi top của nó <= top CSS value (thường là 0)
                const stuck = rect.top <= topCss + 2; // Thêm 2px để đảm bảo detect đúng

                document.documentElement.classList.toggle("tabs-stuck", stuck);
                if (stuck) {
                    // Set CSS variables để đẩy nút Facebook xuống
                    document.documentElement.style.setProperty(
                        "--tabs-sticky-top",
                        `${topCss}px`
                    );
                    document.documentElement.style.setProperty(
                        "--tabs-sticky-height",
                        `${tabs.offsetHeight || 0}px`
                    );
                } else {
                    // Reset khi tabs không stuck
                    document.documentElement.style.removeProperty("--tabs-sticky-top");
                    document.documentElement.style.removeProperty("--tabs-sticky-height");
                }
            } else {
                document.documentElement.classList.remove("tabs-stuck");
                document.documentElement.style.removeProperty("--tabs-sticky-top");
                document.documentElement.style.removeProperty("--tabs-sticky-height");
            }
        } catch (e) {
            // ignore
        }

        lastScrollY = currentScrollY;
        ticking = false;
    };

    window.addEventListener(
        "scroll",
        () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollEffects);
                ticking = true;
            }
        },
        { passive: true }
    );
    
    // Chạy ngay khi trang load để kiểm tra tabs có stuck không
    window.addEventListener("load", () => {
        // Delay nhỏ để đảm bảo layout đã render xong
        setTimeout(() => {
            updateScrollEffects();
        }, 100);
    });
    
    // Chạy ngay sau khi DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            // Delay nhỏ để đảm bảo layout đã render xong
            setTimeout(() => {
                updateScrollEffects();
            }, 100);
        });
    } else {
        // Delay nhỏ để đảm bảo layout đã render xong
        setTimeout(() => {
            updateScrollEffects();
        }, 100);
    }
    
    // Chạy lại sau khi resize để đảm bảo tính toán đúng
    window.addEventListener("resize", () => {
        setTimeout(() => {
            updateScrollEffects();
        }, 150);
    });

    // Optimize resize events with debounce
    let resizeTimeout;
    const handleResize = () => {
        // Recalculate layouts if needed
        if (scrollObserver) {
            // Re-observe elements after resize
            document
                .querySelectorAll(".product-card, .slider-item")
                .forEach((el) => {
                    if (!el.classList.contains("animate-in")) {
                        scrollObserver.observe(el);
                    }
                });
        }
    };

    window.addEventListener(
        "resize",
        () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                requestAnimationFrame(handleResize);
            }, 150);
        },
        { passive: true }
    );

    // Optimize touch events for mobile
    let touchStartY = 0;
    document.addEventListener(
        "touchstart",
        (e) => {
            touchStartY = e.touches[0].clientY;
        },
        { passive: true }
    );

    // Preload critical resources
    if ("requestIdleCallback" in window) {
        requestIdleCallback(
            () => {
                // Preconnect to likely external resources
                const preconnectDomains = [
                    "https://www.facebook.com",
                    "https://www.messenger.com",
                ];
                preconnectDomains.forEach((domain) => {
                    const link = document.createElement("link");
                    link.rel = "preconnect";
                    link.href = domain;
                    document.head.appendChild(link);
                });
            },
            { timeout: 3000 }
        );
    }

    // Use Content Visibility API for better rendering performance
    if ("IntersectionObserver" in window && "requestIdleCallback" in window) {
        requestIdleCallback(
            () => {
                const productCards = document.querySelectorAll(".product-card");
                productCards.forEach((card, index) => {
                    // Set content-visibility for off-screen items
                    if (index > 20) {
                        card.style.contentVisibility = "auto";
                        card.style.containIntrinsicSize = "300px 400px";
                    }
                });
            },
            { timeout: 2000 }
        );
    }
}

// Prefetch likely next resources
function prefetchLikelyResources() {
    // Prefetch "batch" tiếp theo (phù hợp infinite scroll)
    const list =
        currentRenderList && currentRenderList.length
            ? currentRenderList
            : products;
    const nextBatchProducts = list.slice(
        visibleProductsCount,
        Math.min(visibleProductsCount + productsPerPage, list.length)
    );

    nextBatchProducts.slice(0, 8).forEach((product) => {
        if (product && product.image) {
            const link = document.createElement("link");
            link.rel = "prefetch";
            link.as = "image";
            link.href = normalizePath(product.image);
            document.head.appendChild(link);
        }
    });
}

function preloadNextPageImages() {
    const list =
        currentRenderList && currentRenderList.length
            ? currentRenderList
            : products;
    const nextBatchProducts = list.slice(
        visibleProductsCount,
        Math.min(visibleProductsCount + productsPerPage, list.length)
    );

    // Use requestIdleCallback to preload images when browser is idle
    if ("requestIdleCallback" in window) {
        requestIdleCallback(
            () => {
                nextBatchProducts.forEach((product) => {
                    if (product && product.image) {
                        const link = document.createElement("link");
                        link.rel = "prefetch";
                        link.href = normalizePath(product.image);
                        document.head.appendChild(link);
                    }
                });
            },
            { timeout: 2000 }
        );
    }
}

// Legacy function - now handled in initPerformanceOptimizations
function updateScrollEffects() {
    const scrollY = window.scrollY;
    const header = document.querySelector(".header");

    if (header) {
        if (scrollY > 100) {
            header.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)";
        } else {
            header.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.1)";
        }
    }
}

function handleResize() {
    // Recalculate layouts if needed
    if (window.innerWidth < 768) {
        // Mobile optimizations
        document.body.classList.add("mobile-view");
    } else {
        document.body.classList.remove("mobile-view");
    }
}

// ==================== PWA INSTALL PROMPT ====================
let deferredPrompt;
let installButton = null;

function initPWAInstall() {
    // Tạo install button
    createInstallButton();

    // Lắng nghe beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e) => {
        // Ngăn trình duyệt tự động hiển thị prompt
        e.preventDefault();
        // Lưu event để dùng sau
        deferredPrompt = e;
        // Hiển thị install button
        showInstallButton();
    });

    // Kiểm tra nếu app đã được cài đặt
    if (window.matchMedia("(display-mode: standalone)").matches) {
        // App đã được cài đặt, ẩn install button
        hideInstallButton();
    }

    // Lắng nghe khi app được cài đặt
    window.addEventListener("appinstalled", () => {
        console.log("✅ PWA đã được cài đặt");
        deferredPrompt = null;
        hideInstallButton();
        showToast("🎉 Ứng dụng đã được cài đặt thành công!", "success");
    });
}

function createInstallButton() {
    // Kiểm tra xem đã có button chưa
    if (document.getElementById("pwaInstallBtn")) return;

    const installBtn = document.createElement("button");
    installBtn.id = "pwaInstallBtn";
    installBtn.className = "pwa-install-btn";
    installBtn.innerHTML =
        '<i class="fas fa-download"></i> <span>Cài đặt App</span>';
    installBtn.setAttribute("aria-label", "Cài đặt ứng dụng ODER 88");
    installBtn.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: linear-gradient(135deg, #FF6600, #FF8C00);
        color: white;
        border: none;
        border-radius: 50px;
        padding: 12px 24px;
        font-size: 0.9rem;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(255, 102, 0, 0.4);
        cursor: pointer;
        z-index: 1000;
        display: none;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        animation: slideUp 0.5s ease;
    `;

    installBtn.addEventListener("click", installPWA);
    installBtn.addEventListener("mouseenter", () => {
        installBtn.style.transform = "translateY(-2px)";
        installBtn.style.boxShadow = "0 6px 25px rgba(255, 102, 0, 0.5)";
    });
    installBtn.addEventListener("mouseleave", () => {
        installBtn.style.transform = "translateY(0)";
        installBtn.style.boxShadow = "0 4px 20px rgba(255, 102, 0, 0.4)";
    });

    document.body.appendChild(installBtn);
    installButton = installBtn;

    // Thêm CSS animation
    if (!document.getElementById("pwaInstallStyles")) {
        const style = document.createElement("style");
        style.id = "pwaInstallStyles";
        style.textContent = `
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @media (max-width: 768px) {
                .pwa-install-btn {
                    bottom: 100px !important;
                    right: 15px !important;
                    padding: 10px 20px !important;
                    font-size: 0.85rem !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

function showInstallButton() {
    if (installButton && deferredPrompt) {
        installButton.style.display = "flex";
    }
}

function hideInstallButton() {
    if (installButton) {
        installButton.style.display = "none";
    }
}

async function installPWA() {
    if (!deferredPrompt) {
        // Nếu không có prompt, hướng dẫn người dùng cài đặt thủ công
        showInstallInstructions();
        return;
    }

    // Hiển thị install prompt
    deferredPrompt.prompt();

    // Đợi người dùng phản hồi
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
        console.log("✅ Người dùng đã chấp nhận cài đặt PWA");
        showToast("🎉 Đang cài đặt ứng dụng...", "success");
    } else {
        console.log("❌ Người dùng đã từ chối cài đặt PWA");
    }

    // Xóa prompt
    deferredPrompt = null;
    hideInstallButton();
}

function showInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let instructions = "";
    if (isIOS) {
        instructions = `
            <h3><i class="fas fa-mobile-alt"></i> Cài đặt trên iOS</h3>
            <ol>
                <li>Nhấn nút <strong>Share</strong> <i class="fas fa-share"></i> ở thanh dưới cùng</li>
                <li>Chọn <strong>"Thêm vào Màn hình chính"</strong></li>
                <li>Nhấn <strong>"Thêm"</strong> để hoàn tất</li>
            </ol>
        `;
    } else if (isAndroid) {
        instructions = `
            <h3><i class="fab fa-android"></i> Cài đặt trên Android</h3>
            <ol>
                <li>Nhấn menu <i class="fas fa-ellipsis-vertical"></i> ở góc trên bên phải</li>
                <li>Chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong></li>
                <li>Xác nhận cài đặt</li>
            </ol>
        `;
    } else {
        instructions = `
            <h3><i class="fas fa-desktop"></i> Cài đặt trên Desktop</h3>
            <ol>
                <li>Nhấn biểu tượng <i class="fas fa-plus"></i> hoặc <i class="fas fa-download"></i> trên thanh địa chỉ</li>
                <li>Chọn <strong>"Cài đặt"</strong> hoặc <strong>"Install"</strong></li>
            </ol>
        `;
    }

    showToast(instructions, "info", 8000);
}

// ==================== SHARE API ====================
function initShareAPI() {
    // Thêm nút share vào product cards (sẽ được thêm khi render products)
    // Kiểm tra xem browser có hỗ trợ Web Share API không
    if (navigator.share) {
        // Thêm share button vào header
        addShareButton();
    }
}

function addShareButton() {
    // Kiểm tra xem đã có button chưa
    if (document.getElementById("shareBtn")) return;

    const shareBtn = document.createElement("button");
    shareBtn.id = "shareBtn";
    shareBtn.className = "share-btn";
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
    shareBtn.setAttribute("aria-label", "Chia sẻ ứng dụng");
    shareBtn.style.cssText = `
        background: rgba(255, 102, 0, 0.1);
        border: 1px solid rgba(255, 102, 0, 0.3);
        color: var(--color-primary);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-left: 10px;
    `;

    shareBtn.addEventListener("click", shareApp);
    shareBtn.addEventListener("mouseenter", () => {
        shareBtn.style.background = "rgba(255, 102, 0, 0.2)";
        shareBtn.style.transform = "scale(1.1)";
    });
    shareBtn.addEventListener("mouseleave", () => {
        shareBtn.style.background = "rgba(255, 102, 0, 0.1)";
        shareBtn.style.transform = "scale(1)";
    });

    // Thêm vào header actions
    const headerActions = document.querySelector(".header-actions");
    if (headerActions) {
        headerActions.insertBefore(shareBtn, headerActions.firstChild);
    }
}

async function shareApp() {
    const shareData = {
        title: "ODER 88 - Thời Trang Cao Cấp",
        text: "Khám phá bộ sưu tập thời trang nam nữ cao cấp tại ODER 88!",
        url: window.location.href,
    };

    try {
        await navigator.share(shareData);
        console.log("✅ Chia sẻ thành công");
    } catch (err) {
        // Người dùng đã hủy hoặc có lỗi
        if (err.name !== "AbortError") {
            console.error("❌ Lỗi khi chia sẻ:", err);
            // Fallback: copy link
            copyToClipboard(window.location.href);
            showToast("📋 Đã sao chép link vào clipboard!", "success");
        }
    }
}

function shareProduct(product) {
    if (!navigator.share) {
        // Fallback: copy link
        const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
        copyToClipboard(productUrl);
        showToast("📋 Đã sao chép link sản phẩm!", "success");
        return;
    }

    const shareData = {
        title: product.name,
        text: `${product.name} - ${formatPriceToYen(product.price)}`,
        url: `${window.location.origin}${window.location.pathname}?product=${product.id}`,
    };

    navigator.share(shareData).catch((err) => {
        if (err.name !== "AbortError") {
            console.error("Lỗi khi chia sẻ sản phẩm:", err);
        }
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback cho browser cũ
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
    }
}

// ==================== APP UPDATE NOTIFICATION ====================
function showUpdateNotification(onUpdate) {
    // Kiểm tra xem đã có notification chưa
    if (document.getElementById("updateNotification")) return;

    const notification = document.createElement("div");
    notification.id = "updateNotification";
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #FF6600, #FF8C00);
        color: white;
        padding: 16px 24px;
        border-radius: 50px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 15px;
        max-width: 90%;
        animation: slideUpNotification 0.5s ease;
    `;

    notification.innerHTML = `
        <i class="fas fa-sync-alt" style="font-size: 1.2rem;"></i>
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">Có phiên bản mới!</div>
            <div style="font-size: 0.85rem; opacity: 0.9;">Nhấn để cập nhật ứng dụng</div>
        </div>
        <button id="updateBtn" style="
            background: white;
            color: #FF6600;
            border: none;
            border-radius: 25px;
            padding: 8px 20px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        ">Cập nhật</button>
        <button id="dismissUpdateBtn" style="
            background: transparent;
            color: white;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        ">×</button>
    `;

    // Thêm CSS animation
    if (!document.getElementById("updateNotificationStyles")) {
        const style = document.createElement("style");
        style.id = "updateNotificationStyles";
        style.textContent = `
            @keyframes slideUpNotification {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
            @media (max-width: 768px) {
                #updateNotification {
                    bottom: 100px !important;
                    flex-direction: column;
                    text-align: center;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Event handlers
    const updateBtn = document.getElementById("updateBtn");
    const dismissBtn = document.getElementById("dismissUpdateBtn");

    updateBtn.addEventListener("click", () => {
        if (onUpdate) onUpdate();
        notification.remove();
    });

    dismissBtn.addEventListener("click", () => {
        notification.remove();
    });

    // Auto dismiss sau 10 giây
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation =
                "slideUpNotification 0.5s ease reverse";
            setTimeout(() => notification.remove(), 500);
        }
    }, 10000);
}

// ==================== SHOPPING CART FUNCTIONS ====================
let cart = [];
let selectedItems = new Set(); // Lưu các item ID được chọn
const SELECTED_ITEMS_STORAGE_KEY = "shoppingCartSelectedItems";

function hasSavedSelection() {
    try {
        return localStorage.getItem(SELECTED_ITEMS_STORAGE_KEY) !== null;
    } catch (e) {
        return false;
    }
}

function normalizeId(id) {
    const n = Number(id);
    return Number.isFinite(n) ? n : id;
}

// Check if category needs size selection
function needsSize(category) {
    if (!category) return false;

    // Quần áo categories
    const clothingCategories = [
        "ao-nam",
        "ao-nu",
        "ao-dong-nam",
        "ao-dong-nu",
        "ao-thu-dong",
        "quan-nam",
        "quan-jean-nam",
        "quan-dai-nu",
        "quan-nu",
        "quan-bo-nam",
        "set-do",
        "set-do-nam",
        "set-do-nu",
        "vay",
        "chan-vay",
    ];

    // Giày dép categories
    const shoeCategories = [
        "giay",
        "giay-nam",
        "giay-nu",
        "boot-nu",
        "giay-the-thao",
        "giay-sneaker-nam",
    ];

    return (
        clothingCategories.includes(category) ||
        shoeCategories.includes(category)
    );
}

// Get available sizes for category
function getSizesForCategory(category) {
    if (!category) return [];

    // Quần áo: S, M, L, XL
    const clothingCategories = [
        "ao-nam",
        "ao-nu",
        "ao-dong-nam",
        "ao-dong-nu",
        "ao-thu-dong",
        "quan-nam",
        "quan-jean-nam",
        "quan-dai-nu",
        "quan-nu",
        "quan-bo-nam",
        "set-do",
        "set-do-nam",
        "set-do-nu",
        "vay",
        "chan-vay",
    ];

    // Giày dép: 35-44
    const shoeCategories = [
        "giay",
        "giay-nam",
        "giay-nu",
        "boot-nu",
        "giay-the-thao",
        "giay-sneaker-nam",
    ];

    if (clothingCategories.includes(category)) {
        return ["S", "M", "L", "XL"];
    } else if (shoeCategories.includes(category)) {
        return ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];
    }

    return [];
}

function normalizeCartItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = normalizeId(raw.id);
    const quantity = Number(raw.quantity);
    return {
        ...raw,
        id,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        size: raw.size || null, // Preserve size if exists
        // Repair old cached mojibake strings in cart as well
        name: normalizeWhitespace(repairUtf8Mojibake(raw.name ?? "")),
        categoryName: normalizeWhitespace(
            repairUtf8Mojibake(raw.categoryName ?? "")
        ),
        price: normalizePriceString(raw.price ?? ""),
    };
}

// Load cart from localStorage
function loadCart() {
    try {
        const savedCart = localStorage.getItem("shoppingCart");
        if (savedCart) {
            const parsed = JSON.parse(savedCart);
            cart = Array.isArray(parsed)
                ? parsed
                      .map(normalizeCartItem)
                      .filter((i) => i && Number.isFinite(Number(i.id)))
                : [];
        } else {
            cart = [];
        }
        // Restore selection state (persist across reload)
        // Lưu ý: KHÔNG auto-select ở đây. Auto-select chỉ xảy ra lần đầu mở giỏ (openCart).
        if (hasSavedSelection()) {
            loadSelectedItems();
            // Clean stale keys if any
            syncSelectedItemsWithCart({ persist: true });
        } else {
            selectedItems.clear();
        }
        updateCartUI();
    } catch (error) {
        console.error("Error loading cart:", error);
        cart = [];
        selectedItems.clear();
    }
}

// Save cart to localStorage
function saveCart() {
    try {
        localStorage.setItem("shoppingCart", JSON.stringify(cart));
        // Khi cart thay đổi, chỉ đồng bộ selection nếu đã từng có selection được lưu
        if (hasSavedSelection()) {
            syncSelectedItemsWithCart({ persist: true });
        }
        updateCartUI();
    } catch (error) {
        console.error("Error saving cart:", error);
    }
}

function loadSelectedItems() {
    try {
        const raw = localStorage.getItem(SELECTED_ITEMS_STORAGE_KEY);
        if (raw === null) return false;
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [];
        selectedItems = new Set(arr.filter((x) => typeof x === "string"));
        return true;
    } catch (e) {
        selectedItems = new Set();
        return false;
    }
}

function saveSelectedItems() {
    try {
        localStorage.setItem(
            SELECTED_ITEMS_STORAGE_KEY,
            JSON.stringify(Array.from(selectedItems))
        );
    } catch (e) {
        // ignore
    }
}

function syncSelectedItemsWithCart({ persist = false } = {}) {
    if (!Array.isArray(cart) || cart.length === 0) {
        selectedItems.clear();
        if (persist) saveSelectedItems();
        return;
    }

    const validKeys = new Set(
        cart.map((item) => `${item.id}_${item.size || "nosize"}`)
    );

    // Remove stale selections
    selectedItems.forEach((key) => {
        if (!validKeys.has(key)) selectedItems.delete(key);
    });
    if (persist) saveSelectedItems();
}

// Add product to cart by product ID
// Animate product flying to cart icon
function animateProductToCart(triggerButton) {
    if (!triggerButton) return;

    // Get cart button position (mobile or desktop)
    const cartBtn =
        document.getElementById("cartBtn") ||
        document.getElementById("headerCartBtn");
    if (!cartBtn) return;

    const buttonRect = triggerButton.getBoundingClientRect();
    const cartRect = cartBtn.getBoundingClientRect();

    // Create flying element
    const flyingElement = document.createElement("div");
    flyingElement.className = "product-flying-to-cart";
    flyingElement.innerHTML = '<i class="fas fa-shopping-cart"></i>';

    // Set initial position (center of button)
    const startX = buttonRect.left + buttonRect.width / 2;
    const startY = buttonRect.top + buttonRect.height / 2;
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    flyingElement.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, #ff9933, #ffaa66);
        color: #ff6600;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        pointer-events: none;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(255, 102, 0, 0.4);
        transform: translate(-50%, -50%);
    `;

    document.body.appendChild(flyingElement);

    // Force reflow
    flyingElement.offsetHeight;

    // Animate to cart
    requestAnimationFrame(() => {
        flyingElement.style.transition =
            "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        flyingElement.style.left = `${endX}px`;
        flyingElement.style.top = `${endY}px`;
        flyingElement.style.transform = "translate(-50%, -50%) scale(0.5)";
        flyingElement.style.opacity = "0.8";
    });

    // Remove element after animation
    setTimeout(() => {
        if (flyingElement.parentNode) {
            flyingElement.parentNode.removeChild(flyingElement);
        }
    }, 600);
}

function addToCartById(productId, event, selectedSize = null) {
    const pid = normalizeId(productId);
    const product = products.find((p) => normalizeId(p.id) === pid);
    if (!product) {
        showToast("Không tìm thấy sản phẩm!", "error");
        return;
    }

    // Check if size is needed
    if (needsSize(product.category)) {
        if (!selectedSize) {
            // Show size selection modal
            showSizeSelectionModal(product, event);
            return;
        }
    }

    // Get the button that was clicked
    const button = event
        ? event.currentTarget || event.target.closest(".add-to-cart-btn")
        : null;
    addToCart(product, button, selectedSize);
}

// Show size selection modal
function showSizeSelectionModal(product, event) {
    const sizes = getSizesForCategory(product.category);
    if (sizes.length === 0) {
        // No size needed, add directly
        const button = event
            ? event.currentTarget || event.target.closest(".add-to-cart-btn")
            : null;
        addToCart(product, button, null);
        return;
    }

    // Create modal
    const modal = document.createElement("div");
    modal.className = "size-selection-modal";
    modal.innerHTML = `
        <div class="size-selection-overlay" onclick="this.closest('.size-selection-modal').remove()"></div>
        <div class="size-selection-content">
            <div class="size-selection-header">
                <h3>Chọn size</h3>
                <button class="size-selection-close" onclick="this.closest('.size-selection-modal').remove()" type="button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="size-selection-product">
                <img src="${normalizePath(product.image)}" alt="${
        product.name
    }" onerror="this.src='assets/logo/favicon.png';">
                <p>${product.name}</p>
            </div>
            <div class="size-selection-options">
                ${sizes
                    .map(
                        (size) => `
                    <button class="size-option" data-size="${size}" type="button">${size}</button>
                `
                    )
                    .join("")}
            </div>
            <button class="size-selection-confirm" type="button" disabled>Xác nhận</button>
        </div>
    `;

    document.body.appendChild(modal);

    let selectedSize = null;
    const sizeOptions = modal.querySelectorAll(".size-option");
    const confirmBtn = modal.querySelector(".size-selection-confirm");

    sizeOptions.forEach((btn) => {
        btn.addEventListener("click", function () {
            sizeOptions.forEach((b) => b.classList.remove("selected"));
            this.classList.add("selected");
            selectedSize = this.dataset.size;
            confirmBtn.disabled = false;
        });
    });

    confirmBtn.addEventListener("click", function () {
        if (selectedSize) {
            const button = event
                ? event.currentTarget ||
                  event.target.closest(".add-to-cart-btn")
                : null;
            addToCart(product, button, selectedSize);
            modal.remove();
        }
    });
}

// Add product to cart
function addToCart(product, triggerButton = null, selectedSize = null) {
    const pid = normalizeId(product.id);

    // For items with size, check if same product + same size exists
    // For items without size, check if same product exists
    const existingItem = cart.find((item) => {
        if (normalizeId(item.id) !== pid) return false;
        if (needsSize(product.category)) {
            return item.size === selectedSize;
        }
        return true; // Same product, no size needed
    });

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: pid,
            name:
                product.name ||
                getCategoryDisplayName(product.category, product.categoryName),
            price: product.price,
            image: product.image,
            category: product.category,
            categoryName: product.categoryName,
            quantity: 1,
            size: needsSize(product.category) ? selectedSize : null,
        });
    }

    // Nếu user đã từng thao tác chọn/bỏ chọn (đã có selection state), thì mặc định chọn item vừa thêm.
    // Nếu chưa từng có selection state, để openCart lần đầu tự chọn tất cả.
    if (hasSavedSelection()) {
        try {
            const addedKey = `${normalizeId(productId)}_${
                selectedSize || "nosize"
            }`;
            selectedItems.add(addedKey);
            saveSelectedItems();
        } catch (e) {
            // ignore
        }
    }

    saveCart();
    // Đã tắt thông báo toast

    // Animate product flying to cart
    if (triggerButton) {
        animateProductToCart(triggerButton);
    }

    // Animate cart badge
    document.querySelectorAll(".cart-badge").forEach((badge) => {
        badge.style.animation = "none";
        setTimeout(() => {
            badge.style.animation = "cartBadgePulse 0.3s ease-out";
        }, 10);
    });

    updateCartUI();
}

// Remove product from cart
function removeFromCart(productId) {
    const pid = normalizeId(productId);
    const item = cart.find((item) => normalizeId(item.id) === pid);

    // Xóa item khỏi selectedItems
    if (item) {
        const itemKey = `${item.id}_${item.size || "nosize"}`;
        selectedItems.delete(itemKey);
    }

    cart = cart.filter((item) => normalizeId(item.id) !== pid);
    if (hasSavedSelection()) saveSelectedItems();
    saveCart();
    showToast("Đã xóa khỏi giỏ hàng", "info");
}

// Update product quantity in cart
function updateCartQuantity(productId, newQuantity) {
    const pid = normalizeId(productId);
    // Không xóa khi bấm dấu trừ về 0: chỉ cho giảm tối thiểu = 1
    if (newQuantity < 1) newQuantity = 1;

    const item = cart.find((item) => normalizeId(item.id) === pid);
    if (item) {
        item.quantity = newQuantity;
        saveCart();
        updateCartUI();
    }
}

// Change size of cart item
function changeCartItemSize(productId, category) {
    const pid = normalizeId(productId);
    const item = cart.find((item) => normalizeId(item.id) === pid);
    if (!item) return;

    const sizes = getSizesForCategory(category);
    if (sizes.length === 0) return;

    // Create modal to change size
    const modal = document.createElement("div");
    modal.className = "size-selection-modal";
    modal.innerHTML = `
        <div class="size-selection-overlay" onclick="this.closest('.size-selection-modal').remove()"></div>
        <div class="size-selection-content">
            <div class="size-selection-header">
                <h3>Chọn size mới</h3>
                <button class="size-selection-close" onclick="this.closest('.size-selection-modal').remove()" type="button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="size-selection-product">
                <img src="${normalizePath(item.image)}" alt="${
        item.name
    }" onerror="this.src='assets/logo/favicon.png';">
                <p>${item.name}</p>
            </div>
            <div class="size-selection-options">
                ${sizes
                    .map(
                        (size) => `
                    <button class="size-option ${
                        item.size === size ? "selected" : ""
                    }" data-size="${size}" type="button">${size}</button>
                `
                    )
                    .join("")}
            </div>
            <button class="size-selection-confirm" type="button" disabled>Xác nhận</button>
        </div>
    `;

    document.body.appendChild(modal);

    let selectedSize = item.size;
    const sizeOptions = modal.querySelectorAll(".size-option");
    const confirmBtn = modal.querySelector(".size-selection-confirm");

    sizeOptions.forEach((btn) => {
        btn.addEventListener("click", function () {
            sizeOptions.forEach((b) => b.classList.remove("selected"));
            this.classList.add("selected");
            selectedSize = this.dataset.size;
            confirmBtn.disabled = false;
        });
    });

    confirmBtn.addEventListener("click", function () {
        if (selectedSize && selectedSize !== item.size) {
            // Xóa item key cũ khỏi selectedItems
            const oldItemKey = `${item.id}_${item.size || "nosize"}`;
            const wasSelected = selectedItems.has(oldItemKey);

            // Check if same product + new size already exists
            const existingItem = cart.find((cartItem) => {
                if (normalizeId(cartItem.id) !== pid) return false;
                return cartItem.size === selectedSize;
            });

            if (existingItem) {
                // Merge quantities
                existingItem.quantity += item.quantity;
                cart = cart.filter((cartItem) => cartItem !== item);

                // Cập nhật selectedItems cho item merged
                if (wasSelected) {
                    const newItemKey = `${existingItem.id}_${
                        existingItem.size || "nosize"
                    }`;
                    selectedItems.delete(oldItemKey);
                    selectedItems.add(newItemKey);
                }
            } else {
                // Just update size
                selectedItems.delete(oldItemKey);
                item.size = selectedSize;
                if (wasSelected) {
                    const newItemKey = `${item.id}_${item.size || "nosize"}`;
                    selectedItems.add(newItemKey);
                }
            }

            if (hasSavedSelection()) saveSelectedItems();
            saveCart();
            updateCartUI();
            modal.remove();
        } else {
            modal.remove();
        }
    });

    // Enable confirm if size is already selected
    if (item.size) {
        confirmBtn.disabled = false;
    }
}

// Clear all items from cart
function clearCart() {
    if (cart.length === 0) return;

    if (confirm("Bạn có chắc muốn xóa tất cả sản phẩm khỏi giỏ hàng?")) {
        cart = [];
        selectedItems.clear();
        if (hasSavedSelection()) saveSelectedItems();
        saveCart();
        showToast("Đã xóa tất cả sản phẩm", "info");
    }
}

// Update cart UI (badge, modal content)
function updateCartUI() {
    // Update badge
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll(".cart-badge").forEach((badge) => {
        if (totalItems > 0) {
            badge.textContent = totalItems > 99 ? "99+" : totalItems;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    });

    // Update cart modal content
    updateCartModal();
}

// Update cart modal content
function updateCartModal() {
    const cartEmpty = document.getElementById("cartEmpty");
    const cartItems = document.getElementById("cartItems");
    const cartFooter = document.getElementById("cartFooter");

    if (!cartEmpty || !cartItems || !cartFooter) return;

    if (cart.length === 0) {
        cartEmpty.style.display = "flex";
        cartItems.innerHTML = "";
        cartFooter.style.display = "none";
    } else {
        cartEmpty.style.display = "none";
        cartFooter.style.display = "block";

        // Render cart items
        cartItems.innerHTML = cart
            .map((item) => {
                const priceInfo = formatPriceWithVND(item.price);
                const totalYen = getYenAmount(item.price) * item.quantity;
                const totalVND = convertYenToVND(totalYen);

                const itemKey = `${item.id}_${item.size || "nosize"}`;
                const isSelected = selectedItems.has(itemKey);

                return `
                <div class="cart-item" data-product-id="${
                    item.id
                }" data-item-key="${itemKey}">
                    <label class="cart-item-checkbox-wrapper">
                        <input type="checkbox" 
                               class="cart-item-checkbox" 
                               ${isSelected ? "checked" : ""}
                               onchange="toggleSelectItem('${itemKey}');"
                               aria-label="Chọn sản phẩm">
                        <span class="cart-item-checkbox-custom"></span>
                    </label>
                    <img src="${normalizePath(item.image)}" 
                         alt="${item.name}" 
                         class="cart-item-image"
                         onerror="this.src='assets/logo/favicon.png';">
                    <div class="cart-item-info">
                        <div class="cart-item-header-row">
                            <h3 class="cart-item-name">${item.name}</h3>
                            <div class="cart-item-quantity-and-size">
                                <div class="cart-item-quantity">
                                    <button class="cart-quantity-btn" 
                                            onclick="updateCartQuantity(${
                                                item.id
                                            }, ${item.quantity - 1})"
                                            type="button" ${
                                                item.quantity <= 1
                                                    ? "disabled"
                                                    : ""
                                            }>-</button>
                                    <span class="cart-quantity-value">${
                                        item.quantity
                                    }</span>
                                    <button class="cart-quantity-btn" 
                                            onclick="updateCartQuantity(${
                                                item.id
                                            }, ${item.quantity + 1})"
                                            type="button">+</button>
                                </div>
                                ${
                                    needsSize(item.category)
                                        ? item.size
                                            ? `<p class="cart-item-size"><span class="size-value" onclick="changeCartItemSize(${item.id}, '${item.category}')" style="cursor: pointer; text-decoration: underline;">${item.size}</span></p>`
                                            : `<p class="cart-item-size"><span class="size-value" onclick="changeCartItemSize(${item.id}, '${item.category}')" style="cursor: pointer; color: #ff6600; font-weight: 700;">Chọn size</span></p>`
                                        : ""
                                }
                            </div>
                        </div>
                        <div class="cart-item-details-row">
                            <div class="cart-item-price-wrapper">
                                <p class="cart-item-price">${formatPriceToYen(
                                    item.price
                                )}</p>
                                <p class="cart-item-price-vnd">${
                                    priceInfo.vnd
                                }</p>
                            </div>
                            <button class="cart-item-remove" 
                                    onclick="removeFromCart(${item.id})"
                                    aria-label="Xóa sản phẩm"
                                    type="button">
                                <i class="fas fa-trash" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            })
            .join("");

        // Update total và select all button state
        updateCartTotal();
        updateSelectAllButton();
    }
}

function isCartOpen() {
    const cartModal = document.getElementById("cartModal");
    return !!cartModal && cartModal.classList.contains("active");
}

let lastNonCartBottomNavActive = "home";

function rememberBottomNavActiveBeforeCart() {
    const active = document.querySelector(".bottom-nav-item.active");
    const label = active?.getAttribute("aria-label") || "Trang chủ";
    const map = {
        "Trang chủ": "home",
        "Danh mục": "category",
        "Tìm kiếm": "search",
        "Liên hệ": "contact",
        Fanpage: "fanpage",
        "Ngẫu nhiên": "random",
    };
    lastNonCartBottomNavActive = map[label] || "home";
}

function closeCart(restoreBottomNav = true) {
    const cartModal = document.getElementById("cartModal");
    if (!cartModal) return;
    cartModal.classList.remove("active");
    document.body.style.overflow = "";
    if (restoreBottomNav) {
        updateBottomNavActive(lastNonCartBottomNavActive);
    }
}

function openCart() {
    const cartModal = document.getElementById("cartModal");
    if (!cartModal) return;
    rememberBottomNavActiveBeforeCart();
    cartModal.classList.add("active");
    document.body.style.overflow = "hidden";
    // Không ép chọn tất cả mỗi lần mở.
    // Trạng thái checkbox được lưu trong localStorage và chỉ auto-select lần đầu (khi chưa có state lưu).
    if (!hasSavedSelection()) {
        // Lần đầu user mở giỏ hàng -> mặc định chọn tất cả
        selectAllCartItems();
    } else {
        // Nếu đã có state lưu, dọn stale keys nếu có
        syncSelectedItemsWithCart({ persist: true });
    }
    updateCartModal();
    updateBottomNavActive("cart");
}

// Toggle cart modal
function toggleCart() {
    // Theo yêu cầu: bấm lại nút giỏ hàng thì vẫn giữ nguyên giỏ (không toggle đóng)
    if (isCartOpen()) return;
    openCart();
}

// Checkout cart (send to Messenger)
// Toggle select all items
function selectAllCartItems() {
    selectedItems.clear();
    if (!Array.isArray(cart) || cart.length === 0) return;
    cart.forEach((item) => {
        const itemKey = `${item.id}_${item.size || "nosize"}`;
        selectedItems.add(itemKey);
    });
    saveSelectedItems();
}

function toggleSelectAll() {
    const allSelected = selectedItems.size === cart.length && cart.length > 0;

    if (allSelected) {
        // Bỏ chọn tất cả
        selectedItems.clear();
    } else {
        // Chọn tất cả
        cart.forEach((item) => {
            const itemKey = `${item.id}_${item.size || "nosize"}`;
            selectedItems.add(itemKey);
        });
    }

    // Update UI
    saveSelectedItems();
    updateCartModal();
}

// Toggle select individual item
function toggleSelectItem(itemKey) {
    if (selectedItems.has(itemKey)) {
        selectedItems.delete(itemKey);
    } else {
        selectedItems.add(itemKey);
    }

    // Update total and select all button
    saveSelectedItems();
    updateCartTotal();
    updateSelectAllButton();
}

// Update select all button state
function updateSelectAllButton() {
    const selectAllBtn = document.querySelector(".cart-select-all-btn");

    if (!selectAllBtn) return;

    const allSelected = selectedItems.size === cart.length && cart.length > 0;

    if (allSelected) {
        selectAllBtn.classList.add("selected");
    } else {
        selectAllBtn.classList.remove("selected");
    }
}

// Update cart total (chỉ tính các item được chọn)
function updateCartTotal() {
    const totalYen = cart.reduce((sum, item) => {
        const itemKey = `${item.id}_${item.size || "nosize"}`;
        if (selectedItems.has(itemKey)) {
            return sum + getYenAmount(item.price) * item.quantity;
        }
        return sum;
    }, 0);
    const totalVND = convertYenToVND(totalYen);

    const cartTotalPrice = document.getElementById("cartTotalPrice");
    const cartTotalVND = document.getElementById("cartTotalVND");

    if (cartTotalPrice) {
        cartTotalPrice.textContent = `¥${formatVND(totalYen)}`;
    }
    if (cartTotalVND) {
        cartTotalVND.textContent = `VND ${formatVND(totalVND)}`;
    }
}

function checkoutCart() {
    if (cart.length === 0) {
        showToast("Giỏ hàng trống!", "warning");
        return;
    }

    // Lọc chỉ các item được chọn
    const selectedCartItems = cart.filter((item) => {
        const itemKey = `${item.id}_${item.size || "nosize"}`;
        return selectedItems.has(itemKey);
    });

    if (selectedCartItems.length === 0) {
        showToast("Vui lòng chọn ít nhất một sản phẩm!", "warning");
        return;
    }

    // Build order message - format ngắn gọn, đầy đủ thông tin
    let message =
        "[GIO HANG] DAT HANG - ODER88\n================================\n";

    selectedCartItems.forEach((item, index) => {
        const yenAmount = getYenAmount(item.price);
        const itemTotalYen = yenAmount * item.quantity;
        const itemTotalVND = convertYenToVND(itemTotalYen);
        const priceInfo = formatPriceWithVND(item.price);

        message += `${index + 1}. ${item.name}\n`;

        // Hiển thị size nếu có
        if (item.size) {
            message += `   Size: ${item.size}\n`;
        }

        message += `   Gia: ${formatPriceToYen(item.price)} (${
            priceInfo.vnd
        })\n`;
        message += `   So luong: ${item.quantity}\n`;
        message += `   Thanh tien: ¥${formatVND(itemTotalYen)} (VND ${formatVND(
            itemTotalVND
        )})\n`;
    });

    // Tính tổng cộng (chỉ các item được chọn)
    const totalYen = selectedCartItems.reduce((sum, item) => {
        return sum + getYenAmount(item.price) * item.quantity;
    }, 0);
    const totalVND = convertYenToVND(totalYen);

    message += "================================\n";
    message += `TONG CONG: ¥${formatVND(totalYen)} (VND ${formatVND(
        totalVND
    )})\n`;
    message += "Vui long xac nhan don hang. Cam on ban!";

    // Open Messenger with order
    openMessengerApp(message);
}

// Show shipping info modal
function showShippingInfo() {
    const modal = document.getElementById("shippingInfoModal");
    if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }
}

// Close shipping info modal
function closeShippingInfo() {
    const modal = document.getElementById("shippingInfoModal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

// ==================== DEBUG ====================
window.debug = {
    getProducts: () => products,
    getCurrentCategory: () => currentCategory,
    getFilteredProducts: () => filterProducts(),
    reloadProducts: async () => {
        await loadProducts();
        initSlider();
        filterProducts();
    },
    getCart: () => cart,
    clearCart: () => {
        cart = [];
        saveCart();
    },
};
