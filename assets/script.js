// ==================== BIẾN TOÀN CỤC ====================
let products = []; // Sẽ được load từ JSON
let originalProducts = []; // Lưu bản gốc để shuffle lại
let currentCategory = "all";
let searchQuery = "";
let currentPage = 1;
const productsPerPage = 40;
let currentSlide = 0;
const itemsPerSlide = 3;

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
    let priceStr = String(price);

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
// Hàm lấy base path cho GitHub Pages
function getBasePath() {
    // Lấy pathname hiện tại (ví dụ: /oder88/ hoặc /)
    const pathname = window.location.pathname;
    // Tách pathname thành các phần
    const parts = pathname.split("/").filter((p) => p);
    // Nếu có repository name trong path (không phải root domain)
    if (parts.length > 0 && parts[0] !== "index.html") {
        // Trả về base path với dấu / ở đầu
        return "/" + parts[0];
    }
    // Nếu là root domain hoặc localhost, trả về rỗng
    return "";
}

// Hàm normalize đường dẫn cho GitHub Pages
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

        products = await response.json();

        // Tự động thêm số lượt mua ngẫu nhiên cho sản phẩm chưa có và điều chỉnh giá
        products = products.map((product) => {
            // Điều chỉnh giá cho áo đông nam và áo đông nữ: trừ 800 yên
            if (product.category === "ao-dong-nam" || product.category === "ao-dong-nu") {
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

    // 10. Hide loading spinner
    hidePageLoader();

    console.log("✅ Ứng dụng đã khởi tạo thành công!");
    // Đã tắt thông báo khi load sản phẩm
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
        .replace(/\\/g, '\\\\')  // Escape backslashes trước
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r');  // Escape carriage returns
}

// ==================== HÀM MỞ MESSENGER APP ====================
function openMessengerApp(message = '') {
    const threadId = '100090836182323';
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroid = /android/i.test(userAgent);
    
    let appUrl = '';
    let webUrl = `https://www.messenger.com/t/${threadId}`;
    
    if (message) {
        const encodedMessage = encodeURIComponent(message);
        webUrl += `?text=${encodedMessage}`;
    }
    
    if (isIOS) {
        // iOS: fb-messenger-public://user-thread/{thread_id}
        appUrl = `fb-messenger-public://user-thread/${threadId}`;
    } else if (isAndroid) {
        // Android: fb-messenger://user/{user_id}
        appUrl = `fb-messenger://user/${threadId}`;
    }
    
    // Thử mở app trước
    if (appUrl) {
        let appOpened = false;
        let fallbackTimer;
        
        // Nếu page blur (user chuyển sang app), đánh dấu app đã mở
        const blurHandler = () => {
            appOpened = true;
            clearTimeout(fallbackTimer);
        };
        window.addEventListener('blur', blurHandler, { once: true });
        
        // Thử mở app bằng cách tạo link ẩn và click
        const link = document.createElement('a');
        link.href = appUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Sau 1 giây, nếu app chưa mở thì mở web
        fallbackTimer = setTimeout(() => {
            window.removeEventListener('blur', blurHandler);
            if (!appOpened) {
                window.open(webUrl, '_blank');
            }
        }, 1000);
    } else {
        // Desktop, mở web
        window.open(webUrl, '_blank');
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
        "quan-jean-nam": "Quần Jean",
        "phu-kien": "Phụ Kiện",
        "non": "Mũ",
        "khan": "Khăn",
        "no-buoc-toc": "Nơ Buộc tóc",
        "tat": "Tất",
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
    // Reload trang - slider sẽ tự động random lại khi trang load (trong initializeApp)
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
    };
    return labels[item] || "Trang chủ";
}

function focusSearch() {
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
            } else if (label === "Tìm kiếm") {
                updateBottomNavActive("search");
            } else if (label === "Liên hệ") {
                updateBottomNavActive("contact");
            } else if (label === "Fanpage") {
                updateBottomNavActive("fanpage");
            } else if (label === "Ngẫu nhiên") {
                updateBottomNavActive("random");
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
    document.body.style.overflow = isOpen ? "" : "hidden";

    // Update ARIA attributes
    if (mobileCategories) {
        mobileCategories.setAttribute("aria-hidden", isOpen ? "true" : "false");
    }
    if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
    }

    overlay.onclick = () => {
        mobileCategories.classList.remove("show");
        overlay.classList.remove("show");
        document.body.style.overflow = "";
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
        document.body.style.overflow = "";
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

    // Cập nhật active - bao gồm cả category-item
    document
        .querySelectorAll(
            ".category-option, .mobile-category-btn, .category-item"
        )
        .forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-selected", "false");
        });

    const activeSelectors = `.category-option[data-category="${category}"], .mobile-category-btn[data-category="${category}"], .category-item[data-category="${category}"]`;
    document.querySelectorAll(activeSelectors).forEach((btn) => {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
    });

    // Cập nhật category
    currentCategory = category;
    updateCategoryIndicator();

    // Cập nhật hiển thị nút quay lại
    updateBackButton();

    // Đã tắt thông báo khi load sản phẩm

    filterProducts();

    // Scroll
    setTimeout(() => {
        const productsSection = document.querySelector(".products-section");
        if (productsSection) {
            window.scrollTo({
                top: productsSection.offsetTop - 80,
                behavior: "smooth",
            });
        }
    }, 100);
}

