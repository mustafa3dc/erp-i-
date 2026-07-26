import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from './Icon';
import { BRAND_MODELS, toEnglishDigits } from '../utils';
import compatData from '../device_compatibilities.json';

export default         function InventoryPage({ products, refresh }) {
            const [name, setName] = useState('');
            const [compatibleDevice, setCompatibleDevice] = useState('');
            const [selectedBrand, setSelectedBrand] = useState('Apple');
            const [customBrand, setCustomBrand] = useState('');
            const [type, setType] = useState('Phone');
            const [purchasePrice, setPurchasePrice] = useState('');
            const [sellingPrice, setSellingPrice] = useState('');
            const [imeisInput, setImeisInput] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            const [activeCategory, setActiveCategory] = useState('Phone');
            const [searchQuery, setSearchQuery] = useState('');
            const [quantity, setQuantity] = useState('1');
            const [batteryHealth, setBatteryHealth] = useState('');
            const [showSoldItems, setShowSoldItems] = useState(false);
            const [purchaseList, setPurchaseList] = useState([]);
            const [isSavingList, setIsSavingList] = useState(false);
            const [selectedParts, setSelectedParts] = useState({});
            const [customPartInput, setCustomPartInput] = useState('');
            const [otherCompatibleDevices, setOtherCompatibleDevices] = useState('');
            const [modelSelectionMode, setModelSelectionMode] = useState('select');

            const [editingProduct, setEditingProduct] = useState(null);
            const [barcodeProduct, setBarcodeProduct] = useState(null);
            const [barcodeQty, setBarcodeQty] = useState(1);
            const [editProductName, setEditProductName] = useState('');
            const [editProductBrand, setEditProductBrand] = useState('');
            const [editProductPurchasePrice, setEditProductPurchasePrice] = useState('');
            const [editProductSellingPrice, setEditProductSellingPrice] = useState('');
            const [editProductQuantity, setEditProductQuantity] = useState('');

            const startEditProduct = (prod) => {
                setEditingProduct(prod);
                setEditProductName(prod.name);
                setEditProductBrand(prod.brand);
                setEditProductPurchasePrice(prod.purchase_price.toString());
                setEditProductSellingPrice(prod.selling_price.toString());
                const availableQty = prod.items ? prod.items.filter(i => String(i.status).toLowerCase() === 'available').length : 0;
                setEditProductQuantity(availableQty.toString());
            };

            const handleSaveEditProduct = async (e) => {
                e.preventDefault();
                try {
                    const currentAvail = editingProduct.items ? editingProduct.items.filter(i => String(i.status).toLowerCase() === 'available').length : 0;
                    const cleanedQty = toEnglishDigits(editProductQuantity);
                    const cleanedPurchase = toEnglishDigits(editProductPurchasePrice);
                    const cleanedSelling = toEnglishDigits(editProductSellingPrice);
                    await axios.put(`/products/${editingProduct.id}/`, {
                        name: editProductName,
                        brand: editProductBrand,
                        type: editingProduct.type,
                        purchase_price: parseFloat(cleanedPurchase) || 0,
                        selling_price: parseFloat(cleanedSelling) || 0,
                        quantity: editingProduct.type !== 'Phone' ? (!isNaN(parseInt(cleanedQty)) ? parseInt(cleanedQty) : currentAvail) : null
                    });
                    setEditingProduct(null);
                    refresh();
                } catch(err) {
                    alert("حدث خطأ أثناء تعديل بيانات المنتج.");
                }
            };

            const handleDeleteProduct = async (prodId, prodName) => {
                const confirmDel = confirm(`⚠️ تحذير: هل أنت متأكد من حذف المنتج "${prodName}" نهائياً من المخزن؟ سيتم حذف كافة القطع المرتبطة به!`);
                if (confirmDel) {
                    try {
                        await axios.delete(`/products/${prodId}/`);
                        alert("تم حذف المنتج بنجاح. 🎉");
                        refresh();
                    } catch(err) {
                        alert("حدث خطأ أثناء محاولة حذف المنتج.");
                    }
                }
            };


            // Charger specs states
            const [isChargerSpec, setIsChargerSpec] = useState(false);
            const [chargerWatts, setChargerWatts] = useState('');
            const [cableLength, setCableLength] = useState('');
            const [boxContents, setBoxContents] = useState('both');

            const defaultPhoneBrands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Realme", "Infinix", "Honor", "Oppo"];
            const defaultAccessoryBrands = ["Anker", "Joyroom", "LDNIO", "Baseus", "Remax", "Yesido", "Hoco", "Oraimo", "Apple", "Samsung", "Xiaomi", "Green Lion", "McDodo", "Awei", "G-Tab", "Pavareal"];

            const existingPhoneBrands = products.filter(p => p.type === 'Phone' || p.type === 'Maintenance').map(p => p.brand);
            const existingAccessoryBrands = products.filter(p => p.type === 'Accessory').map(p => p.brand);

            const PHONE_BRANDS = [...new Set([...defaultPhoneBrands, ...existingPhoneBrands])].filter(b => b && b !== 'أخرى');
            PHONE_BRANDS.push('أخرى');

            const ACCESSORY_BRANDS = [...new Set([...defaultAccessoryBrands, ...existingAccessoryBrands])].filter(b => b && b !== 'أخرى');
            ACCESSORY_BRANDS.push('أخرى');

            // Sync product type state and default brand with the active category tab
            useEffect(() => {
                setType(activeCategory);
                if (activeCategory === 'Accessory') {
                    setSelectedBrand('Anker');
                } else {
                    setSelectedBrand('Apple');
                }
            }, [activeCategory]);

            const handleAddToList = (e) => {
                e.preventDefault();
                setErrorMsg('');
                
                const finalBrand = selectedBrand === 'أخرى' ? customBrand.trim() : selectedBrand;
                if (!finalBrand) {
                    setErrorMsg("يرجى تحديد أو كتابة اسم الشركة المصنعة.");
                    return;
                }

                let finalName = name.trim();
                if (activeCategory === 'Maintenance' && compatibleDevice.trim()) {
                    finalName = `${finalName} (${compatibleDevice.trim()})`;
                }

                if (activeCategory === 'Accessory' && isChargerSpec) {
                    const specs = [];
                    if (chargerWatts.trim()) specs.push(`${chargerWatts.trim()}W`);
                    if (cableLength.trim()) specs.push(`طول ${cableLength.trim()}م`);
                    
                    let contentsText = '';
                    if (boxContents === 'both') contentsText = 'شاحن مع كيبل';
                    else if (boxContents === 'adapter') contentsText = 'شاحن فقط';
                    else if (boxContents === 'cable') contentsText = 'كيبل فقط';
                    
                    if (contentsText) specs.push(contentsText);
                    
                    if (specs.length > 0) {
                        finalName = `${finalName} (${specs.join(' - ')})`;
                    }
                }

                const imeis = imeisInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

                const newItem = {
                    name: finalName,
                    brand: finalBrand,
                    type: activeCategory,
                    purchase_price: parseFloat(purchasePrice) || 0,
                    selling_price: parseFloat(sellingPrice) || 0,
                    imeis: activeCategory === 'Phone' ? imeis : null,
                    quantity: activeCategory === 'Phone' ? 1 : parseInt(quantity) || 1,
                    battery_health: (activeCategory === 'Phone' && selectedBrand === 'Apple' && batteryHealth) ? parseInt(batteryHealth) : null,
                    displayName: name.trim(),
                    displayDevice: compatibleDevice.trim()
                };

                setPurchaseList([...purchaseList, newItem]);

                // Reset only specific fields to allow quick adding for same device/brand
                setName('');
                setPurchasePrice('');
                setSellingPrice('');
                setImeisInput('');
                setQuantity('1');
                setBatteryHealth('');
                setIsChargerSpec(false);
                setChargerWatts('');
                setCableLength('');
                setBoxContents('both');
            };

            const handleSaveEntireList = async () => {
                if (purchaseList.length === 0) return;
                setIsSavingList(true);
                setErrorMsg('');
                try {
                    for (const item of purchaseList) {
                        await axios.post('/products/', {
                            name: item.name,
                            brand: item.brand,
                            type: item.type,
                            purchase_price: item.purchase_price,
                            selling_price: item.selling_price,
                            imeis: item.imeis,
                            quantity: item.quantity,
                            battery_health: item.battery_health
                        });
                    }
                    setPurchaseList([]);
                    setCompatibleDevice('');
                    setCustomBrand('');
                    refresh();
                    alert("تم تنزيل قائمة المواد بالكامل إلى المخزن بنجاح! 🎉");
                } catch (err) {
                    setErrorMsg("حدث خطأ أثناء تنزيل بعض المواد. يرجى المحاولة مرة أخرى.");
                } finally {
                    setIsSavingList(false);
                }
            };

            const handleCreateProduct = async (e) => {
                e.preventDefault();
                setErrorMsg('');
                
                const finalBrand = selectedBrand === 'أخرى' ? customBrand.trim() : selectedBrand;
                if (!finalBrand) {
                    setErrorMsg("يرجى تحديد أو كتابة اسم الشركة المصنعة.");
                    return;
                }

                try {
                    if (activeCategory === 'Maintenance') {
                        const partNames = Object.keys(selectedParts);
                        if (partNames.length === 0) {
                            setErrorMsg("يرجى اختيار قطعة صيانة واحدة على الأقل وتعبئة معلوماتها.");
                            return;
                        }
                        if (!compatibleDevice.trim()) {
                            setErrorMsg("يرجى كتابة موديل الجهاز المتوافق.");
                            return;
                        }

                        let compatText = compatibleDevice.trim();
                        if (otherCompatibleDevices.trim()) {
                            compatText += " / " + otherCompatibleDevices.trim();
                        }
                        for (const partName of partNames) {
                            const pData = selectedParts[partName];
                            const qualityText = pData.quality ? ` - ${pData.quality}` : '';
                            const finalName = `${partName}${qualityText} (${compatText})`;
                            await axios.post('/products/', {
                                name: finalName,
                                brand: finalBrand,
                                type: 'Maintenance',
                                purchase_price: parseFloat(pData.purchasePrice) || 0,
                                selling_price: parseFloat(pData.sellingPrice) || 0,
                                imeis: null,
                                quantity: parseInt(pData.quantity) || 1,
                                battery_health: null
                            });
                        }
                        
                        setSelectedParts({});
                        setCompatibleDevice('');
                        setOtherCompatibleDevices('');
                    } else {
                        let finalName = name.trim();
                        if (activeCategory === 'Accessory' && isChargerSpec) {
                            const specs = [];
                            if (chargerWatts.trim()) specs.push(`${chargerWatts.trim()}W`);
                            if (cableLength.trim()) specs.push(`طول ${cableLength.trim()}م`);
                            
                            let contentsText = '';
                            if (boxContents === 'both') contentsText = 'شاحن مع كيبل';
                            else if (boxContents === 'adapter') contentsText = 'شاحن فقط';
                            else if (boxContents === 'cable') contentsText = 'كيبل فقط';
                            
                            if (contentsText) specs.push(contentsText);
                            
                            if (specs.length > 0) {
                                finalName = `${finalName} (${specs.join(' - ')})`;
                            }
                        }

                        const imeis = imeisInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

                        await axios.post('/products/', {
                            name: finalName,
                            brand: finalBrand,
                            type: activeCategory,
                            purchase_price: parseFloat(purchasePrice) || 0,
                            selling_price: parseFloat(sellingPrice) || 0,
                            imeis: activeCategory === 'Phone' ? imeis : null,
                            quantity: activeCategory === 'Phone' ? 1 : parseInt(quantity) || 1,
                            battery_health: (activeCategory === 'Phone' && selectedBrand === 'Apple' && batteryHealth) ? parseInt(batteryHealth) : null
                        });
                        
                        setName('');
                        setPurchasePrice('');
                        setSellingPrice('');
                        setImeisInput('');
                        setQuantity('1');
                        setBatteryHealth('');
                        setIsChargerSpec(false);
                        setChargerWatts('');
                        setCableLength('');
                        setBoxContents('both');
                    }
                    
                    setCustomBrand('');
                    refresh();
                    alert("تم حفظ وتنزيل المواد بالمخزن بنجاح! 🎉");
                } catch (err) {
                    setErrorMsg(err.response?.data?.detail || "حدث خطأ أثناء إضافة البضاعة.");
                }
            };

            return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Form dynamically adapted to the active tab */}
                    <div className="space-y-6">
                        <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl h-fit">
                        <h3 className="font-bold text-lg mb-6 text-emerald-400">
                            {activeCategory === 'Phone' && "شراء وتنزيل أجهزة موبايل"}
                            {activeCategory === 'Accessory' && "شراء وتنزيل إكسسوارات"}
                            {activeCategory === 'Maintenance' && "شراء وتنزيل قطع صيانة"}
                        </h3>
                        <form onSubmit={handleCreateProduct} className="space-y-4">
                            {errorMsg && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl">
                                    {errorMsg}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">الشركة المصنعة (Brand)</label>
                                <select 
                                    value={selectedBrand}
                                    onChange={e => setSelectedBrand(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 mb-2"
                                >
                                    {(activeCategory === 'Accessory' ? ACCESSORY_BRANDS : PHONE_BRANDS).map(b => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                                {selectedBrand === 'أخرى' && (
                                    <input 
                                        type="text" 
                                        required
                                        value={customBrand}
                                        onChange={e => setCustomBrand(e.target.value)}
                                        placeholder="اكتب اسم الشركة هنا"
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100"
                                    />
                                )}
                            </div>

                            {activeCategory === 'Maintenance' ? (
                                /* =============================================
                                   MAINTENANCE: MULTI-PART SELECTOR VIEW (بدون هوسة)
                                   ============================================= */
                                <div className="space-y-4">
                                     {/* Compatible Device */}
                                     <div>
                                          <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">موديل الجهاز المتوافق *</label>
                                          {modelSelectionMode === 'select' ? (
                                              <div className="relative">
                                                  <select
                                                      required
                                                      value={compatibleDevice}
                                                       onChange={e => {
                                                           const val = e.target.value;
                                                           if (val === '__custom__') {
                                                               setModelSelectionMode('custom');
                                                               setCompatibleDevice('');
                                                               setOtherCompatibleDevices('');
                                                           } else {
                                                               setCompatibleDevice(val);
                                                               // Find compatibilities in our database to auto-fill
                                                               const entry = (compatData.compatibilities || []).find(c => {
                                                                   return c.brand.toLowerCase() === selectedBrand.toLowerCase() && c.model.toLowerCase() === val.toLowerCase();
                                                               });
                                                               if (entry && entry.compatible_models) {
                                                                   setOtherCompatibleDevices(entry.compatible_models.join(' / '));
                                                               } else {
                                                                   setOtherCompatibleDevices('');
                                                               }
                                                           }
                                                       }}
                                                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 cursor-pointer appearance-none text-right"
                                                  >
                                                      <option value="">-- اختر الموديل من القائمة --</option>
                                                      {(BRAND_MODELS[selectedBrand] || []).map(m => (
                                                          <option key={m} value={m}>{m}</option>
                                                      ))}
                                                      <option value="__custom__">✍️ كتابة موديل آخر يدوياً...</option>
                                                  </select>
                                                  <Icon name="chevron-down" className="w-4 h-4 text-zinc-400 absolute left-3.5 top-4 pointer-events-none" />
                                              </div>
                                          ) : (
                                              <div className="flex gap-2">
                                                  <input 
                                                      type="text" 
                                                      required 
                                                      value={compatibleDevice} 
                                                      onChange={e => setCompatibleDevice(e.target.value)} 
                                                      placeholder="اكتب الموديل يدوياً..." 
                                                      className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100" 
                                                  />
                                                  <button
                                                      type="button"
                                                      onClick={() => {
                                                          setModelSelectionMode('select');
                                                          setCompatibleDevice('');
                                                      }}
                                                      className="px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-400 rounded-xl text-sm font-bold transition-all"
                                                  >
                                                      القائمة
                                                  </button>
                                              </div>
                                          )}
                                     </div>

                                     {/* Other compatible devices field */}
                                     {compatibleDevice.trim() && (() => {
                                         const tags = otherCompatibleDevices.trim() ? otherCompatibleDevices.split(' / ').map(m => m.trim()).filter(Boolean) : [];
                                         return (
                                             <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-900 rounded-2xl">
                                                 <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">أجهزة متوافقة أخرى (اختياري)</label>
                                                 
                                                 {/* Dropdown Selector */}
                                                 <div className="relative">
                                                     <select
                                                         onChange={e => {
                                                             const val = e.target.value;
                                                             if (!val) return;
                                                             if (!tags.includes(val)) {
                                                                 const updated = [...tags, val];
                                                                 setOtherCompatibleDevices(updated.join(' / '));
                                                             }
                                                             e.target.value = ""; // Reset dropdown selection
                                                         }}
                                                         className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer appearance-none text-right"
                                                     >
                                                         <option value="">-- اختر جهازاً لإضافته للتوافقات --</option>
                                                         {Object.keys(BRAND_MODELS).map(brand => (
                                                             <optgroup key={brand} label={brand}>
                                                                 {BRAND_MODELS[brand].map(model => (
                                                                     <option key={`${brand}-${model}`} value={`${brand} - ${model}`}>{brand} - {model}</option>
                                                                 ))}
                                                             </optgroup>
                                                         ))}
                                                     </select>
                                                     <Icon name="chevron-down" className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                                                 </div>

                                                 {/* Custom manual model addition */}
                                                 <div className="flex gap-2">
                                                     <input 
                                                         type="text" 
                                                         id="custom-compat-input"
                                                         placeholder="أو اكتب موديل مخصص يدوياً هنا واضغط (+)..."
                                                         className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                                                         onKeyDown={e => {
                                                             if (e.key === 'Enter') {
                                                                 e.preventDefault();
                                                                 const val = e.target.value.trim();
                                                                 if (val && !tags.includes(val)) {
                                                                     const updated = [...tags, val];
                                                                     setOtherCompatibleDevices(updated.join(' / '));
                                                                 }
                                                                 e.target.value = "";
                                                             }
                                                         }}
                                                     />
                                                     <button
                                                         type="button"
                                                         onClick={() => {
                                                             const inputEl = document.getElementById('custom-compat-input');
                                                             const val = inputEl ? inputEl.value.trim() : '';
                                                             if (val && !tags.includes(val)) {
                                                                 const updated = [...tags, val];
                                                                 setOtherCompatibleDevices(updated.join(' / '));
                                                             }
                                                             if (inputEl) inputEl.value = "";
                                                         }}
                                                         className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                                     >
                                                         + إضافة
                                                     </button>
                                                 </div>

                                                 {/* Visual Tags/Badges list */}
                                                 <div>
                                                     <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-1.5 font-bold">التوافقات المحددة حالياً ({tags.length}):</div>
                                                     {tags.length > 0 ? (
                                                         <div className="flex flex-wrap gap-1.5">
                                                             {tags.map((tag, i) => (
                                                                 <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all">
                                                                     <span>{tag}</span>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => {
                                                                             const updated = tags.filter((_, idx) => idx !== i);
                                                                             setOtherCompatibleDevices(updated.join(' / '));
                                                                         }}
                                                                         className="text-emerald-500/60 hover:text-rose-500 transition-colors font-black"
                                                                     >
                                                                         ✕
                                                                     </button>
                                                                 </span>
                                                             ))}
                                                         </div>
                                                     ) : (
                                                         <div className="text-xs text-zinc-400 dark:text-zinc-500 italic">لا توجد أجهزة متوافقة أخرى مضافة بعد.</div>
                                                     )}
                                                 </div>
                                             </div>
                                         );
                                     })()}

                                    {/* Toggle Buttons */}
                                    <div>
                                         <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1.5 font-bold text-sky-400">اختر قطع الصيانة المطلوبة (يمكن تحديد أكثر من قطعة) *</label>
                                         <div className="flex flex-wrap gap-1.5 mb-3">
                                             {["شاشة", "بطارية", "كفر خلفي", "منفذ شحن", "كاميرا خلفية", "كاميرا أمامية", "فلاتة شحن", "سماعة"].map(partType => {
                                                 const isSelected = !!selectedParts[partType];
                                                 return (
                                                     <button
                                                         type="button"
                                                         key={partType}
                                                         onClick={() => {
                                                             const updated = { ...selectedParts };
                                                             if (updated[partType]) {
                                                                 delete updated[partType];
                                                             } else {
                                                                 updated[partType] = { purchasePrice: '', sellingPrice: '', quantity: '1' };
                                                             }
                                                             setSelectedParts(updated);
                                                         }}
                                                         className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                             isSelected 
                                                             ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm' 
                                                             : 'bg-zinc-50 dark:bg-zinc-950 text-slate-450 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:text-zinc-200'
                                                         }`}
                                                     >
                                                         {partType} {isSelected ? '✓' : ''}
                                                     </button>
                                                 );
                                             })}
                                         </div>

                                         {/* Add custom part field */}
                                         <div className="flex gap-2">
                                             <input 
                                                 type="text" 
                                                 value={customPartInput} 
                                                 onChange={e => setCustomPartInput(e.target.value)} 
                                                 placeholder="إضافة قطعة صيانة أخرى..." 
                                                 className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                                             />
                                             <button 
                                                 type="button" 
                                                 onClick={() => {
                                                     if (!customPartInput.trim()) return;
                                                     const part = customPartInput.trim();
                                                     const updated = { ...selectedParts };
                                                     if (!updated[part]) {
                                                         updated[part] = { purchasePrice: '', sellingPrice: '', quantity: '1' };
                                                         setSelectedParts(updated);
                                                     }
                                                     setCustomPartInput('');
                                                 }}
                                                 className="px-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-slate-755 text-emerald-400 font-bold rounded-xl text-xs transition-all"
                                             >
                                                 إضافة
                                             </button>
                                         </div>
                                    </div>

                                    {/* Dynamically opened input fields for each selected part */}
                                    <div className="space-y-3">
                                         {Object.keys(selectedParts).map(partName => {
                                             const partData = selectedParts[partName];
                                             return (
                                                 <div key={partName} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-150 dark:border-zinc-900 rounded-2xl space-y-3">
                                                     <div className="flex justify-between items-center">
                                                         <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">🛠️ {partName}</span>
                                                         <button 
                                                             type="button" 
                                                             onClick={() => {
                                                                 const updated = { ...selectedParts };
                                                                 delete updated[partName];
                                                                 setSelectedParts(updated);
                                                             }} 
                                                             className="text-[10px] text-rose-450 hover:text-rose-400"
                                                         >
                                                             إلغاء القطعة
                                                         </button>
                                                     </div>
                                                     <div className="grid grid-cols-4 gap-2">
                                                         <div>
                                                             <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">الجودة</label>
                                                             <select
                                                                 value={partData.quality || 'أصلي'}
                                                                 onChange={e => {
                                                                     const updated = { ...selectedParts };
                                                                     updated[partName].quality = e.target.value;
                                                                     setSelectedParts(updated);
                                                                 }}
                                                                 className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg px-1.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                                                             >
                                                                 <option value="أصلي وكالة">أصلي وكالة</option>
                                                                 <option value="درجة أولى">درجة أولى</option>
                                                                 <option value="تجاري">تجاري</option>
                                                                 <option value="تفصيخ مستعمل">تفصيخ</option>
                                                             </select>
                                                         </div>
                                                         <div>
                                                             <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">سعر الشراء</label>
                                                             <input 
                                                                 type="text" 
                                                                 inputMode="decimal"
                                                                 required
                                                                 placeholder="0" 
                                                                 value={partData.purchasePrice} 
                                                                 onChange={e => {
                                                                     const val = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '');
                                                                     const updated = { ...selectedParts };
                                                                     updated[partName].purchasePrice = val;
                                                                     setSelectedParts(updated);
                                                                 }}
                                                                 className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-right text-emerald-400 font-mono focus:outline-none focus:border-emerald-500" 
                                                             />
                                                         </div>
                                                         <div>
                                                             <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">سعر البيع</label>
                                                             <input 
                                                                 type="text" 
                                                                 inputMode="decimal"
                                                                 required
                                                                 placeholder="0" 
                                                                 value={partData.sellingPrice} 
                                                                 onChange={e => {
                                                                     const val = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '');
                                                                     const updated = { ...selectedParts };
                                                                     updated[partName].sellingPrice = val;
                                                                     setSelectedParts(updated);
                                                                 }}
                                                                 className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-right text-sky-400 font-mono focus:outline-none focus:border-emerald-500" 
                                                             />
                                                         </div>
                                                         <div>
                                                             <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">الكمية</label>
                                                             <input 
                                                                 type="text" 
                                                                 inputMode="numeric"
                                                                 required
                                                                 value={partData.quantity} 
                                                                 onChange={e => {
                                                                     const val = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                                                                     const updated = { ...selectedParts };
                                                                     updated[partName].quantity = val;
                                                                     setSelectedParts(updated);
                                                                 }}
                                                                 className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-center text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500" 
                                                             />
                                                         </div>
                                                     </div>
                                                 </div>
                                             );
                                         })}
                                    </div>
                                </div>
                            ) : (
                                /* =============================================
                                   PHONES / ACCESSORIES: STANDARD SINGLE-ITEM VIEW
                                   ============================================= */
                                <div className="space-y-4">
                                    <div>
                                         <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                                             {activeCategory === 'Phone' && "اسم الجهاز والموديل"}
                                             {activeCategory === 'Accessory' && "اسم الإكسسوار"}
                                         </label>
                                         <input 
                                             type="text" 
                                             required
                                             value={name}
                                             onChange={e => setName(e.target.value)}
                                             list={activeCategory === 'Phone' ? "inventory-device-models" : undefined}
                                             placeholder={
                                                 activeCategory === 'Phone' ? "مثال: iPhone 15 Pro Max" : "مثال: شاحن سريع 20W"
                                             }
                                             className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100"
                                         />
                                         {activeCategory === 'Phone' && (
                                             <datalist id="inventory-device-models">
                                                 {(BRAND_MODELS[selectedBrand] || []).map(m => (
                                                     <option key={m} value={m} />
                                                 ))}
                                             </datalist>
                                         )}
                                    </div>
                                     {activeCategory === 'Accessory' && (
                                         <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-150 dark:border-zinc-900 rounded-2xl space-y-4 mb-4">
                                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                                 <input 
                                                     type="checkbox" 
                                                     checked={isChargerSpec} 
                                                     onChange={e => setIsChargerSpec(e.target.checked)} 
                                                     className="w-4 h-4 rounded border-zinc-200 dark:border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-50 dark:bg-zinc-950"
                                                 />
                                                 <span className="text-xs font-bold text-slate-350">تخصيص مواصفات الشاحن / الكيبل (واط، طول، نوع)</span>
                                             </label>

                                             {isChargerSpec && (
                                                 <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-900">
                                                     <div className="grid grid-cols-2 gap-2">
                                                         <div>
                                                             <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">القدرة بالواط (Watts)</label>
                                                             <input 
                                                                 type="text" 
                                                                 placeholder="مثال: 20" 
                                                                 value={chargerWatts} 
                                                                 onChange={e => setChargerWatts(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''))}
                                                                 className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-center text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                                                             />
                                                         </div>
                                                         <div>
                                                             <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">طول الكيبل (متر)</label>
                                                             <input 
                                                                 type="text" 
                                                                 placeholder="مثال: 1 أو 1.5" 
                                                                 value={cableLength} 
                                                                 onChange={e => setCableLength(e.target.value)}
                                                                 className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-center text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                                                             />
                                                         </div>
                                                     </div>
                                                     <div>
                                                         <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1.5">نوع المنتج / المحتويات</label>
                                                         <div className="grid grid-cols-3 gap-1">
                                                             {[
                                                                 { key: 'both', label: 'شاحن مع كيبل' },
                                                                 { key: 'adapter', label: 'شاحن فقط' },
                                                                 { key: 'cable', label: 'كيبل فقط' }
                                                             ].map(opt => (
                                                                 <button
                                                                     type="button"
                                                                     key={opt.key}
                                                                     onClick={() => setBoxContents(opt.key)}
                                                                     className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                                                         boxContents === opt.key 
                                                                         ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                                         : 'bg-white dark:bg-[#0c0c0f] text-slate-450 border-transparent hover:text-zinc-800 dark:text-zinc-200'
                                                                     }`}
                                                                 >
                                                                     {opt.label}
                                                                 </button>
                                                             ))}
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     )}
                                    <div>
                                         <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">سعر الشراء (التكلفة للقطعة)</label>
                                         <input 
                                             type="text" 
                                             inputMode="decimal"
                                             required
                                             placeholder="0.00"
                                             value={purchasePrice}
                                             onChange={e => {
                                                 const converted = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '');
                                                 setPurchasePrice(converted);
                                             }}
                                             onFocus={e => e.target.select()}
                                             className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 text-right font-mono"
                                         />
                                    </div>
                                    <div>
                                         <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">سعر البيع المقترح</label>
                                         <input 
                                             type="text" 
                                             inputMode="decimal"
                                             required
                                             placeholder="0.00"
                                             value={sellingPrice}
                                             onChange={e => {
                                                 const converted = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '');
                                                 setSellingPrice(converted);
                                             }}
                                             onFocus={e => e.target.select()}
                                             className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 text-right font-mono"
                                         />
                                    </div>
                                    {activeCategory !== 'Phone' && (
                                         <div>
                                             <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">الكمية المشتراة (عدد القطع)</label>
                                             <input 
                                                 type="text" 
                                                 inputMode="numeric"
                                                 required
                                                 value={quantity}
                                                 onChange={e => {
                                                     const converted = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                                                     setQuantity(converted);
                                                 }}
                                                 onFocus={e => e.target.select()}
                                                 className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 text-right font-mono"
                                             />
                                         </div>
                                    )}
                                    {activeCategory === 'Phone' && (
                                         <div>
                                             <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">أرقام الـ IMEI (رقم لكل جهاز في سطر)</label>
                                             <textarea 
                                                 rows="3"
                                                 required
                                                 value={imeisInput}
                                                 onChange={e => setImeisInput(e.target.value)}
                                                 placeholder="أدخل أرقام التسلسلي هنا"
                                                 className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-550 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
                                             ></textarea>
                                         </div>
                                    )}
                                    {activeCategory === 'Phone' && selectedBrand === 'Apple' && (
                                         <div>
                                             <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">نسبة صحة البطارية (%)</label>
                                             <input 
                                                 type="text" 
                                                 inputMode="numeric"
                                                 placeholder="مثال: 85"
                                                 value={batteryHealth}
                                                 onChange={e => {
                                                     const converted = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                                                     setBatteryHealth(converted);
                                                 }}
                                                 onFocus={e => e.target.select()}
                                                 className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-zinc-100 text-right font-mono"
                                             />
                                         </div>
                                    )}
                                </div>
                            )}

                            {/* Submit Buttons */}
                            {activeCategory === 'Maintenance' ? (
                                <button 
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Icon name="plus-circle" className="w-5 h-5" />
                                    <span>حفظ وتنزيل قطع الصيانة للمخزن 📥</span>
                                </button>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button"
                                        onClick={handleAddToList}
                                        className="bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-md"
                                    >
                                        <Icon name="plus-circle" className="w-4 h-4 text-emerald-400" />
                                        <span>إضافة للقائمة</span>
                                    </button>
                                    <button 
                                        type="submit"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-md"
                                    >
                                        <Icon name="zap" className="w-4 h-4 text-white" />
                                        <span>تنزيل مباشر</span>
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Temporary Purchase List Card */}
                    {purchaseList.length > 0 && (
                        <div className="p-5 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                                    📋 قائمة تنزيل البضاعة المؤقتة ({purchaseList.length})
                                </h4>
                                <button onClick={() => setPurchaseList([])} className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors">
                                    إلغاء الكل
                                </button>
                            </div>
                            
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {purchaseList.map((item, idx) => (
                                    <div key={idx} className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 rounded-xl flex justify-between items-center text-xs">
                                        <div className="space-y-0.5">
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200">{item.brand} - {item.displayName}</div>
                                            {item.displayDevice && <div className="text-[10px] text-zinc-400 dark:text-zinc-500">لجهاز: {item.displayDevice}</div>}
                                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">العدد: {item.quantity} | التكلفة للقطعة: {item.purchase_price.toLocaleString()} د.ع</div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setPurchaseList(purchaseList.filter((_, i) => i !== idx))} 
                                            className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-rose-400 transition-colors text-xs"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveEntireList}
                                disabled={isSavingList}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-850 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                {isSavingList ? 'جاري تنزيل وتثبيت المواد...' : `تنزيل المواد المضافة (${purchaseList.length}) للمخزن`}
                            </button>
                        </div>
                    )}
                </div>

                    {/* Right Column: Products & Stock List */}
                    <div className="lg:col-span-2 p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <h3 className="font-bold text-lg mb-4 text-emerald-400">البضاعة والمستودع</h3>
                        
                        {/* 3 Categories Tab Navigation */}
                        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6 overflow-x-auto">
                            <button 
                                type="button"
                                onClick={() => setActiveCategory('Phone')}
                                className={`px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${activeCategory === 'Phone' ? 'bg-zinc-200 dark:bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200'}`}
                            >
                                أجهزة الموبايل
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveCategory('Accessory')}
                                className={`px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${activeCategory === 'Accessory' ? 'bg-zinc-200 dark:bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200'}`}
                            >
                                الإكسسوارات
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveCategory('Maintenance')}
                                className={`px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap ${activeCategory === 'Maintenance' ? 'bg-zinc-200 dark:bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200'}`}
                            >
                                قطع الصيانة
                            </button>
                        </div>

                        {/* Search Input Bar & Sold Toggle */}
                        <div className="mb-6 flex gap-3">
                            <div className="relative flex-1">
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="البحث باسم الجهاز، الشركة، الأجهزة المتوافقة، أو الـ IMEI..."
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                                />
                                <div className="absolute right-3 top-3.5 text-zinc-400 dark:text-zinc-500">
                                    <Icon name="search" className="w-4 h-4" />
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowSoldItems(!showSoldItems)}
                                className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${
                                    showSoldItems 
                                    ? 'bg-brand-500/10 text-brand-600 border-brand-500/20' 
                                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:text-zinc-200'
                                }`}
                                title="عرض المواد المباعة"
                            >
                                <Icon name={showSoldItems ? "eye" : "eye-off"} className="w-4 h-4" />
                                <span>المباعة</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {products
                                .filter(p => p.type === activeCategory)
                                .filter(p => {
                                    // Hide virtual recharge/gaming cards from inventory list
                                    const isRecharge = ["كارت", "بطاقة", "شدات", "رصيد", "آسيا سيل", "زين عراق", "كورك", "فري فاير", "Free Fire", "ببجي", "PUBG", "آيتونز", "رايزر", "PlayStation", "جوجل بلاي"].some(kw => p.name.includes(kw));
                                    return !isRecharge;
                                })
                                .filter(p => 
                                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    p.items.some(item => item.imei && item.imei.toLowerCase().includes(searchQuery.toLowerCase()))
                                )
                                .map(p => {
                                    const availableItems = p.items.filter(i => String(i.status).toLowerCase() === 'available');
                                    
                                    // If showSoldItems is FALSE, hide products with 0 available items (finished items)
                                    if (!showSoldItems && availableItems.length === 0) {
                                        return null;
                                    }
                                    
                                    const itemsToDisplay = showSoldItems ? p.items : availableItems;
                                    return (
                                        <div key={p.id} className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 rounded-xl">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-base">{p.brand} - {p.name}</h4>
                                                        <button 
                                                            type="button"
                                                            onClick={() => startEditProduct(p)} 
                                                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-455 hover:text-emerald-500 transition-all cursor-pointer"
                                                            title="تعديل بيانات المادة"
                                                        >
                                                            <Icon name="edit" className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => { setBarcodeProduct(p); setBarcodeQty(1); }} 
                                                            className="p-1 hover:bg-indigo-500/10 rounded text-zinc-455 hover:text-indigo-400 transition-all cursor-pointer"
                                                            title="طباعة ستيكر الباركود والسعر"
                                                        >
                                                            <Icon name="barcode" className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteProduct(p.id, p.name)} 
                                                            className="p-1 hover:bg-rose-500/10 rounded text-zinc-455 hover:text-rose-500 transition-all cursor-pointer"
                                                            title="حذف المادة نهائياً"
                                                        >
                                                            <Icon name="trash-2" className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">سعر الشراء: {parseFloat(p.purchase_price).toLocaleString()} د.ع | سعر البيع: {parseFloat(p.selling_price).toLocaleString()} د.ع</div>
                                                </div>
                                                <div className="text-left text-xs">
                                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                                        p.type === 'Phone' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        p.type === 'Accessory' ? 'bg-amber-500/10 text-amber-400' : 'bg-orange-500/10 text-orange-400'
                                                    }`}>
                                                        {p.type === 'Phone' ? 'موبايل' : p.type === 'Accessory' ? 'إكسسوار' : 'قطعة صيانة'}
                                                    </span>
                                                    <div className="text-zinc-500 dark:text-zinc-400 mt-1">المتوفر: {availableItems.length} {p.type === 'Phone' ? 'أجهزة' : 'قطع'}</div>
                                                </div>
                                            </div>

                                            {/* IMEIs status */}
                                            {p.type === 'Phone' && p.items.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-900">
                                                    <div className="flex flex-wrap gap-2">
                                                        {itemsToDisplay.map(item => (
                                                            <span key={item.id} className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                                                                String(item.status).toLowerCase() === 'available' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-white dark:bg-[#0c0c0f] border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 line-through'
                                                            }`}>
                                                                {p.type === 'Phone' ? item.imei : 'قطعة'} {item.battery_health ? `(🔋 ${item.battery_health}%)` : ''} ({String(item.status).toLowerCase() === 'available' ? 'متوفر' : 'مباع'})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            {products
                                .filter(p => p.type === activeCategory)
                                .filter(p => {
                                    const isRecharge = ["كارت", "بطاقة", "شدات", "رصيد", "آسيا سيل", "زين عراق", "كورك", "فري فاير", "Free Fire", "ببجي", "PUBG", "آيتونز", "رايزر", "PlayStation", "جوجل بلاي"].some(kw => p.name.includes(kw));
                                    return !isRecharge;
                                })
                                .filter(p => 
                                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    p.items.some(item => item.imei && item.imei.toLowerCase().includes(searchQuery.toLowerCase()))
                                ).length === 0 && (
                                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm">لا توجد نتائج بحث مطابقة.</div>
                            )}
                        </div>
                    </div>

                    {/* Edit Product Modal */}
                    {editingProduct && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <form onSubmit={handleSaveEditProduct} className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                                <h3 className="font-bold text-base text-emerald-500">تعديل بيانات مادة بالمستودع</h3>
                                
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">اسم المادة / الموديل *</label>
                                    <input type="text" required value={editProductName} onChange={e => setEditProductName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500" />
                                </div>

                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">الشركة المصنعة (البراند) *</label>
                                    <input type="text" required value={editProductBrand} onChange={e => setEditProductBrand(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">سعر الشراء (د.ع) *</label>
                                        <input type="text" required value={editProductPurchasePrice} onChange={e => setEditProductPurchasePrice(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 text-right font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">سعر البيع (د.ع) *</label>
                                        <input type="text" required value={editProductSellingPrice} onChange={e => setEditProductSellingPrice(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 text-right font-mono" />
                                    </div>
                                </div>

                                {editingProduct.type !== 'Phone' && (
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">الكمية المتوفرة بالمخزن *</label>
                                        <input 
                                            type="number" 
                                            required 
                                            value={editProductQuantity} 
                                            onChange={e => setEditProductQuantity(e.target.value)} 
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500" 
                                            min="0"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer">
                                        إلغاء
                                    </button>
                                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer">
                                        حفظ التغييرات
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Barcode Sticker Generator Modal */}
                    {barcodeProduct && (() => {
                        // Generate a simple numeric representation of product ID for standard barcode rendering
                        const shortIdNum = parseInt(barcodeProduct.id.replace(/[^0-9]/g, '').slice(0, 12)) || 123456789012;
                        const barcodeValue = String(shortIdNum).padStart(12, '0').slice(0, 12);
                        
                        // Callback to draw the barcode svg on the fly
                        setTimeout(() => {
                            try {
                                if (window.JsBarcode) {
                                    window.JsBarcode("#printable-barcode-svg", barcodeValue, {
                                        format: "EAN13",
                                        width: 1.8,
                                        height: 50,
                                        displayValue: true,
                                        fontSize: 10,
                                        font: "monospace"
                                    });
                                }
                            } catch (e) {
                                console.error("Error drawing barcode:", e);
                            }
                        }, 100);

                        const handlePrint = () => {
                            const printContent = document.getElementById('barcode-printable-area').innerHTML;
                            const originalContent = document.body.innerHTML;
                            
                            // Simple window print layout override
                            const style = document.createElement('style');
                            style.innerHTML = `
                                @media print {
                                    body {
                                        background: white;
                                        color: black;
                                        margin: 0;
                                        padding: 0;
                                        direction: rtl;
                                    }
                                    .no-print {
                                        display: none !important;
                                    }
                                    .sticker-sheet {
                                        display: grid;
                                        grid-template-columns: repeat(3, 1fr);
                                        gap: 15px;
                                        padding: 20px;
                                    }
                                    .sticker {
                                        border: 1px dashed #ccc;
                                        padding: 10px;
                                        text-align: center;
                                        background: white;
                                        border-radius: 4px;
                                        page-break-inside: avoid;
                                    }
                                }
                            `;
                            document.head.appendChild(style);
                            window.print();
                            document.head.removeChild(style);
                            window.location.reload(); // Quick restore state
                        };

                        return (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-base text-indigo-400">طباعة ملصقات الأسعار والباركود للبضاعة</h3>
                                        <button onClick={() => setBarcodeProduct(null)} className="text-zinc-400 hover:text-zinc-200 text-sm">✕</button>
                                    </div>
                                    
                                    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{barcodeProduct.brand} - {barcodeProduct.name}</div>
                                            <div className="text-xs text-emerald-400 mt-1 font-mono font-bold">سعر البيع للملصق: {parseFloat(barcodeProduct.selling_price).toLocaleString()} د.ع</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="text-xs text-zinc-400">عدد الملصقات:</label>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="60" 
                                                value={barcodeQty} 
                                                onChange={e => setBarcodeQty(parseInt(e.target.value) || 1)} 
                                                className="w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-center text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Preview Area */}
                                    <div className="border border-dashed border-zinc-200 dark:border-zinc-850 rounded-2xl p-6 bg-white flex justify-center items-center overflow-x-auto">
                                        <div id="barcode-printable-area" className="sticker-sheet w-full grid grid-cols-2 gap-4 text-black" style={{ direction: 'rtl' }}>
                                            {Array.from({ length: barcodeQty }).map((_, idx) => (
                                                <div key={idx} className="sticker border border-black p-4 rounded-xl text-center bg-white shadow-sm space-y-1.5 flex flex-col items-center justify-center text-black">
                                                    <div className="text-[10px] font-bold text-black tracking-wider">M MOBILE CENTER</div>
                                                    <div className="text-[11px] font-black text-black truncate max-w-full">{barcodeProduct.brand} - {barcodeProduct.name}</div>
                                                    <svg id={`preview-barcode-svg-${idx}`} className="h-14 my-1 w-full max-w-[180px] text-black"></svg>
                                                    <div className="text-[12px] font-extrabold text-black font-mono">{parseFloat(barcodeProduct.selling_price).toLocaleString()} د.ع</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Render barcodes dynamically for preview cards */}
                                    {setTimeout(() => {
                                        for (let i = 0; i < barcodeQty; i++) {
                                            try {
                                                if (window.JsBarcode) {
                                                    window.JsBarcode(`#preview-barcode-svg-${i}`, barcodeValue, {
                                                        format: "EAN13",
                                                        width: 1.2,
                                                        height: 38,
                                                        displayValue: true,
                                                        fontSize: 9,
                                                        font: "monospace"
                                                    });
                                                }
                                            } catch(err) {}
                                        }
                                    }, 150)}

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setBarcodeProduct(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer">
                                            إلغاء
                                        </button>
                                        <button onClick={handlePrint} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10">
                                            <Icon name="printer" className="w-4 h-4" />
                                            طباعة الملصقات 🖨️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            );
        }

        // Advanced Accounting Component
