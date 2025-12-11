// ==================== BIẾN TOÀN CỤC ====================
let products = []; // Sẽ được load từ JSON
let originalProducts = []; // Lưu bản gốc để shuffle lại
let currentCategory = "all";
let searchQuery = "";
let currentPage = 1;
const productsPerPage = 20;
let currentSlide = 0;
const itemsPerSlide = 3;

// ==================== HÀM FORMAT GIÁ TIỀN ====================
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

// Intersection Observer instances
let scrollObserver = null;
let imageObserver = null;

// ==================== LOAD DỮ LIỆU TỪ JSON ====================
// Hàm lấy base path cho GitHub Pages
function getBasePath() {
    // Lấy pathname hiện tại (ví dụ: /oder88/ hoặc /)
    const pathname = window.location.pathname;
    // Tách pathname thành các phần
    const parts = pathname.split('/').filter(p => p);
    // Nếu có repository name trong path (không phải root domain)
    if (parts.length > 0 && parts[0] !== 'index.html') {
        // Trả về base path với dấu / ở đầu
        return '/' + parts[0];
    }
    // Nếu là root domain hoặc localhost, trả về rỗng
    return '';
}

// Hàm normalize đường dẫn cho GitHub Pages
function normalizePath(path) {
    if (!path) return path;
    // Nếu đã là đường dẫn tuyệt đối (bắt đầu bằng http), giữ nguyên
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // Nếu bắt đầu bằng /, thêm base path
    if (path.startsWith('/')) {
        const basePath = getBasePath();
        return basePath + path;
    }
    // Nếu là đường dẫn tương đối, thêm base path
    const basePath = getBasePath();
    return basePath + '/' + path;
}

