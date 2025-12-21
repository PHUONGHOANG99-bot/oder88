/**
 * Script an toàn để cập nhật giá sản phẩm trong products.json
 * Đảm bảo encoding UTF-8 đúng và không bị lỗi "Â" trước ký hiệu ¥
 * 
 * Cách dùng:
 *   node update-price-safe.js <productId> <newPrice>
 * 
 * Ví dụ:
 *   node update-price-safe.js 1 2500
 *   node update-price-safe.js 1 ¥2500
 */

const fs = require('fs');
const path = require('path');

// Đảm bảo giá luôn có format đúng: ¥{số}
function normalizePrice(priceInput) {
    if (!priceInput) return null;
    
    let priceStr = String(priceInput).trim();
    
    // Loại bỏ các ký tự rác như "Â" trước ký hiệu tiền
    priceStr = priceStr.replace(/Â(?=\s*[¥₫đ])/g, '');
    
    // Nếu có ký hiệu yên, giữ nguyên (đảm bảo là ¥ Unicode đúng)
    if (priceStr.includes('¥') || priceStr.includes('y') || priceStr.includes('Y')) {
        priceStr = priceStr.replace(/[yY]/g, '¥');
        // Loại bỏ tất cả ¥ trừ cái đầu tiên
        const yenCount = (priceStr.match(/¥/g) || []).length;
        if (yenCount > 1) {
            priceStr = '¥' + priceStr.replace(/¥/g, '');
        } else if (!priceStr.startsWith('¥')) {
            priceStr = priceStr.replace(/¥/g, '');
            priceStr = '¥' + priceStr;
        }
        return priceStr;
    }
    
    // Nếu chỉ có số, thêm ký hiệu ¥ (Unicode U+00A5)
    const numbersOnly = priceStr.replace(/[^0-9]/g, '');
    if (numbersOnly) {
        return '¥' + numbersOnly;
    }
    
    return null;
}

// Repair UTF-8 mojibake (copy từ script.js)
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

function normalizePriceString(price) {
    if (price === undefined || price === null) return price;
    let s = String(price).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    s = repairUtf8Mojibake(s);
    s = s.replace(/Â(?=\s*[¥₫đ])/g, "");
    return normalizePrice(s);
}

// Main
const jsonPath = path.join(__dirname, 'assets', 'products.json');
const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Cách dùng: node update-price-safe.js <productId> <newPrice>');
    console.log('Ví dụ: node update-price-safe.js 1 2500');
    console.log('       node update-price-safe.js 1 ¥2500');
    process.exit(1);
}

const productId = parseInt(args[0]);
const newPriceInput = args[1];

if (isNaN(productId)) {
    console.error('❌ Product ID phải là số!');
    process.exit(1);
}

// Đọc file với UTF-8 (loại bỏ BOM nếu có)
let text = fs.readFileSync(jsonPath, 'utf8');
const hasBom = text.charCodeAt(0) === 0xFEFF;
if (hasBom) {
    text = text.replace(/^\uFEFF/, '');
    console.log('⚠️  Đã loại bỏ UTF-8 BOM từ file');
}

let data;
try {
    data = JSON.parse(text);
} catch (e) {
    console.error('❌ Lỗi parse JSON:', e.message);
    process.exit(1);
}

// Tìm sản phẩm
const product = data.find(p => p.id === productId);
if (!product) {
    console.error(`❌ Không tìm thấy sản phẩm với ID ${productId}`);
    process.exit(1);
}

// Normalize giá mới
const oldPrice = product.price;
const normalizedPrice = normalizePriceString(newPriceInput);

if (!normalizedPrice) {
    console.error('❌ Giá không hợp lệ!');
    process.exit(1);
}

// Cập nhật giá
product.price = normalizedPrice;

// Backup
const backupPath = jsonPath + '.backup.' + Date.now();
fs.copyFileSync(jsonPath, backupPath);

// Ghi lại file với UTF-8 (KHÔNG BOM) và format đẹp
const output = JSON.stringify(data, null, 4);
fs.writeFileSync(jsonPath, output, { encoding: 'utf8' });

console.log('✅ Đã cập nhật giá:');
console.log(`   ID: ${productId}`);
console.log(`   Tên: ${product.name}`);
console.log(`   Giá cũ: ${oldPrice}`);
console.log(`   Giá mới: ${normalizedPrice}`);
console.log(`\n📦 Backup đã lưu tại: ${backupPath}`);
console.log('✨ Hoàn tất!');

