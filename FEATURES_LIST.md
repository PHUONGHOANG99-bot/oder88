# DANH SÁCH CHỨC NĂNG ĐẦY ĐỦ - ODER88 SHOP

## 📦 QUẢN LÝ DỮ LIỆU
1. **Load sản phẩm từ JSON** - Đọc và parse products.json
2. **UTF-8 Mojibake Fix** - Sửa lỗi encoding (ví dụ: "Quáº§n dÃ i..." → "Quần dài...")
3. **Sanitize Product Data** - Chuẩn hóa dữ liệu sản phẩm (name, price, categoryName, keywords)
4. **Normalize Path** - Xử lý đường dẫn cho GitHub Pages và localhost
5. **Product Shuffle** - Xáo trộn sản phẩm với seed trong localStorage

## 💰 XỬ LÝ GIÁ CẢ
6. **Format Giá Yên** - Hiển thị giá với ký hiệu ¥
7. **Convert Yên → VND** - Quy đổi (tỷ giá 1¥ = 170 VND)
8. **Format VND** - Hiển thị VND với dấu chấm ngăn cách (1.000.000)
9. **Format Price with VND** - Hiển thị cả Yên và VND cùng lúc
10. **Get Yen Amount** - Lấy số Yên từ chuỗi giá

## 🏷️ QUẢN LÝ DANH MỤC
11. **Desktop Categories** - Hiển thị danh mục trên desktop
12. **Mobile Categories Menu** - Menu danh mục trên mobile
13. **Subcategories Panel** - Hiển thị danh mục con
14. **Category Selection** - Chọn danh mục và lọc sản phẩm
15. **Category Indicator** - Hiển thị danh mục đang chọn
16. **Back Button** - Nút quay lại trang chủ (hiện khi đang ở danh mục)

## 🔍 TÌM KIẾM & LỌC
17. **Search Input** - Ô tìm kiếm sản phẩm
18. **Search Clear Button** - Nút xóa tìm kiếm
19. **Vietnamese Tone-Insensitive Search** - Tìm kiếm không phân biệt dấu
20. **Search Keywords Generation** - Tạo từ khóa tìm kiếm từ category, name, keywords
21. **Product Filtering** - Lọc sản phẩm theo category và search query
22. **Subcategory Filtering** - Xử lý lọc cho subcategories (tui-xach, vay)

## 📄 PHÂN TRANG & HIỂN THỊ
23. **Pagination** - Phân trang sản phẩm (40 sản phẩm/trang)
24. **Page Navigation** - Chuyển trang, hiển thị số trang
25. **Products Grid** - Lưới hiển thị sản phẩm
26. **Product Cards** - Card sản phẩm với hình ảnh, tên, giá
27. **Loading Skeleton** - Hiển thị skeleton khi đang load
28. **No Results Message** - Thông báo khi không tìm thấy sản phẩm

## 🎠 SLIDER SẢN PHẨM NỔI BẬT
29. **Featured Slider** - Slider hiển thị sản phẩm bán chạy
30. **Get Best Sellers** - Lấy danh sách sản phẩm bán chạy
31. **Slider Navigation** - Nút prev/next cho slider
32. **Slider Dots** - Chấm điều hướng slider
33. **Go To Slide** - Chuyển đến slide cụ thể
34. **Auto Width Calculation** - Tự động tính toán width slider

## 🖼️ GALLERY SẢN PHẨM
35. **Product Gallery Modal** - Modal xem chi tiết sản phẩm
36. **Gallery Images** - Hiển thị nhiều ảnh sản phẩm
37. **Gallery Thumbnails** - Ảnh thu nhỏ
38. **Gallery Navigation** - Chuyển ảnh prev/next
39. **Gallery Zoom** - Zoom in/out ảnh (zoom in, zoom out, reset)
40. **Gallery Pan** - Di chuyển ảnh khi đã zoom
41. **YouTube Video Support** - Hỗ trợ video YouTube trong gallery
42. **Video/Image Toggle** - Chuyển đổi giữa xem ảnh và video
43. **Video Play Overlay** - Overlay phát video
44. **Gallery Image Counter** - Hiển thị số ảnh hiện tại / tổng số
45. **Open Product Gallery** - Mở gallery từ product card
46. **Close Product Gallery** - Đóng gallery

