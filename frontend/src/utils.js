// Automatically convert Arabic numerals (١٢٣) to English (123)
export const toEnglishDigits = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
              .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵٦٧٨٩'.indexOf(d));
};

// Generate a clean, short 5-digit receipt number from a UUID
export const getShortId = (uuidStr) => {
    if (!uuidStr) return '0000';
    const clean = uuidStr.replace(/[^a-fA-F0-9]/g, '');
    if (clean.length < 6) return '0000';
    const num = parseInt(clean.slice(-6), 16);
    return (10000 + (num % 90000)).toString();
};

// Popular brands and their models map
export const BRAND_MODELS = {
    "Apple": [
        "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Plus", "iPhone 17", "iPhone 17 Slim",
        "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
        "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
        "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
        "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
        "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini",
        "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
        "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
        "iPhone 8 Plus", "iPhone 8", "iPhone 7 Plus", "iPhone 7",
        "iPhone SE (2022)", "iPhone SE (2020)", "iPhone 6s Plus", "iPhone 6s",
        "iPad 10", "iPad 9", "iPad 8", "iPad 7", "iPad 6",
        "iPad Air 6", "iPad Air 5", "iPad Air 4", "iPad Air 3",
        "iPad Pro 12.9", "iPad Pro 11", "iPad mini 6", "iPad mini 5",
        "Apple Watch Ultra 2", "Apple Watch Series 9", "Apple Watch SE"
    ],
    "Samsung": [
        "Galaxy S26 Ultra", "Galaxy S26+", "Galaxy S26", "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25",
        "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23",
        "Galaxy S22 Ultra", "Galaxy S22+", "Galaxy S22", "Galaxy S21 Ultra", "Galaxy S21+", "Galaxy S21",
        "Galaxy S20 Ultra", "Galaxy S20+", "Galaxy S20", "Galaxy Note 20 Ultra", "Galaxy Note 20",
        "Galaxy Note 10+", "Galaxy Note 10", "Galaxy Note 9", "Galaxy Note 8", "Galaxy Note 7",
        "Galaxy Z Fold6", "Galaxy Z Flip6", "Galaxy Z Fold5", "Galaxy Z Flip5", "Galaxy Z Fold4", "Galaxy Z Flip4",
        "Galaxy A56", "Galaxy A55", "Galaxy A36", "Galaxy A35", "Galaxy A25", "Galaxy A16", "Galaxy A15",
        "Galaxy A54", "Galaxy A34", "Galaxy A24", "Galaxy A14", "Galaxy A05s", "Galaxy A05",
        "Galaxy A73", "Galaxy A53", "Galaxy A33", "Galaxy A23", "Galaxy A13", "Galaxy A04s", "Galaxy A04",
        "Galaxy A72", "Galaxy A52", "Galaxy A32", "Galaxy A22", "Galaxy A12", "Galaxy A03s",
        "Galaxy A71", "Galaxy A51", "Galaxy A31", "Galaxy A21", "Galaxy A11", "Galaxy A80",
        "Galaxy A70", "Galaxy A50", "Galaxy A30", "Galaxy A20", "Galaxy A10", "Galaxy A730",
        "Galaxy A720", "Galaxy A710", "Galaxy A700", "Galaxy A520", "Galaxy A510", "Galaxy A500",
        "Galaxy A320", "Galaxy A310", "Galaxy A300",
        "Galaxy J810", "Galaxy J7 Prime", "Galaxy J7 Pro", "Galaxy J730", "Galaxy J710", "Galaxy J700",
        "Galaxy J610", "Galaxy J600", "Galaxy J530", "Galaxy J510", "Galaxy J500", "Galaxy J415",
        "Galaxy J410", "Galaxy J400", "Galaxy J330", "Galaxy J320", "Galaxy J250", "Galaxy J210",
        "Galaxy J200", "Galaxy J120", "Galaxy J110", "Galaxy J100",
        "Galaxy Note N980", "Galaxy Note N970", "Galaxy Note N960", "Galaxy Note N950", "Galaxy Note N930",
        "Galaxy Note N9200", "Galaxy Note N9100", "Galaxy Note N9000", "Galaxy Note N7100", "Galaxy Note N7000",
        "Galaxy S S931", "Galaxy S S921", "Galaxy S S911", "Galaxy S S901", "Galaxy S G990", "Galaxy S G980",
        "Galaxy S G970", "Galaxy S G960", "Galaxy S G950", "Galaxy S G930", "Galaxy S G920", "Galaxy S G900",
        "Galaxy S I9500", "Galaxy S I9300", "Galaxy S I9100", "Galaxy S I9000",
        "Galaxy M55", "Galaxy M35", "Galaxy M15", "Galaxy M54", "Galaxy M34", "Galaxy M14",
        "Galaxy M53", "Galaxy M33", "Galaxy M23", "Galaxy M13", "Galaxy M52", "Galaxy M32",
        "Galaxy M22", "Galaxy M12", "Galaxy M51", "Galaxy M31", "Galaxy M21", "Galaxy M11",
        "Galaxy M40", "Galaxy M30", "Galaxy M20", "Galaxy M10",
        "Galaxy Z F741 (Flip 6)", "Galaxy Z F731 (Flip 5)", "Galaxy Z F721 (Flip 4)", "Galaxy Z F711 (Flip 3)",
        "Galaxy Z F707 (Flip 5G)", "Galaxy Z F700 (Flip)", "Galaxy Z F956 (Fold 6)", "Galaxy Z F946 (Fold 5)",
        "Galaxy Z F936 (Fold 4)", "Galaxy Z F926 (Fold 3)", "Galaxy Z F907 (Fold 2)", "Galaxy Z F900 (Fold)",
        "Galaxy F55", "Galaxy F54", "Galaxy F52", "Galaxy F42", "Galaxy F41", "Galaxy F34",
        "Galaxy F23", "Galaxy F22", "Galaxy F15", "Galaxy F14", "Galaxy F13", "Galaxy F12", "Galaxy F02"
    ],
    "Xiaomi": [
        "Xiaomi 15 Ultra", "Xiaomi 15 Pro", "Xiaomi 15",
        "Xiaomi 14 Ultra", "Xiaomi 14 Pro", "Xiaomi 14", "Xiaomi 14T",
        "Xiaomi 13 Ultra", "Xiaomi 13 Pro", "Xiaomi 13", "Xiaomi 13T Pro", "Xiaomi 13T",
        "Xiaomi 12 Pro", "Xiaomi 12", "Xiaomi 12S", "Xiaomi 12T",
        "Mi 11T", "Mi 11", "Mi 10T", "Mi 10", "Mi 9", "Mi 8", "Mi 6", "Mi 5", "Mi 4", "Mi 3", "Mi 2", "Mi 1",
        "Redmi Note 14 Pro", "Redmi Note 14", "Redmi Note 13 Pro", "Redmi Note 13",
        "Redmi Note 12 Pro", "Redmi Note 12", "Redmi Note 11 Pro", "Redmi Note 11",
        "Redmi Note 10 Pro", "Redmi Note 10", "Redmi Note 9 Pro", "Redmi Note 9",
        "Redmi Note 8 Pro", "Redmi Note 8", "Redmi Note 7", "Redmi Note 6 Pro",
        "Redmi Note 5", "Redmi Note 4", "Redmi Note 3", "Redmi Note 2", "Redmi Note 1",
        "Redmi 14", "Redmi 13", "Redmi 12", "Redmi 10", "Redmi 9", "Redmi 8", "Redmi 7",
        "Redmi 6", "Redmi 5", "Redmi 4", "Redmi 3", "Redmi 2", "Redmi 1",
        "Redmi 6A", "Redmi 7A", "Redmi 8A", "Redmi 9A", "Redmi 9C", "Redmi 10A", "Redmi 10C",
        "Redmi A3", "Redmi A2", "Redmi A1",
        "Redmi K70", "Redmi K60", "Redmi K50", "Redmi K40", "Redmi K30", "Redmi K20",
        "Poco F6", "Poco F5", "Poco F4", "Poco F3", "Poco F2 Pro", "Poco F1",
        "Poco X6 Pro", "Poco X5 Pro", "Poco X4 Pro", "Poco X3 Pro", "Poco X2",
        "Poco M6 Pro", "Poco M5", "Poco M4", "Poco M3", "Poco M2",
        "Poco C65", "Poco C50", "Poco C40",
        "Xiaomi MIX Fold 4", "Xiaomi MIX Fold 3", "Xiaomi MIX Fold 2", "Xiaomi MIX Fold",
        "Xiaomi MIX Flip", "Xiaomi MIX 4", "Xiaomi MIX 3", "Xiaomi MIX 2S", "Xiaomi MIX 2", "Xiaomi MIX",
        "Xiaomi Civi 4 Pro", "Xiaomi Civi 3", "Xiaomi Civi 2", "Xiaomi Civi 1S", "Xiaomi Civi",
        "Black Shark 5 Pro", "Black Shark 5 RS", "Black Shark 5", "Black Shark 4 Pro", "Black Shark 4S",
        "Black Shark 4", "Black Shark 3S", "Black Shark 3 Pro", "Black Shark 3", "Black Shark 2 Pro",
        "Black Shark 2", "Black Shark Helo", "Black Shark 1"
    ],
    "Huawei": [
        "Pura 70 Ultra", "Pura 70 Pro+", "Pura 70 Pro", "Pura 70",
        "Mate 60 Pro+", "Mate 60 Pro", "Mate 60", "Mate 50 Pro", "Mate 50",
        "P60 Pro", "P60", "P50 Pro", "P50", "Mate 40 Pro", "Mate 30 Pro",
        "P40 Pro", "P40", "P30 Pro", "P30 Lite", "Nova 12 Ultra", "Nova 12 Pro",
        "Nova 12s", "Nova 12i", "Nova 11 Pro", "Nova 11", "Nova 11i", "Nova 10 Pro",
        "Nova 10", "Nova 10 SE", "Nova 9 SE", "Nova 8", "Nova 7i", "Y9a", "Y9 Prime"
    ],
    "Realme": [
        "Realme 14 Pro+", "Realme 14 Pro", "Realme 14",
        "Realme 13 Pro+", "Realme 13 Pro", "Realme 13",
        "Realme 12 Pro+", "Realme 12 Pro", "Realme 12+", "Realme 12 5G", "Realme 12", "Realme 12x",
        "Realme 11 Pro+", "Realme 11 Pro", "Realme 11 5G", "Realme 11",
        "Realme 10 Pro+", "Realme 10 Pro", "Realme 10",
        "Realme 9 Pro+", "Realme 9 Pro", "Realme 9",
        "Realme 8 Pro", "Realme 8", "Realme 7 Pro", "Realme 7",
        "Realme 6 Pro", "Realme 6", "Realme 5 Pro", "Realme 5",
        "Realme 3 Pro", "Realme 3", "Realme 2 Pro", "Realme 2", "Realme 1",
        "Realme C67", "Realme C65", "Realme C63", "Realme C61", "Realme C55", "Realme C53", "Realme C51",
        "Realme C35", "Realme C33", "Realme C31", "Realme C30", "Realme C25", "Realme C21", "Realme C17",
        "Realme C15", "Realme C12", "Realme C11", "Realme C3", "Realme C2", "Realme C1",
        "Realme GT6", "Realme GT5", "Realme GT3", "Realme GT2 Pro", "Realme GT2",
        "Realme GT Neo 6", "Realme GT Neo 5", "Realme GT Neo 3", "Realme GT Neo 2", "Realme GT Neo", "Realme GT",
        "Realme Narzo 70", "Realme Narzo 60", "Realme Narzo 50", "Realme Narzo 30", "Realme Narzo 20", "Realme Narzo 10",
        "Realme X50 Pro", "Realme X7 Pro", "Realme X3 SuperZoom", "Realme X2 Pro", "Realme X2", "Realme XT", "Realme X",
        "Realme Note 50"
    ],
    "Infinix": [
        "Zero 40 5G", "Zero 40 4G", "Zero 30 5G", "Zero 30 4G", "Zero Ultra", "Zero 20", "Zero X Pro", "Zero X Neo", "Zero X", "Zero 8", "Zero 8i", "Zero 6", "Zero 5",
        "Note 40 Pro+ 5G", "Note 40 Pro 5G", "Note 40 Pro 4G", "Note 40 5G", "Note 40 4G", "Note 40X 5G", "Note 30 Pro", "Note 30 5G", "Note 30 4G", "Note 30 VIP", "Note 30i", "Note 12 Pro 5G", "Note 12 Pro 4G", "Note 12 2023", "Note 12 G96", "Note 12 G88", "Note 12i", "Note 11 Pro", "Note 11", "Note 11S", "Note 11i", "Note 10 Pro", "Note 10", "Note 8", "Note 8i", "Note 7", "Note 7 Lite", "Note 5",
        "Hot 50 Pro+", "Hot 50 Pro", "Hot 50 5G", "Hot 50 4G", "Hot 40 Pro", "Hot 40", "Hot 40i", "Hot 30 5G", "Hot 30 4G", "Hot 30i", "Hot 30 Play", "Hot 20 5G", "Hot 20 4G", "Hot 20i", "Hot 20 Play", "Hot 20S", "Hot 12 Pro", "Hot 12 Play", "Hot 12", "Hot 12i", "Hot 11 2022", "Hot 11S NFC", "Hot 11S", "Hot 11 Play", "Hot 11", "Hot 10S", "Hot 10T", "Hot 10S NFC", "Hot 10 Play", "Hot 10 Lite", "Hot 10", "Hot 9 Play", "Hot 9", "Hot 8 Lite", "Hot 8", "Hot 7 Pro", "Hot 7", "Hot 6 Pro", "Hot 6", "Hot 5",
        "Smart 8 Pro", "Smart 8 Plus", "Smart 8", "Smart 8 HD", "Smart 7 Plus", "Smart 7", "Smart 7 HD", "Smart 6 Plus", "Smart 6 HD", "Smart 6", "Smart 5 Pro", "Smart 5", "Smart 5 Indian", "Smart 4 Plus", "Smart 4", "Smart 3 Plus", "Smart 2"
    ],
    "Honor": [
        "Magic 7 Pro", "Magic 6 Pro", "Magic 6", "Magic V2", "Magic 5 Pro", "Magic 5",
        "Honor 200 Pro", "Honor 200", "Honor 200 Lite", "Honor 90", "Honor 90 Lite",
        "Honor 70", "Honor 50", "Honor X9b", "Honor X8b", "Honor X7b", "Honor X9a",
        "Honor X8a", "Honor X7a", "Honor X6a", "Honor X9", "Honor X8", "Honor X7"
    ],
    "Oppo": [
        "Find X7 Ultra", "Find X7", "Find X6 Pro", "Find X5 Pro",
        "Reno 13 Pro", "Reno 13", "Reno 12 Pro", "Reno 12", "Reno 12 F", "Reno 11 Pro", "Reno 11", "Reno 11 F",
        "Reno 10 Pro+", "Reno 10 Pro", "Reno 10", "Reno 9", "Reno 8 Pro", "Reno 8", "Reno 7",
        "A98", "A78 5G", "A78", "A58", "A38", "A18", "A77s", "A57", "A17", "A96", "A76", "A16"
    ]
};

