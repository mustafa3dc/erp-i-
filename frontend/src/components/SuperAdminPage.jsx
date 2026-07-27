import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './Icon';

export default function SuperAdminPage({ currentUser }) {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState({
        username: '',
        password: '',
        shop_name: '',
        subscription_days: 30
    });
    const [saving, setSaving] = useState(false);

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/auth/users/');
            setTenants(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleCreateTenant = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password || !form.shop_name) {
            alert('يرجى ملء كافة الحقول المنسدلة.');
            return;
        }
        setSaving(true);
        try {
            await axios.post('/admin/tenants/', form);
            alert(`تم إنشاء حساب المحل "${form.shop_name}" بنجاح! 🎉`);
            setShowAddModal(false);
            setForm({ username: '', password: '', shop_name: '', subscription_days: 30 });
            fetchTenants();
        } catch (err) {
            alert(err.response?.data?.detail || 'حدث خطأ أثناء إنشاء حساب المحل.');
        } finally {
            setSaving(false);
        }
    };

    const handleRenew = async (tenantId) => {
        const days = prompt('كم عدد الأيام التي تريد تمديد اشتراك هذا المحل بها؟', '30');
        if (days && !isNaN(days)) {
            try {
                await axios.post('/admin/tenants/renew/', {
                    user_id: tenantId,
                    additional_days: parseInt(days)
                });
                alert('تم تمديد الاشتراك بنجاح! 🎉');
                fetchTenants();
            } catch (e) {
                alert('حدث خطأ أثناء تجديد الاشتراك.');
            }
        }
    };

    const handleToggleStatus = async (tenantId) => {
        try {
            await axios.post(`/admin/tenants/toggle-status/?user_id=${tenantId}`);
            fetchTenants();
        } catch (e) {
            alert('حدث خطأ أثناء تغيير حالة الحساب.');
        }
    };

    const handleDelete = async (tenantId, name) => {
        if (confirm(`هل أنت متأكد من حذف حساب المحل "${name}" نهائياً؟`)) {
            try {
                await axios.delete(`/auth/users/${tenantId}/`);
                alert('تم حذف الحساب بنجاح.');
                fetchTenants();
            } catch (e) {
                alert('حدث خطأ أثناء حذف الحساب.');
            }
        }
    };

    const activeCount = tenants.filter(t => t.is_active).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
                        <Icon name="shield-check" className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-white">لوحة تحكم مالك التطبيق (Super Admin)</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">الإدارة العليا</span>
                        </div>
                        <p className="text-xs text-indigo-200/70 mt-1">إدارة الاشتراكات، إنشاء حسابات المحلات الجديدة، والتحكم بالفترات التجريبية</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer transform hover:scale-[1.02]"
                >
                    <Icon name="plus-circle" className="w-5 h-5" />
                    إضافة محل (زبون جديد)
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                        <div className="text-xs text-zinc-400 font-bold mb-1">إجمالي المحلات المشتركة</div>
                        <div className="text-2xl font-black text-indigo-500">{tenants.length} محل</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Icon name="store" className="w-5 h-5" />
                    </div>
                </div>
                <div className="p-5 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                        <div className="text-xs text-zinc-400 font-bold mb-1">المحلات النشطة حالياً</div>
                        <div className="text-2xl font-black text-emerald-500">{activeCount} محل</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Icon name="check-circle" className="w-5 h-5" />
                    </div>
                </div>
                <div className="p-5 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                        <div className="text-xs text-zinc-400 font-bold mb-1">اشتراكات معطلة / منتهية</div>
                        <div className="text-2xl font-black text-rose-500">{tenants.length - activeCount} محل</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                        <Icon name="slash" className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Tenants List Table */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Icon name="users" className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-extrabold text-base">سجل المحلات والمشتركين</h3>
                    </div>
                    <button onClick={fetchTenants} className="p-2 text-zinc-400 hover:text-indigo-500 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                        <Icon name="refresh-cw" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400">
                                <th className="p-4 font-extrabold">المحل والمستخدم</th>
                                <th className="p-4 font-extrabold">الصلاحية</th>
                                <th className="p-4 font-extrabold">تاريخ انتهاء الاشتراك</th>
                                <th className="p-4 font-extrabold">حالة الحساب</th>
                                <th className="p-4 font-extrabold text-left">التحكم والتجديد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/60">
                            {tenants.map(t => (
                                <tr key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all">
                                    <td className="p-4 font-bold">
                                        <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{t.shop_name || 'MOBILE SIS'}</div>
                                        <div className="text-[11px] text-indigo-400 dir-ltr font-mono mt-0.5">@{t.username}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full font-extrabold text-[10px] ${t.is_super_admin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                            {t.is_super_admin ? 'مالك المنصة' : 'صاحب محل'}
                                        </span>
                                    </td>
                                    <td className="p-4 font-extrabold text-amber-500 dir-ltr text-right">
                                        {t.subscription_end ? t.subscription_end.split('T')[0] : 'دائم (غير محدود)'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full font-extrabold text-[10px] ${t.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                            {t.is_active ? 'مفعل ✅' : 'معطل 🛑'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-left space-x-2 space-x-reverse">
                                        <button
                                            onClick={() => handleRenew(t.id)}
                                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-extrabold rounded-xl border border-amber-500/30 transition-all cursor-pointer"
                                        >
                                            + تمديد الاشتراك
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(t.id)}
                                            className={`px-3 py-1.5 font-extrabold rounded-xl transition-all cursor-pointer ${t.is_active ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}
                                        >
                                            {t.is_active ? 'إيقاف الحساب' : 'تفعيل'}
                                        </button>
                                        {!t.is_super_admin && (
                                            <button
                                                onClick={() => handleDelete(t.id, t.shop_name)}
                                                className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                                                title="حذف الحساب"
                                            >
                                                <Icon name="trash-2" className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Tenant Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                            <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Icon name="store" className="w-5 h-5 text-indigo-500" />
                                إضافة محل جديد (حساب زبون)
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-200">
                                <Icon name="x" className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTenant} className="space-y-4 text-right">
                            <div>
                                <label className="block text-xs font-extrabold text-zinc-400 mb-1.5">اسم المحل</label>
                                <input
                                    type="text"
                                    value={form.shop_name}
                                    onChange={e => setForm({ ...form, shop_name: e.target.value })}
                                    placeholder="مثال: مركز بابل للصيانة"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-right focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-zinc-400 mb-1.5">اسم المستخدم (للدخول)</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={e => setForm({ ...form, username: e.target.value })}
                                    placeholder="اسم المستخدم بالإنكليزي"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-right focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-zinc-400 mb-1.5">كلمة المرور</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    placeholder="كلمة المرور"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-right focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-zinc-400 mb-1.5">مدة الاشتراك الأولي (بالأيام)</label>
                                <input
                                    type="number"
                                    value={form.subscription_days}
                                    onChange={e => setForm({ ...form, subscription_days: parseInt(e.target.value) || 30 })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-right focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 font-bold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                    إلغاء
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-indigo-600/30">
                                    {saving ? 'جاري الإنشـاء...' : 'إنشاء الحساب وتفعيل الاشتراك'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
