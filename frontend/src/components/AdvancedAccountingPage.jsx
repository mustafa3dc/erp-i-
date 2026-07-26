import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from './Icon';

export default         function AdvancedAccountingPage({ accounts, entries, refresh }) {
            const [activeSubTab, setActiveSubTab] = useState('chart');
            const [botToken, setBotToken] = useState('');
            const [allowedUsers, setAllowedUsers] = useState([]);
            const [isBotRunning, setIsBotRunning] = useState(false);
            const [saving, setSaving] = useState(false);
            const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

            // Fetch current telegram settings on mount
            useEffect(() => {
                const fetchSettings = async () => {
                    try {
                        const res = await axios.get('/telegram/settings/');
                        setBotToken(res.data.token || '');
                        const users = res.data.allowed_users ? res.data.allowed_users.split(',').map(s => s.trim()).filter(Boolean) : [];
                        setAllowedUsers(users);
                        setIsBotRunning(res.data.is_running);
                    } catch (e) {
                        console.error("Failed to load Telegram Bot settings:", e);
                    }
                };
                fetchSettings();
            }, []);

            const handleSaveTelegram = async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                    const cleanUsers = allowedUsers.map(u => u.trim()).filter(Boolean).join(',');
                    const res = await axios.post('/telegram/settings/', { 
                        token: botToken,
                        allowed_users: cleanUsers
                    });
                    setIsBotRunning(res.data.is_running);
                    setHasUnsavedChanges(false);
                    alert("تم حفظ إعدادات البوت والتشغيل بنجاح!");
                } catch (err) {
                    alert("حدث خطأ أثناء حفظ إعدادات البوت.");
                } finally {
                    setSaving(false);
                }
            };

            return (
                <div className="space-y-6">
                    <div className="flex gap-4 border-b border-zinc-150 dark:border-zinc-900 pb-3 overflow-x-auto">
                        <button 
                            onClick={() => setActiveSubTab('chart')}
                            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeSubTab === 'chart' ? 'bg-zinc-200 dark:bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                            دليل الحسابات (Chart of Accounts)
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('journal')}
                            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeSubTab === 'journal' ? 'bg-zinc-200 dark:bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                            سجل القيود اليومية (Manual Entries & Logs)
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('telegram')}
                            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeSubTab === 'telegram' ? 'bg-zinc-200 dark:bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`}
                        >
                            بوت التليجرام (Telegram Bot)
                        </button>
                    </div>

                    {activeSubTab === 'chart' && (
                        <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                            <h3 className="font-bold text-lg mb-6 text-emerald-400">شجرة ودليل الحسابات الدفترية</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-150 dark:border-zinc-900 text-zinc-500 dark:text-zinc-400 text-sm">
                                            <th className="pb-3 pr-4">رمز الحساب</th>
                                            <th className="pb-3">الاسم</th>
                                            <th className="pb-3">النوع</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {accounts.map(acc => (
                                            <tr key={acc.id} className="hover:bg-zinc-200 dark:bg-zinc-800/30 text-zinc-800 dark:text-zinc-200 text-sm">
                                                <td className="py-4 pr-4 font-mono text-emerald-400 font-semibold">{acc.code}</td>
                                                <td className="py-4">{acc.name}</td>
                                                <td className="py-4">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350">
                                                        {acc.type}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeSubTab === 'journal' && (
                        <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                            <h3 className="font-bold text-lg mb-6 text-emerald-400">سجل القيود اليومية والدفتر العام</h3>
                            <div className="space-y-4">
                                {entries.map(entry => (
                                    <div key={entry.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 rounded-xl">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{entry.description}</div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400">المرجع: {entry.reference} | التاريخ: {new Date(entry.entry_date).toLocaleDateString('en-GB')}</div>
                                            </div>
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">{entry.state}</span>
                                        </div>
                                        <table className="w-full text-right text-xs">
                                            <thead>
                                                <tr className="text-zinc-400 dark:text-zinc-500 border-b border-slate-900">
                                                    <th>الحساب</th>
                                                    <th>مدين</th>
                                                    <th>دائن</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entry.items.map(item => {
                                                    const acc = accounts.find(a => a.id === item.account_id);
                                                    return (
                                                        <tr key={item.id} className="text-zinc-500 dark:text-zinc-400">
                                                            <td className="py-1">{acc ? acc.name : 'غير معروف'}</td>
                                                            <td className="py-1 font-mono text-emerald-500">{parseFloat(item.debit) > 0 ? parseFloat(item.debit).toFixed(2) : '-'}</td>
                                                            <td className="py-1 font-mono text-rose-500">{parseFloat(item.credit) > 0 ? parseFloat(item.credit).toFixed(2) : '-'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeSubTab === 'telegram' && (
                        <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                    <Icon name="send" className="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-sky-400">ربط وتفعيل بوت التليجرام</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">للبحث والاستعلام الفوري عن قطع الصيانة المتوفرة بالمخزن</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveTelegram} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">توكن البوت (API Token)</label>
                                    <input 
                                        type="text"
                                        required
                                        value={botToken}
                                        onChange={e => {
                                            setBotToken(e.target.value);
                                            setHasUnsavedChanges(true);
                                        }}
                                        placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsT..."
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500 text-zinc-900 dark:text-zinc-100 font-mono text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2 font-bold">الحسابات و الـ Chat IDs المصرح لها بالاستخدام</label>
                                    <div className="space-y-2">
                                        {allowedUsers.map((user, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    value={user}
                                                    onChange={e => {
                                                        const copy = [...allowedUsers];
                                                        copy[index] = e.target.value;
                                                        setAllowedUsers(copy);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    placeholder="مثال: mustafa أو 123456789"
                                                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-sky-500 font-mono"
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setAllowedUsers(allowedUsers.filter((_, i) => i !== index));
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setAllowedUsers([...allowedUsers, '']);
                                            setHasUnsavedChanges(true);
                                        }}
                                        className="mt-3 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sky-400 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        + إضافة حساب مصرح له
                                    </button>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2">
                                        تنبيه: يجب إضافة الحسابات المصرح لها هنا. إذا كانت القائمة فارغة فلن يتمكن أحد من استخدام البوت.
                                    </p>
                                </div>

                                {hasUnsavedChanges && (
                                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold flex items-center gap-2">
                                        ⚠️ انتبه: لديك تغييرات غير محفوظة! يرجى الضغط على زر "حفظ وتشغيل البوت" أدناه لتطبيق التغييرات.
                                    </div>
                                )}

                                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-150 dark:border-zinc-900 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 block">حالة البوت الحالية</span>
                                        <span className={`text-sm font-bold ${isBotRunning ? 'text-emerald-400' : 'text-rose-500'}`}>
                                            {isBotRunning ? '🟢 متصل ويعمل بنجاح' : '🔴 متوقف (يرجى إدخال توكن صالح)'}
                                        </span>
                                    </div>
                                    <button 
                                        type="submit"
                                        disabled={saving}
                                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md text-sm"
                                    >
                                        {saving ? 'جاري التشغيل...' : 'حفظ وتشغيل البوت'}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 rounded-xl space-y-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                <h4 className="font-bold text-zinc-800 dark:text-zinc-200">💡 كيف تصنع وتفعل البوت؟</h4>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>ابحث في تطبيق التليجرام عن المعرف الرسمي: <a href="https://t.me/BotFather" target="_blank" className="text-sky-400 underline">@BotFather</a></li>
                                    <li>أرسل له الأمر <code className="bg-white dark:bg-[#0c0c0f] px-1 py-0.5 rounded text-sky-300">/newbot</code> ثم اختر اسماً ومعرفاً للبوت الخاص بك.</li>
                                    <li>انسخ التوكن الطويل (Token) الذي سيعطيك إياه، وضعه في الحقل أعلاه واضغط على **"حفظ وتشغيل البوت"**.</li>
                                    <li>الآن، افتح البوت الخاص بك على التليجرام واضغط **Start**، ثم اكتب أي كلمة (مثال: شاشة) للبحث فوراً في مخزنك!</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Settings Field - must be outside ShopSettingsPage to avoid remount on every render