// Set up keyboard event listeners for Arabic/Farsi digit auto-conversion
export const setupDigitConversion = () => {
    const handleKeyPress = (e) => {
        const char = String.fromCharCode(e.which || e.keyCode);
        const converted = toEnglishDigits(char);
        if (converted !== char) {
            e.preventDefault();
            const input = e.target;
            if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const val = input.value;
                const newVal = val.slice(0, start) + converted + val.slice(end);
                
                const setter = Object.getOwnPropertyDescriptor(
                    input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 
                    "value"
                ).set;
                setter.call(input, newVal);
                
                input.selectionStart = input.selectionEnd = start + 1;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
            }
        }
    };

    const handlePaste = (e) => {
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const converted = toEnglishDigits(pastedText);
        if (converted !== pastedText) {
            e.preventDefault();
            const input = e.target;
            if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const val = input.value;
                const newVal = val.slice(0, start) + converted + val.slice(end);
                
                const setter = Object.getOwnPropertyDescriptor(
                    input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 
                    "value"
                ).set;
                setter.call(input, newVal);
                
                input.selectionStart = input.selectionEnd = start + converted.length;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
            }
        }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('paste', handlePaste);

    return () => {
        window.removeEventListener('keypress', handleKeyPress);
        window.removeEventListener('paste', handlePaste);
    };
};

// Formats a raw number string with thousands separators
export const formatNumberWithCommas = (value) => {
    if (value === null || value === undefined) return '';
    const clean = value.toString().replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
};

// Cleans formatted string to raw numeric string for processing
export const cleanCommaFormattedNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
};