## 🛒 GIỎ HÀNG
47. **Load Cart from localStorage** - Đọc giỏ hàng từ localStorage
48. **Save Cart to localStorage** - Lưu giỏ hàng vào localStorage
49. **Add to Cart** - Thêm sản phẩm vào giỏ hàng
50. **Remove from Cart** - Xóa sản phẩm khỏi giỏ hàng
51. **Update Cart Quantity** - Cập nhật số lượng sản phẩm
52. **Change Cart Item Size** - Thay đổi size sản phẩm trong giỏ hàng
53. **Size Selection Modal** - Modal chọn size (cho một số danh mục)
54. **Needs Size Check** - Kiểm tra category có cần chọn size không
55. **Get Sizes for Category** - Lấy danh sách size theo category
56. **Normalize Cart Item** - Chuẩn hóa dữ liệu item trong giỏ hàng
57. **Cart Badge** - Hiển thị số lượng sản phẩm trên icon giỏ hàng
58. **Cart Modal** - Modal hiển thị giỏ hàng
59. **Cart Items Display** - Hiển thị danh sách sản phẩm trong giỏ
60. **Cart Empty State** - Hiển thị khi giỏ hàng trống
61. **Select All Items** - Chọn tất cả sản phẩm trong giỏ
62. **Toggle Select Item** - Chọn/bỏ chọn từng sản phẩm
63. **Update Select All Button** - Cập nhật trạng thái nút chọn tất cả
64. **Update Cart Total** - Tính và hiển thị tổng tiền (chỉ các item được chọn)
65. **Cart Total Yen & VND** - Hiển thị tổng tiền cả Yên và VND
66. **Checkout Cart** - Đặt hàng (mở Messenger với thông tin đơn hàng)
67. **Animate Product to Cart** - Animation khi thêm vào giỏ hàng
68. **Update Cart UI** - Cập nhật UI giỏ hàng (badge, modal)
69. **Toggle Cart** - Mở/đóng giỏ hàng
70. **Open Cart** - Mở giỏ hàng
71. **Close Cart** - Đóng giỏ hàng
72. **Is Cart Open** - Kiểm tra giỏ hàng có đang mở không
73. **Remember Bottom Nav Active** - Nhớ trạng thái bottom nav trước khi mở cart

## 📱 THÔNG TIN VẬN CHUYỂN
74. **Shipping Info Modal** - Modal thông tin vận chuyển và phí ship
75. **Show Shipping Info** - Hiển thị modal thông tin vận chuyển
76. **Close Shipping Info** - Đóng modal thông tin vận chuyển

## 💬 TÍCH HỢP MESSENGER
77. **Open Messenger App** - Mở ứng dụng Messenger (mobile) hoặc web (desktop)
78. **Create Messenger Order Link** - Tạo link đặt hàng qua Messenger
79. **Escape Message for HTML** - Escape ký tự đặc biệt cho HTML

## 🔔 THÔNG BÁO & UI
80. **Toast Notifications** - Hiển thị thông báo (success, error, info)
81. **Show Toast** - Hiển thị toast với message, type, duration
82. **Page Loader** - Spinner loading khi tải trang
83. **Show Page Loader** - Hiển thị loader
84. **Hide Page Loader** - Ẩn loader