async function loadProducts() {
    try {
        console.log("Đang load sản phẩm từ JSON...");
        const basePath = getBasePath();
        const jsonPath = `${basePath}/assets/products.json`.replace('//', '/');
        console.log("Loading from:", jsonPath);
        
        const response = await fetch(jsonPath);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        products = await response.json();

        // Tự động thêm số lượt mua ngẫu nhiên cho sản phẩm chưa có
        products = products.map((product) => {
            if (!product.purchases) {
                // Tạo số lượt mua ngẫu nhiên từ 50 đến 500+
                product.purchases = Math.floor(Math.random() * 451) + 50;
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

    // 8. Init product gallery
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

// ==================== HÀM TẠO LINK MESSENGER ====================
function createMessengerOrderLink(productName, productPrice, categoryName) {
    const message = `Xin chào ODER 88! Tôi muốn đặt hàng:\n\n👕 Sản phẩm: ${productName}\n💰 Giá: ${productPrice}\n🏷️ Danh mục: ${categoryName}\n\nVui lòng liên hệ lại với tôi để xác nhận đơn hàng.`;
    const encodedMessage = encodeURIComponent(message);
    return `https://m.me/nekoshop68?text=${encodedMessage}`;
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
    window.location.reload();
}

// ==================== HÀM SCROLL TO PRODUCTS ====================
function scrollToProducts() {
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

function updateCategoryIndicator() {
    const categoryIndicator = document.getElementById("currentCategory");
    const sectionTitle = document.getElementById("sectionTitle");

    let categoryName = "Tất cả";
    const categoryMap = {
        "quan-dai-nu": "Quần dài nữ",
        "ao-nu": "Áo nữ",
        "ao-dong-nu": "Áo đông nữ",
        "tui-xach": "Túi xách",
        "tui-xach-nam": "Túi xách nam",
        "tui-xach-nu": "Túi xách nữ",
        "giay-nu": "Giày nữ",
        "boot-nu": "Boot nữ",
        "giay-the-thao": "Giày Sneaker",
        vay: "Váy",
        "chan-vay": "Chân váy",
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
            "ao-nu": "fa-tshirt",
            "ao-dong-nu": "fa-tshirt",
            "giay-nu": "fa-heart",
            "boot-nu": "fa-shoe-prints",
            "giay-the-thao": "fa-running",
            vay: "fa-tshirt",
            "chan-vay": "fa-tshirt",
            "tui-xach": "fa-shopping-bag",
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
            image: "assets/logo/logo1.png",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            image: "assets/image/tui-xach/tui-xach-nu/tx1.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "giay-nu",
            name: "Giày nữ",
            icon: "fa-heart",
            image: "assets/image/giay-nu/boot-nu/bn1.jpg",
            color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
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
            name: "Giày Sneaker",
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
            id: "giay-nam",
            name: "Giày Nam",
            icon: "fa-shoe-prints",
            image: "assets/image/giay-nam/giay-sneaker-nam/IMG_0937.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "giay-sneaker-nam",
            name: "Giày Sneaker",
            icon: "fa-running",
            image: "assets/image/giay-nam/giay-sneaker-nam/IMG_0937.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "quan-dai-nu",
            name: "Quần dài nữ",
            icon: "fa-tshirt",
            image: "assets/image/quan-dai-nu/qd1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
    ];

    // Render categories (bỏ qua các subcategories như boot-nu, giay-the-thao, ao-dong-nu, ao-dong-nam, giay-sneaker-nam)
    categoriesGrid.innerHTML = categories
        .map((category) => {
            // Bỏ qua boot-nu, giay-the-thao, ao-dong-nu, ao-dong-nam, giay-sneaker-nam vì chúng là subcategories
            if (
                category.id === "boot-nu" ||
                category.id === "giay-the-thao" ||
                category.id === "ao-dong-nu" ||
                category.id === "ao-dong-nam" ||
                category.id === "giay-sneaker-nam"
            ) {
                return "";
            }
            return `
        <div class="category-item" data-category="${category.id}" role="button" tabindex="0">
            <div class="category-image-wrapper">
                <div class="category-image-bg" style="background: ${category.color}"></div>
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
            image: "assets/logo/logo1.png",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
            image: "assets/image/tui-xach/tui-xach-nu/tx1.JPG",
            color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
        {
            id: "giay-nu",
            name: "Giày nữ",
            icon: "fa-heart",
            image: "assets/image/giay-nu/boot-nu/bn1.jpg",
            color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
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
            name: "Giày Sneaker",
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
            id: "giay-nam",
            name: "Giày Nam",
            icon: "fa-shoe-prints",
            image: "assets/image/giay-nam/giay-sneaker-nam/IMG_0937.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "giay-sneaker-nam",
            name: "Giày Sneaker",
            icon: "fa-running",
            image: "assets/image/giay-nam/giay-sneaker-nam/IMG_0937.JPG",
            color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        },
        {
            id: "quan-dai-nu",
            name: "Quần dài nữ",
            icon: "fa-tshirt",
            image: "assets/image/quan-dai-nu/qd1.jpg",
            color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
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
                                <img src="${category.image}" alt="Tất cả túi xách" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả túi xách</span>
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
                                <img src="assets/image/tui-xach/tui-xach-nu/tui-xach-nu-1.jpg" alt="Túi xách nữ" loading="lazy" onerror="this.src='assets/image/tui-xach/tx1.JPG'; this.onerror=null;">
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
                                <img src="${category.image}" alt="Tất cả quần dài nữ" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả quần dài nữ</span>
                        </button>
                    </div>
                </div>
            `;
            } else if (category.id === "ao-nu") {
                // Tìm các subcategories
                const aoDongNu = categories.find((c) => c.id === "ao-dong-nu");

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
                                }" alt="Tất cả áo nữ" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${
                                    category.color
                                }; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả áo nữ</span>
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
                    </div>
                </div>
            `;
            } else if (category.id === "giay-nu") {
                // Tìm các subcategories
                const bootNu = categories.find((c) => c.id === "boot-nu");
                const giayTheThao = categories.find(
                    (c) => c.id === "giay-the-thao"
                );

                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="giayNuBtn"
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
                        id="giayNuSubcategories"
                        style="display: none"
                    >
                        <button
                            class="mobile-category-btn subcategory-btn"
                            data-category="giay-nu"
                            type="button"
                        >
                            <div class="mobile-category-image">
                                <img src="${
                                    category.image
                                }" alt="Tất cả giày nữ" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${
                                    category.color
                                }; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả giày nữ</span>
                        </button>
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
                                <img src="${category.image}" alt="Tất cả váy" loading="lazy" onerror="this.style.display='none'; this.parentElement.querySelector('.mobile-category-icon-fallback').style.display='flex';">
                                <div class="mobile-category-icon-fallback" style="background: ${category.color}; display: none;">
                                    <i class="fas ${category.icon}"></i>
                                </div>
                            </div>
                            <span class="mobile-category-text">Tất cả váy</span>
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
            } else if (category.id === "ao-nam") {
                const aoDongNam = categories.find((c) => c.id === "ao-dong-nam");
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="aoNamBtn"
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
                const giaySneakerNam = categories.find((c) => c.id === "giay-sneaker-nam");
                return `
                <div class="category-with-subcategories">
                    <button
                        class="mobile-category-btn"
                        data-category="${category.id}"
                        id="giayNamBtn"
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
                        id="giayNamSubcategories"
                        style="display: none"
                    >
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
            } else if (category.id === "boot-nu") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay-nu"
                return "";
            } else if (category.id === "giay-the-thao") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay-nu"
                return "";
            } else if (category.id === "ao-dong-nu") {
                // Bỏ qua category này vì đã được render trong subcategories của "ao-nu"
                return "";
            } else if (category.id === "ao-dong-nam") {
                // Bỏ qua category này vì đã được render trong subcategories của "ao-nam"
                return "";
            } else if (category.id === "giay-sneaker-nam") {
                // Bỏ qua category này vì đã được render trong subcategories của "giay-nam"
                return "";
            }
        })
        .filter((html) => html !== "") // Loại bỏ các HTML rỗng
        .join("");

    // Cập nhật HTML
    mobileCategoriesList.innerHTML = categoriesHTML;

    // Event listeners sẽ được gắn trong setupEventListeners()
}

// ==================== HÀM SLIDER ====================
function getBestSellers() {
    // Lấy sản phẩm đa dạng từ nhiều category khác nhau
    const categories = [
        "quan-dai-nu",
        "tui-xach-nam",
        "tui-xach-nu",
        "giay-nu",
    ];
    const selectedProducts = [];
    const maxPerCategory = 4; // Tối đa 4 sản phẩm mỗi category
    const totalProducts = 20; // Tổng số sản phẩm hiển thị

    // Lấy sản phẩm từ mỗi category
    categories.forEach((category) => {
        const categoryProducts = products.filter(
            (p) => p.category === category
        );

        if (categoryProducts.length === 0) return;

        // Ưu tiên bestSeller, sau đó lấy ngẫu nhiên
        const bestSellers = categoryProducts.filter((p) => p.bestSeller);
        const others = categoryProducts.filter((p) => !p.bestSeller);

        // Shuffle để đa dạng
        const shuffledBestSellers = [...bestSellers].sort(
            () => Math.random() - 0.5
        );
        const shuffledOthers = [...others].sort(() => Math.random() - 0.5);

        // Lấy từ bestSeller trước
        const fromBestSellers = shuffledBestSellers.slice(0, maxPerCategory);
        selectedProducts.push(...fromBestSellers);

        // Nếu chưa đủ, lấy thêm từ others
        if (fromBestSellers.length < maxPerCategory) {
            const needed = maxPerCategory - fromBestSellers.length;
            selectedProducts.push(...shuffledOthers.slice(0, needed));
        }
    });

    // Nếu chưa đủ, lấy thêm sản phẩm từ tất cả categories (ưu tiên bestSeller)
    if (selectedProducts.length < totalProducts) {
        const remaining = totalProducts - selectedProducts.length;
        const selectedIds = new Set(selectedProducts.map((p) => p.id));

        // Lấy bestSeller trước
        const allBestSellers = products
            .filter((p) => p.bestSeller && !selectedIds.has(p.id))
            .sort(() => Math.random() - 0.5);

        const fromBestSellers = allBestSellers.slice(0, remaining);
        selectedProducts.push(...fromBestSellers);

        // Nếu vẫn chưa đủ, lấy thêm từ tất cả sản phẩm
        if (selectedProducts.length < totalProducts) {
            const stillNeeded = totalProducts - selectedProducts.length;
            const allOthers = products
                .filter(
                    (p) =>
                        !selectedIds.has(p.id) &&
                        !selectedProducts.find((sp) => sp.id === p.id)
                )
                .sort(() => Math.random() - 0.5)
                .slice(0, stillNeeded);
            selectedProducts.push(...allOthers);
        }
    }

    // Shuffle lại để đa dạng hơn
    const shuffled = [...selectedProducts].sort(() => Math.random() - 0.5);

    // Trả về tối đa totalProducts sản phẩm
    return shuffled.slice(0, totalProducts);
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
        }" role="listitem" aria-label="Sản phẩm ${product.categoryName}">
            <div class="image-container">
                <img src="${normalizePath(product.image)}" 
                     alt="${product.categoryName} - ${formatPriceToYen(
                product.price
            )}" 
                     class="slider-img" 
                     data-product-id="${product.id}"
                     loading="${index < 3 ? "eager" : "lazy"}"
                     onerror="handleImageError(this)"
                     style="cursor: pointer;">
            </div>
            <div class="slider-info">
                <div class="slider-price">${formatPriceToYen(
                    product.price
                )}</div>
                <a href="${createMessengerOrderLink(
                    product.name,
                    formatPriceToYen(product.price),
                    product.categoryName
                )}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="order-btn"
                   aria-label="Đặt hàng ${product.categoryName}">
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
                    ${
                        product.bestSeller
                            ? '<div class="best-seller-badge">HOT</div>'
                            : ""
                    }
                    <img src="${normalizePath(product.image)}" 
                         alt="${product.categoryName} - ${formatPriceToYen(
                    product.price
                )}" 
                         class="product-image" 
                         data-product-id="${product.id}"
                         loading="${index < 4 ? "eager" : "lazy"}"
                         onerror="handleImageError(this)"
                         style="cursor: pointer;">
                </div>
                <div class="product-info">
                    <div class="product-price-wrapper">
                        <div class="product-price">${formatPriceToYen(
                            product.price
                        )}</div>
                        ${
                            product.purchases
                                ? `<div class="product-purchases">${product.purchases}+ người đã mua</div>`
                                : ""
                        }
                    </div>
                    <a href="${createMessengerOrderLink(
                        product.name,
                        formatPriceToYen(product.price),
                        product.categoryName
                    )}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="order-btn"
                       aria-label="Đặt hàng ${product.categoryName}">
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

    // Show loading spinner
    showPageLoader();

    // Show loading briefly
    showLoadingSkeleton(productsPerPage);
    setTimeout(() => {
        displayProductsPaginated(filtered);
        hidePageLoader();
    }, 200);

    window.scrollTo({
        top: document.querySelector(".products-section").offsetTop - 100,
        behavior: "smooth",
    });
}

