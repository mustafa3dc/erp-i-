import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from './Icon';
import SettingsField from './SettingsField';

export default function ShopSettingsPage({ currentUser, refresh }) {
            const defaultSettings = {
                shopName: 'متجر الموبايل',
                currency: 'د.ع',
                phone: '',
                email: '',
                address: '',
                footerNote: 'شكراً لتعاملكم معنا 🙏',
                systemPassword: '123456'
            };

            const [settings, setSettings] = useState(defaultSettings);
            const [saved, setSaved] = useState(false);
            const [gdriveAccounts, setGdriveAccounts] = useState([]);
            const [selectedGdriveAccount, setSelectedGdriveAccount] = useState('');
            
            const [usersList, setUsersList] = useState([]);
            const [newUsername, setNewUsername] = useState('');
            const [newPassword, setNewPassword] = useState('');
            const [newRole, setNewRole] = useState('user');

            const fetchUsers = async () => {
                if (currentUser?.role === 'admin') {
                    try {
                        const res = await axios.get('/auth/users/');
                        setUsersList(res.data);
                    } catch (e) {
                        console.error("Failed to load users list", e);
                    }
                }
            };

            useEffect(() => {
                const fetchGdriveInfo = async () => {
                    try {
                        const listRes = await axios.get('/list-gdrive-accounts/');
                        setGdriveAccounts(listRes.data);
                        
                        const getRes = await axios.get('/get-gdrive-account/');
                        setSelectedGdriveAccount(getRes.data.account || '');
                    } catch (e) {
                        console.error("Failed to load Google Drive info", e);
                    }
                };
                const fetchSettings = async () => {
                    try {
                        const res = await axios.get('/shop-settings/');
                        const d = res.data;
                        setSettings({
                            shopName: d.shop_name,
                            currency: d.currency,
                            phone: d.phone || '',
                            email: d.email || '',
                            address: d.address || '',
                            footerNote: d.footer_note || '',
                            systemPassword: d.system_password,
                        });
                    } catch (e) {
                        console.error("Failed to load shop settings", e);
                    }
                };
                fetchGdriveInfo();
                fetchSettings();
                fetchUsers();
            }, [currentUser]);

            const [whatsappStatus, setWhatsappStatus] = useState('disconnected'); // 'connected' | 'qr' | 'loading' | 'disconnected'
            const [whatsappQr, setWhatsappQr] = useState('');

            useEffect(() => {
                const fetchStatus = async () => {
                    try {
                        const res = await axios.get('/whatsapp/status');
                        setWhatsappStatus(res.data.status);
                        setWhatsappQr(res.data.qr || '');
                    } catch (e) {
                        setWhatsappStatus('disconnected');
                    }
                };
                
                fetchStatus();
                const interval = setInterval(fetchStatus, 5000); // poll status every 5 seconds
                return () => clearInterval(interval);
            }, []);

            const handleDownloadBackup = async () => {
                try {
                    const response = await axios.get('/backup-db/', {
                        responseType: 'blob',
                    });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'accounting_backup.db');
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode.removeChild(link);
                } catch (err) {
                    alert("حدث خطأ أثناء تحميل نسخة قاعدة البيانات.");
                }
            };

            const handleChange = (key, value) => {
                setSettings(prev => ({ ...prev, [key]: value }));
                setSaved(false);
            };

            const handleSave = async (e) => {
                e.preventDefault();
                try {
                    await axios.post('/shop-settings/', {
                        shop_name: settings.shopName,
                        currency: settings.currency,
                        phone: settings.phone || '',
                        email: settings.email || '',
                        address: settings.address || '',
                        footer_note: settings.footerNote || '',
                        system_password: settings.systemPassword,
                    });
                    setSaved(true);
                    if (refresh) await refresh();
                    setTimeout(() => setSaved(false), 2500);
                } catch (err) {
                    alert("حدث خطأ أثناء حفظ الإعدادات في قاعدة البيانات.");
                }
            };

            const handleAddUser = async (e) => {
                e.preventDefault();
                if (!newUsername.trim() || !newPassword) {
                    alert("يرجى ملء اسم المستخدم وكلمة المرور.");
                    return;
                }
                try {
                    await axios.post('/auth/register/', {
                        username: newUsername,
                        password: newPassword,
                        role: newRole
                    });
                    alert("تم إضافة المستخدم الجديد بنجاح! 🎉");
                    setNewUsername('');
                    setNewPassword('');
                    setNewRole('user');
                    fetchUsers();
                } catch (err) {
                    alert(err.response?.data?.detail || "حدث خطأ أثناء إضافة المستخدم.");
                }
            };

            const handleDeleteUser = async (userId, username) => {
                if (username === currentUser?.username) {
                    alert("لا يمكنك حذف حسابك الحالي الذي تستخدمه لتسجيل الدخول!");
                    return;
                }
                const confirmDel = confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`);
                if (confirmDel) {
                    try {
                        await axios.delete(`/auth/users/${userId}/`);
                        alert("تم حذف المستخدم بنجاح.");
                        fetchUsers();
                    } catch (err) {
                        alert("حدث خطأ أثناء حذف المستخدم.");
                    }
                }
            };

            return (
                <div className="max-w-2xl space-y-8">

                    {/* Shop Identity */}
                    <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Icon name="store" className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-emerald-400">هوية المتجر</h3>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500">تظهر هذه المعلومات في رأس الفاتورة</p>
                            </div>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SettingsField label="اسم المتجر" id="shopName" value={settings.shopName} onChange={v => handleChange('shopName', v)} placeholder="متجر الموبايل" />
                                <SettingsField label="العملة" id="currency" value={settings.currency} onChange={v => handleChange('currency', v)} placeholder="د.ع" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SettingsField label="رقم الهاتف / الواتساب" id="phone" value={settings.phone} onChange={v => handleChange('phone', v)} placeholder="07xxxxxxxxx" />
                                <SettingsField label="البريد الإلكتروني" id="email" value={settings.email} onChange={v => handleChange('email', v)} placeholder="example@email.com" />
                            </div>
                            <SettingsField label="العنوان / الموقع" id="address" value={settings.address} onChange={v => handleChange('address', v)} placeholder="بغداد - الكرادة - ..." />
                            <SettingsField label="نص ختام الفاتورة" id="footerNote" value={settings.footerNote} onChange={v => handleChange('footerNote', v)} placeholder="شكراً لتعاملكم معنا 🙏" />
                            
                            {/* Per-Shop Telegram & WhatsApp Notifications */}
                            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                                <h4 className="font-extrabold text-sm text-indigo-400 flex items-center gap-2">
                                    <Icon name="bell" className="w-4 h-4" /> إعدادات الإشعارات الخاصة بمحلك (تليجرام وواتساب)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <SettingsField label="توكن بوت التليجرام (Telegram Token)" id="telegramToken" value={settings.telegramToken || ''} onChange={v => handleChange('telegramToken', v)} placeholder="123456789:ABC..." />
                                    <SettingsField label="معرف الشات (Telegram Chat ID)" id="telegramChatId" value={settings.telegramChatId || ''} onChange={v => handleChange('telegramChatId', v)} placeholder="12345678" />
                                </div>
                                <SettingsField label="رقم واتساب المحل لإرسال التنبيهات للزبائن" id="whatsappPhone" value={settings.whatsappPhone || ''} onChange={v => handleChange('whatsappPhone', v)} placeholder="07xxxxxxxxx" />
                            </div>

                            <SettingsField label="رمز قفل النظام السري (Password)" id="systemPassword" value={settings.systemPassword} onChange={v => handleChange('systemPassword', v)} placeholder="123456" />

                            <div className="pt-2 flex items-center gap-4">
                                <button
                                    type="submit"
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                                >
                                    حفظ الإعدادات
                                </button>
                                {saved && (
                                    <span className="text-emerald-400 text-sm font-bold flex items-center gap-1">
                                        <Icon name="check-circle" className="w-4 h-4" /> تم الحفظ بنجاح!
                                    </span>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Live Invoice Preview */}
                    <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                <Icon name="eye" className="w-5 h-5 text-sky-400" />
                            </div>
                            <h3 className="font-bold text-sky-400">معاينة رأس الفاتورة</h3>
                        </div>
                        <div className="bg-[#064e3b] rounded-xl p-5 flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                            <div className="text-center sm:text-left text-white/60 text-xs leading-6">
                                {settings.phone && <div>📞 {settings.phone}</div>}
                                {settings.email && <div>✉ {settings.email}</div>}
                                {settings.address && <div>📍 {settings.address}</div>}
                                {!settings.phone && !settings.email && !settings.address && (
                                    <div className="text-white/30">أضف معلومات الاتصال</div>
                                )}
                            </div>
                            <div className="text-center sm:text-right">
                                <div className="text-xl sm:text-2xl font-black text-white">{settings.shopName || 'اسم المتجر'}</div>
                                <div className="text-[10px] text-white/60 mt-0.5">فاتورة مبيعات / Sales Invoice</div>
                            </div>
                        </div>
                    </div>

                    {/* Database Backup & Export */}
                    <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <Icon name="download" className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-indigo-400">النسخ الاحتياطي وتصدير البيانات</h3>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500">حفظ وحماية بياناتك سحابياً ومحلياً بضمان 100%</p>
                            </div>
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl space-y-2">
                            <div className="font-bold text-zinc-800 dark:text-zinc-200">🛡️ النسخ الاحتياطي التلقائي:</div>
                            <div>• يتم حفظ نسخة محلية تلقائياً في مجلد المستندات بالماك <code>Documents/MMobile_LocalBackup</code> عند كل تشغيل.</div>
                            <div>• <strong>Google Drive:</strong> إذا قمت بتثبيت تطبيق Google Drive Desktop على جهازك، سيتم عمل نسخة احتياطية سحابية داخل مجلد <code>Google Drive/MMobileBackup</code> تلقائياً!</div>
                        </div>

                        {gdriveAccounts.length > 0 && (
                            <div className="pt-2 pb-2 space-y-2">
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400">اختر حساب Google Drive للنسخ الاحتياطي السحابي:</label>
                                <div className="relative max-w-md">
                                    <select
                                        value={selectedGdriveAccount}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            setSelectedGdriveAccount(val);
                                            try {
                                                await axios.post('/set-gdrive-account/', { account: val });
                                                alert("تم حفظ اختيار الحساب وتفعيل النسخ الاحتياطي عليه بنجاح! 🎉");
                                            } catch (err) {
                                                alert("حدث خطأ أثناء حفظ اختيار الحساب.");
                                            }
                                        }}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer appearance-none text-right font-bold"
                                    >
                                        <option value="">-- اختر الحساب من القائمة --</option>
                                        {gdriveAccounts.map(acc => (
                                            <option key={acc} value={acc}>{acc}</option>
                                        ))}
                                    </select>
                                    <Icon name="chevron-down" className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3">
                            <button 
                                type="button"
                                onClick={handleDownloadBackup}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                            >
                                <Icon name="download" className="w-4 h-4" />
                                تصدير وتحميل قاعدة البيانات الحالية
                            </button>

                            <label className="px-6 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                <Icon name="upload" className="w-4 h-4" />
                                استيراد واستعادة قاعدة بيانات من جهازك
                                <input 
                                    type="file" 
                                    accept=".db" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const confirmRestore = confirm("⚠️ تحذير: استعادة قاعدة البيانات ستؤدي إلى استبدال البيانات الحالية بالكامل! هل أنت متأكد؟");
                                        if (confirmRestore) {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            try {
                                                const res = await axios.post('/restore-db/', formData, {
                                                    headers: {
                                                        'Content-Type': 'multipart/form-data'
                                                    }
                                                });
                                                if (res.data.status === 'success') {
                                                    alert("تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة الآن لتطبيق البيانات الجديدة. 🎉");
                                                    window.location.reload();
                                                }
                                            } catch (err) {
                                                const errMsg = err.response && err.response.data && err.response.data.detail ? err.response.data.detail : "فشل استيراد الملف.";
                                                alert(`❌ خطأ: ${errMsg}`);
                                            }
                                        }
                                        e.target.value = ""; // Reset input
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* WhatsApp Gateway Integration */}
                    <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Icon name="message-square" className="w-5 h-5 text-emerald-450" />
                            </div>
                            <div>
                                <h3 className="font-bold text-emerald-500">ربط واتساب المحل للرسائل التلقائية</h3>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500">ارسال اشعارات الصيانة للزبائن تلقائياً في الخلفية</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl">
                            <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">حالة الاتصال بالواتساب:</div>
                            {whatsappStatus === 'connected' ? (
                                <span className="px-3 py-1 bg-emerald-500/15 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse">
                                    ● متصل بالواتساب وجاهز
                                </span>
                            ) : whatsappStatus === 'qr' ? (
                                <span className="px-3 py-1 bg-amber-500/15 text-amber-600 text-xs font-bold rounded-full">
                                    ⚠️ يرجى مسح كود QR للربط
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 text-xs font-bold rounded-full">
                                    ⏳ جاري تشغيل خادم الواتساب...
                                </span>
                            )}
                        </div>

                        {whatsappStatus === 'qr' && whatsappQr && (
                            <div className="flex flex-col items-center justify-center p-4 border border-zinc-150 dark:border-zinc-900 rounded-xl bg-white dark:bg-zinc-950/40 space-y-3">
                                <div className="text-xs text-center text-zinc-500 leading-relaxed max-w-sm">
                                    افتح الواتساب في هاتفك ➡️ الأجهزة المرتبطة ➡️ ربط جهاز، ثم وجه الكاميرا لمسح هذا الكود:
                                </div>
                                <div className="p-3 bg-white rounded-xl shadow-md border border-zinc-150">
                                    <img src={whatsappQr} alt="WhatsApp QR Code" className="w-48 h-48" />
                                </div>
                            </div>
                        )}

                        {whatsappStatus === 'connected' && (
                            <div className="text-xs text-zinc-500 leading-relaxed bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl">
                                🟢 <strong>تم الربط بنجاح!</strong> الآن بمجرد تحويل أي جهاز صيانة إلى حالة <strong>"جاهز للتسليم"</strong>، سيقوم السيرفر بإرسال رسالة تفصيلية برقم هاتف الزبون تلقائياً وصامتاً بالخلفية بدون أي تدخل منك.
                            </div>
                        )}
                    </div>

                    {/* User Management Panel (Visible ONLY to Super Admin Owner) */}
                    {(currentUser?.is_super_admin === 1 || currentUser?.username === 'admin') && (
                        <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                    <Icon name="users" className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-indigo-400">إدارة مستخدمي النظام</h3>
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500">إضافة، تعديل وحذف صلاحيات حسابات الموظفين والمدراء</p>
                                </div>
                            </div>

                            {/* Add User Form */}
                            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-100 dark:border-zinc-900">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 text-right">اسم المستخدم</label>
                                    <input 
                                        type="text" 
                                        value={newUsername} 
                                        onChange={e => setNewUsername(e.target.value)} 
                                        placeholder="اسم المستخدم" 
                                        className="w-full text-xs text-right"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5 text-right">كلمة المرور</label>
                                    <input 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)} 
                                        placeholder="كلمة المرور" 
                                        className="w-full text-xs text-right"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5 text-right">الصلاحية</label>
                                    <select 
                                        value={newRole} 
                                        onChange={e => setNewRole(e.target.value)}
                                        className="w-full text-xs text-right"
                                    >
                                        <option value="user">مستخدم عادي</option>
                                        <option value="admin">مدير النظام</option>
                                    </select>
                                </div>
                                <button 
                                    type="submit" 
                                    className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all hover:bg-indigo-700 cursor-pointer"
                                >
                                    إضافة مستخدم
                                </button>
                            </form>

                            {/* Users List */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b border-zinc-150 dark:border-zinc-800">
                                            <th className="pb-3 text-right">المحل / المستخدم</th>
                                            <th className="pb-3 text-right">الصلاحية</th>
                                            <th className="pb-3 text-right">تاريخ انتهاء الاشتراك</th>
                                            <th className="pb-3 text-right">الحالة</th>
                                            <th className="pb-3 text-left">التحكم والتجديد</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usersList.map(u => (
                                            <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20">
                                                <td className="py-3 font-bold">
                                                    <div>{u.shop_name || 'متجر الموبايل'}</div>
                                                    <div className="text-[10px] text-zinc-400">@{u.username}</div>
                                                </td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                                                        {u.is_super_admin ? 'مدير التطبيق (Super)' : (u.role === 'admin' ? 'صاحب محل' : 'موظف')}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-bold text-amber-500 dir-ltr text-right">
                                                    {u.subscription_end ? u.subscription_end.split('T')[0] : 'غير محدد (دائم)'}
                                                </td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                        {u.is_active ? 'مفعل ✅' : 'معطل 🛑'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-left space-x-2 space-x-reverse">
                                                    <button 
                                                        type="button" 
                                                        onClick={async () => {
                                                            const days = prompt("كم عدد الأيام التي تريد تمديد الاشتراك بها؟", "30");
                                                            if (days && !isNaN(days)) {
                                                                try {
                                                                    await axios.post('/admin/tenants/renew/', { user_id: u.id, additional_days: parseInt(days) });
                                                                    alert("تم تمديد الاشتراك بنجاح! 🎉");
                                                                    fetchUsers();
                                                                } catch (e) {
                                                                    alert("حدث خطأ في تجديد الاشتراك.");
                                                                }
                                                            }
                                                        }}
                                                        className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 font-bold"
                                                    >
                                                        + تجديد
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={async () => {
                                                            try {
                                                                await axios.post(`/admin/tenants/toggle-status/?user_id=${u.id}`);
                                                                fetchUsers();
                                                            } catch (e) {
                                                                alert("خطأ في تغيير الحالة.");
                                                            }
                                                        }}
                                                        className={`px-2 py-1 rounded-lg font-bold ${u.is_active ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                                                    >
                                                        {u.is_active ? 'إيقاف' : 'تفعيل'}
                                                    </button>
                                                    {u.username !== currentUser?.username && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleDeleteUser(u.id, u.username)}
                                                            className="text-rose-500 hover:text-rose-600 font-bold cursor-pointer"
                                                        >
                                                            حذف
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Database Reset (Danger Zone) */}
                    <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/200/10 flex items-center justify-center">
                                <Icon name="trash-2" className="w-5 h-5 text-rose-600 dark:text-rose-450" />
                            </div>
                            <div>
                                <h3 className="font-bold text-rose-700 dark:text-rose-400">تصفير قاعدة البيانات (منطقة خطر)</h3>
                                <p className="text-xs text-rose-500 dark:text-rose-450 font-bold">هذا الإجراء سيقوم بمسح كافة المبيعات، البضائع، القيود المحاسبية، وأجهزة الصيانة نهائياً ولا يمكن التراجع عنه!</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={async () => {
                                const confirmReset = confirm("⚠️ تحذير: هل أنت متأكد من تصفير قاعدة البيانات ومسح كل شيء؟ لا يمكن استعادة البيانات المحذوفة!");
                                if (confirmReset) {
                                    try {
                                        const res = await axios.post('/reset-db/');
                                        if (res.data.status === 'success') {
                                            alert("تم تصفير قاعدة البيانات بالكامل بنجاح! سيتم تحديث الصفحة.");
                                            window.location.reload();
                                        }
                                    } catch (e) {
                                        alert("حدث خطأ أثناء محاولة تصفير قاعدة البيانات.");
                                    }
                                }
                            }}
                            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-rose-600/10 flex items-center gap-2"
                        >
                            <Icon name="alert-triangle" className="w-4 h-4" />
                            تصفير كل شيء وبدء عمل حقيقي
                        </button>
                    </div>

                </div>
            );
        }

