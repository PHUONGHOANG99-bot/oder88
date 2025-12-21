# Hướng dẫn thêm video YouTube vào sản phẩm

## Cách 1: Sử dụng script tự động (Khuyến nghị)

### Bước 1: Mở file `add-youtube-videos.js`

### Bước 2: Chỉnh sửa mảng `videos` với link của bạn

Có 3 cách để thêm video:

#### Cách A: Gắn link vào sản phẩm cụ thể theo ID

```javascript
const videos = [
    { productId: 1, link: "https://www.youtube.com/watch?v=VIDEO_ID_1" },
    { productId: 2, link: "https://youtu.be/VIDEO_ID_2" },
    { productId: 100, link: "https://www.youtube.com/embed/VIDEO_ID_3" }
];
```

#### Cách B: Gắn link vào các sản phẩm liên tiếp bắt đầu từ ID

```javascript
const videos = [
    { 
        startProductId: 100, 
        links: [
            "https://www.youtube.com/watch?v=VIDEO_ID_1",
            "https://youtu.be/VIDEO_ID_2",
            "https://www.youtube.com/embed/VIDEO_ID_3"
        ]
    }
];
```

#### Cách C: Gắn link vào sản phẩm trong category cụ thể

```javascript
const videos = [
    { 
        category: "tui-xach-nu", 
        startIndex: 0,  // Bắt đầu từ sản phẩm đầu tiên trong category
        links: [
            "https://www.youtube.com/watch?v=VIDEO_ID_1",
            "https://youtu.be/VIDEO_ID_2",
            "https://www.youtube.com/embed/VIDEO_ID_3"
        ]
    }
];
```

### Bước 3: Chạy script

```bash
node add-youtube-videos.js
```

## Cách 2: Thêm trực tiếp vào products.json

Nếu bạn muốn thêm thủ công, mở file `assets/products.json` và thêm trường `"video"` vào sản phẩm:

```json
{
    "id": 1,
    "name": "Tên sản phẩm",
    "price": "¥2402",
    "category": "quan-dai-nu",
    "categoryName": "Quần dài nữ",
    "image": "assets/image/quan-dai-nu/qd1.jpg",
    "video": "https://www.youtube.com/embed/VIDEO_ID",
    "bestSeller": true,
    "purchases": 300
}
```

**Lưu ý:** Link phải ở định dạng embed: `https://www.youtube.com/embed/VIDEO_ID`

## Các định dạng link YouTube được hỗ trợ

Script tự động chuyển đổi các định dạng sau sang embed:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID` (giữ nguyên)

## Ví dụ thực tế

Nếu bạn có 5 video YouTube Shorts và muốn gắn vào 5 sản phẩm đầu tiên trong category "tui-xach-nu":

```javascript
const videos = [
    { 
        category: "tui-xach-nu", 
        startIndex: 0,
        links: [
            "https://www.youtube.com/shorts/abc123",
            "https://youtu.be/def456",
            "https://www.youtube.com/watch?v=ghi789",
            "https://youtu.be/jkl012",
            "https://www.youtube.com/shorts/mno345"
        ]
    }
];
```

Sau đó chạy: `node add-youtube-videos.js`