// ==================== HÀM LỌC & TÌM KIẾM ====================
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
            // Hiển thị tất cả áo nữ (bao gồm áo đông nữ)
            filtered = filtered.filter(
                (p) => p.category === "ao-nu" || p.category === "ao-dong-nu"
            );
        } else if (currentCategory === "ao-nam") {
            // Hiển thị tất cả áo nam (bao gồm áo đông nam)
            filtered = filtered.filter(
                (p) => p.category === "ao-nam" || p.category === "ao-dong-nam"
            );
        } else if (currentCategory === "giay-nu") {
            // Hiển thị tất cả giày nữ (bao gồm boot nữ và giày sneaker)
            filtered = filtered.filter(
                (p) =>
                    p.category === "giay-nu" ||
                    p.category === "boot-nu" ||
                    p.category === "giay-the-thao"
            );
        } else if (currentCategory === "giay-nam") {
            // Hiển thị tất cả giày nam (bao gồm giày sneaker nam)
            filtered = filtered.filter(
                (p) =>
                    p.category === "giay-nam" ||
                    p.category === "giay-sneaker-nam"
            );
        } else {
            filtered = filtered.filter((p) => p.category === currentCategory);
        }
    }

    // Apply tab filter if active
    const activeTab = document.querySelector(".tab-btn.active");
    if (activeTab) {
        const tab = activeTab.dataset.tab;
        if (tab === "hot") {
            filtered = filtered.filter((p) => p.bestSeller);
        } else if (tab === "recommended") {
            // Shuffle and take top products
            filtered = [...filtered]
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.min(filtered.length, 30));
        }
    }

    if (searchQuery)
        filtered = filtered.filter((p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
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

    // Đã tắt thông báo khi tìm kiếm
}

// ==================== PRODUCT IMAGE GALLERY ====================
let currentGalleryImages = [];
let currentGalleryIndex = 0;
let galleryZoomLevel = 1;

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
    if (currentGalleryImages.length === 0) {
        // Đã tắt thông báo
        return;
    }

    currentGalleryIndex = Math.max(
        0,
        Math.min(imageIndex, currentGalleryImages.length - 1)
    );
    galleryZoomLevel = 1;

    const modal = document.getElementById("productGalleryModal");
    const mainImage = document.getElementById("galleryMainImage");
    const productName = document.getElementById("galleryProductName");
    const productPrice = document.getElementById("galleryProductPrice");
    const currentIndexSpan = document.getElementById("galleryCurrentIndex");
    const totalImagesSpan = document.getElementById("galleryTotalImages");
    const thumbnailsContainer = document.getElementById("galleryThumbnails");

    if (!modal || !mainImage) return;

    // Set product info
    if (productName) productName.textContent = product.name;
    if (productPrice)
        productPrice.textContent = formatPriceToYen(product.price);
    if (currentIndexSpan)
        currentIndexSpan.textContent = currentGalleryIndex + 1;
    if (totalImagesSpan)
        totalImagesSpan.textContent = currentGalleryImages.length;

    // Set main image
    mainImage.src = normalizePath(currentGalleryImages[currentGalleryIndex]);
    mainImage.style.transform = "scale(1)";

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
        const mainImage = document.getElementById("galleryMainImage");
        if (mainImage) {
            mainImage.style.transform = "scale(1)";
        }
    }
}

