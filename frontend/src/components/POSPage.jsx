import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from './Icon';
import { BRAND_MODELS, getShortId, toEnglishDigits, formatNumberWithCommas, cleanCommaFormattedNumber } from '../utils';
import { getShopSettings } from '../App';

export default         function POSPage({ products, sales, refresh, activeReceiptToPrint, setActiveReceiptToPrint }) {
            const [customerName, setCustomerName] = useState('');
            const [customerPhone, setCustomerPhone] = useState('');
            const [paymentMethod, setPaymentMethod] = useState('Cash');
            const [downpayment, setDownpayment] = useState('0');
            const [installmentMonthly, setInstallmentMonthly] = useState('0');
            const [cart, setCart] = useState([]);
            const [errorMsg, setErrorMsg] = useState('');
            const [receipt, setReceipt] = useState(null);
            const [maintenanceNote, setMaintenanceNote] = useState('');
            const [warrantyDays, setWarrantyDays] = useState('30');
            const [customerSuggestions, setCustomerSuggestions] = useState([]);
            const [searchQuery, setSearchQuery] = useState('');
            const [posFilter, setPosFilter] = useState('All');
            const [updateTrigger, setUpdateTrigger] = useState(0);
            const [activeCardProvider, setActiveCardProvider] = useState('All');
            const [pricingModalCard, setPricingModalCard] = useState(null);
            const [modalPurchasePrice, setModalPurchasePrice] = useState('');
            const [modalSellingPrice, setModalSellingPrice] = useState('');
            const [modalSaving, setModalSaving] = useState(false);
            const [entisharBalance, setEntisharBalance] = useState(0);
            const [entisharModalOpen, setEntisharModalOpen] = useState(false);
            const [newEntisharBalance, setNewEntisharBalance] = useState('');

            const fetchEntisharBalance = async () => {
                try {
                    const res = await axios.get('/entishar/balance/');
                    setEntisharBalance(res.data.balance || 0);
                } catch (e) {
                    console.error("Error fetching Entishar balance:", e);
                }
            };

            useEffect(() => {
                fetchEntisharBalance();
            }, [updateTrigger]);

            useEffect(() => {
                if (activeReceiptToPrint) {
                    setReceipt(activeReceiptToPrint);
                    setActiveReceiptToPrint(null); // Clear it so it doesn't loop
                }
            }, [activeReceiptToPrint]);

            const printReceipt = () => {
                window.print();
            };
            
            const filteredProducts = products.filter(p => {
                if (p.type === 'Maintenance') return false;
                
                // Hide recharge/gaming cards from the general physical products list
                const isRechargeCard = anyRechargeKeywords(p.name);
                if (isRechargeCard) return false;

                const isAvailable = p.items.some(i => i.status === 'Available');
                if (!isAvailable) return false;
                
                // Search query match
                const query = searchQuery.toLowerCase();
                const matchesSearch = p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query);
                
                // Category match
                if (posFilter === 'All') return matchesSearch;
                return p.type === posFilter && matchesSearch;
            });

            function anyRechargeKeywords(name) {
                return ["كارت", "بطاقة", "شدات", "رصيد", "آسيا سيل", "زين عراق", "كورك", "فري فاير", "Free Fire", "ببجي", "PUBG", "آيتونز", "رايزر", "PlayStation", "جوجل بلاي"].some(kw => name.includes(kw));
            }


            const addToCart = (product) => {
                const availableItems = (product.items || []).filter(i => i.status === 'Available');
                const inCartCount = cart.filter(item => item.product_id === product.id).length;

                // Client-side prevention for adding virtual cards beyond Entishar Balance
                const isCard = anyRechargeKeywords(product.name);
                if (isCard) {
                    // Sum the purchase price of cards already in cart
                    const currentCardsCost = cart.reduce((sum, item) => {
                        const isItemCard = anyRechargeKeywords(item.name);
                        if (isItemCard) {
                            // Find the product to get its purchase_price
                            const originalProduct = products.find(p => p.id === item.product_id);
                            return sum + (originalProduct ? parseFloat(originalProduct.purchase_price) : 0);
                        }
                        return sum;
                    }, 0);

                    const nextTotalCost = currentCardsCost + parseFloat(product.purchase_price);
                    if (nextTotalCost > entisharBalance) {
                        alert(`❌ لا يمكن إضافة الكارت! إجمالي تكلفة شراء الكروت في السلة (${nextTotalCost.toLocaleString()} د.ع) ستتجاوز رصيد محفظة انتشار الحالي (${entisharBalance.toLocaleString()} د.ع).`);
                        return;
                    }
                }

                if (product.type === 'Maintenance') {
                    setCart([...cart, {
                        product_id: product.id,
                        name: product.name,
                        brand: product.brand,
                        type: product.type,
                        inventory_item_id: null,
                        imei: '',
                        battery_health: null,
                        price: product.selling_price
                    }]);
                    return;
                }

                if (!isCard && inCartCount >= availableItems.length) {
                    alert(`لا يمكن إضافة المزيد! الكمية المتوفرة في المخزن لـ (${product.brand} - ${product.name}) هي ${availableItems.length} فقط.`);
                    return;
                }

                let selectedItemId = null;
                let selectedImei = '';
                let selectedBattery = null;

                if (product.type === 'Phone') {
                    const cartItemIds = cart.map(item => item.inventory_item_id);
                    const nextAvailable = availableItems.find(i => !cartItemIds.includes(i.id));
                    
                    if (!nextAvailable) {
                        alert("عذراً، كل الأجهزة المتوفرة من هذا الموديل مضافة بالفعل في الفاتورة!");
                        return;
                    }
                    selectedItemId = nextAvailable.id;
                    selectedImei = nextAvailable.imei;
                    selectedBattery = nextAvailable.battery_health;
                }

                setCart([...cart, {
                    product_id: product.id,
                    name: product.name,
                    brand: product.brand,
                    type: product.type,
                    inventory_item_id: selectedItemId,
                    imei: selectedImei,
                    battery_health: selectedBattery,
                    price: product.selling_price
                }]);
            };

            const removeFromCart = (index) => {
                setCart(cart.filter((_, i) => i !== index));
            };

            const updateCartPrice = (index, newPrice) => {
                const newCart = [...cart];
                newCart[index].price = newPrice;
                setCart(newCart);
            };

            const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
            const isMaintenanceCart = cart.length > 0 && cart.every(i => i.type === 'Maintenance');

            const handleCheckout = async (e) => {
                e.preventDefault();
                setErrorMsg('');
                if (cart.length === 0) {
                    setErrorMsg("الفاتورة فارغة! أضف سلعاً أولاً.");
                    return;
                }

                if (paymentMethod === 'Credit') {
                    if (!customerName || !customerName.trim() || customerName.trim() === "زبون نقدي") {
                        setErrorMsg("❌ لا يمكن عمل فاتورة آجل/أقساط دون تحديد اسم الزبون.");
                        return;
                    }
                    if (!customerPhone || !customerPhone.trim() || customerPhone.trim().length < 10) {
                        setErrorMsg("❌ لا يمكن عمل فاتورة آجل/أقساط دون إدخال رقم هاتف صحيح للزبون لتلقي الإشعارات.");
                        return;
                    }
                }

                try {
                    const cleanedDownpayment = toEnglishDigits(downpayment || '0');
                    const cleanedMonthly = toEnglishDigits(installmentMonthly || '0');
                    const saleRes = await axios.post('/sales/', {
                        customer_name: customerName || "زبون نقدي",
                        customer_phone: customerPhone || null,
                        payment_method: paymentMethod,
                        total_amount: total,
                        installment_downpayment: parseFloat(cleanedDownpayment) || 0,
                        installment_monthly: parseFloat(cleanedMonthly) || 0,
                        items: cart.map(item => ({
                            product_id: item.product_id,
                            inventory_item_id: item.inventory_item_id,
                            price: parseFloat(item.price) || 0
                        }))
                    });
                    // Save receipt data before clearing cart
                    setReceipt({
                        id: saleRes.data.id,
                        type: isMaintenanceCart ? 'maintenance' : 'sale',
                        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        customer: customerName || "زبون نقدي",
                        customerPhone: customerPhone,
                        paymentMethod: paymentMethod,
                        items: [...cart],
                        total: total,
                        maintenanceNote: maintenanceNote,
                        warrantyDays: warrantyDays
                    });
                    setCustomerName('');
                    setCustomerPhone('');
                    setPaymentMethod('Cash');
                    setDownpayment('0');
                    setInstallmentMonthly('0');
                    setMaintenanceNote('');
                    setWarrantyDays('30');
                    setCart([]);
                    refresh();
                    setUpdateTrigger(prev => prev + 1);
                } catch (err) {
                    const serverDetail = err.response?.data?.detail;
                    const errorDetails = serverDetail ? (typeof serverDetail === 'object' ? JSON.stringify(serverDetail) : serverDetail) : '';
                    setErrorMsg(errorDetails || err.message || "حدث خطأ أثناء إتمام عملية البيع.");
                }
            };

            return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Cart & Billing Panel */}
                    <div className="lg:col-span-7 p-6 bg-white dark:bg-[#0c0c0f]/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col justify-between min-h-[550px] shadow-2xl backdrop-blur-md">
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-emerald-400 flex items-center gap-2">
                                    <Icon name="shopping-cart" className="w-5 h-5 text-emerald-400" />
                                    فاتورة البيع الحالية
                                </h3>
                                {cart.length > 0 && (
                                    <button onClick={() => setCart([])} className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1">
                                        <Icon name="trash" className="w-3.5 h-3.5" /> مسح الكل
                                    </button>
                                )}
                            </div>

                            {errorMsg && (
                                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl mb-4 flex items-center gap-2">
                                    <Icon name="alert-triangle" className="w-4 h-4" /> {errorMsg}
                                </div>
                            )}

                            <div className="space-y-3 mb-6 max-h-[360px] overflow-y-auto pr-1">
                                {cart.map((item, index) => (
                                    <div key={index} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-150 dark:border-zinc-900 hover:border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all">
                                        <div className="flex-1 pr-3 w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono">#{index + 1}</span>
                                                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.brand} - {item.name}</div>
                                            </div>
                                            {item.type === 'Phone' && (
                                                <div className="text-[11px] text-emerald-400 font-mono mt-1.5 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-lg w-max">
                                                    <Icon name="smartphone" className="w-3 h-3" /> IMEI: {item.imei} {item.battery_health ? `| Health: ${item.battery_health}%` : ''}
                                                </div>
                                            )}
                                            {item.type === 'Maintenance' && (
                                                <div className="text-[11px] text-amber-400 font-mono mt-1.5 flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-lg w-max">
                                                    <Icon name="wrench" className="w-3 h-3" /> صيانة / خدمة
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-200 dark:border-zinc-800">
                                            <div className="relative flex-1 sm:flex-none">
                                                <input 
                                                    type="text" 
                                                    value={formatNumberWithCommas(item.price)}
                                                    onChange={e => {
                                                        const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                        const converted = clean.replace(/[^0-9.]/g, '');
                                                        updateCartPrice(index, converted);
                                                    }}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full sm:w-36 bg-white dark:bg-[#0c0c0f]/80 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 rounded-xl pl-3 pr-8 py-2 text-right font-mono text-emerald-400 font-bold text-sm focus:outline-none transition-all"
                                                />
                                                <span className="absolute right-3 top-2.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">د.ع</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => removeFromCart(index)}
                                                className="text-zinc-500 dark:text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl transition-all"
                                            >
                                                <Icon name="trash-2" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {cart.length === 0 && (
                                    <div className="text-center py-16 text-zinc-400 dark:text-zinc-500 flex flex-col items-center justify-center gap-3">
                                        <Icon name="shopping-bag" className="w-10 h-10 text-slate-700" />
                                        <div className="text-sm">الفاتورة فارغة. اختر من قائمة المنتجات لإضافة الأجهزة.</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-6 mt-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">اسم الزبون</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={customerName}
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                setCustomerName(val);
                                                if (val.trim().length >= 1) {
                                                    try {
                                                        const res = await axios.get(`/customers/search/?q=${encodeURIComponent(val)}`);
                                                        setCustomerSuggestions(res.data);
                                                    } catch (err) {
                                                        console.error(err);
                                                    }
                                                } else {
                                                    setCustomerSuggestions([]);
                                                }
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setCustomerSuggestions([]), 200);
                                            }}
                                            placeholder="اكتب للبحث أو اسم جديد..."
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 rounded-xl pl-4 pr-10 py-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all"
                                        />
                                        <Icon name="user" className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute right-3.5 top-3.5" />
                                        
                                        {/* Dropdown Suggestions */}
                                        {customerSuggestions.length > 0 && (
                                            <div className="absolute right-0 left-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                                {customerSuggestions.map(cust => (
                                                    <div 
                                                        key={cust.id}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            setCustomerName(cust.name);
                                                            if (cust.phone) setCustomerPhone(cust.phone);
                                                            setCustomerSuggestions([]);
                                                        }}
                                                        className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                                    >
                                                        <span>👤 {cust.name}</span>
                                                        <span className="text-[10px] text-zinc-400 font-mono">{cust.phone || 'بدون رقم'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">رقم هاتف الزبون</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            placeholder="07xxxxxxxxx"
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 rounded-xl pl-4 pr-10 py-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all font-mono"
                                        />
                                        <Icon name="phone" className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute right-3.5 top-3.5" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold">طريقة الدفع</label>
                                    <div className="relative">
                                        <select 
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value)}
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="Cash">نقدي (Cash)</option>
                                            <option value="Credit">آجل / بالدين (Credit)</option>
                                        </select>
                                        <Icon name="chevron-down" className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-4 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {paymentMethod === 'Credit' && (
                                <div className="space-y-4 p-4 bg-emerald-500/5 dark:bg-zinc-950 border border-emerald-500/10 dark:border-zinc-800 rounded-2xl">
                                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-emerald-500 mb-1.5">إضافة نسبة زيادة للأقساط (اختياري)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    id="interest-rate-input"
                                                    placeholder="مثال: 10 أو 15 أو 20"
                                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const btn = document.getElementById('apply-interest-btn');
                                                            if (btn) btn.click();
                                                        }
                                                    }}
                                                />
                                                <span className="absolute left-3 top-3 text-xs text-zinc-400 dark:text-zinc-500 font-bold">%</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            id="apply-interest-btn"
                                            onClick={() => {
                                                const input = document.getElementById('interest-rate-input');
                                                const pct = parseFloat(toEnglishDigits(input ? input.value : '0')) || 0;
                                                if (pct > 0) {
                                                    const updatedCart = cart.map(item => {
                                                        const basePrice = parseFloat(item.originalPrice || item.price) || 0;
                                                        // Keep original price saved to allow re-calculation
                                                        const newPrice = Math.round(basePrice * (1 + pct / 100));
                                                        return {
                                                            ...item,
                                                            originalPrice: item.originalPrice || item.price,
                                                            price: newPrice.toString()
                                                        };
                                                    });
                                                    setCart(updatedCart);
                                                    alert(`تم تطبيق زيادة الأقساط بنسبة ${pct}% على أسعار المواد بالفاتورة!`);
                                                }
                                            }}
                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                                        >
                                            تطبيق النسبة
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updatedCart = cart.map(item => {
                                                    if (item.originalPrice) {
                                                        return {
                                                            ...item,
                                                            price: item.originalPrice,
                                                            originalPrice: undefined
                                                        };
                                                    }
                                                    return item;
                                                });
                                                setCart(updatedCart);
                                                const input = document.getElementById('interest-rate-input');
                                                if (input) input.value = '';
                                                alert("تمت إعادة الأسعار إلى السعر النقدي الأصلي.");
                                            }}
                                            className="px-3 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-bold rounded-xl text-xs transition-all"
                                        >
                                            إلغاء الزيادة
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-900">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">المقدمة المتفق عليها (د.ع)</label>
                                            <input
                                                type="text"
                                                value={formatNumberWithCommas(downpayment)}
                                                onChange={e => {
                                                    const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                    const converted = clean.replace(/[^0-9.]/g, '');
                                                    setDownpayment(converted);
                                                }}
                                                onFocus={e => {
                                                    if (downpayment === '0') setDownpayment('');
                                                    e.target.select();
                                                }}
                                                placeholder="مثال: 300,000"
                                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-850 dark:text-zinc-200 focus:outline-none LTR_number focus:border-emerald-500 font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">القسط الشهري المتفق عليه (د.ع)</label>
                                            <input
                                                type="text"
                                                value={formatNumberWithCommas(installmentMonthly)}
                                                onChange={e => {
                                                    const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                    const converted = clean.replace(/[^0-9.]/g, '');
                                                    setInstallmentMonthly(converted);
                                                }}
                                                onFocus={e => {
                                                    if (installmentMonthly === '0') setInstallmentMonthly('');
                                                    e.target.select();
                                                }}
                                                placeholder="مثال: 50,000"
                                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-850 dark:text-zinc-200 focus:outline-none LTR_number focus:border-emerald-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Extra maintenance fields */}
                            {isMaintenanceCart && (
                                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4 shadow-inner">
                                    <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                                        <Icon name="wrench" className="w-4 h-4 text-amber-400" /> حقول وتفاصيل الصيانة
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">رقم هاتف الزبون</label>
                                            <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="07xxxxxxxxx" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">مدة الضمان (أيام)</label>
                                            <input 
                                                type="text" 
                                                inputMode="numeric"
                                                value={warrantyDays} 
                                                onChange={e => {
                                                    const converted = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                                                    setWarrantyDays(converted);
                                                }} 
                                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">وصف العطل / الخدمة المنجزة</label>
                                        <textarea rows="2" value={maintenanceNote} onChange={e => setMaintenanceNote(e.target.value)} placeholder="مثال: تغيير شاشة مكسورة — تم تركيب شاشة أصلية" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none resize-none transition-all" />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/40 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-900/80 backdrop-blur-md">
                                <div>
                                    <span className="text-zinc-400 dark:text-zinc-500 text-xs block font-bold mb-1">الإجمالي المستحق</span>
                                    <span className="text-2xl font-extrabold text-emerald-400 font-mono">{total.toLocaleString()} <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">د.ع</span></span>
                                </div>
                                <button 
                                    onClick={handleCheckout}
                                    disabled={cart.length === 0}
                                    className={`flex items-center gap-2 px-6 py-3.5 font-bold rounded-2xl shadow-lg transition-all text-sm ${
                                        cart.length > 0 
                                        ? (isMaintenanceCart ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20')
                                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none'
                                    }`}
                                >
                                    <Icon name="printer" className="w-4 h-4" />
                                    {isMaintenanceCart ? 'حفظ وصل الصيانة' : 'حفظ الفاتورة وطباعتها'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Products List Panel */}
                    <div className="lg:col-span-5 p-6 bg-white dark:bg-[#0c0c0f]/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col shadow-2xl backdrop-blur-md">
                        <h3 className="font-bold text-lg mb-4 text-emerald-400 flex items-center gap-2">
                            <Icon name="package" className="w-5 h-5 text-emerald-400" />
                            بضائع المحل والمنتجات
                        </h3>

                        {/* Quick Cards & Credits Section */}
                        <div className="mb-5 bg-zinc-50 dark:bg-zinc-950/60 p-4 border border-zinc-150 dark:border-zinc-900 rounded-2xl">
                            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                                        <Icon name="credit-card" className="w-3.5 h-3.5 text-sky-400" />
                                        كروت شحن سريعة
                                    </div>
                                    <div 
                                        onClick={() => {
                                            setNewEntisharBalance(entisharBalance.toString());
                                            setEntisharModalOpen(true);
                                        }}
                                        className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-450 border border-emerald-500/20 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                        title="اضغط لتحديث رصيد المحفظة"
                                    >
                                        <Icon name="wallet" className="w-3 h-3" />
                                        <span>رصيد انتشار:</span>
                                        <span className="font-mono text-emerald-400">{entisharBalance.toLocaleString()} د.ع</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {['All', 'Asiacell', 'Zain'].map(prov => (
                                        <button
                                            type="button"
                                            key={prov}
                                            onClick={() => setActiveCardProvider(prov)}
                                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                                activeCardProvider === prov
                                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                                : 'bg-white dark:bg-[#0c0c0f] text-zinc-450 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                                            }`}
                                        >
                                            {prov === 'All' && 'الكل'}
                                            {prov === 'Asiacell' && 'آسيا'}
                                            {prov === 'Zain' && 'زين'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    // General view
                                    { name: 'كارت شحن كورك Koryk', brand: 'كورك تليكوم', icon: 'phone', color: 'border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/5', provider: 'All' },
                                    { name: 'شدات ببجي PUBG UC', brand: 'شدات ببجي', icon: 'gamepad', color: 'border-amber-500/20 text-amber-500 hover:bg-amber-500/5', provider: 'All' },
                                    { name: 'كارت بلايستيشن PlayStation', brand: 'بلايستيشن', icon: 'gamepad-2', color: 'border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5', provider: 'All' },
                                    { name: 'بطاقة شحن رايزر Razer Gold', brand: 'رايزر جولد', icon: 'award', color: 'border-yellow-500/20 text-yellow-600 hover:bg-yellow-500/5', provider: 'All' },
                                    { name: 'بطاقة شحن آيتونز iTunes', brand: 'آيتونز Apple', icon: 'smartphone', color: 'border-blue-500/20 text-blue-500 hover:bg-blue-500/5', provider: 'All' },
                                    { name: 'بطاقة شحن جوجل بلاي Google', brand: 'جوجل بلاي', icon: 'play', color: 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5', provider: 'All' },
                                    { name: 'بطاقات فري فاير Free Fire', brand: 'فري فاير', icon: 'flame', color: 'border-orange-500/20 text-orange-500 hover:bg-orange-500/5', provider: 'All' },

                                    // Asiacell view
                                    { name: 'كارت آسيا سيل فئة 5,000', brand: 'آسيا 5,000', icon: 'phone', color: 'border-rose-500/30 text-rose-600 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },
                                    { name: 'كارت آسيا سيل فئة 10,000', brand: 'آسيا 10,000', icon: 'phone', color: 'border-rose-500/30 text-rose-650 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },
                                    { name: 'كارت آسيا سيل فئة 15,000', brand: 'آسيا 15,000', icon: 'phone', color: 'border-rose-500/30 text-rose-650 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },
                                    { name: 'كارت آسيا سيل فئة 25,000', brand: 'آسيا 25,000', icon: 'phone', color: 'border-rose-500/30 text-rose-650 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },
                                    { name: 'كارت آسيا سيل فئة 35,000', brand: 'آسيا 35,000', icon: 'phone', color: 'border-rose-500/30 text-rose-650 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },
                                    { name: 'كارت آسيا سيل فئة 50,000', brand: 'آسيا 50,000', icon: 'phone', color: 'border-rose-500/30 text-rose-650 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },
                                    { name: 'كارت آسيا سيل فئة 100,000', brand: 'آسيا 100,000', icon: 'phone', color: 'border-rose-500/30 text-rose-650 bg-rose-500/5 hover:bg-rose-500/10', provider: 'Asiacell' },

                                    // Zain view
                                    { name: 'كارت زين فئة 5,000', brand: 'زين 5,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-700 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' },
                                    { name: 'كارت زين فئة 10,000', brand: 'زين 10,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-750 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' },
                                    { name: 'كارت زين فئة 15,000', brand: 'زين 15,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-750 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' },
                                    { name: 'كارت زين فئة 25,000', brand: 'زين 25,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-750 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' },
                                    { name: 'كارت زين فئة 35,000', brand: 'زين 35,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-750 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' },
                                    { name: 'كارت زين فئة 50,000', brand: 'زين 50,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-750 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' },
                                    { name: 'كارت زين فئة 100,000', brand: 'زين 100,000', icon: 'phone', color: 'border-zinc-500/30 text-zinc-750 bg-zinc-500/5 hover:bg-zinc-500/10', provider: 'Zain' }
                                ]
                                .filter(card => {
                                    if (activeCardProvider === 'All') {
                                        return card.provider === 'All';
                                    }
                                    return card.provider === activeCardProvider;
                                })
                                .map(card => {
                                    const p = products.find(prod => prod.name === card.name);
                                    return (
                                        <div key={card.name} className="relative group/card">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (p) {
                                                        addToCart(p);
                                                    } else {
                                                        alert(`الرجاء تحديث الصفحة! منتج ${card.name} لم يتم تحميله بعد.`);
                                                    }
                                                }}
                                                className={`w-full flex flex-col items-center justify-center p-2 rounded-xl border bg-white dark:bg-[#0c0c0f] font-bold text-[10px] transition-all hover:scale-102 hover:shadow-sm cursor-pointer ${card.color}`}
                                            >
                                                <Icon name={card.icon} className="w-4 h-4 mb-1" />
                                                <span>{card.brand}</span>
                                                {p && (
                                                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                                                        {parseFloat(p.selling_price) > 0 ? `${parseFloat(p.selling_price).toLocaleString()} د.ع` : 'تحديد سعر'}
                                                    </span>
                                                )}
                                            </button>
                                            {p && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPricingModalCard(p);
                                                        setModalPurchasePrice(p.purchase_price ? p.purchase_price.toString() : '');
                                                        setModalSellingPrice(p.selling_price ? p.selling_price.toString() : '');
                                                    }}
                                                    className="absolute -top-1 -left-1 w-5 h-5 bg-zinc-100 hover:bg-emerald-500 hover:text-white border border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity z-10"
                                                    title="تعديل وتثبيت أسعار الشراء والبيع"
                                                >
                                                    <Icon name="settings" className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث باسم الجهاز أو الماركة..."
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all"
                            />
                            <Icon name="search" className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute right-3.5 top-3" />
                        </div>

                        {/* Category filter tabs */}
                        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 no-scrollbar">
                            {['All', 'Phone', 'Accessory'].map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => setPosFilter(cat)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                                        posFilter === cat 
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border border-transparent'
                                    }`}
                                >
                                    {cat === 'All' && 'الكل'}
                                    {cat === 'Phone' && 'هواتف'}
                                    {cat === 'Accessory' && 'إكسسوارات'}
                                </button>
                            ))}
                        </div>

                        {/* Products list container */}
                        <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                            {filteredProducts.map(p => {
                                const available = p.items.filter(i => i.status === 'Available');
                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => addToCart(p)}
                                        className="p-4 bg-zinc-50 dark:bg-zinc-950/70 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-900/80 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-2xl flex justify-between items-center cursor-pointer transition-all hover:-translate-y-[1px]"
                                    >
                                        <div className="flex-1 pr-2">
                                            <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{p.brand} - {p.name}</div>
                                            <div className="text-xs text-emerald-400 mt-1 font-mono font-bold">{parseFloat(p.selling_price).toLocaleString()} د.ع</div>
                                        </div>
                                        <div className="text-left text-xs">
                                            {p.type === 'Maintenance' ? (
                                                <span className="px-2.5 py-1 rounded-full font-bold border bg-amber-500/10 text-amber-400 border-amber-500/10">
                                                    صيانة / خدمة
                                                </span>
                                            ) : (
                                                <span className={`px-2.5 py-1 rounded-full font-bold border ${
                                                    available.length > 0 
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' 
                                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/10'
                                                }`}>
                                                    المتوفر: {available.length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">لا توجد منتجات مطابقة للبحث.</div>
                            )}
                        </div>
                    </div>

                    {/* Receipt Modal */}
                     {receipt && (() => {
                        const s = getShopSettings();
                        const shopName = s.shopName || 'متجر الموبايل';
                        const logoLetter = shopName.trim().charAt(0).toUpperCase();
                        const currency = s.currency || 'د.ع';
                        const phone = s.phone || '';
                        const email = s.email || '';
                        const address = s.address || '';
                        const footerNote = s.footerNote || 'شكراً لتعاملكم معنا 🙏';
                        const invoiceNum = 'INV-' + getShortId(receipt.id);
                        
                        return (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setReceipt(null)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div id="print-receipt">
                                    {receipt.type === 'maintenance' ? (
                                        /* ---------------------------------------------
                                           MAINTENANCE RECEIPT TEMPLATE (وصل صيانة)
                                           --------------------------------------------- */
                                        <div className="mnt">
                                            {/* Head: Title + Logo */}
                                            <div className="mnt-head">
                                                <div>
                                                    <div className="mnt-head-title">وصل صيانة وأمانة</div>
                                                    <div className="mnt-head-sub">Maintenance & Service Receipt</div>
                                                </div>
                                                <div className="mnt-head-logo">{logoLetter}</div>
                                            </div>

                                            {/* Company block */}
                                            <div className="mnt-company">
                                                <span className="mnt-company-name">{shopName}</span>
                                                {phone && <span>هاتف: {phone}&nbsp;&nbsp;</span>}
                                                {email && <span>بريد: {email}</span>}
                                                {address && <div>العنوان: {address}</div>}
                                            </div>

                                            {/* 2-Column Info Box */}
                                            <div className="mnt-info">
                                                <div className="mnt-info-box">
                                                    <div className="mnt-info-box-title">معلومات الزبون</div>
                                                    <div className="mnt-info-row"><span className="mnt-info-key">الاسم:</span><span className="mnt-info-val">{receipt.customer}</span></div>
                                                    {receipt.customerPhone && <div className="mnt-info-row"><span className="mnt-info-key">الهاتف:</span><span className="mnt-info-val">{receipt.customerPhone}</span></div>}
                                                    <div className="mnt-info-row"><span className="mnt-info-key">طريقة الدفع:</span><span className="mnt-info-val">{receipt.paymentMethod === 'Cash' ? 'نقدي' : 'آجل'}</span></div>
                                                </div>
                                                <div className="mnt-info-box">
                                                    <div className="mnt-info-box-title">تفاصيل الوصل</div>
                                                    <div className="mnt-info-row"><span className="mnt-info-key">رقم الوصل:</span><span className="mnt-info-val">{invoiceNum}</span></div>
                                                    <div className="mnt-info-row"><span className="mnt-info-key">التاريخ:</span><span className="mnt-info-val">{receipt.date}</span></div>
                                                </div>
                                            </div>

                                            {/* Description of Service */}
                                            <div className="mnt-section-title">الأجهزة والخدمات المنجزة</div>
                                            <table className="mnt-table">
                                                <thead>
                                                    <tr>
                                                        <th>اسم الجهاز / المنتج</th>
                                                        <th className="th-r">التكلفة</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {receipt.items.map((item, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <strong>{item.brand} — {item.name}</strong>
                                                                {item.imei && <span style={{display:'block', fontSize:'11px', color:'#777'}}>IMEI: {item.imei}</span>}
                                                            </td>
                                                            <td className="td-r">{parseFloat(item.price).toLocaleString()} {currency}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {/* Maintenance details note */}
                                            {receipt.maintenanceNote && (
                                                <div className="mnt-note-box">
                                                    <div className="mnt-note-label">تقرير الفحص والصيانة:</div>
                                                    <div className="mnt-note-text">{receipt.maintenanceNote}</div>
                                                </div>
                                            )}

                                            {/* Warranty block */}
                                            {receipt.warrantyDays && parseInt(receipt.warrantyDays) > 0 && (
                                                <div className="mnt-warranty">
                                                    <span className="mnt-warranty-icon">🛡️</span>
                                                    <div>
                                                        <div className="mnt-warranty-title">الضمان والكفالة</div>
                                                        <div className="mnt-warranty-text">هذا الجهاز مكفول لمدة {receipt.warrantyDays} يوم من تاريخ استلامه على القطع المستبدلة فقط. الكفالة لا تشمل سوء الاستخدام أو الكسر أو السوائل.</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Totals */}
                                            <div className="mnt-total">
                                                <div className="mnt-total-box">
                                                    <span className="mnt-total-label">المجموع الكلي:</span>
                                                    <span className="mnt-total-amount">{receipt.total.toLocaleString()} {currency}</span>
                                                </div>
                                            </div>

                                            {/* Signature lines */}
                                            <div className="mnt-sign">
                                                <div className="mnt-sign-block">
                                                    <div className="mnt-sign-line"></div>
                                                    <div className="mnt-sign-label">توقيع الزبون</div>
                                                </div>
                                                <div className="mnt-sign-block">
                                                    <div className="mnt-sign-line"></div>
                                                    <div className="mnt-sign-label">توقيع الفني / المستلم</div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ---------------------------------------------
                                           STANDARD SALES RECEIPT TEMPLATE (فاتورة مبيعات)
                                           --------------------------------------------- */
                                        <div className="inv">
                                            {/* Head: INVOICE + Logo */}
                                            <div className="inv-head">
                                                <div>
                                                    <div className="inv-head-title">فاتورة مبيعات</div>
                                                    <div className="inv-head-sub">Sales Receipt / Invoice</div>
                                                </div>
                                                <div className="inv-head-logo">{logoLetter}</div>
                                            </div>

                                            {/* Company block */}
                                            <div className="inv-company">
                                                <span className="inv-company-name">{shopName}</span>
                                                {phone && <span>هاتف: {phone}&nbsp;&nbsp;</span>}
                                                {email && <span>بريد: {email}</span>}
                                                {address && <div>العنوان: {address}</div>}
                                            </div>

                                            {/* Info: Bill To | Payment | Invoice details */}
                                            <div className="inv-info">
                                                <div className="inv-info-block">
                                                    <div className="inv-info-label">العميل / BILL TO</div>
                                                    <div className="inv-info-val">{receipt.customer}</div>
                                                </div>
                                                <div className="inv-info-block">
                                                    <div className="inv-info-label">طريقة الدفع / PAYMENT</div>
                                                    <div className="inv-info-val">{receipt.paymentMethod === 'Cash' ? 'نقدي / Cash' : 'آجل / Credit'}</div>
                                                </div>
                                                <div className="inv-info-block">
                                                    <div className="inv-info-label">التفاصيل / DETAILS</div>
                                                    <div className="inv-info-row"><span className="inv-info-row-key">رقم الفاتورة #</span><span className="inv-info-row-val">{invoiceNum}</span></div>
                                                    <div className="inv-info-row"><span className="inv-info-row-key">التاريخ</span><span className="inv-info-row-val">{receipt.date}</span></div>
                                                </div>
                                            </div>

                                            {/* Table */}
                                            <table className="inv-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{width:'60px'}}>العدد / QTY</th>
                                                        <th className="th-desc">البيان / DESCRIPTION</th>
                                                        <th>سعر المفرد / PRICE</th>
                                                        <th className="th-amt">المجموع / AMOUNT</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {receipt.items.map((item, i) => (
                                                        <tr key={i}>
                                                            <td className="td-qty">1</td>
                                                            <td className="td-desc">
                                                                <div className="inv-desc-name">{item.brand} — {item.name ? item.name.replace(/\s*\([^)]+\)/g, '').trim() : ''}</div>
                                                                {item.imei && <div className="inv-desc-sub">IMEI: {item.imei}</div>}
                                                                {item.battery_health && <div className="inv-desc-sub">Battery: {item.battery_health}%</div>}
                                                            </td>
                                                            <td className="td-up">{parseFloat(item.price).toLocaleString()} {currency}</td>
                                                            <td className="td-amt">{parseFloat(item.price).toLocaleString()} {currency}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {/* Totals */}
                                            <div className="inv-totals">
                                                <div className="inv-totals-row">
                                                    <span>المجموع الفرعي / Subtotal:</span>
                                                    <span>{receipt.total.toLocaleString()} {currency}</span>
                                                </div>
                                            </div>
                                            <div className="inv-totals-grand">
                                                <span>المجموع الكلي / TOTAL</span>
                                                <span>{receipt.total.toLocaleString()} {currency}</span>
                                            </div>

                                            {/* Footer */}
                                            <div className="inv-foot">
                                                <div className="inv-foot-thanks">شكراً لتعاملكم معنا / Thank you</div>
                                                <div className="inv-foot-terms">
                                                    <div className="inv-foot-terms-title">TERMS &amp; CONDITIONS</div>
                                                    <div className="inv-foot-terms-text">{footerNote}</div>
                                                    <div className="inv-foot-copyright">© {new Date().getFullYear()} {shopName}. All rights reserved.</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl no-print">
                                    <button onClick={() => setReceipt(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all">
                                        إغلاق
                                    </button>
                                    <button onClick={printReceipt} className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                                        <Icon name="printer" className="w-4 h-4" /> طباعة الفاتورة
                                    </button>
                                </div>
                            </div>
                        </div>
                        );
                     })()}

                    {/* Pricing Config Modal */}
                    {pricingModalCard && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
                                <button 
                                    type="button" 
                                    onClick={() => setPricingModalCard(null)}
                                    className="absolute left-4 top-4 text-zinc-400 hover:text-zinc-650"
                                >
                                    <Icon name="x" className="w-5 h-5" />
                                </button>
                                <h3 className="text-md font-bold text-zinc-900 dark:text-zinc-100 mb-2.5 flex items-center gap-2">
                                    <Icon name="settings" className="w-4 h-4 text-emerald-450" />
                                    تثبيت أسعار {pricingModalCard.name}
                                </h3>
                                <p className="text-[11px] text-zinc-400 mb-5">قم بإدخال أسعار الكارت لكي يتم تعبئتها مباشرة عند الضغط عليه.</p>
                                
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setModalSaving(true);
                                    try {
                                        const cleanPurchase = cleanCommaFormattedNumber(toEnglishDigits(modalPurchasePrice));
                                        const cleanSelling = cleanCommaFormattedNumber(toEnglishDigits(modalSellingPrice));
                                        await axios.put(`/products/${pricingModalCard.id}/`, {
                                            name: pricingModalCard.name,
                                            brand: pricingModalCard.brand,
                                            type: pricingModalCard.type,
                                            purchase_price: parseFloat(cleanPurchase) || 0,
                                            selling_price: parseFloat(cleanSelling) || 0,
                                            quantity: pricingModalCard.quantity
                                        });
                                        await refresh();
                                        setPricingModalCard(null);
                                    } catch (err) {
                                        alert("خطأ في حفظ وتثبيت الأسعار الجديدة.");
                                    } finally {
                                        setModalSaving(false);
                                    }
                                }} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1.5">سعر شراء الكارت (د.ع)</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formatNumberWithCommas(modalPurchasePrice)}
                                            onChange={e => {
                                                const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                setModalPurchasePrice(clean.replace(/[^0-9.]/g, ''));
                                            }}
                                            placeholder="مثال: 4,750" 
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1.5">سعر بيع الكارت للزبون (د.ع)</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formatNumberWithCommas(modalSellingPrice)}
                                            onChange={e => {
                                                const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                setModalSellingPrice(clean.replace(/[^0-9.]/g, ''));
                                            }}
                                            placeholder="مثال: 5,000" 
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setPricingModalCard(null)}
                                            className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={modalSaving}
                                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center"
                                        >
                                            {modalSaving ? 'جاري الحفظ...' : 'تثبيت وحفظ السعر'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Entishar Wallet Modal */}
                    {entisharModalOpen && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
                                <button 
                                    type="button" 
                                    onClick={() => setEntisharModalOpen(false)}
                                    className="absolute left-4 top-4 text-zinc-400 hover:text-zinc-650"
                                >
                                    <Icon name="x" className="w-5 h-5" />
                                </button>
                                <h3 className="text-md font-bold text-zinc-900 dark:text-zinc-100 mb-2.5 flex items-center gap-2">
                                    <Icon name="wallet" className="w-4 h-4 text-emerald-450" />
                                    شحن / تحديث رصيد محفظة انتشار
                                </h3>
                                <p className="text-[11px] text-zinc-400 mb-5">قم بإدخال رصيدك الكلي الحالي في محفظة جهاز انتشار. سيقوم النظام بخصم أسعار شراء كروت الشحن تلقائياً من هذا الرصيد مع كل عملية بيع.</p>
                                
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setModalSaving(true);
                                    try {
                                        const cleanVal = cleanCommaFormattedNumber(toEnglishDigits(newEntisharBalance));
                                        await axios.post('/entishar/balance/', {
                                            balance: parseFloat(cleanVal) || 0
                                        });
                                        setUpdateTrigger(prev => prev + 1);
                                        setEntisharModalOpen(false);
                                    } catch (err) {
                                        alert("خطأ في تحديث رصيد محفظة انتشار.");
                                    } finally {
                                        setModalSaving(false);
                                    }
                                }} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 mb-1.5">رصيد المحفظة الحالي (د.ع)</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formatNumberWithCommas(newEntisharBalance)}
                                            onChange={e => {
                                                const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                setNewEntisharBalance(clean.replace(/[^0-9.]/g, ''));
                                            }}
                                            onFocus={e => {
                                                if (newEntisharBalance === '0' || parseFloat(newEntisharBalance) === 0) setNewEntisharBalance('');
                                                e.target.select();
                                            }}
                                            placeholder="مثال: 500,000" 
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono text-center text-lg"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setEntisharModalOpen(false)}
                                            className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={modalSaving}
                                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center"
                                        >
                                            {modalSaving ? 'جاري التحديث...' : 'تحديث الرصيد'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Inventory Component
