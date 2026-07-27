import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './Icon';
import { toEnglishDigits, formatNumberWithCommas, cleanCommaFormattedNumber, getShortId } from '../utils';

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [history, setHistory] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', notes: '', initial_debt: '0', installment_downpayment: '0', installment_monthly: '0' });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Debt ledger specific states
    const [activeSubTab, setActiveSubTab] = useState('history'); // 'history' or 'debt_ledger'
    const [payments, setPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [showInitialDebtModal, setShowInitialDebtModal] = useState(false);
    const [initialDebtValue, setInitialDebtValue] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkRows, setBulkRows] = useState([{ name: '', phone: '', initial_debt: '', notes: '' }]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/customers/');
            setCustomers(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCustomers(); }, []);

    const fetchHistory = async (customerId) => {
        setHistoryLoading(true);
        try {
            const res = await axios.get(`/customers/${customerId}/history/`);
            setHistory(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchPayments = async (customerId) => {
        setPaymentsLoading(true);
        try {
            const res = await axios.get(`/customers/${customerId}/payments/`);
            setPayments(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setPaymentsLoading(false);
        }
    };

    const handleSelectCustomer = (c) => {
        setSelectedCustomer(c);
        setHistory(null);
        setPayments([]);
        fetchHistory(c.id);
        fetchPayments(c.id);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const cleanedDebt = cleanCommaFormattedNumber(toEnglishDigits(form.initial_debt));
            const cleanedDownpayment = cleanCommaFormattedNumber(toEnglishDigits(form.installment_downpayment || '0'));
            const cleanedMonthly = cleanCommaFormattedNumber(toEnglishDigits(form.installment_monthly || '0'));
            const res = await axios.post('/customers/', {
                ...form,
                initial_debt: parseFloat(cleanedDebt) || 0,
                installment_downpayment: parseFloat(cleanedDownpayment) || 0,
                installment_monthly: parseFloat(cleanedMonthly) || 0
            });
            setShowAddModal(false);
            setForm({ name: '', phone: '', notes: '', initial_debt: '0', installment_downpayment: '0', installment_monthly: '0' });
            alert(`تم إضافة الزبون "${res.data.name}" بنجاح! 🎉`);
            if (res.data) {
                setCustomers(prev => [res.data, ...prev.filter(c => c.id !== res.data.id)]);
                handleSelectCustomer(res.data);
            }
            fetchCustomers();
        } catch (e) {
            alert(e.response?.data?.detail || 'خطأ في إضافة الزبون. يرجى التأكد من البيانات.');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const cleanedDebt = toEnglishDigits(form.initial_debt);
            const cleanedDownpayment = toEnglishDigits(form.installment_downpayment || '0');
            const cleanedMonthly = toEnglishDigits(form.installment_monthly || '0');
            const res = await axios.put(`/customers/${editingCustomer.id}/`, {
                ...form,
                initial_debt: parseFloat(cleanedDebt) || 0,
                installment_downpayment: parseFloat(cleanedDownpayment) || 0,
                installment_monthly: parseFloat(cleanedMonthly) || 0
            });
            setShowEditModal(false);
            setEditingCustomer(null);
            setForm({ name: '', phone: '', notes: '', initial_debt: '0', installment_downpayment: '0', installment_monthly: '0' });
            fetchCustomers();
            if (selectedCustomer?.id === editingCustomer.id) {
                setSelectedCustomer(res.data);
                fetchHistory(editingCustomer.id);
            }
        } catch (e) {
            alert('خطأ في تعديل الزبون');
        } finally {
            setSaving(false);
        }
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        const cleanedAmt = cleanCommaFormattedNumber(toEnglishDigits(paymentAmount));
        const amt = parseFloat(cleanedAmt);
        if (isNaN(amt) || amt <= 0) {
            alert('يرجى كتابة مبلغ صحيح أكبر من الصفر');
            return;
        }
        setSaving(true);
        try {
            await axios.post(`/customers/${selectedCustomer.id}/payments/`, {
                amount: amt,
                notes: paymentNotes,
                payment_date: paymentDate ? new Date(paymentDate).toISOString() : null
            });
            setPaymentAmount('');
            setPaymentNotes('');
            setPaymentDate('');
            fetchCustomers();
            fetchHistory(selectedCustomer.id);
            fetchPayments(selectedCustomer.id);
            
            // Refresh currently selected customer to update display totals directly by ID
            const updatedRes = await axios.get('/customers/');
            const match = updatedRes.data.find(c => c.id === selectedCustomer.id);
            if (match) setSelectedCustomer(match);
        } catch (err) {
            alert('خطأ في تنزيل دفعة التسديد');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveInitialDebt = async (e) => {
        e.preventDefault();
        const cleanedVal = toEnglishDigits(initialDebtValue);
        const val = parseFloat(cleanedVal) || 0;
        setSaving(true);
        try {
            const res = await axios.put(`/customers/${selectedCustomer.id}/`, {
                initial_debt: val
            });
            setSelectedCustomer(res.data);
            setShowInitialDebtModal(false);
            fetchCustomers();
            fetchHistory(selectedCustomer.id);
        } catch (err) {
            alert('خطأ في تعديل الدين السابق');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/customers/${id}/`);
            setDeleteConfirm(null);
            if (selectedCustomer?.id === id) {
                setSelectedCustomer(null);
                setHistory(null);
            }
            fetchCustomers();
        } catch (e) {
            alert('خطأ في حذف الزبون');
        }
    };

    const openEdit = (c) => {
        setEditingCustomer(c);
        setForm({
            name: c.name,
            phone: c.phone || '',
            notes: c.notes || '',
            initial_debt: c.initial_debt ? c.initial_debt.toString() : '0',
            installment_downpayment: c.installment_downpayment ? c.installment_downpayment.toString() : '0',
            installment_monthly: c.installment_monthly ? c.installment_monthly.toString() : '0'
        });
        setShowEditModal(true);
    };

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery)
    );

    const totalSpent = (h) => {
        if (!h) return 0;
        const s = h.sales.reduce((a, s) => a + s.total, 0);
        const m = h.maintenance.reduce((a, m) => a + m.cost, 0);
        return s + m;
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full" dir="rtl">
            {/* Left Panel - Customer List */}
            <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 ${selectedCustomer ? 'hidden lg:flex' : 'flex'}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">قاعدة الزبائن</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{customers.length} زبون مسجل</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setBulkRows([{ name: '', phone: '', initial_debt: '', notes: '' }]); setShowBulkModal(true); }}
                            className="flex items-center gap-1.5 px-2.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="إضافة وإدخال قائمة زبائن دفعة واحدة في جدول"
                        >
                            <Icon name="file-text" className="w-3.5 h-3.5 text-indigo-500" />
                            استيراد سريع
                        </button>
                        <button
                            onClick={() => { setForm({ name: '', phone: '', notes: '', initial_debt: '0', installment_downpayment: '0', installment_monthly: '0' }); setShowAddModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                            <Icon name="user-plus" className="w-3.5 h-3.5" />
                            إضافة زبون
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Icon name="search" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="ابحث بالاسم أو الرقم..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* List */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400">
                            <Icon name="users" className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">لا توجد نتائج</p>
                        </div>
                    ) : (
                        filtered.map(c => (
                            <div
                                key={c.id}
                                onClick={() => handleSelectCustomer(c)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                    selectedCustomer?.id === c.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                        selectedCustomer?.id === c.id
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                    }`}>
                                        {c.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{c.name}</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.phone || 'بدون رقم'}</p>
                                    </div>
                                    <div className="text-left flex flex-col items-end gap-1">
                                        <div className="flex gap-1">
                                            {c.total_sales > 0 && (
                                                <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-md font-bold">
                                                    🛒{c.total_sales}
                                                </span>
                                            )}
                                            {c.total_maintenance > 0 && (
                                                <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-md font-bold">
                                                    🔧{c.total_maintenance}
                                                </span>
                                            )}
                                        </div>
                                        {parseFloat(c.current_debt) > 0 ? (
                                            <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] rounded-md font-bold">
                                                عليه: {parseFloat(c.current_debt).toLocaleString()}
                                            </span>
                                        ) : parseFloat(c.current_debt) < 0 ? (
                                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] rounded-md font-bold">
                                                له: {Math.abs(parseFloat(c.current_debt)).toLocaleString()}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel - Customer Detail */}
            <div className={`flex-1 overflow-y-auto ${!selectedCustomer ? 'hidden lg:block' : 'block'}`}>
                {!selectedCustomer ? (
                    <div className="h-full flex items-center justify-center text-zinc-400">
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                                <Icon name="user" className="w-10 h-10 opacity-30" />
                            </div>
                            <p className="font-bold text-lg text-zinc-500 dark:text-zinc-400">اختر زبون من القائمة</p>
                            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">لعرض تاريخه الكامل</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Back Button for Mobile */}
                        <button 
                            onClick={() => setSelectedCustomer(null)}
                            className="lg:hidden flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-2 text-sm font-bold bg-zinc-150 dark:bg-zinc-800/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer w-max"
                        >
                            <Icon name="arrow-right" className="w-4 h-4" />
                            <span>رجوع للقائمة</span>
                        </button>

                        {/* Customer Header Card */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg shadow-indigo-600/20 flex-shrink-0">
                                        {selectedCustomer.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white truncate">{selectedCustomer.name}</h2>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                            <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                                                <Icon name="phone" className="w-3.5 h-3.5" />
                                                {selectedCustomer.phone || 'بدون رقم'}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs text-zinc-400">
                                                <Icon name="calendar" className="w-3.5 h-3.5" />
                                                منذ {new Date(selectedCustomer.created_at).toLocaleDateString('ar-IQ')}
                                            </span>
                                        </div>
                                        {/* Status Badge: Owed / Owes */}
                                        <div className="mt-3 flex items-center gap-2">
                                            {parseFloat(selectedCustomer.current_debt || 0) < 0 ? (
                                                <span className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-xs font-black rounded-xl flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    الزبون يطلبنا (دائن): {Math.abs(parseFloat(selectedCustomer.current_debt || 0)).toLocaleString()} د.ع
                                                </span>
                                            ) : parseFloat(selectedCustomer.current_debt || 0) > 0 ? (
                                                <span className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450 text-xs font-black rounded-xl flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                                    مطلوب للـمحل (مدين): {parseFloat(selectedCustomer.current_debt || 0).toLocaleString()} د.ع
                                                </span>
                                            ) : (
                                                <span className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-xl flex items-center gap-1">
                                                    الحساب مصفر (خالي من الديون)
                                                </span>
                                            )}
                                        </div>
                                        {selectedCustomer.notes && (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 italic">📝 {selectedCustomer.notes}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-150 dark:border-zinc-800">
                                    <a
                                        href={`/customers/${selectedCustomer.id}/report/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 hover:bg-indigo-600 hover:text-white text-indigo-650 dark:text-indigo-400 rounded-lg text-sm transition-all cursor-pointer font-bold"
                                    >
                                        <Icon name="file-text" className="w-3.5 h-3.5" />
                                        كشف الحساب (PDF)
                                    </a>
                                    <button
                                        onClick={() => openEdit(selectedCustomer)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-700 dark:text-zinc-300 rounded-lg text-sm transition-all cursor-pointer font-bold"
                                    >
                                        <Icon name="edit-2" className="w-3.5 h-3.5" />
                                        تعديل
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(selectedCustomer)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-600 hover:text-white text-zinc-700 dark:text-zinc-300 rounded-lg text-sm transition-all cursor-pointer font-bold"
                                    >
                                        <Icon name="trash-2" className="w-3.5 h-3.5" />
                                        حذف
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            {history && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="text-center">
                                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{history.sales.length}</p>
                                        <p className="text-xs text-zinc-500 mt-1">فاتورة مبيعات</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{history.maintenance.length}</p>
                                        <p className="text-xs text-zinc-500 mt-1">طلب صيانة</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                            {history.sales.reduce((a, s) => a + s.total, 0).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1">إجمالي المشتريات (د.ع)</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                                            {totalSpent(history).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1">إجمالي الإنفاق (د.ع)</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Subtabs Selection */}
                        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-4 gap-4">
                            <button
                                onClick={() => setActiveSubTab('history')}
                                className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                    activeSubTab === 'history'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                            >
                                سجل العمليات (صيانة ومبيعات)
                            </button>
                            <button
                                onClick={() => setActiveSubTab('debt_ledger')}
                                className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                                    activeSubTab === 'debt_ledger'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                            >
                                دفتر الديون والأقساط
                                {selectedCustomer.current_debt > 0 && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                )}
                            </button>
                        </div>

                        {activeSubTab === 'debt_ledger' ? (
                            <div className="space-y-6">
                                {/* Debt Summary row */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl relative">
                                        <p className="text-xs text-zinc-500">الدين السابق (القديم)</p>
                                        <p className="text-lg font-black text-zinc-950 dark:text-zinc-100 mt-1">
                                            {parseFloat(selectedCustomer.initial_debt || 0).toLocaleString()} د.ع
                                        </p>
                                        <button
                                            onClick={() => { setInitialDebtValue(selectedCustomer.initial_debt?.toString() || '0'); setShowInitialDebtModal(true); }}
                                            className="absolute left-3 top-3 text-indigo-500 hover:text-indigo-700 p-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
                                            title="تعديل الدين القديم"
                                        >
                                            <Icon name="edit-2" className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl">
                                        <p className="text-xs text-zinc-500">المشتريات الآجلة الجديدة</p>
                                        <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                                            {history ? history.sales.filter(s => s.payment !== 'Cash').reduce((a, s) => a + s.total, 0).toLocaleString() : 0} د.ع
                                        </p>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl">
                                        <p className="text-xs text-zinc-500">إجمالي المبالغ المسددة</p>
                                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                            {payments.reduce((a, p) => a + parseFloat(p.amount), 0).toLocaleString()} د.ع
                                        </p>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl">
                                        <p className="text-xs text-zinc-500">صافي الدين المتبقي</p>
                                        <p className={`text-lg font-black mt-1 ${
                                            parseFloat(selectedCustomer.current_debt || 0) < 0 
                                            ? 'text-emerald-500 dark:text-emerald-400' 
                                            : parseFloat(selectedCustomer.current_debt || 0) > 0 
                                            ? 'text-rose-600 dark:text-rose-400' 
                                            : 'text-zinc-600 dark:text-zinc-400'
                                        }`}>
                                            {parseFloat(selectedCustomer.current_debt || 0) < 0 
                                            ? `له: ${Math.abs(parseFloat(selectedCustomer.current_debt || 0)).toLocaleString()}` 
                                            : parseFloat(selectedCustomer.current_debt || 0) > 0 
                                            ? `عليه: ${parseFloat(selectedCustomer.current_debt || 0).toLocaleString()}`
                                            : '0'} د.ع
                                        </p>
                                    </div>
                                </div>

                                {selectedCustomer.installment_monthly > 0 && (
                                    <div className="bg-gradient-to-r from-indigo-500/10 via-indigo-600/5 to-transparent border border-indigo-500/10 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                                <Icon name="calendar" className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">اتفاقية أقساط الزبون</h4>
                                                <p className="text-xs text-zinc-500 mt-0.5">
                                                    المقدمة: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{parseFloat(selectedCustomer.installment_downpayment || 0).toLocaleString()} د.ع</span>
                                                    {' | '}
                                                    القسط الشهري: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{parseFloat(selectedCustomer.installment_monthly || 0).toLocaleString()} د.ع</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-indigo-500/10 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-400">
                                            المتبقي التقريبي: {selectedCustomer.current_debt > 0 ? `${Math.ceil(selectedCustomer.current_debt / selectedCustomer.installment_monthly)} أشهر` : 'مسدد بالكامل'}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {/* Record New Payment Form */}
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                <Icon name="plus-circle" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            </span>
                                            تنزيل دفعة / تسديد قسط
                                        </h3>
                                        <form onSubmit={handleAddPayment} className="space-y-4">
                                            <div>
                                                <label className="block text-xs text-zinc-500 mb-1.5">مبلغ التسديد (د.ع) *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formatNumberWithCommas(paymentAmount)}
                                                    onChange={e => {
                                                        const clean = cleanCommaFormattedNumber(toEnglishDigits(e.target.value));
                                                        const converted = clean.replace(/[^0-9.]/g, '');
                                                        setPaymentAmount(converted);
                                                    }}
                                                    placeholder="مثال: 50000"
                                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 LTR_number"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-zinc-500 mb-1.5">ملاحظات / رقم الوصل</label>
                                                <input
                                                    type="text"
                                                    value={paymentNotes}
                                                    onChange={e => setPaymentNotes(e.target.value)}
                                                    placeholder="مثال: تسديد القسط الأول لشهر تموز"
                                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-zinc-500 mb-1.5">تاريخ الدفعة (اختياري - اتركه فارغاً لتسجيله بالوقت الحالي)</label>
                                                <input
                                                    type="datetime-local"
                                                    value={paymentDate}
                                                    onChange={e => setPaymentDate(e.target.value)}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer max-w-full"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                                            >
                                                {saving ? 'جاري الحفظ...' : '✅ تأكيد التسديد'}
                                            </button>
                                        </form>
                                    </div>

                                    {/* Payments History List */}
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                <Icon name="clock" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </span>
                                            سجل دفعات التسديد المستلمة
                                            <span className="mr-auto px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs rounded-full">{payments.length}</span>
                                        </h3>
                                        {paymentsLoading ? (
                                            <div className="flex justify-center py-8">
                                                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        ) : payments.length === 0 ? (
                                            <p className="text-center text-zinc-400 text-sm py-6">لم يتم تسديد أي مبالغ بعد</p>
                                        ) : (
                                            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                                {payments.map(p => (
                                                    <div key={p.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-between">
                                                        <div>
                                                            <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                                                                +{parseFloat(p.amount).toLocaleString()} د.ع
                                                            </p>
                                                            {p.notes && (
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">📝 {p.notes}</p>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-zinc-450 dark:text-zinc-500">
                                                            {new Date(p.payment_date).toLocaleDateString('ar-IQ')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            historyLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : history && (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {/* Sales History */}
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                <Icon name="shopping-cart" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            </span>
                                            سجل المشتريات
                                            <span className="mr-auto px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs rounded-full">{history.sales.length}</span>
                                        </h3>
                                        {history.sales.length === 0 ? (
                                            <p className="text-center text-zinc-400 text-sm py-6">لا توجد مشتريات مسجلة</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {history.sales.map(s => (
                                                    <div key={s.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">#{getShortId(s.id)}</p>
                                                                <p className="text-xs text-zinc-400">{new Date(s.date).toLocaleDateString('ar-IQ')}</p>
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{s.total.toLocaleString()} د.ع</p>
                                                                <p className="text-xs text-zinc-400">{s.payment === 'Cash' ? '💵 نقدي' : '🕒 آجل'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="pt-1.5 border-t border-zinc-200/50 dark:border-zinc-700/50 text-xs text-zinc-650 dark:text-zinc-350">
                                                            📦 {s.items}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Maintenance History */}
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                                <Icon name="wrench" className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            </span>
                                            سجل الصيانة
                                            <span className="mr-auto px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs rounded-full">{history.maintenance.length}</span>
                                        </h3>
                                        {history.maintenance.length === 0 ? (
                                            <p className="text-center text-zinc-400 text-sm py-6">لا توجد طلبات صيانة</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {history.maintenance.map(m => (
                                                    <div key={m.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-bold text-zinc-900 dark:text-white">{m.device}</p>
                                                                <p className="text-xs text-zinc-400">{new Date(m.date).toLocaleDateString('ar-IQ')}</p>
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="font-bold text-sm text-amber-600 dark:text-amber-400">{m.cost.toLocaleString()} د.ع</p>
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                                                    m.status === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                                    m.status === 'Repaired' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                                    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                }`}>
                                                                    {m.status === 'Delivered' ? '✅ مسلّم' : m.status === 'Repaired' ? '🔧 جاهز' : '🔍 قيد الفحص'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">إضافة زبون جديد</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all cursor-pointer">
                                <Icon name="x" className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">الاسم *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="اسم الزبون"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">رقم الهاتف</label>
                                <input
                                    type="text"
                                    value={form.phone}
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="07xxxxxxxxx"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">الدين السابق (دفتر الديون القديم)</label>
                                <input
                                    type="text"
                                    value={form.initial_debt}
                                    onChange={e => setForm(p => ({ ...p, initial_debt: e.target.value }))}
                                    placeholder="اكتب المبلغ المستحق سابقاً إن وجد"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">المقدمة المتفق عليها (د.ع)</label>
                                    <input
                                        type="text"
                                        value={form.installment_downpayment}
                                        onChange={e => setForm(p => ({ ...p, installment_downpayment: e.target.value }))}
                                        placeholder="مثال: 300000"
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">القسط الشهري (د.ع)</label>
                                    <input
                                        type="text"
                                        value={form.installment_monthly}
                                        onChange={e => setForm(p => ({ ...p, installment_monthly: e.target.value }))}
                                        placeholder="مثال: 50000"
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">ملاحظات</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="أي ملاحظات عن الزبون..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                                    إلغاء
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50">
                                    {saving ? 'جاري الحفظ...' : '💾 حفظ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">تعديل بيانات الزبون</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all cursor-pointer">
                                <Icon name="x" className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">الاسم *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">رقم الهاتف</label>
                                <input
                                    type="text"
                                    value={form.phone}
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">الدين السابق (دفتر الديون القديم)</label>
                                <input
                                    type="text"
                                    value={form.initial_debt}
                                    onChange={e => setForm(p => ({ ...p, initial_debt: e.target.value }))}
                                    placeholder="اكتب المبلغ المستحق سابقاً إن وجد"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">المقدمة المتفق عليها (د.ع)</label>
                                    <input
                                        type="text"
                                        value={form.installment_downpayment}
                                        onChange={e => setForm(p => ({ ...p, installment_downpayment: e.target.value }))}
                                        placeholder="مثال: 300000"
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">القسط الشهري (د.ع)</label>
                                    <input
                                        type="text"
                                        value={form.installment_monthly}
                                        onChange={e => setForm(p => ({ ...p, installment_monthly: e.target.value }))}
                                        placeholder="مثال: 50000"
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">ملاحظات</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                                    إلغاء
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50">
                                    {saving ? 'جاري الحفظ...' : '✅ تحديث'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
                            <Icon name="trash-2" className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                        </div>
                        <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white mb-2">حذف الزبون؟</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                            هل تريد حذف <strong>{deleteConfirm.name}</strong> من قاعدة البيانات؟<br />
                            <span className="text-rose-500">هذا الإجراء لا يمكن التراجع عنه.</span>
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                                إلغاء
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer transition-all">
                                تأكيد الحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Initial Debt Edit Modal */}
            {showInitialDebtModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">تعديل الدين السابق (القديم)</h3>
                            <button onClick={() => setShowInitialDebtModal(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all cursor-pointer">
                                <Icon name="x" className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveInitialDebt} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">الدين السابق المستحق (د.ع)</label>
                                <input
                                    type="text"
                                    required
                                    value={initialDebtValue}
                                    onChange={e => setInitialDebtValue(e.target.value)}
                                    placeholder="مثال: 150000"
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 LTR_number"
                                  />
                              </div>
                              <div className="flex gap-3 pt-2">
                                  <button type="button" onClick={() => setShowInitialDebtModal(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer">
                                      إلغاء
                                  </button>
                                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50">
                                      {saving ? 'جاري الحفظ...' : '💾 حفظ التغيير'}
                                  </button>
                              </div>
                          </form>
                      </div>
                  </div>
              )}

              {/* Bulk Import Modal - Table Grid Layout */}
              {showBulkModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden">
                          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/20">
                              <div>
                                  <h3 className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                                      <Icon name="users" className="w-5 h-5 text-indigo-600" />
                                      إدخال وإضافة زبائن متعددين معاً
                                  </h3>
                                  <p className="text-zinc-500 text-xs mt-1">املأ الجدول أدناه بالبيانات، ثم اضغط حفظ لإضافة جميع الزبائن دفعة واحدة.</p>
                              </div>
                              <button onClick={() => setShowBulkModal(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-all cursor-pointer">
                                  <Icon name="x" className="w-5 h-5" />
                              </button>
                          </div>
                          
                          <div className="p-6 space-y-4">
                              <div className="overflow-y-auto max-h-[380px] border border-zinc-200 dark:border-zinc-850 rounded-2xl">
                                  <table className="w-full text-right text-xs">
                                      <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-bold sticky top-0 z-10">
                                          <tr className="border-b border-zinc-250 dark:border-zinc-800">
                                              <th className="py-3 px-4 w-12 text-center">ت</th>
                                              <th className="py-3 px-4">اسم الزبون (مطلوب)</th>
                                              <th className="py-3 px-4">رقم الهاتف</th>
                                              <th className="py-3 px-4 w-40">الدين القديم السابق (د.ع)</th>
                                              <th className="py-3 px-4">ملاحظات</th>
                                              <th className="py-3 px-4 w-14 text-center">حذف</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-850 bg-white dark:bg-zinc-900">
                                          {bulkRows.map((row, index) => (
                                              <tr key={index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/10">
                                                  <td className="py-2.5 px-4 text-center font-bold text-zinc-400">{index + 1}</td>
                                                  <td className="py-2 px-3">
                                                      <input
                                                          type="text"
                                                          value={row.name}
                                                          onChange={e => {
                                                              const next = [...bulkRows];
                                                              next[index].name = e.target.value;
                                                              setBulkRows(next);
                                                          }}
                                                          placeholder="أحمد علي..."
                                                          className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                                      />
                                                  </td>
                                                  <td className="py-2 px-3">
                                                      <input
                                                          type="text"
                                                          value={row.phone}
                                                          onChange={e => {
                                                              const next = [...bulkRows];
                                                              next[index].phone = e.target.value;
                                                              setBulkRows(next);
                                                          }}
                                                          placeholder="077XXXXXXXX"
                                                          className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-center"
                                                      />
                                                  </td>
                                                  <td className="py-2 px-3">
                                                      <input
                                                          type="text"
                                                          value={row.initial_debt}
                                                          onChange={e => {
                                                              const next = [...bulkRows];
                                                              next[index].initial_debt = e.target.value;
                                                              setBulkRows(next);
                                                          }}
                                                          placeholder="0"
                                                          className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-left LTR_number"
                                                      />
                                                  </td>
                                                  <td className="py-2 px-3">
                                                      <input
                                                          type="text"
                                                          value={row.notes}
                                                          onChange={e => {
                                                              const next = [...bulkRows];
                                                              next[index].notes = e.target.value;
                                                              setBulkRows(next);
                                                          }}
                                                          placeholder="ملاحظات أخرى..."
                                                          className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                      />
                                                  </td>
                                                  <td className="py-2 px-4 text-center">
                                                      <button
                                                          type="button"
                                                          onClick={() => {
                                                              if (bulkRows.length === 1) return;
                                                              setBulkRows(bulkRows.filter((_, idx) => idx !== index));
                                                          }}
                                                          className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/30 rounded text-rose-500 transition-all cursor-pointer"
                                                      >
                                                          <Icon name="trash-2" className="w-4 h-4" />
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>

                              <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/40 p-4 border border-zinc-200 dark:border-zinc-850 rounded-2xl">
                                  <button
                                      type="button"
                                      onClick={() => setBulkRows([...bulkRows, { name: '', phone: '', initial_debt: '', notes: '' }])}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                  >
                                      <Icon name="plus" className="w-4 h-4" />
                                      أضف سطر جديد للجدول
                                  </button>
                                  <span className="text-zinc-500 text-xs font-bold">عدد الزبائن المطلوب إدخالهم: {bulkRows.filter(r => r.name.trim()).length} زبائن</span>
                              </div>

                              <div className="flex gap-3 pt-2">
                                  <button 
                                      type="button" 
                                      onClick={() => setShowBulkModal(false)} 
                                      className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                                  >
                                      إلغاء
                                  </button>
                                  <button 
                                      type="button" 
                                      disabled={saving || bulkRows.filter(r => r.name.trim()).length === 0} 
                                      onClick={async () => {
                                          setSaving(true);
                                          try {
                                              const payload = bulkRows
                                                  .filter(r => r.name.trim().length > 0)
                                                  .map(r => ({
                                                      name: r.name.trim(),
                                                      phone: r.phone ? r.phone.trim() : null,
                                                      initial_debt: parseFloat(toEnglishDigits(r.initial_debt)) || 0,
                                                      notes: r.notes ? r.notes.trim() : null,
                                                      installment_downpayment: 0,
                                                      installment_monthly: 0
                                                  }));

                                              const res = await axios.post('/customers/bulk/', payload);
                                              alert(`تم بنجاح استيراد وإضافة ${res.data.added_count} زبون إلى قاعدة البيانات!`);
                                              setShowBulkModal(false);
                                              setBulkRows([{ name: '', phone: '', initial_debt: '', notes: '' }]);
                                              fetchCustomers();
                                          } catch (err) {
                                              alert('حدث خطأ أثناء حفظ الزبائن، يرجى مراجعة وتدقيق المدخلات.');
                                          } finally {
                                              setSaving(false);
                                          }
                                      }}
                                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                                  >
                                      {saving ? 'جاري الحفظ والرفع...' : `💾 حفظ وإدخال جميع الأسماء`}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
        </div>
    );
}
