/**
 * Script để normalize và sửa lỗi encoding trong products.json
 * CHẠY SCRIPT NÀY SAU MỖI LẦN CHỈNH SỬA FILE products.json THỦ CÔNG
 * 
 * Cách dùng:
 *   node normalize-products-json.js
 */

const fs = require('fs');
const path = require('path');

// Copy logic repair từ script.js
const WIN1252_CHAR_TO_BYTE = {
    "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
    "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
    "\u2030": 0x89, "\u0160": 0x8a, "\u2039": 0x8b, "\u0152": 0x8c,
    "\u017D": 0x8e, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
    "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
    "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9a, "\u203A": 0x9b,
    "\u0153": 0x9c, "\u017E": 0x9e, "\u0178": 0x9f,
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
    const looksBroken = /Ã|Â|Ä|Å|Æ|Ç|Ð|Ñ|Ø|Þ/.test(input) ||
        input.includes("áº") || input.includes("á»") || input.includes("\ufffd");
    if (!looksBroken) return input;
    
    try {
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const bytes = singleByteBytesFromString(input);
        let decoded = "";
        if (bytes) {
            decoded = decoder.decode(bytes);
        } else {
            let out = "", chunk = [];
            for (let i = 0; i < input.length; i++) {
                const code = input.charCodeAt(i);
                const mapped = code <= 255 ? code : WIN1252_CHAR_TO_BYTE[input[i]];
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
            if (chunk.length) out += decoder.decode(Uint8Array.from(chunk));
            decoded = out;
        }
        if (!decoded || decoded === input) return input;
        const score = (s) => (s.match(/Ã/g) || []).length + (s.match(/Â/g) || []).length +
            (s.match(/áº/g) || []).length + (s.match(/á»/g) || []).length +
            (s.includes("\ufffd") ? 10 : 0);
        return score(decoded) < score(input) ? decoded : input;
    } catch (e) {
        return input;
    }
}

function normalizeWhitespace(str) {
    if (typeof str !== "string") return str;
    return str.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePriceString(price) {
    if (price === undefined || price === null) return price;
    let s = normalizeWhitespace(repairUtf8Mojibake(String(price)));
    // Loại bỏ "Â" trước ký hiệu tiền
    s = s.replace(/Â(?=\s*[¥₫đ])/g, "");
    
    // Đảm bảo format đúng: ¥{số}
    if (s.includes('¥') || s.includes('y') || s.includes('Y')) {
        s = s.replace(/[yY]/g, '¥');
        if (!s.startsWith('¥')) {
            s = s.replace(/¥/g, '');
            s = '¥' + s.replace(/[^0-9]/g, '');
        } else {
            s = '¥' + s.replace(/¥/g, '').replace(/[^0-9]/g, '');
        }
    } else {
        const numbers = s.replace(/[^0-9]/g, '');
        if (numbers) s = '¥' + numbers;
    }
    
    return s;
}

function sanitizeProduct(product) {
    if (!product || typeof product !== "object") return product;
    return {
        ...product,
        name: normalizeWhitespace(repairUtf8Mojibake(product.name ?? "")),
        categoryName: normalizeWhitespace(repairUtf8Mojibake(product.categoryName ?? "")),
        keywords: normalizeWhitespace(repairUtf8Mojibake(product.keywords ?? "")),
        price: normalizePriceString(product.price ?? ""),
    };
}

// Main
const jsonPath = path.join(__dirname, 'assets', 'products.json');
console.log('🔄 Đang normalize file:', jsonPath);

let text = fs.readFileSync(jsonPath, 'utf8');
const hasBom = text.charCodeAt(0) === 0xFEFF;
if (hasBom) {
    text = text.replace(/^\uFEFF/, '');
    console.log('⚠️  Đã loại bỏ UTF-8 BOM');
}

let data;
try {
    data = JSON.parse(text);
} catch (e) {
    console.error('❌ Lỗi parse JSON:', e.message);
    process.exit(1);
}

console.log(`📦 Đã đọc ${data.length} sản phẩm`);

// Kiểm tra xem có lỗi encoding không
let hasErrors = false;
const sample = data[0];
if (sample) {
    const oldName = sample.name;
    const oldPrice = sample.price;
    const fixedName = normalizeWhitespace(repairUtf8Mojibake(oldName));
    const fixedPrice = normalizePriceString(oldPrice);
    
    if (oldName !== fixedName || oldPrice !== fixedPrice) {
        hasErrors = true;
        console.log('\n⚠️  Phát hiện lỗi encoding:');
        console.log('  name:', oldName, '→', fixedName);
        console.log('  price:', oldPrice, '→', fixedPrice);
    }
}

// Sửa tất cả products
const fixed = data.map(sanitizeProduct);

// Đếm số lượng giá bị lỗi "Â"
const priceErrors = fixed.filter(p => {
    const old = data.find(orig => orig.id === p.id);
    return old && old.price !== p.price && old.price.includes('Â');
}).length;

if (priceErrors > 0) {
    console.log(`\n🔧 Đã sửa ${priceErrors} giá bị lỗi "Â"`);
}

// Backup
const backupPath = jsonPath + '.backup.' + Date.now();
fs.copyFileSync(jsonPath, backupPath);
console.log(`\n📦 Backup: ${backupPath}`);

// Ghi lại file với UTF-8 (KHÔNG BOM) và format đẹp
const output = JSON.stringify(fixed, null, 4);
fs.writeFileSync(jsonPath, output, { encoding: 'utf8' });

console.log('✅ Đã normalize và ghi lại file');
console.log('✨ Hoàn tất! File đã được đảm bảo encoding UTF-8 đúng.');