## 🎨 GIAO DIỆN & ĐIỀU HƯỚNG
85. **Theme Toggle** - Chuyển đổi dark/light mode
86. **Theme Detection** - Tự động detect theme từ localStorage hoặc system preference
87. **Scroll to Top Button** - Nút cuộn lên đầu trang
88. **Init Scroll to Top** - Khởi tạo nút scroll to top
89. **Bottom Navigation** - Thanh điều hướng dưới cùng (mobile)
90. **Bottom Nav Active State** - Quản lý trạng thái active của bottom nav
91. **Init Bottom Nav** - Khởi tạo bottom navigation
92. **Handle Scroll for Bottom Nav** - Xử lý scroll để ẩn/hiện bottom nav
93. **Update Bottom Nav Active** - Cập nhật item active trong bottom nav
94. **Mobile Menu Toggle** - Mở/đóng menu mobile
95. **Create Overlay** - Tạo overlay cho modal/menu

## 🔄 TÁC VỤ KHÁC
96. **Reload Page** - Reload trang (lưu cart trước khi reload)
97. **Scroll to Products** - Cuộn đến phần sản phẩm
98. **Go Back to Home** - Quay về trang chủ
99. **Reset to Home** - Reset về trang chủ (clear category, search)
100. **Focus Search** - Focus vào ô tìm kiếm

## 🎬 TAB FILTERS
101. **Products Tabs** - Tab lọc sản phẩm (Tất cả, Bán chạy, Xu hướng, Gợi ý)
102. **Tab All** - Hiển thị tất cả sản phẩm
103. **Tab Hot** - Hiển thị sản phẩm bán chạy
104. **Tab Trending** - Hiển thị sản phẩm xu hướng
105. **Tab Recommended** - Hiển thị sản phẩm gợi ý
106. **Tab Active State** - Quản lý trạng thái active của tab

## 📱 PWA & SHARING
107. **PWA Install** - Chức năng cài đặt PWA
108. **Init PWA Install** - Khởi tạo PWA install
109. **Create Install Button** - Tạo nút cài đặt
110. **Show Install Button** - Hiển thị nút cài đặt
111. **Hide Install Button** - Ẩn nút cài đặt
112. **Install PWA** - Cài đặt PWA
113. **Show Install Instructions** - Hiển thị hướng dẫn cài đặt
114. **Share API** - Sử dụng Web Share API
115. **Init Share API** - Khởi tạo Share API
116. **Add Share Button** - Thêm nút chia sẻ
117. **Share App** - Chia sẻ ứng dụng
118. **Share Product** - Chia sẻ sản phẩm
119. **Copy to Clipboard** - Copy text vào clipboard

## 🔄 SERVICE WORKER
120. **Service Worker Registration** - Đăng ký service worker
121. **Service Worker Update Detection** - Phát hiện cập nhật service worker
122. **Update Notification** - Thông báo khi có cập nhật
123. **Show Update Notification** - Hiển thị thông báo cập nhật
124. **Offline Support** - Hỗ trợ offline (cache assets)

## ⚡ TỐI ƯU HIỆU SUẤT
125. **Intersection Observer** - Lazy loading và scroll animations
126. **Init Intersection Observer** - Khởi tạo Intersection Observer
127. **Image Observer** - Observer cho lazy load images
128. **Performance Optimizations** - Các tối ưu hiệu suất
129. **Init Performance Optimizations** - Khởi tạo các tối ưu
130. **Preload Next Page Images** - Preload ảnh trang tiếp theo
131. **Update Scroll Effects** - Cập nhật hiệu ứng scroll
132. **Handle Resize** - Xử lý khi resize window

## 🖼️ XỬ LÝ HÌNH ẢNH
133. **Handle Image Error** - Xử lý lỗi load ảnh (fallback placeholder)
134. **Lazy Load Images** - Tải ảnh lazy loading
135. **Image Loading State** - Trạng thái loading của ảnh

## 🔧 UTILITIES
136. **Get Category Display Name** - Lấy tên hiển thị của category
137. **Get Purchase Count** - Lấy số lượng đã bán
138. **Remove Vietnamese Tones** - Bỏ dấu tiếng Việt
139. **Normalize Whitespace** - Chuẩn hóa khoảng trắng
140. **Setup Event Listeners** - Gắn các event listeners
141. **Initialize App** - Khởi tạo ứng dụng

## 📋 TỔNG KẾT
**Tổng số chức năng: 141 chức năng**