function goToGalleryImage(index) {
    if (index < 0 || index >= currentGalleryImages.length) return;

    currentGalleryIndex = index;
    galleryZoomLevel = 1;

    const mainImage = document.getElementById("galleryMainImage");
    const currentIndexSpan = document.getElementById("galleryCurrentIndex");
    const thumbnails = document.querySelectorAll(".gallery-thumbnail");

    if (mainImage) {
        mainImage.style.opacity = "0";
        setTimeout(() => {
            mainImage.src = normalizePath(currentGalleryImages[currentGalleryIndex]);
            mainImage.style.transform = "scale(1)";
            mainImage.style.opacity = "1";
        }, 150);
    }

    if (currentIndexSpan) {
        currentIndexSpan.textContent = currentGalleryIndex + 1;
    }

    // Update thumbnails
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle("active", i === currentGalleryIndex);
    });
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
        galleryZoomLevel = Math.min(galleryZoomLevel + 0.25, 3);
    } else if (direction === "out") {
        galleryZoomLevel = Math.max(galleryZoomLevel - 0.25, 1);
    } else if (direction === "reset") {
        galleryZoomLevel = 1;
    }

    mainImage.style.transform = `scale(${galleryZoomLevel})`;
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

    // Touch swipe for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    const mainImageWrapper = document.querySelector(
        ".gallery-main-image-wrapper"
    );

    if (mainImageWrapper) {
        mainImageWrapper.addEventListener(
            "touchstart",
            (e) => {
                touchStartX = e.changedTouches[0].screenX;
            },
            { passive: true }
        );

        mainImageWrapper.addEventListener(
            "touchend",
            (e) => {
                touchEndX = e.changedTouches[0].screenX;
                const diff = touchStartX - touchEndX;
                if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                        nextGalleryImage();
                    } else {
                        prevGalleryImage();
                    }
                }
            },
            { passive: true }
        );
    }

    // Mouse drag for desktop
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let currentX = 0;
    let currentY = 0;
    const mainImage = document.getElementById("galleryMainImage");

    if (mainImage) {
        mainImage.addEventListener("mousedown", (e) => {
            if (galleryZoomLevel > 1) {
                isDragging = true;
                dragStartX = e.clientX - currentX;
                dragStartY = e.clientY - currentY;
                mainImage.style.cursor = "grabbing";
            }
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging && galleryZoomLevel > 1) {
                e.preventDefault();
                currentX = e.clientX - dragStartX;
                currentY = e.clientY - dragStartY;
                mainImage.style.transform = `scale(${galleryZoomLevel}) translate(${
                    currentX / galleryZoomLevel
                }px, ${currentY / galleryZoomLevel}px)`;
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                mainImage.style.cursor = galleryZoomLevel > 1 ? "grab" : "move";
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
                    "ao-nu": {
                        btnId: "aoNuBtn",
                        subId: "aoNuSubcategories",
                    },
                    "giay-nu": {
                        btnId: "giayNuBtn",
                        subId: "giayNuSubcategories",
                    },
                    vay: {
                        btnId: "vayBtn",
                        subId: "vaySubcategories",
                    },
                    "ao-nam": {
                        btnId: "aoNamBtn",
                        subId: "aoNamSubcategories",
                    },
                    "giay-nam": {
                        btnId: "giayNamBtn",
                        subId: "giayNamSubcategories",
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
                    "quan-dai-nu": "Quần dài nữ",
                    "tui-xach": "Túi xách",
                    "tui-xach-nam": "Túi xách nam",
                    "tui-xach-nu": "Túi xách nữ",
                    "giay-nu": "Giày nữ",
                    "ao-nam": "Áo Nam",
                    "ao-dong-nam": "Áo đông nam",
                    "giay-nam": "Giày Nam",
                    "giay-sneaker-nam": "Giày Sneaker",
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
            if (currentCategory !== "all") {
                if (currentCategory === "tui-xach") {
                    filtered = filtered.filter(
                        (p) =>
                            p.category === "tui-xach" ||
                            p.category === "tui-xach-nam" ||
                            p.category === "tui-xach-nu"
                    );
                } else {
                    filtered = filtered.filter(
                        (p) => p.category === currentCategory
                    );
                }
            }

            // Apply tab filter
            if (tab === "hot") {
                filtered = filtered.filter((p) => p.bestSeller);
            } else if (tab === "recommended") {
                // Shuffle and take top products
                filtered = [...filtered]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Math.min(filtered.length, 30));
            }

            // Apply search if any
            if (searchQuery) {
                filtered = filtered.filter((p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    }, 6000); // Increased to 6 seconds for better UX

    const sliderContainer = document.querySelector(".slider-container");
    if (sliderContainer) {
        sliderContainer.addEventListener("mouseenter", () => {
            clearInterval(slideInterval);
        });
        sliderContainer.addEventListener("mouseleave", () => {
            clearInterval(slideInterval);
            slideInterval = setInterval(() => {
                nextSlide();
            }, 6000);
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
                slideInterval = setInterval(nextSlide, 5000);
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
