import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './components/Icon';
import DashboardPage from './components/DashboardPage';
import POSPage from './components/POSPage';
import MaintenanceJobsPage from './components/MaintenanceJobsPage';
import InventoryPage from './components/InventoryPage';
import AdvancedAccountingPage from './components/AdvancedAccountingPage';
import ShopSettingsPage from './components/ShopSettingsPage';
import CustomersPage from './components/CustomersPage';
import ReturnsPage from './components/ReturnsPage';
import SuperAdminPage from './components/SuperAdminPage';
import { getShortId, setupDigitConversion } from './utils';

// Helper to read shop settings from localStorage
export function getShopSettings() {
    try {
        return JSON.parse(localStorage.getItem('shopSettings') || '{}');
    } catch {
        return {};
    }
}

function App() {
    const [currentTab, setCurrentTab] = useState('maintenance_jobs');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [journalEntries, setJournalEntries] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [maintenanceJobs, setMaintenanceJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [globalReceipt, setGlobalReceipt] = useState(null);

    const [shopSettings, setShopSettings] = useState({
        shopName: 'متجر الموبايل',
        currency: 'د.ع',
        phone: '',
        email: '',
        address: '',
        footerNote: 'شكراً لتعاملكم معنا 🙏',
        systemPassword: '123456'
    });

    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    const [currentUser, setCurrentUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('currentUser') || 'null');
        } catch {
            return null;
        }
    });
    const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
    const [usernameInput, setUsernameInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
    const [roleInput, setRoleInput] = useState('user');
    const [loginError, setLoginError] = useState('');

    useEffect(() => {
        if (theme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setLoginError('');
        if (!usernameInput.trim() || !passwordInput) {
            setLoginError('يرجى ملء جميع الحقول.');
            return;
        }
        try {
            const res = await axios.post('/auth/login/', {
                username: usernameInput,
                password: passwordInput
            });
            if (res.data.status === 'success') {
                const user = res.data.user;
                setCurrentUser(user);
                localStorage.setItem('currentUser', JSON.stringify(user));
                setUsernameInput('');
                setPasswordInput('');
                window.location.reload();
            }
        } catch (err) {
            setLoginError(err.response?.data?.detail || 'اسم المستخدم أو رمز المرور غير صحيح.');
        }
    };

    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        setLoginError('');
        if (!usernameInput.trim() || !passwordInput || !confirmPasswordInput) {
            setLoginError('يرجى ملء جميع الحقول.');
            return;
        }
        if (passwordInput !== confirmPasswordInput) {
            setLoginError('كلمتا المرور غير متطابقتين.');
            return;
        }
        try {
            await axios.post('/auth/register/', {
                username: usernameInput,
                password: passwordInput,
                role: roleInput
            });
            alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
            setAuthTab('login');
            setPasswordInput('');
            setConfirmPasswordInput('');
            setLoginError('');
        } catch (err) {
            setLoginError(err.response?.data?.detail || 'حدث خطأ أثناء إنشاء الحساب.');
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        window.location.reload();
    };

    // Fetch data
    const fetchData = async () => {
        setLoading(true);
        try {
            const accRes = await axios.get('/accounts/');
            const jeRes = await axios.get('/journal-entries/');
            const prodRes = await axios.get('/products/');
            const salesRes = await axios.get('/sales/');
            const mntRes = await axios.get('/maintenance/');
            const settingsRes = await axios.get('/shop-settings/');
            setAccounts(accRes.data);
            setJournalEntries(jeRes.data);
            setProducts(prodRes.data);
            setSales(salesRes.data);
            setMaintenanceJobs(mntRes.data);
            const d = settingsRes.data;
            setShopSettings({
                shopName: d.shop_name,
                currency: d.currency,
                phone: d.phone || '',
                email: d.email || '',
                address: d.address || '',
                footerNote: d.footer_note || '',
                systemPassword: d.system_password,
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Setup automatic Arabic digit conversion listeners
        const removeDigitConversion = setupDigitConversion();
        return () => {
            removeDigitConversion();
        };
    }, []);

    useEffect(() => {
        if (shopSettings.shopName) {
            document.title = shopSettings.shopName;
        } else {
            document.title = 'متجر الموبايل';
        }
    }, [shopSettings.shopName]);

    if (!currentUser) {
        const shopName = shopSettings.shopName || 'متجر الموبايل';
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-550 dark:bg-[#09090b] font-tajawal text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
                <div className="w-full max-w-sm p-8 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl space-y-6 backdrop-blur-md">
                    {/* Head */}
                    <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                            <Icon name="lock" className="w-7 h-7 text-indigo-600 animate-pulse" />
                        </div>
                        <h1 className="text-xl font-extrabold">{shopName}</h1>
                        <p className="text-xs text-zinc-550 dark:text-zinc-400 font-bold">يرجى تسجيل الدخول للمتابعة</p>
                    </div>

                    {/* Auth Tabs */}
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800" dir="rtl">
                        <button 
                            type="button" 
                            onClick={() => { setAuthTab('login'); setLoginError(''); }}
                            className={`flex-1 pb-3 text-center text-sm font-bold border-b-2 transition-all cursor-pointer ${authTab === 'login' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                        >
                            تسجيل الدخول
                        </button>
                        <button 
                            type="button" 
                            onClick={() => { setAuthTab('register'); setLoginError(''); }}
                            className={`flex-1 pb-3 text-center text-sm font-bold border-b-2 transition-all cursor-pointer ${authTab === 'register' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                        >
                            إنشاء حساب جديد
                        </button>
                    </div>

                    {loginError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl text-center">
                            {loginError}
                        </div>
                    )}

                    {authTab === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-4 text-right">
                            <div>
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5">اسم المستخدم</label>
                                <input 
                                    type="text" 
                                    value={usernameInput} 
                                    onChange={e => setUsernameInput(e.target.value)} 
                                    placeholder="أدخل اسم المستخدم"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-600 text-right"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5">كلمة المرور</label>
                                <input 
                                    type="password" 
                                    value={passwordInput} 
                                    onChange={e => setPasswordInput(e.target.value)} 
                                    placeholder="أدخل كلمة المرور"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-600 text-right"
                                    required 
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
                            >
                                الدخول للنظام
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4 text-right">
                            <div>
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5">اسم المستخدم</label>
                                <input 
                                    type="text" 
                                    value={usernameInput} 
                                    onChange={e => setUsernameInput(e.target.value)} 
                                    placeholder="اختر اسم مستخدم"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-600 text-right"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5">كلمة المرور</label>
                                <input 
                                    type="password" 
                                    value={passwordInput} 
                                    onChange={e => setPasswordInput(e.target.value)} 
                                    placeholder="أدخل كلمة المرور"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-600 text-right"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5">تأكيد كلمة المرور</label>
                                <input 
                                    type="password" 
                                    value={confirmPasswordInput} 
                                    onChange={e => setConfirmPasswordInput(e.target.value)} 
                                    placeholder="أعد إدخال كلمة المرور"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-600 text-right"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-550 dark:text-zinc-400 mb-1.5">الصلاحية</label>
                                <select 
                                    value={roleInput} 
                                    onChange={e => setRoleInput(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-600 text-right dark:bg-[#0c0c0f]"
                                >
                                    <option value="user" className="dark:bg-[#0c0c0f]">مستخدم عادي</option>
                                    <option value="admin" className="dark:bg-[#0c0c0f]">مدير النظام</option>
                                </select>
                            </div>
                            <button 
                                type="submit" 
                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
                            >
                                إنشاء الحساب
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-zinc-555 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-50 overflow-hidden font-tajawal transition-colors duration-300 relative">
            {/* Sidebar Mobile Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 md:hidden animate-fadeIn" 
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside 
                className={`fixed inset-y-0 right-0 z-50 w-64 bg-white dark:bg-[#0c0c0f] border-l border-zinc-200 dark:border-zinc-800 flex flex-col justify-between transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
                    sidebarOpen ? 'translate-x-0' : 'translate-x-full'
                } flex`}
            >
                <div>
                    {/* Logo & Close Button for mobile */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Icon name="smartphone" className="w-5 h-5 text-slate-950" />
                            </div>
                            <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">نظام المحمول</span>
                        </div>
                        <button 
                            onClick={() => setSidebarOpen(false)}
                            className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 md:hidden rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-all"
                        >
                            <Icon name="x" className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Nav Items */}
                    <nav className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-10rem)]">
                        <button 
                            onClick={() => { setCurrentTab('maintenance_jobs'); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${currentTab === 'maintenance_jobs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-550 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-950 dark:hover:text-zinc-100'}`}
                        >
                            <Icon name="wrench" className="w-5 h-5" />
                            <span>قسم الصيانة</span>
                        </button>
                        <button 
                            onClick={() => { setCurrentTab('customers'); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${currentTab === 'customers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-550 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-950 dark:hover:text-zinc-100'}`}
                        >
                            <Icon name="users" className="w-5 h-5" />
                            <span>إدارة الديون والزبائن</span>
                        </button>
                        <button 
                            onClick={() => { setCurrentTab('settings'); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${currentTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-550 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-950 dark:hover:text-zinc-100'}`}
                        >
                            <Icon name="settings" className="w-5 h-5" />
                            <span>إعدادات المتجر</span>
                        </button>
                        {(currentUser?.is_super_admin === 1 || currentUser?.username === 'admin') && (
                            <button 
                                onClick={() => { setCurrentTab('super_admin'); setSidebarOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${currentTab === 'super_admin' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20' : 'text-purple-400 hover:bg-purple-500/10'}`}
                            >
                                <Icon name="shield-check" className="w-5 h-5 text-purple-400" />
                                <span className="font-extrabold">لوحة المالك (Super Admin)</span>
                            </button>
                        )}
                    </nav>
                </div>
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                    {currentUser && (
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                                    {currentUser.username.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-xs truncate max-w-[100px]">{currentUser.username}</div>
                                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{currentUser.role === 'admin' ? 'مدير النظام' : 'مستخدم'}</div>
                                </div>
                            </div>
                            <button 
                                onClick={handleLogout}
                                className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="تسجيل الخروج"
                            >
                                <Icon name="log-out" className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <div className="text-xs text-zinc-550 text-center">
                        نظام الصيانة والديون v1.3
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden bg-zinc-550 dark:bg-[#09090b] transition-colors duration-300 pb-16 md:pb-0">
                {/* Header */}
                <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 md:px-8 bg-white/70 dark:bg-[#0c0c0f]/70 backdrop-blur-md transition-colors duration-300">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Button for mobile */}
                        <button 
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 text-zinc-550 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg md:hidden transition-all cursor-pointer"
                        >
                            <Icon name="menu" className="w-5 h-5" />
                        </button>
                        <h1 className="text-base md:text-xl font-bold text-zinc-850 dark:text-zinc-200 truncate max-w-[180px] sm:max-w-xs">
                            {currentTab === 'maintenance_jobs' && 'أجهزة الصيانة'}
                            {currentTab === 'customers' && 'إدارة الديون والزبائن'}
                            {currentTab === 'settings' && 'إعدادات المتجر'}
                            {currentTab === 'super_admin' && 'لوحة تحكم مالك التطبيق (Super Admin)'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-3">
                        {/* Theme Toggle Button */}
                        <button 
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="تبديل المظهر"
                        >
                            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-4.5 h-4.5 md:w-5 md:h-5" />
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="تسجيل الخروج"
                        >
                            <Icon name="lock" className="w-4.5 h-4.5 md:w-5 md:h-5" />
                        </button>
                        <button 
                            onClick={fetchData}
                            className="p-2 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                        >
                            <Icon name="refresh-cw" className={`w-4.5 h-4.5 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </header>

                {/* Page Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {currentTab === 'maintenance_jobs' && <MaintenanceJobsPage jobs={maintenanceJobs} products={products} refresh={fetchData} />}
                    {currentTab === 'customers' && <CustomersPage />}
                    {currentTab === 'settings' && <ShopSettingsPage currentUser={currentUser} refresh={fetchData} />}
                    {currentTab === 'super_admin' && <SuperAdminPage currentUser={currentUser} />}
                </div>

                {/* Global Receipt Modal */}
                {globalReceipt && (() => {
                    const s = shopSettings;
                    const shopName = s.shopName || 'My Shop';
                    const currency = s.currency || 'IQD';
                    const phone = s.phone || '';
                    const email = s.email || '';
                    const address = s.address || '';
                    const footerNote = (s.footerNote && !s.footerNote.includes('شكر')) ? s.footerNote : 'Thank you for your business!';
                    const invoiceNum = 'INV-' + getShortId(globalReceipt.id);
                    
                    return (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setGlobalReceipt(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div id="print-receipt">
                                {globalReceipt.type === 'maintenance' ? (
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
                                                <div className="mnt-info-row"><span className="mnt-info-key">الاسم:</span><span className="mnt-info-val">{globalReceipt.customer}</span></div>
                                                {globalReceipt.customerPhone && <div className="mnt-info-row"><span className="mnt-info-key">الهاتف:</span><span className="mnt-info-val">{globalReceipt.customerPhone}</span></div>}
                                                <div className="mnt-info-row"><span className="mnt-info-key">طريقة الدفع:</span><span className="mnt-info-val">{globalReceipt.paymentMethod === 'Cash' ? 'نقدي' : 'آجل'}</span></div>
                                            </div>
                                            <div className="mnt-info-box">
                                                <div className="mnt-info-box-title">تفاصيل الوصل</div>
                                                <div className="mnt-info-row"><span className="mnt-info-key">رقم الوصل:</span><span className="mnt-info-val">{invoiceNum}</span></div>
                                                <div className="mnt-info-row"><span className="mnt-info-key">التاريخ:</span><span className="mnt-info-val">{globalReceipt.date}</span></div>
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
                                                {globalReceipt.items.map((item, i) => (
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
                                        {globalReceipt.maintenanceNote && (
                                            <div className="mnt-note-box">
                                                <div className="mnt-note-label">تقرير الفحص والصيانة:</div>
                                                <div className="mnt-note-text">{globalReceipt.maintenanceNote}</div>
                                            </div>
                                        )}

                                        {/* Warranty block */}
                                        {globalReceipt.warrantyDays && parseInt(globalReceipt.warrantyDays) > 0 && (
                                            <div className="mnt-warranty">
                                                <span className="mnt-warranty-icon">🛡️</span>
                                                <div>
                                                    <div className="mnt-warranty-title">الضمان والكفالة</div>
                                                    <div className="mnt-warranty-text">هذا الجهاز مكفول لمدة {globalReceipt.warrantyDays} يوم من تاريخ استلامه على القطع المستبدلة فقط. الكفالة لا تشمل سوء الاستخدام أو الكسر أو السوائل.</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Totals */}
                                        <div className="mnt-total">
                                            <div className="mnt-total-box">
                                                <span className="mnt-total-label">المجموع الكلي:</span>
                                                <span className="mnt-total-amount">{globalReceipt.total.toLocaleString()} {currency}</span>
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
                                       STANDARD SALES INVOICE TEMPLATE — ENGLISH ONLY
                                       Beige Minimalist Typecentric Professional Style
                                       --------------------------------------------- */
                                    <div className="inv" style={{direction:'ltr', fontFamily:"'Outfit', 'Inter', sans-serif"}}>

                                        {/* ── TOP HEADER ── */}
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:'28px', borderBottom:'2.5px solid #1a1a1a', marginBottom:'32px'}}>
                                            {/* LEFT: Big INVOICE word */}
                                            <div>
                                                <div style={{fontSize:'62px', fontWeight:'900', color:'#1a1a1a', lineHeight:'0.9', letterSpacing:'-3px', textTransform:'uppercase'}}>INVOICE</div>
                                                <div style={{fontSize:'11px', color:'#888', marginTop:'10px', fontWeight:'500', letterSpacing:'2px', textTransform:'uppercase'}}>Sales Receipt</div>
                                            </div>
                                            {/* RIGHT: Company name + phone/email + invoice meta */}
                                            <div style={{textAlign:'right', minWidth:'200px'}}>
                                                <div style={{fontWeight:'900', fontSize:'17px', color:'#1a1a1a', letterSpacing:'-0.5px', marginBottom:'4px'}}>{shopName}</div>
                                                {phone && <div style={{fontSize:'11px', color:'#555', marginBottom:'2px'}}>{phone}</div>}
                                                {email && <div style={{fontSize:'11px', color:'#555'}}>{email}</div>}
                                                <div style={{marginTop:'14px', borderTop:'1px solid #ddd', paddingTop:'12px'}}>
                                                    <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'8px', marginBottom:'6px'}}>
                                                        <span style={{fontSize:'9px', fontWeight:'800', color:'#999', textTransform:'uppercase', letterSpacing:'1px'}}>Invoice No.</span>
                                                        <span style={{fontSize:'12px', fontWeight:'900', color:'#000'}}>{invoiceNum}</span>
                                                    </div>
                                                    <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:'8px'}}>
                                                        <span style={{fontSize:'9px', fontWeight:'800', color:'#999', textTransform:'uppercase', letterSpacing:'1px'}}>Date</span>
                                                        <span style={{fontSize:'12px', fontWeight:'700', color:'#000'}}>{globalReceipt.date}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── BILLED TO ── */}
                                        <div style={{marginBottom:'36px', paddingBottom:'24px', borderBottom:'1px solid #ddd'}}>
                                            <div style={{fontSize:'9px', fontWeight:'900', color:'#999', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'10px'}}>Billed To</div>
                                            <div style={{fontSize:'16px', fontWeight:'900', color:'#1a1a1a', letterSpacing:'-0.5px'}}>{globalReceipt.customer || 'Walk-in Customer'}</div>
                                            {globalReceipt.customerPhone && <div style={{fontSize:'12px', color:'#555', marginTop:'5px'}}>{globalReceipt.customerPhone}</div>}
                                            <div style={{display:'inline-block', marginTop:'8px', fontSize:'10px', fontWeight:'800', color:'#000', border:'1.5px solid #000', padding:'3px 10px', letterSpacing:'1px', textTransform:'uppercase'}}>
                                                {globalReceipt.paymentMethod === 'Cash' ? 'Cash' : 'Credit'}
                                            </div>
                                        </div>

                                        {/* ── ITEMS TABLE ── */}
                                        <table style={{width:'100%', borderCollapse:'collapse', fontSize:'12px', marginBottom:'8px'}}>
                                            <thead>
                                                <tr style={{borderBottom:'2px solid #1a1a1a'}}>
                                                    <th style={{textAlign:'left', padding:'10px 8px', fontSize:'9px', fontWeight:'900', textTransform:'uppercase', letterSpacing:'1.5px', color:'#555', width:'40px'}}>#</th>
                                                    <th style={{textAlign:'left', padding:'10px 8px', fontSize:'9px', fontWeight:'900', textTransform:'uppercase', letterSpacing:'1.5px', color:'#555'}}>Description</th>
                                                    <th style={{textAlign:'right', padding:'10px 8px', fontSize:'9px', fontWeight:'900', textTransform:'uppercase', letterSpacing:'1.5px', color:'#555', width:'130px'}}>Unit Price</th>
                                                    <th style={{textAlign:'right', padding:'10px 8px', fontSize:'9px', fontWeight:'900', textTransform:'uppercase', letterSpacing:'1.5px', color:'#555', width:'130px'}}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {globalReceipt.items.map((item, i) => (
                                                    <tr key={i} style={{borderBottom:'1px solid #e8e8e8'}}>
                                                        <td style={{padding:'14px 8px', color:'#999', fontWeight:'700', verticalAlign:'top'}}>{i + 1}</td>
                                                        <td style={{padding:'14px 8px', verticalAlign:'top'}}>
                                                            <div style={{fontWeight:'800', color:'#1a1a1a', fontSize:'13px'}}>{item.brand} {item.name ? item.name.replace(/\s*\([^)]+\)/g, '').trim() : ''}</div>
                                                            {item.imei && <div style={{fontSize:'10px', color:'#888', marginTop:'3px', fontFamily:'monospace'}}>IMEI: {item.imei}</div>}
                                                            {item.battery_health && <div style={{fontSize:'10px', color:'#888', marginTop:'2px'}}>Battery Health: {item.battery_health}%</div>}
                                                        </td>
                                                        <td style={{padding:'14px 8px', textAlign:'right', color:'#444', fontWeight:'700', verticalAlign:'top'}}>{parseFloat(item.price).toLocaleString()} {currency}</td>
                                                        <td style={{padding:'14px 8px', textAlign:'right', fontWeight:'900', color:'#1a1a1a', verticalAlign:'top'}}>{parseFloat(item.price).toLocaleString()} {currency}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* ── TOTALS ── */}
                                        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0', marginTop:'0', marginBottom:'48px'}}>
                                            <div style={{display:'flex', justifyContent:'space-between', width:'280px', padding:'10px 0', borderBottom:'1px solid #ddd'}}>
                                                <span style={{fontSize:'11px', color:'#777', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.5px'}}>Subtotal</span>
                                                <span style={{fontSize:'12px', color:'#333', fontWeight:'700'}}>{globalReceipt.total.toLocaleString()} {currency}</span>
                                            </div>
                                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', width:'280px', padding:'14px 0', borderTop:'2.5px solid #1a1a1a', borderBottom:'2.5px solid #1a1a1a', marginTop:'4px'}}>
                                                <span style={{fontSize:'11px', fontWeight:'900', color:'#1a1a1a', textTransform:'uppercase', letterSpacing:'1px'}}>Total Due</span>
                                                <span style={{fontSize:'20px', fontWeight:'900', color:'#1a1a1a', letterSpacing:'-1px'}}>{globalReceipt.total.toLocaleString()} {currency}</span>
                                            </div>
                                        </div>

                                        {/* ── FOOTER ── */}
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderTop:'2px solid #1a1a1a', paddingTop:'24px'}}>
                                            <div>
                                                <div style={{fontSize:'9px', fontWeight:'900', color:'#999', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'8px'}}>Payment Information</div>
                                                <div style={{fontSize:'12px', fontWeight:'900', color:'#1a1a1a'}}>{shopName}</div>
                                                {phone && <div style={{fontSize:'11px', color:'#555', marginTop:'3px'}}>{phone}</div>}
                                                {email && <div style={{fontSize:'11px', color:'#555'}}>{email}</div>}
                                            </div>
                                            <div style={{textAlign:'right'}}>
                                                <div style={{fontSize:'15px', fontWeight:'900', color:'#1a1a1a', marginBottom:'4px'}}>Thank you!</div>
                                                <div style={{fontSize:'10px', color:'#888', fontStyle:'italic'}}>{footerNote}</div>
                                                <div style={{fontSize:'9px', color:'#aaa', marginTop:'6px'}}>© {new Date().getFullYear()} {s.shopName || 'My Shop'}. All rights reserved.</div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl no-print">
                                <button onClick={() => setGlobalReceipt(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-150 transition-all cursor-pointer">
                                    إغلاق
                                </button>
                                <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                                    <Icon name="printer" className="w-4 h-4" /> طباعة الفاتورة
                                </button>
                            </div>
                        </div>
                    </div>
                    );
                })()}
            </main>

            {/* Bottom Navigation for mobile */}
            <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0c0c0f] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around z-30 md:hidden pb-safe">
                <button 
                    onClick={() => setCurrentTab('maintenance_jobs')}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${currentTab === 'maintenance_jobs' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'}`}
                >
                    <Icon name="wrench" className="w-5 h-5" />
                    <span className="text-[10px] font-bold">الصيانة</span>
                </button>
                <button 
                    onClick={() => setCurrentTab('customers')}
                    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${currentTab === 'customers' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'}`}
                >
                    <Icon name="users" className="w-5 h-5" />
                    <span className="text-[10px] font-bold">الديون والزبائن</span>
                </button>
                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                    <Icon name="menu" className="w-5 h-5" />
                    <span className="text-[10px] font-bold">القائمة</span>
                </button>
            </nav>
        </div>
    );
}

export default App;
