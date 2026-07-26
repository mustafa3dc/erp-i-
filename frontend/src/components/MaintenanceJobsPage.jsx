import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from './Icon';
import { getShortId, toEnglishDigits, BRAND_MODELS } from '../utils';
import { getShopSettings } from '../App';
import compatData from '../device_compatibilities.json';

const getWhatsAppLink = (job) => {
    let phone = job.customer_phone ? job.customer_phone.trim() : '';
    if (!phone) return '';
    phone = phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('07')) {
        phone = '964' + phone.substring(1);
    } else if (phone.startsWith('7')) {
        phone = '964' + phone;
    }
    let statusText = 'قيد الفحص والتصليح 🛠️';
    if (job.status === 'Repaired') statusText = 'تم إصلاح جهازك بنجاح وهو جاهز للاستلام 🎉';
    else if (job.status === 'Delivered') statusText = 'تم التسليم ✅';
    else if (job.status === 'Cancelled') statusText = 'تم إلغاؤه/لا يمكن تصليحه ❌';
    const costRaw = job.cost || job.actual_cost;
    const costText = (costRaw && parseFloat(costRaw) > 0) ? `${parseFloat(costRaw).toLocaleString()} د.ع` : 'محدد عند الاستلام';
    const msg = `السلام عليكم يا طيب 🌹\nبخصوص جهازك للـ صيانة:\n📱 *الجهاز:* ${job.device_model}\n🔧 *الحالة:* ${statusText}\n💵 *التكلفة:* ${costText}\n\n📍 محل M MOBILE يرحب بك في أي وقت.`;
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
};