// Hàm cập nhật hiển thị nút quay lại
function updateBackButton() {
    const backBtn = document.getElementById("backBtn");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");

    if (!backBtn || !mobileMenuBtn) return;

    // Hiển thị nút quay lại khi không ở category "all"
    if (currentCategory !== "all" || searchQuery !== "") {
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
        "quan-jean-nam": "Quần Jean",
        "ao-nu": "Áo nữ",
        "ao-dong-nu": "Áo đông nữ",
        "ao-thu-dong": "Áo thu đông",
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
        "non": "Mũ",
        "khan": "Khăn",
        "no-buoc-toc": "Nơ Buộc tóc",
        "tat": "Tất",
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
            "quan-dai-nu": "fa-tshirt",
            "quan-nam": "fa-user",
            "quan-jean-nam": "fa-user",
            "ao-nu": "fa-tshirt",
            "phu-kien": "fa-gift",
            "non": "fa-hat-cowboy",
            "khan": "fa-scarf",
            "no-buoc-toc": "fa-ribbon",
            "tat": "fa-socks",
            "ao-dong-nu": "fa-tshirt",
            "ao-thu-dong": "fa-tshirt",
            giay: "fa-shoe-prints",
            "giay-nu": "fa-heart",
            "giay-nam": "fa-shoe-prints",
            "boot-nu": "fa-shoe-prints",
            "giay-the-thao": "fa-running",
            "giay-sneaker-nam": "fa-running",
            vay: "fa-tshirt",
            "chan-vay": "fa-tshirt",
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
            image: "assets/image/ao-nu/ao-dong-nu/adn1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-dong-nu",
            name: "Áo đông nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/ao-dong-nu/adn1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-thu-dong",
            name: "Áo thu đông",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/thu-dong-nu/1.JPG",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-nam",
            name: "Áo Nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adn1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "ao-dong-nam",
            name: "Áo đông nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adn1.jpg",
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
            image: "assets/image/giay-nu/giay-the-thao/gtt1.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "vay",
            name: "Váy",
            icon: "fa-tshirt",
            image: "assets/image/vay/chan-vay/cv1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "giay-sneaker-nam",
            name: "Sneaker Nam",
            icon: "fa-running",
            image: "assets/image/giay-nam/giay-sneaker-nam/IMG_0937.JPG",
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
            name: "Quần Jean",
            icon: "fa-user",
            image: "assets/logo/quannam.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "quan-dai-nu",
            name: "Quần Nữ",
            icon: "fa-tshirt",
            image: "assets/image/quan-dai-nu/qd1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "phu-kien",
            name: "Phụ Kiện",
            icon: "fa-gift",
            image: "assets/logo/tatca.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
    ];

    // Render categories (bỏ qua các subcategories như boot-nu, giay-the-thao, ao-dong-nu, ao-dong-nam, giay-sneaker-nam, quan-jean-nam)
    categoriesGrid.innerHTML = categories
        .map((category) => {
            // Bỏ qua boot-nu, giay-the-thao, ao-dong-nu, ao-thu-dong, ao-dong-nam, giay-sneaker-nam, giay-nu, giay-nam, non, khan, no-buoc-toc, tat vì chúng là subcategories
            if (
                category.id === "boot-nu" ||
                category.id === "giay-the-thao" ||
                category.id === "ao-dong-nu" ||
                category.id === "ao-thu-dong" ||
                category.id === "ao-dong-nam" ||
                category.id === "giay-sneaker-nam" ||
                category.id === "giay-nu" ||
                category.id === "giay-nam" ||
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
}

// ==================== HÀM MOBILE CATEGORIES ====================
function initMobileCategories() {
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
            image: "assets/image/ao-nu/ao-dong-nu/adn1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-dong-nu",
            name: "Áo đông nữ",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/ao-dong-nu/adn1.jpg",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-thu-dong",
            name: "Áo thu đông",
            icon: "fa-tshirt",
            image: "assets/image/ao-nu/thu-dong-nu/1.JPG",
            color: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
        },
        {
            id: "ao-nam",
            name: "Áo Nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adn1.jpg",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "ao-dong-nam",
            name: "Áo đông nam",
            icon: "fa-tshirt",
            image: "assets/image/ao-nam/ao-dong-nam/adn1.jpg",
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
            image: "assets/image/giay-nu/giay-the-thao/gtt1.jpg",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "vay",
            name: "Váy",
            icon: "fa-tshirt",
            image: "assets/image/vay/chan-vay/cv1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
            id: "giay-sneaker-nam",
            name: "Sneaker Nam",
            icon: "fa-running",
            image: "assets/image/giay-nam/giay-sneaker-nam/IMG_0937.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "quan-dai-nu",
            name: "Quần Nữ",
            icon: "fa-tshirt",
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
            name: "Quần Jean",
            icon: "fa-user",
            image: "assets/logo/quannam.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "phu-kien",
            name: "Phụ Kiện",
            icon: "fa-gift",
            image: "assets/logo/tatca.jpg",
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
                const aoThuDong = categories.find((c) => c.id === "ao-thu-dong");

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
                const noBuocToc = categories.find((c) => c.id === "no-buoc-toc");
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

    // Event listeners sẽ được gắn trong setupEventListeners()
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
                <img src="${normalizePath(product.image)}" 
                     alt="${getCategoryDisplayName(
                         product.category,
                         product.categoryName
                     )} - ${formatPriceToYen(product.price)}" 
                     class="slider-img" 
                     data-product-id="${product.id}"
                     loading="${index < 3 ? "eager" : "lazy"}"
                     onerror="handleImageError(this)"
                     style="cursor: pointer;">
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
                <a href="javascript:void(0)" 
                   onclick="openMessengerApp('${escapeMessageForHTML(createMessengerOrderLink(
                       product.name,
                       formatPriceToYen(product.price),
                       getCategoryDisplayName(
                           product.category,
                           product.categoryName
                       )
                   ))}'); return false;"
                   class="order-btn"
                   aria-label="Đặt hàng ${getCategoryDisplayName(
                       product.category,
                       product.categoryName
                   )}">
                    <i class="fas fa-shopping-cart" aria-hidden="true"></i> ORDER NGAY
                </a>
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
    const totalPages = Math.ceil(productsToShow.length / productsPerPage);
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const pageProducts = productsToShow.slice(startIndex, endIndex);

    if (pageProducts.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" role="status" aria-live="polite">
                <i class="fas fa-search" style="font-size: 3rem; color: #FF6B6B; margin-bottom: 15px;" aria-hidden="true"></i>
                <h3 style="color: #333; margin-bottom: 10px; font-size: 1.2rem;">Không tìm thấy sản phẩm</h3>
                <p style="color: #666;">Vui lòng thử từ khóa khác hoặc chọn danh mục khác</p>
            </div>
        `;
    } else {
        grid.innerHTML = pageProducts
            .map(
                (product, index) => `
            <div class="product-card" role="listitem" aria-label="Sản phẩm ${
                product.categoryName
            }" data-index="${index}">
                <div class="image-container">
                    <img src="${normalizePath(product.image)}" 
                         alt="${getCategoryDisplayName(
                             product.category,
                             product.categoryName
                         )} - ${formatPriceToYen(product.price)}" 
                         class="product-image" 
                         data-product-id="${product.id}"
                         loading="${index < 4 ? "eager" : "lazy"}"
                         onerror="handleImageError(this)"
                         style="cursor: pointer;">
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
                    <a href="javascript:void(0)" 
                       onclick="openMessengerApp('${escapeMessageForHTML(createMessengerOrderLink(
                           product.name,
                           formatPriceToYen(product.price),
                           getCategoryDisplayName(
                               product.category,
                               product.categoryName
                           )
                       ))}'); return false;"
                       class="order-btn"
                       aria-label="Đặt hàng ${getCategoryDisplayName(
                           product.category,
                           product.categoryName
                       )}">
                        <i class="fas fa-shopping-cart" aria-hidden="true"></i> ORDER NGAY
                    </a>
                </div>
            </div>
        `
            )
            .join("");
    }

    displayPagination(productsToShow.length, totalPages);

    // Observe new product cards for animation
    if (scrollObserver) {
        document.querySelectorAll(".product-card").forEach((card) => {
            if (!card.classList.contains("animate-in")) {
                scrollObserver.observe(card);
            }
        });
    }
}

function displayPagination(totalProducts, totalPages) {
    const pagination = document.getElementById("pagination");
    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }

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

    // Show loading spinner
    showPageLoader();

    // Show loading briefly
    showLoadingSkeleton(productsPerPage);
    setTimeout(() => {
        displayProductsPaginated(filtered);
        hidePageLoader();

        // Ensure scroll position after products are rendered
        requestAnimationFrame(() => {
            const productsTabs = document.querySelector(".products-tabs");
            if (productsTabs) {
                const tabsPosition =
                    productsTabs.getBoundingClientRect().top +
                    window.pageYOffset;
                window.scrollTo({
                    top: tabsPosition - 100,
                    behavior: "smooth",
                });
            }
        });
    }, 200);
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
        "phu-kien": [
            "phụ kiện",
            "phu kien",
            "accessories",
            "accessory",
        ],
        "non": [
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
        "khan": [
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
        "tat": [
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
    // Show loading spinner nếu đang filter
    const loader = document.getElementById("pageLoader");
    if (loader && !loader.classList.contains("active")) {
        showPageLoader();
    }

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
            // Hiển thị tất cả áo nữ (bao gồm áo đông nữ và áo thu đông)
            filtered = filtered.filter(
                (p) => p.category === "ao-nu" || p.category === "ao-dong-nu" || p.category === "ao-thu-dong"
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

    displayProductsPaginated(filtered);

    // Hide loading spinner sau khi hiển thị xong
    setTimeout(() => {
        hidePageLoader();
    }, 300);

    return filtered;
}

function handleSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    searchQuery = searchInput.value.trim();

    const filtered = filterProducts();

    // Cập nhật hiển thị nút quay lại
    updateBackButton();

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

    // Nếu có mảng images, dùng nó (đảm bảo có ít nhất 1 ảnh)
    if (
        product.images &&
        Array.isArray(product.images) &&
        product.images.length > 0
    ) {
        return product.images.slice(0, 4); // Chỉ lấy tối đa 4 ảnh
    }

    // Nếu không, tạo 4 ảnh từ ảnh hiện có và các ảnh khác
    const allImages = [
        "assets/image/1.jpeg",
        "assets/image/2.jpg",
        "assets/image/3.jpeg",
        "assets/image/4.png",
        "assets/image/5.jpg",
        "assets/image/6.jpg",
        "assets/image/7.JPG",
        "assets/image/8.JPG",
        "assets/image/9.jpg",
        "assets/image/10.jpg",
        "assets/image/11.jpg",
        "assets/image/g1.jpg",
        "assets/image/g2.jpg",
        "assets/image/g2.jpeg",
        "assets/image/giay-converse-da-bong-5.jpg",
    ];

    // Tìm index của ảnh hiện tại (hoặc dùng index 0 nếu không tìm thấy)
    let productImageIndex = allImages.findIndex(
        (img) =>
            img.toLowerCase() === product.image.toLowerCase() ||
            img.includes(product.image.split("/").pop())
    );

    if (productImageIndex === -1) {
        productImageIndex = 0;
    }

    const generatedImages = [product.image];

    // Thêm 3 ảnh khác (không trùng với ảnh chính)
    let added = 1;
    let attempts = 0;
    while (added < 4 && attempts < allImages.length * 2) {
        const imgIndex = (productImageIndex + added) % allImages.length;
        const candidateImage = allImages[imgIndex];

        if (
            candidateImage !== product.image &&
            !generatedImages.includes(candidateImage)
        ) {
            generatedImages.push(candidateImage);
            added++;
        }
        attempts++;
    }

    // Đảm bảo có đủ 4 ảnh (nếu không đủ, lặp lại ảnh đầu)
    while (generatedImages.length < 4) {
        generatedImages.push(generatedImages[0]);
    }

    return generatedImages.slice(0, 4);
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
        orderBtn.onclick = function(e) {
            e.preventDefault();
            openMessengerApp(message);
            return false;
        };
    }

    // Handle video if product has video - show video first instead of image
    const mainVideo = document.getElementById("galleryMainVideo");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const videoToggle = document.getElementById("galleryVideoToggle");
    
    if (product.video && mainVideo && videoContainer && videoPlayOverlay) {
        // Set video source and poster (first image as thumbnail)
        mainVideo.src = normalizePath(product.video);
        mainVideo.poster = normalizePath(currentGalleryImages[0]);
        mainVideo.controls = false; // Hide controls initially
        
        // Show video container, hide image
        videoContainer.style.display = "flex";
        mainImage.style.display = "none";
        videoPlayOverlay.style.display = "flex";
        
        // Show toggle button to switch back to image
        if (videoToggle) {
            videoToggle.style.display = "flex";
            videoToggle.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i><span>Xem ảnh</span>';
            videoToggle.onclick = function(e) {
                e.stopPropagation();
                switchToImage();
            };
        }
        
        // Play video when clicking play overlay
        videoPlayOverlay.onclick = function(e) {
            e.stopPropagation();
            playVideo();
        };
        
        // Also allow clicking on video to play
        mainVideo.onclick = function(e) {
            e.stopPropagation();
            if (mainVideo.paused) {
                playVideo();
            }
        };
        
        // Hide play overlay when video starts playing
        mainVideo.addEventListener('play', function() {
            videoPlayOverlay.style.display = "none";
            mainVideo.controls = true;
        });
        
        // Show play overlay when video is paused
        mainVideo.addEventListener('pause', function() {
            videoPlayOverlay.style.display = "flex";
            mainVideo.controls = false;
        });
        
        // Show play overlay when video ends
        mainVideo.addEventListener('ended', function() {
            videoPlayOverlay.style.display = "flex";
            mainVideo.controls = false;
            mainVideo.currentTime = 0;
        });
        
        // Limit video playback to 10 seconds maximum
        mainVideo.addEventListener('timeupdate', function() {
            if (mainVideo.currentTime >= 10) {
                mainVideo.pause();
                mainVideo.currentTime = 0;
                if (videoPlayOverlay) {
                    videoPlayOverlay.style.display = "flex";
                }
                mainVideo.controls = false;
            }
        });
    } else {
        // No video - show image normally
        mainImage.src = normalizePath(currentGalleryImages[currentGalleryIndex]);
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
                    <img src="${normalizePath(img)}" alt="Ảnh ${index + 1}" />
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
        const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
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
        if (videoContainer) {
            videoContainer.style.display = "none";
        }
        if (videoPlayOverlay) {
            videoPlayOverlay.style.display = "flex";
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
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const mainImageWrapper = document.querySelector(
        ".gallery-main-image-wrapper"
    );
    const currentIndexSpan = document.getElementById("galleryCurrentIndex");
    const thumbnails = document.querySelectorAll(".gallery-thumbnail");

    // Reset video if showing
    if (mainVideo && videoContainer && videoContainer.style.display !== "none") {
        mainVideo.pause();
        mainVideo.currentTime = 0;
        mainVideo.controls = false;
        if (videoPlayOverlay) videoPlayOverlay.style.display = "flex";
    }

    // Get current product to check if it has video
    const currentProduct = currentGalleryProductId ? 
        products.find((p) => p.id === currentGalleryProductId) : null;

    // If switching to first image (index 0) and product has video, show video
    if (index === 0 && currentProduct && currentProduct.video) {
        // Show video container
        if (videoContainer) {
            videoContainer.style.display = "flex";
            if (mainVideo) {
                mainVideo.poster = normalizePath(currentGalleryImages[0]);
                mainVideo.pause();
                mainVideo.currentTime = 0;
                mainVideo.controls = false;
            }
            if (videoPlayOverlay) videoPlayOverlay.style.display = "flex";
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

// Play video
function playVideo() {
    const mainVideo = document.getElementById("galleryMainVideo");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    
    if (!mainVideo) return;
    
    mainVideo.play().catch(err => {
        console.error("Error playing video:", err);
    });
}

// Switch from video to image
function switchToImage() {
    const mainImage = document.getElementById("galleryMainImage");
    const mainVideo = document.getElementById("galleryMainVideo");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const videoToggle = document.getElementById("galleryVideoToggle");
    
    if (!mainImage || !mainVideo || !videoContainer) return;
    
    // Pause and reset video
    mainVideo.pause();
    mainVideo.currentTime = 0;
    mainVideo.controls = false;
    if (videoPlayOverlay) videoPlayOverlay.style.display = "flex";
    
    // Hide video container, show image
    videoContainer.style.display = "none";
    mainImage.style.display = "block";
    mainImage.src = normalizePath(currentGalleryImages[currentGalleryIndex]);
    mainImage.style.transform = "scale(1)";
    mainImage.style.transformOrigin = "center center";
    mainImage.classList.remove("zoomed");
    
    // Update toggle button
    if (videoToggle) {
        videoToggle.innerHTML = '<i class="fas fa-video" aria-hidden="true"></i><span>Xem video</span>';
        videoToggle.onclick = function(e) {
            e.stopPropagation();
            switchToVideo();
        };
    }
}

// Switch from image to video
function switchToVideo() {
    const mainImage = document.getElementById("galleryMainImage");
    const mainVideo = document.getElementById("galleryMainVideo");
    const videoContainer = document.getElementById("galleryVideoContainer");
    const videoPlayOverlay = document.getElementById("galleryVideoPlayOverlay");
    const videoToggle = document.getElementById("galleryVideoToggle");
    
    if (!mainImage || !mainVideo || !videoContainer) return;
    
    // Hide image, show video container
    mainImage.style.display = "none";
    videoContainer.style.display = "flex";
    if (videoPlayOverlay) videoPlayOverlay.style.display = "flex";
    
    // Reset video
    mainVideo.pause();
    mainVideo.currentTime = 0;
    mainVideo.controls = false;
    
    // Update toggle button
    if (videoToggle) {
        videoToggle.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i><span>Xem ảnh</span>';
        videoToggle.onclick = function(e) {
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
    document
        .querySelectorAll(
            ".category-option, .mobile-category-btn, .category-item"
        )
        .forEach((btn) => {
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
                    "quan-jean-nam": "Quần Jean",
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
                    "non": "Mũ",
                    "khan": "Khăn",
                    "no-buoc-toc": "Nơ Buộc tóc",
                    "tat": "Tất",
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
            displayProductsPaginated(filtered);
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
    document
        .getElementById("searchBtn")
        ?.addEventListener("click", handleSearch);
    document
        .getElementById("searchInput")
        ?.addEventListener("keypress", function (e) {
            if (e.key === "Enter") handleSearch();
        });
    document
        .getElementById("searchInput")
        ?.addEventListener("input", function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(handleSearch, 500);
        });

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

    // Initialize modern features
    initThemeToggle();
    initIntersectionObserver();
    initPerformanceOptimizations();

    // Thêm CSS cho page dots và skeleton
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
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .product-card, .slider-item {
            animation: fadeIn 0.4s ease;
        }
        
        .skeleton-card {
            pointer-events: none;
        }
        
        .skeleton-card .product-info {
            padding: 20px;
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

    // Lazy load images with Intersection Observer
    if ("IntersectionObserver" in window) {
        imageObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute("data-src");
                            img.classList.remove("image-loading");
                            imageObserver?.unobserve(img);
                        }
                    }
                });
            },
            {
                rootMargin: "50px",
            }
        );

        // Observe all images with data-src
        document.querySelectorAll("img[data-src]").forEach((img) => {
            imageObserver.observe(img);
        });
    }
}

// ==================== PERFORMANCE OPTIMIZATIONS ====================
function initPerformanceOptimizations() {
    // Use requestIdleCallback for non-critical tasks
    if ("requestIdleCallback" in window) {
        requestIdleCallback(
            () => {
                // Preload next page images
                preloadNextPageImages();
            },
            { timeout: 2000 }
        );
    }

    // Debounce scroll events
    let scrollTimeout;
    window.addEventListener(
        "scroll",
        () => {
            if (scrollTimeout) {
                cancelAnimationFrame(scrollTimeout);
            }
            scrollTimeout = requestAnimationFrame(() => {
                updateScrollEffects();
            });
        },
        { passive: true }
    );

    // Optimize resize events
    let resizeTimeout;
    window.addEventListener(
        "resize",
        () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                handleResize();
            }, 250);
        },
        { passive: true }
    );
}

function preloadNextPageImages() {
    const nextPageProducts = products.slice(
        currentPage * productsPerPage,
        (currentPage + 1) * productsPerPage
    );

    nextPageProducts.forEach((product) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = product.image;
        document.head.appendChild(link);
    });
}

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
};