export default         function MaintenanceJobsPage({ jobs, products = [], refresh }) {
             const [customerName, setCustomerName] = useState('');
            const [customerPhone, setCustomerPhone] = useState('');
            const [deviceModel, setDeviceModel] = useState('');
            const [selectedBrand, setSelectedBrand] = useState('Apple');
            const [imei, setImei] = useState('');
            const [problem, setProblem] = useState('');
            const [cost, setCost] = useState('');
            const [warrantyDays, setWarrantyDays] = useState('30');
            const [usedProductId, setUsedProductId] = useState('');
            const [usedPartIds, setUsedPartIds] = useState([]);
            const [errorMsg, setErrorMsg] = useState('');
            const [activeTab, setActiveTab] = useState('All');
            const [searchQuery, setSearchQuery] = useState('');
            const [showAddForm, setShowAddForm] = useState(false);
             const [partSearchQuery, setPartSearchQuery] = useState('');
             const [updateTrigger, setUpdateTrigger] = useState(0);
             const [customerSuggestions, setCustomerSuggestions] = useState([]);
             const [receipt, setReceipt] = useState(null);
             const [compatibleModel, setCompatibleModel] = useState('');
             const [modelSelectionMode, setModelSelectionMode] = useState('select');
             const [editingJob, setEditingJob] = useState(null);
             const [editCustomerName, setEditCustomerName] = useState('');
             const [editCustomerPhone, setEditCustomerPhone] = useState('');
             const [editBrand, setEditBrand] = useState('Apple');
             const [editModel, setEditModel] = useState('');
             const [editModelSelectionMode, setEditModelSelectionMode] = useState('select');
             const [editImei, setEditImei] = useState('');
             const [editProblem, setEditProblem] = useState('');
             const [editCost, setEditCost] = useState('');
             const [editWarrantyDays, setEditWarrantyDays] = useState('30');
             const [labelJob, setLabelJob] = useState(null);

             const startEditJob = (job) => {
                 setEditingJob(job);
                 setEditCustomerName(job.customer_name);
                 setEditCustomerPhone(job.customer_phone || '');
                 const brand = job.device_model.includes(' - ') ? job.device_model.split(' - ')[0].trim() : 'Apple';
                 const model = job.device_model.includes(' - ') ? job.device_model.split(' - ')[1].trim() : job.device_model;
                 setEditBrand(brand);
                 setEditModel(model);
                 setEditModelSelectionMode('select');
                 setEditImei(job.imei || '');
                 setEditProblem(job.problem_description || '');
                 setEditCost(job.cost.toString());
                 setEditWarrantyDays(job.warranty_days.toString());
             };

             const handleSaveEdit = async (e) => {
                 e.preventDefault();
                 try {
                     const finalDeviceModel = `${editBrand} - ${editModel.trim()}`;
                     await axios.put(`/maintenance/${editingJob.id}/`, {
                         status: editingJob.status,
                         cost: parseFloat(editCost) || 0,
                         used_product_id: editingJob.used_product_id,
                         used_part_ids: editingJob.parts.map(p => p.product_id),
                         customer_name: editCustomerName,
                         customer_phone: editCustomerPhone || null,
                         device_model: finalDeviceModel,
                         imei: editImei || null,
                         problem_description: editProblem || null,
                         warranty_days: parseInt(editWarrantyDays) || 30
                     });
                     setEditingJob(null);
                     refresh();
                 } catch(err) {
                     alert("حدث خطأ أثناء تعديل بيانات جهاز الصيانة.");
                 }
             };


            const handleCreateJob = async (e) => {
                e.preventDefault();
                setErrorMsg('');
                if (!customerName || !deviceModel) {
                    setErrorMsg("يرجى ملء الحقول الإلزامية (الاسم، والموديل).");
                    return;
                }

                try {
                    const finalDeviceModel = `${selectedBrand} - ${deviceModel.trim()}`;
                    await axios.post('/maintenance/', {
                        customer_name: customerName,
                        customer_phone: customerPhone || null,
                        device_model: finalDeviceModel,
                        imei: imei || null,
                        problem_description: problem || null,
                        cost: parseFloat(cost) || 0,
                        status: "Under Inspection",
                        warranty_days: parseInt(warrantyDays) || 30,
                        used_product_id: usedProductId || null,
                        used_part_ids: usedPartIds
                    });
                    // Reset
                    setCustomerName('');
                    setCustomerPhone('');
                    setDeviceModel('');
                    setImei('');
                    setProblem('');
                    setCost('');
                    setWarrantyDays('30');
                    setUsedProductId('');
                    setUsedPartIds([]);
                    setPartSearchQuery('');
                    setCompatibleModel('');
                    setShowAddForm(false);
                    refresh();
                } catch (err) {
                    setErrorMsg(err.response?.data?.detail || "حدث خطأ أثناء حفظ جهاز الصيانة.");
                }
            };

            const handleUpdateStatus = async (jobId, currentStatus, currentCost) => {
                let nextStatus = "Under Inspection";
                if (currentStatus === "Under Inspection") nextStatus = "Repaired";
                else if (currentStatus === "Repaired") nextStatus = "Delivered";
                
                try {
                    const res = await axios.put(`/maintenance/${jobId}/`, {
                        status: nextStatus,
                        cost: parseFloat(currentCost) || 0
                    });
                    refresh();
                    
                    // If transitioned to Delivered, show receipt!
                    if (nextStatus === "Delivered") {
                        const s = getShopSettings();
                        setReceipt({
                            id: res.data.id,
                            type: 'maintenance',
                            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                            customer: res.data.customer_name,
                            customerPhone: res.data.customer_phone,
                            paymentMethod: 'Cash',
                            items: [{
                                brand: 'صيانة جهاز',
                                name: res.data.device_model,
                                imei: res.data.imei,
                                price: res.data.cost
                            }],
                            total: res.data.cost,
                            maintenanceNote: res.data.problem_description,
                            warrantyDays: res.data.warranty_days
                        });
                    }
                } catch (e) {
                    alert("حدث خطأ أثناء تحديث حالة جهاز الصيانة.");
                }
            };

            const printReceipt = () => {
                window.print();
            };

            const filteredJobs = jobs.filter(job => {
                const matchesTab = activeTab === 'All' || job.status === activeTab;
                const matchesSearch = 
                    job.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    job.device_model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (job.imei && job.imei.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (job.customer_phone && job.customer_phone.includes(searchQuery));
                return matchesTab && matchesSearch;
            });

            const getStatusColor = (status) => {
                switch(status) {
                    case 'Under Inspection': return 'bg-amber-500/10 text-amber-500 border border-amber-500/10';
                    case 'Repaired': return 'bg-sky-500/10 text-sky-500 border border-sky-500/10';
                    case 'Delivered': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10';
                    default: return 'bg-slate-500/10 text-zinc-500 dark:text-zinc-400 border border-slate-500/10';
                }
            };

            const getStatusText = (status) => {
                switch(status) {
                    case 'Under Inspection': return 'تحت الفحص / التصليح';
                    case 'Repaired': return 'جاهز للاستلام';
                    case 'Delivered': return 'تم التسليم والقبض';
                    default: return status;
                }
            };

            const normalizeModel = (modelStr) => {
                return modelStr
                    .toLowerCase()
                    .replace(/galaxy/g, '')
                    .replace(/iphone/g, '')
                    .replace(/redmi/g, '')
                    .replace(/poco/g, '')
                    .replace(/infinix/g, '')
                    .replace(/tecno/g, '')
                    .replace(/realme/g, '')
                    .replace(/oppo/g, '')
                    .replace(/note/g, '')
                    .replace(/smart/g, '')
                    .replace(/spark/g, '')
                    .replace(/[\s\-_]+/g, '')
                    .trim();
            };

            const checkCompatibility = (partName, partBrand, inputModel) => {
                if (!inputModel) return false;
                const cleanInput = inputModel.toString().trim().toLowerCase();
                if (!cleanInput) return false;
                
                const nameLower = partName ? partName.toLowerCase() : '';
                const brandLower = partBrand ? partBrand.toLowerCase() : '';
                if (!nameLower) return false;
                
                // Extract clean models to prevent "pro" matching "pro max", "plus" matching "normal" etc.
                const getModelInfo = (str) => {
                    const norm = str.toLowerCase();
                    const isMax = norm.includes('max');
                    const isPro = norm.includes('pro') && !isMax;
                    const isPlus = norm.includes('plus');
                    const isUltra = norm.includes('ultra');
                    return { isMax, isPro, isPlus, isUltra };
                };

                const inputModelOnly = cleanInput.includes(' - ') ? cleanInput.split(' - ')[1].trim() : cleanInput;
                const inputInfo = getModelInfo(inputModelOnly);
                const partInfo = getModelInfo(nameLower);

                // Prevent mismatching Pro vs Pro Max vs Plus vs Ultra
                if (inputInfo.isMax !== partInfo.isMax) return false;
                if (inputInfo.isPro !== partInfo.isPro) return false;
                if (inputInfo.isPlus !== partInfo.isPlus) return false;
                if (inputInfo.isUltra !== partInfo.isUltra) return false;

                // Direct matches
                if (nameLower.includes(cleanInput)) return true;
                
                const modelOnly = cleanInput.includes(' - ') ? cleanInput.split(' - ')[1].trim() : cleanInput;
                if (nameLower.includes(modelOnly.toLowerCase())) return true;
                
                // Brand + Model word matches
                const inputWords = cleanInput.split(/[\s\-]+/);
                const isBrandMatch = inputWords.some(word => brandLower.includes(word) && word.length >= 2);
                
                if (isBrandMatch) {
                    const nonBrandWords = inputWords.filter(word => !brandLower.includes(word) && word.length >= 2);
                    if (nonBrandWords.length > 0) {
                        const match = nonBrandWords.some(word => nameLower.includes(word));
                        if (match) return true;
                    }
                }
                
                // Find device brand
                const deviceBrand = cleanInput.includes(' - ') ? cleanInput.split(' - ')[0].trim() : '';
                
                // Check from compatibilities JSON file with strict normalized match
                const cleanModelOnly = normalizeModel(modelOnly);
                const jsonCompat = (compatData.compatibilities || []).find(c => {
                    const cBrand = c.brand.toLowerCase();
                    const cModel = normalizeModel(c.model);
                    return (deviceBrand ? cBrand === deviceBrand : true) && cleanModelOnly === cModel;
                });
                if (jsonCompat) {
                    const isCompat = jsonCompat.compatible_models.some(m => {
                        const mNorm = normalizeModel(m);
                        const fullPartName = `${partBrand} ${partName}`.toLowerCase();
                        return fullPartName.includes(mNorm) || normalizeModel(fullPartName).includes(mNorm);
                    });
                    if (isCompat) return true;
                }
                
                // Parenthesis check (e.g. "شاشة (A12 / A02s / M12)")
                const compatParts = nameLower.match(/\(([^)]+)\)/);
                if (compatParts && compatParts[1]) {
                    const models = compatParts[1].split(/[\s/,\-]+/).map(m => m.trim()).filter(m => m.length >= 2);
                    return models.some(m => {
                        const mNorm = normalizeModel(m);
                        return cleanModelOnly === mNorm;
                    });
                }
                
                return false;
            };

            const cleanQueryModel = (compatibleModel || deviceModel || '').trim().toLowerCase();
            const matchingParts = cleanQueryModel.length >= 2 ? products.filter(p => {
                if (p.type !== 'Maintenance') return false;
                const availableItems = (p.items || []).filter(i => i.status === 'Available');
                return checkCompatibility(p.name, p.brand, compatibleModel || deviceModel) && availableItems.length > 0;
            }) : [];

            return (
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white dark:bg-[#0c0c0f]/60 p-4 sm:p-6 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
                        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                            {['All', 'Under Inspection', 'Repaired', 'Delivered'].map(status => (
                                <button 
                                    key={status}
                                    onClick={() => setActiveTab(status)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                        activeTab === status 
                                        ? 'bg-brand-500/10 text-brand-600 border border-brand-500/20' 
                                        : 'bg-zinc-50 dark:bg-zinc-950 text-slate-450 border border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:text-zinc-200'
                                    }`}
                                >
                                    {status === 'All' && 'كل الأجهزة'}
                                    {status === 'Under Inspection' && 'تحت الفحص صيانة'}
                                    {status === 'Repaired' && 'جاهز للاستلام'}
                                    {status === 'Delivered' && 'تم تسليمه'}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="w-full sm:w-auto justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                        >
                            <Icon name="plus" className="w-4 h-4" />
                            استلام جهاز جديد
                        </button>
                    </div>

                    {showAddForm && (
                        /* Add form modal/panel */
                        <form onSubmit={handleCreateJob} className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 max-w-2xl">
                            <h3 className="font-bold text-base text-brand-600">استمارة استلام جهاز صيانة جديد</h3>
                            {errorMsg && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl">
                                    {errorMsg}
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">اسم الزبون *</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            required 
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
                                            placeholder="اسم الزبون..."
                                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" 
                                        />
                                        
                                        {/* Autocomplete Suggestions */}
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
                                                        className="px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 last:border-0"
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
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">رقم الهاتف</label>
                                    <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" />
                                </div>
                            </div>
                            {/* Brand selection inside Maintenance Form */}
                            <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">الشركة المصنعة (البراند) *</label>
                                <div className="flex flex-wrap gap-2">
                                    {["Apple", "Samsung", "Xiaomi", "Huawei", "Realme", "Infinix", "Honor", "Oppo", "أخرى"].map(brandName => (
                                        <button
                                            type="button"
                                            key={brandName}
                                            onClick={() => setSelectedBrand(brandName)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                selectedBrand === brandName 
                                                ? 'bg-brand-500/10 text-brand-600 border-brand-500/20 shadow-sm' 
                                                : 'bg-zinc-50 dark:bg-zinc-950 text-slate-450 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:text-zinc-200'
                                            }`}
                                        >
                                            {brandName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                     <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">موديل الجهاز *</label>
                                     {modelSelectionMode === 'select' ? (
                                         <div className="relative">
                                             <select
                                                 required
                                                 value={deviceModel}
                                                 onChange={e => {
                                                     if (e.target.value === '__custom__') {
                                                         setModelSelectionMode('custom');
                                                         setDeviceModel('');
                                                     } else {
                                                         setDeviceModel(e.target.value);
                                                     }
                                                 }}
                                                 className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 cursor-pointer appearance-none"
                                             >
                                                 <option value="">-- اختر الموديل من القائمة --</option>
                                                 {(BRAND_MODELS[selectedBrand] || []).map(m => (
                                                     <option key={m} value={m}>{m}</option>
                                                 ))}
                                                 <option value="__custom__">✍️ كتابة موديل آخر يدوياً...</option>
                                             </select>
                                             <Icon name="chevron-down" className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                                         </div>
                                     ) : (
                                         <div className="flex gap-2">
                                             <input 
                                                 type="text" 
                                                 required 
                                                 value={deviceModel} 
                                                 onChange={e => setDeviceModel(e.target.value)} 
                                                 placeholder="اكتب الموديل يدوياً..." 
                                                 className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" 
                                             />
                                             <button
                                                 type="button"
                                                 onClick={() => {
                                                     setModelSelectionMode('select');
                                                     setDeviceModel('');
                                                 }}
                                                 className="px-3 bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold transition-all"
                                             >
                                                 القائمة
                                             </button>
                                         </div>
                                     )}                         <datalist id="maintenance-device-models">
                                        {(BRAND_MODELS[selectedBrand] || []).map(m => (
                                            <option key={m} value={m} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">رقم الـ IMEI أو التسلسلي</label>
                                    <input type="text" value={imei} onChange={e => setImei(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" />
                                </div>
                            </div>

                            {/* Optional compatibility dropdown */}
                            {deviceModel && (
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl space-y-2">
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 font-bold">أجهزة متوافقة (توافق الشاشات / قطع الغيار) - اختياري</label>
                                    <div className="relative">
                                        <select 
                                            value={compatibleModel} 
                                            onChange={e => setCompatibleModel(e.target.value)} 
                                            className="w-full bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 cursor-pointer appearance-none"
                                        >
                                            <option value="">-- اختر موديل متوافق إذا كان متوفراً --</option>
                                             {(() => {
                                                 const inputDeviceNorm = normalizeModel(deviceModel);
                                                 const entry = (compatData.compatibilities || []).find(c => {
                                                     return c.brand.toLowerCase() === selectedBrand.toLowerCase() && normalizeModel(c.model) === inputDeviceNorm;
                                                 });
                                                 const opts = entry ? entry.compatible_models : [];
                                                 if (opts.length === 0) {
                                                     return <option disabled>لا توجد توافقات مسجلة للموديل ({deviceModel}) في قاعدة البيانات</option>;
                                                 }
                                                 return opts.map(m => (
                                                     <option key={m} value={m}>{m}</option>
                                                 ));
                                             })()}
                                        </select>
                                        <Icon name="chevron-down" className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Spares indicator */}
                            {matchingParts.length > 0 && (
                                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-1">
                                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                        <Icon name="check-circle" className="w-4 h-4 text-emerald-500" />
                                        <span>قطع غيار صيانة متوفرة في المخزن لهذا الجهاز:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                        {matchingParts.map(p => {
                                            const qty = (p.items || []).filter(i => i.status === 'Available').length;
                                            return (
                                                <span key={p.id} className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 text-[10px] text-zinc-700 dark:text-zinc-350 font-bold rounded-lg flex items-center gap-1">
                                                    🛠️ {p.brand} - {p.name} (المتوفر: {qty} قطع)
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">تكلفة الصيانة المقدرة (د.ع)</label>
                                    <input 
                                        type="text" 
                                        inputMode="decimal"
                                        value={cost} 
                                        onChange={e => {
                                            const clean = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '');
                                            setCost(clean);
                                        }} 
                                        placeholder="0" 
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 text-right font-mono" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">كفالة الصيانة (أيام)</label>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={warrantyDays} 
                                        onChange={e => {
                                            const clean = toEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                                            setWarrantyDays(clean);
                                        }} 
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 text-right font-mono" 
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">قطع الغيار المستخدمة (يمكن اختيار أكثر من قطعة)</label>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            placeholder="ابحث عن قطعة يدوياً..."
                                            value={partSearchQuery}
                                            onChange={e => setPartSearchQuery(e.target.value)}
                                            className="w-48 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pr-7 pl-3 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 transition-all"
                                        />
                                        <Icon name="search" className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1.5" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2 bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-150 dark:border-zinc-900 rounded-2xl max-h-[160px] overflow-y-auto">
                                     {(() => {
                                         const filtered = products.filter(p => {
                                             if (p.type !== 'Maintenance') return false;
                                             if (partSearchQuery.trim()) {
                                                 const cleanPartQuery = partSearchQuery.trim().toLowerCase();
                                                 return p.name.toLowerCase().includes(cleanPartQuery) || p.brand.toLowerCase().includes(cleanPartQuery);
                                             }
                                             return checkCompatibility(p.name, p.brand, deviceModel);
                                         });
                                         
                                         if (!deviceModel.trim() && !partSearchQuery.trim()) {
                                             return <div className="text-center py-6 text-xs text-zinc-400 dark:text-zinc-500">يرجى كتابة موديل الجهاز أولاً أو البحث يدوياً لعرض قطع الغيار...</div>;
                                         }
                                         
                                         if (filtered.length === 0) {
                                             return <div className="text-center py-6 text-xs text-zinc-400 dark:text-zinc-500">لا توجد قطع غيار متوفرة في المخزن لهذا البحث.</div>;
                                         }
                                         
                                         return filtered.map(p => {
                                             const qty = (p.items || []).filter(i => i.status === 'Available').length;
                                             const isChecked = usedPartIds.includes(p.id);
                                             return (
                                                 <label 
                                                     key={p.id} 
                                                     className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                                         isChecked 
                                                         ? 'bg-brand-500/10 text-brand-600 border-brand-500/20' 
                                                         : 'bg-white dark:bg-[#0c0c0f]/40 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:text-zinc-200'
                                                     }`}
                                                 >
                                                     <input 
                                                         type="checkbox" 
                                                         disabled={qty === 0 && !isChecked}
                                                         checked={isChecked}
                                                         onChange={e => {
                                                             if (e.target.checked) {
                                                                 setUsedPartIds([...usedPartIds, p.id]);
                                                             } else {
                                                                 setUsedPartIds(usedPartIds.filter(id => id !== p.id));
                                                             }
                                                         }}
                                                         className="rounded text-brand-600 focus:ring-brand-500" 
                                                     />
                                                     <span className="flex-1">{p.brand} - {p.name} (المتوفر: {qty})</span>
                                                 </label>
                                             );
                                         });
                                     })()}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">توصيف المشكلة والقطع المستبدلة</label>
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                    {["تبديل شاشة", "تبديل بطارية", "تبديل ظهر", "مشكلة بالبورد", "قاعدة شحن", "صيانة سماعة/مايك"].map(prob => (
                                        <button
                                            type="button"
                                            key={prob}
                                            onClick={() => {
                                                const current = problem ? problem.trim() : '';
                                                setProblem(current ? `${current} — ${prob}` : prob);
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 transition-all"
                                        >
                                            + {prob}
                                        </button>
                                    ))}
                                </div>
                                <textarea rows="2" value={problem} onChange={e => setProblem(e.target.value)} placeholder="مثال: تبديل شاشة مكسورة — الزبون يشتكي من حرارة في البطارية" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 resize-none" />
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-all shadow-md">حفظ واستلام</button>
                                <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-850 dark:text-zinc-200 font-bold rounded-xl text-xs transition-all">إلغاء</button>
                            </div>
                        </form>
                    )}

                    {/* Jobs Table List */}
                    <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl">
                        <div className="mb-4 relative">
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث باسم الزبون، هاتف، موديل الجهاز، أو IMEI..."
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pr-10 pl-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500"
                            />
                            <Icon name="search" className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute right-3.5 top-3.5" />
                        </div>

                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs">
                                        <th className="py-3 px-4">الزبون والتاريخ</th>
                                        <th className="py-3 px-4">الجهاز</th>
                                        <th className="py-3 px-4">المشكلة / العطل</th>
                                        <th className="py-3 px-4 text-left">التكلفة</th>
                                        <th className="py-3 px-4 text-center">الحالة والإجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredJobs.map(job => (
                                        <tr key={job.id} className="border-b border-zinc-150 dark:border-zinc-900 hover:bg-zinc-50 dark:bg-zinc-950/20 text-zinc-800 dark:text-zinc-200">
                                            {/* Customer & Date */}
                                            <td className="py-3 px-4">
                                                 <div className="flex items-center gap-2">
                                                     <div className="font-bold text-zinc-900 dark:text-zinc-100">{job.customer_name}</div>
                                                     <button 
                                                         onClick={() => startEditJob(job)} 
                                                         className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded text-zinc-450 hover:text-brand-600 transition-all"
                                                         title="تعديل بيانات الجهاز"
                                                     >
                                                         <Icon name="edit" className="w-3.5 h-3.5" />
                                                     </button>
                                                 </div>
                                                 <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 flex items-center gap-1.5">
                                                     <span>{job.customer_phone || '-'}</span>
                                                     {job.customer_phone && (
                                                         <a 
                                                             href={getWhatsAppLink(job)} 
                                                             target="_blank" 
                                                             rel="noopener noreferrer" 
                                                             className="inline-flex items-center text-emerald-500 hover:text-emerald-600 transition-all scale-95 hover:scale-105"
                                                             title="إرسال إشعار صيانة بالواتساب"
                                                         >
                                                             <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                 <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.966a9.9 9.9 0 00-6.98-2.879c-5.443 0-9.866 4.372-9.87 9.802 0 1.714.47 3.387 1.357 4.847l-.994 3.63 3.738-.971zm11.387-7.764c-.09-.149-.329-.238-.689-.418-.359-.18-2.122-1.048-2.451-1.167-.329-.12-.569-.18-.809.18-.24.359-.929 1.167-1.139 1.407-.21.24-.419.269-.779.09-.36-.18-1.517-.559-2.89-1.786-1.067-.952-1.789-2.128-1.999-2.487-.21-.359-.022-.553.158-.732.162-.162.359-.419.539-.628.18-.21.24-.359.359-.599.119-.24.06-.449-.03-.628-.09-.18-.809-1.947-1.109-2.667-.291-.706-.588-.609-.809-.609h-.689c-.24 0-.629.09-.959.449-.33.359-1.258 1.228-1.258 2.996 0 1.768 1.288 3.475 1.468 3.715.18.24 2.534 3.869 6.139 5.425.856.37 1.525.59 2.046.756.86.273 1.644.234 2.263.142.69-.103 2.122-.868 2.421-1.706.3-.839.3-1.558.21-1.706z"/>
                                                             </svg>
                                                         </a>
                                                     )}
                                                 </div>
                                                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{new Date(job.created_at).toLocaleDateString('en-GB')}</div>
                                            </td>

                                            {/* Device */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-zinc-800 dark:text-zinc-200">{job.device_model}</div>
                                                {job.imei && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono block mt-0.5">IMEI: {job.imei}</span>}
                                                {(() => {
                                                    const linkedParts = job.parts || [];
                                                    const hasLegacy = !!job.used_product_id;
                                                    
                                                    return (
                                                        <div className="mt-1 space-y-1">
                                                            {/* Display legacy part if any */}
                                                            {hasLegacy && (() => {
                                                                const lp = products.find(p => p.id === job.used_product_id);
                                                                return lp ? (
                                                                    <div className="text-[10px] text-amber-500 font-bold mb-1">
                                                                        🛠️ {lp.brand} - {lp.name}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                            
                                                            {/* Display linked parts as green tags */}
                                                            {linkedParts.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mb-1">
                                                                    {linkedParts.map(part => {
                                                                        const prod = products.find(p => p.id === part.product_id);
                                                                        return prod ? (
                                                                            <span key={part.id} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-600 font-bold rounded">
                                                                                ✓ {prod.name}
                                                                            </span>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            )}
                                                            
                                                            {/* Tag selectors for linking/unlinking if not delivered */}
                                                            {job.status !== 'Delivered' && (
                                                                <div className="flex flex-wrap gap-1 max-w-[280px] mt-1">
                                                                    {products.filter(p => {
                                                                        if (p.type !== 'Maintenance') return false;
                                                                        const isLinked = linkedParts.some(part => part.product_id === p.id);
                                                                        const isCompat = checkCompatibility(p.name, p.brand, job.device_model);
                                                                        return isLinked || isCompat;
                                                                    }).map(p => {
                                                                        const qty = (p.items || []).filter(i => i.status === 'Available').length;
                                                                        const isLinked = linkedParts.some(part => part.product_id === p.id);
                                                                        // Hide if not linked and no inventory available to keep it clean
                                                                        if (qty === 0 && !isLinked) return null;
                                                                        return (
                                                                            <button 
                                                                                key={p.id}
                                                                                onClick={async () => {
                                                                                    let nextPartIds = linkedParts.map(part => part.product_id);
                                                                                    if (isLinked) {
                                                                                        nextPartIds = nextPartIds.filter(id => id !== p.id);
                                                                                    } else {
                                                                                        nextPartIds.push(p.id);
                                                                                    }
                                                                                    try {
                                                                                        await axios.put(`/maintenance/${job.id}/`, {
                                                                                            status: job.status,
                                                                                            cost: parseFloat(job.cost) || 0,
                                                                                            used_product_id: job.used_product_id,
                                                                                            used_part_ids: nextPartIds
                                                                                        });
                                                                                        refresh();
                                                                                    } catch(err) {
                                                                                        alert("حدث خطأ أثناء ربط قطعة الغيار.");
                                                                                    }
                                                                                }}
                                                                                className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold border transition-all ${
                                                                                    isLinked 
                                                                                    ? 'bg-brand-500/10 text-brand-600 border-brand-500/20' 
                                                                                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-400 dark:text-zinc-500 border-zinc-150 dark:border-zinc-900 hover:text-slate-350'
                                                                                }`}
                                                                            >
                                                                                {isLinked ? '✓' : '+'} {p.name}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* Problem Description */}
                                            <td className="py-3 px-4 text-xs text-slate-450 max-w-[220px] truncate" title={job.problem_description}>
                                                {job.problem_description || '-'}
                                            </td>

                                            {/* Cost */}
                                            <td className="py-3 px-4 text-left font-mono font-bold text-emerald-400">
                                                {parseFloat(job.cost).toLocaleString()} د.ع
                                            </td>

                                            {/* Status & Actions */}
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex flex-col items-center gap-1.5 justify-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap inline-block ${getStatusColor(job.status)}`}>
                                                        {getStatusText(job.status)}
                                                    </span>
                                                    {job.status !== 'Delivered' ? (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(job.id, job.status, job.cost)}
                                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition-all whitespace-nowrap ${
                                                                job.status === 'Under Inspection' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                                            }`}
                                                        >
                                                            {job.status === 'Under Inspection' ? 'جاهز للتسليم' : 'تسليم وقبض'}
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => {
                                                                setReceipt({
                                                                    id: job.id,
                                                                    type: 'maintenance',
                                                                    date: new Date(job.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                                                                    customer: job.customer_name,
                                                                    customerPhone: job.customer_phone,
                                                                    paymentMethod: 'Cash',
                                                                    items: [{
                                                                        brand: 'صيانة جهاز',
                                                                        name: job.device_model,
                                                                        imei: job.imei,
                                                                        price: job.cost
                                                                    }],
                                                                    total: job.cost,
                                                                    maintenanceNote: job.problem_description,
                                                                    warrantyDays: job.warranty_days
                                                                });
                                                            }}
                                                            className="px-2 py-1 bg-slate-850 hover:bg-zinc-200 dark:bg-zinc-800 text-slate-350 font-bold rounded-lg text-[10px] flex items-center gap-1 mx-auto border border-zinc-200 dark:border-zinc-800"
                                                        >
                                                            <Icon name="printer" className="w-3 h-3" /> طباعة الوصل
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => setLabelJob(job)}
                                                        className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg text-[10px] flex items-center gap-1 mx-auto border border-indigo-500/15 cursor-pointer"
                                                        title="طباعة ملصق لظهر الجهاز"
                                                    >
                                                        <Icon name="tag" className="w-3 h-3" /> ملصق الجهاز
                                                    </button>
                                                    {/* WhatsApp notify button - visible if phone exists */}
                                                    {job.customer_phone && (
                                                        <a
                                                            href={(() => {
                                                                let p = job.customer_phone.replace(/[^0-9]/g, '');
                                                                if (p.startsWith('07')) p = '964' + p.slice(1);
                                                                else if (p.startsWith('7')) p = '964' + p;
                                                                const s = getShopSettings();
                                                                const shopName = s.shopName || 'M Mobile';
                                                                const cost = job.cost ? `${Number(job.cost).toLocaleString()} د.ع` : 'سيتم تحديدها لاحقاً';
                                                                const msg =
                                                                    `🏪 *${shopName}*\n` +
                                                                    `━━━━━━━━━━━━━━━━\n\n` +
                                                                    `السلام عليكم عزيزنا *${job.customer_name || 'الزبون'}* 🙏\n\n` +
                                                                    `يسعدنا إعلامكم بأن جهازكم جاهز للاستلام ✅\n\n` +
                                                                    `📱 الجهاز: ${job.device_model}\n` +
                                                                    `💵 التكلفة: ${cost}\n\n` +
                                                                    `نتطلع لاستقبالكم في أي وقت يناسبكم 😊`;
                                                                return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
                                                            })()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="إرسال واتساب للزبون"
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white transition-all"
                                                        >
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                            واتساب
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredJobs.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">لا توجد أجهزة صيانة مطابقة للبحث أو الفلتر.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card List View */}
                        <div className="block md:hidden space-y-4">
                            {filteredJobs.map(job => (
                                <div key={job.id} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-150 dark:border-zinc-900 rounded-2xl space-y-3.5 shadow-sm">
                                    {/* Top row: Customer name, edit icon, date */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{job.customer_name}</span>
                                                <button 
                                                    onClick={() => startEditJob(job)} 
                                                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-brand-600 transition-all cursor-pointer"
                                                >
                                                    <Icon name="edit" className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            {job.customer_phone && (
                                                <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                                                    <span>{job.customer_phone}</span>
                                                    <a 
                                                        href={getWhatsAppLink(job)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                    >
                                                        <Icon name="message-circle" className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-zinc-400 font-mono">{new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                                    </div>

                                    {/* Mid row: Device & IMEI */}
                                    <div className="border-t border-zinc-150 dark:border-zinc-800 pt-2.5">
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-0.5">الجهاز والموديل</div>
                                        <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{job.device_model}</div>
                                        {job.imei && <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">IMEI: {job.imei}</span>}
                                        
                                        {/* Linked parts */}
                                        {((job.parts && job.parts.length > 0) || job.used_product_id) && (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {job.used_product_id && (() => {
                                                    const lp = products.find(p => p.id === job.used_product_id);
                                                    return lp ? (
                                                        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-500 font-bold rounded">
                                                            🛠️ {lp.name}
                                                        </span>
                                                    ) : null;
                                                })()}
                                                {job.parts && job.parts.map(part => {
                                                    const prod = products.find(p => p.id === part.product_id);
                                                    return prod ? (
                                                        <span key={part.id} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-600 font-bold rounded">
                                                            ✓ {prod.name}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Issue/Problem Description */}
                                    {job.problem_description && (
                                        <div className="text-xs bg-white dark:bg-zinc-900 p-2.5 rounded-xl text-zinc-650 dark:text-zinc-400 border border-zinc-150 dark:border-zinc-800">
                                            <span className="font-bold text-[10px] text-zinc-400 block mb-0.5">العطل والمشكلة:</span>
                                            {job.problem_description}
                                        </div>
                                    )}

                                    {/* Bottom row: Cost & Status & Actions */}
                                    <div className="flex justify-between items-center border-t border-zinc-150 dark:border-zinc-800 pt-2.5">
                                        <div>
                                            <div className="text-[10px] text-zinc-400">التكلفة</div>
                                            <div className="font-bold text-sm text-emerald-400 font-mono">{parseFloat(job.cost).toLocaleString()} د.ع</div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${getStatusColor(job.status)}`}>
                                                {getStatusText(job.status)}
                                            </span>
                                            
                                            {job.status !== 'Delivered' ? (
                                                <button 
                                                    onClick={() => handleUpdateStatus(job.id, job.status, job.cost)}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold text-white transition-all cursor-pointer ${
                                                        job.status === 'Under Inspection' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                                    }`}
                                                >
                                                    {job.status === 'Under Inspection' ? 'جاهز للتسليم' : 'تسليم وقبض'}
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setReceipt({
                                                            id: job.id,
                                                            type: 'maintenance',
                                                            date: new Date(job.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                                                            customer: job.customer_name,
                                                            customerPhone: job.customer_phone,
                                                            paymentMethod: 'Cash',
                                                            items: [{
                                                                brand: 'صيانة جهاز',
                                                                name: job.device_model,
                                                                imei: job.imei,
                                                                price: job.cost
                                                            }],
                                                            total: job.cost,
                                                            maintenanceNote: job.problem_description,
                                                            warrantyDays: job.warranty_days
                                                        });
                                                    }}
                                                    className="px-2.5 py-1 bg-zinc-150 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-[10px] flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                                                >
                                                    <Icon name="printer" className="w-3 h-3" /> طباعة
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setLabelJob(job)}
                                                className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg text-[10px] flex items-center gap-1 border border-indigo-500/15 cursor-pointer mt-1"
                                            >
                                                <Icon name="tag" className="w-3 h-3" /> ملصق الجهاز
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredJobs.length === 0 && (
                                <div className="text-center py-8 text-zinc-400">لا توجد أجهزة صيانة مطابقة للبحث أو الفلتر.</div>
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
                                                <div className="mnt-info-row"><span className="mnt-info-key">طريقة الدفع:</span><span className="mnt-info-val">نقدي</span></div>
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

                    {/* Device Label Sticker Modal */}
                    {labelJob && (() => {
                        const s = getShopSettings();
                        const shopName = s.shopName || 'متجر الموبايل';
                        const invoiceNum = 'M-' + getShortId(labelJob.id);
                        
                        return (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setLabelJob(null)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()}>
                                <div id="print-label" className="text-center font-sans text-black" style={{ direction: 'rtl', padding: '10px' }}>
                                    <style>{`
                                        @media print {
                                            body * {
                                                visibility: hidden;
                                            }
                                            #print-label, #print-label * {
                                                visibility: visible;
                                            }
                                            #print-label {
                                                position: absolute;
                                                left: 0;
                                                top: 0;
                                                width: 50mm;
                                                height: auto;
                                                padding: 2mm;
                                                box-shadow: none;
                                            }
                                        }
                                    `}</style>
                                    <div className="border border-dashed border-zinc-400 p-3 rounded-lg bg-zinc-50/50">
                                        <div className="text-[14px] font-black tracking-wide border-b border-zinc-200 pb-1.5 mb-2">{shopName}</div>
                                        
                                        <div className="space-y-1 text-right text-[11px] leading-relaxed">
                                            <div><strong>الرقم:</strong> <span className="font-mono font-bold text-[12px]">{invoiceNum}</span></div>
                                            <div><strong>الزبون:</strong> <span>{labelJob.customer_name}</span></div>
                                            {labelJob.customer_phone && <div><strong>الهاتف:</strong> <span className="font-mono">{labelJob.customer_phone}</span></div>}
                                            <div><strong>الجهاز:</strong> <span className="font-bold text-[12px]">{labelJob.device_model}</span></div>
                                            {labelJob.imei && <div><strong>IMEI:</strong> <span className="font-mono text-[9px]">{labelJob.imei}</span></div>}
                                            {labelJob.problem_description && <div className="border-t border-zinc-200 pt-1 mt-1 text-zinc-700"><strong>العطل:</strong> <span>{labelJob.problem_description}</span></div>}
                                        </div>
                                        
                                        <div className="text-[9px] text-zinc-400 mt-2 font-mono">{new Date(labelJob.created_at).toLocaleDateString('en-GB')}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2.5 mt-4 no-print">
                                    <button onClick={() => setLabelJob(null)} className="flex-1 py-2 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-100 transition-all cursor-pointer">
                                        إغلاق
                                    </button>
                                    <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                                        <Icon name="printer" className="w-3.5 h-3.5" /> طباعة الملصق
                                    </button>
                                </div>
                            </div>
                        </div>
                        );
                    })()}

                    {/* Edit Job Modal */}
                    {editingJob && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <form onSubmit={handleSaveEdit} className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                                <h3 className="font-bold text-base text-brand-600">تعديل بيانات جهاز الصيانة</h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">اسم الزبون *</label>
                                        <input type="text" required value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">رقم الهاتف</label>
                                        <input type="text" value={editCustomerPhone} onChange={e => setEditCustomerPhone(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">الشركة المصنعة (البراند) *</label>
                                    <div className="flex flex-wrap gap-2">
                                        {["Apple", "Samsung", "Xiaomi", "Huawei", "Realme", "Infinix", "Honor", "Oppo", "أخرى"].map(brandName => (
                                            <button
                                                type="button"
                                                key={brandName}
                                                onClick={() => setEditBrand(brandName)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                    editBrand === brandName 
                                                    ? 'bg-brand-500/10 text-brand-600 border-brand-500/20 shadow-sm' 
                                                    : 'bg-zinc-50 dark:bg-zinc-950 text-slate-450 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:text-zinc-200'
                                                }`}
                                            >
                                                {brandName}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">موديل الجهاز *</label>
                                        {editModelSelectionMode === 'select' ? (
                                            <div className="relative">
                                                <select
                                                    required
                                                    value={editModel}
                                                    onChange={e => {
                                                        if (e.target.value === '__custom__') {
                                                            setEditModelSelectionMode('custom');
                                                            setEditModel('');
                                                        } else {
                                                            setEditModel(e.target.value);
                                                        }
                                                    }}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 cursor-pointer appearance-none"
                                                >
                                                    <option value="">-- اختر الموديل من القائمة --</option>
                                                    {(BRAND_MODELS[editBrand] || []).map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                    <option value="__custom__">✍️ كتابة موديل آخر يدوياً...</option>
                                                </select>
                                                <Icon name="chevron-down" className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    required 
                                                    value={editModel} 
                                                    onChange={e => setEditModel(e.target.value)} 
                                                    placeholder="اكتب الموديل يدوياً..." 
                                                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditModelSelectionMode('select');
                                                        setEditModel('');
                                                    }}
                                                    className="px-3 bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    القائمة
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">رقم الـ IMEI أو التسلسلي</label>
                                        <input type="text" value={editImei} onChange={e => setEditImei(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">تكلفة الصيانة المقدرة (د.ع)</label>
                                        <input type="text" value={editCost} onChange={e => setEditCost(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 text-right font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">كفالة الصيانة (أيام)</label>
                                        <input type="text" value={editWarrantyDays} onChange={e => setEditWarrantyDays(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500 text-right font-mono" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">توصيف المشكلة والقطع المستبدلة</label>
                                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                                        {["تبديل شاشة", "تبديل بطارية", "تبديل ظهر", "مشكلة بالبورد", "قاعدة شحن", "صيانة سماعة/مايك"].map(prob => (
                                            <button
                                                type="button"
                                                key={prob}
                                                onClick={() => {
                                                    const current = editProblem ? editProblem.trim() : '';
                                                    setEditProblem(current ? `${current} — ${prob}` : prob);
                                                }}
                                                className="px-2 py-1 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-150 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-bold transition-all"
                                            >
                                                + {prob}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setEditProblem('')}
                                            className="px-2 py-1 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-rose-500 rounded-lg text-[10px] font-bold transition-all"
                                        >
                                            🗑️ مسح
                                        </button>
                                    </div>
                                    <textarea 
                                        rows="2" 
                                        value={editProblem} 
                                        onChange={e => setEditProblem(e.target.value)} 
                                        placeholder="اكتب التقرير هنا..." 
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-brand-500"
                                    ></textarea>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setEditingJob(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all">
                                        إلغاء
                                    </button>
                                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition-all">
                                        حفظ التغييرات
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            );
        }

        // Shop Settings Page
