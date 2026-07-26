import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from './Icon';
import { getShortId } from '../utils';

export default function ReturnsPage({ products, refresh }) {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchSales = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/sales/');
            // Sort sales by newest first
            const sorted = (res.data || []).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
            setSales(sorted);
        } catch (err) {
            console.error("Error fetching sales history:", err);
            setErrorMsg("خطأ في جلب سجل المبيعات.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
    }, []);

    const handleRefund = async (saleId, customerName, totalAmount) => {
        const confirmRefund = window.confirm(`هل أنت متأكد من استرجاع الفاتورة الخاصة بالزبون (${customerName || 'زبون نقدي'}) بقيمة ${parseFloat(totalAmount).toLocaleString()} د.ع؟\n\nسيتم إرجاع المواد للمخازن، وإلغاء القيد المحاسبي، وإعادة رصيد محفظة انتشار إذا كانت تحتوي على كروت.`);
        if (!confirmRefund) return;

        try {
            await axios.post(`/sales/${saleId}/refund/`);
            setSuccessMsg("تم استرجاع الفاتورة بنجاح وإعادة المواد للمخزن وتحديث الأرصدة! 🎉");
            setErrorMsg('');
            // Refresh list
            fetchSales();
            if (refresh) refresh();
        } catch (err) {
            const detail = err.response?.data?.detail || "حدث خطأ أثناء محاولة استرجاع الفاتورة.";
            setErrorMsg(typeof detail === 'object' ? JSON.stringify(detail) : detail);
            setSuccessMsg('');
        }
    };

    const filteredSales = sales.filter(s => {
        const query = searchQuery.toLowerCase();
        const matchesCustomer = (s.customer_name || 'زبون نقدي').toLowerCase().includes(query);
        const matchesId = String(s.id).toLowerCase().includes(query);
        const matchesItems = s.items && s.items.some(item => 
            (item.product?.name || '').toLowerCase().includes(query) ||
            (item.product?.brand || '').toLowerCase().includes(query)
        );
        return matchesCustomer || matchesId || matchesItems;
    });

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <div className="bg-white dark:bg-[#0c0c0f]/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
                <h3 className="font-bold text-lg text-rose-400 flex items-center gap-2 mb-2">
                    <Icon name="rotate-ccw" className="w-5 h-5 text-rose-400" />
                    استرجاع وإلغاء الفواتير والمبيعات
                </h3>
                <p className="text-xs text-zinc-400 mb-6">يمكنك هنا البحث عن أي فاتورة مبيعات سابقة واسترجاعها. سيقوم النظام تلقائياً بإرجاع البضاعة للمخزن، وتحديث الحسابات المالية، وإعادة رصيد محفظة انتشار المخصوم.</p>

                {/* Status Messages */}
                {errorMsg && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl mb-4 flex items-center gap-2">
                        <Icon name="alert-triangle" className="w-4 h-4" /> {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-sm rounded-2xl mb-4 flex items-center gap-2">
                        <Icon name="check-circle" className="w-4 h-4" /> {successMsg}
                    </div>
                )}

                {/* Search Bar */}
                <div className="relative mb-6">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="ابحث باسم الزبون، رقم الفاتورة، أو اسم المادة المبيعة..."
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-rose-500 text-zinc-800 dark:text-zinc-100"
                    />
                    <Icon name="search" className="w-5 h-5 text-zinc-400 absolute right-4 top-3.5" />
                </div>

                {/* Sales List */}
                {loading ? (
                    <div className="text-center py-12">
                        <Icon name="refresh-cw" className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-2" />
                        <span className="text-xs text-zinc-400">جاري تحميل سجل المبيعات...</span>
                    </div>
                ) : filteredSales.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-sm">
                        لا توجد فواتير مبيعات مطابقة للبحث.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSales.map(sale => (
                            <div key={sale.id} className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-rose-500/20 transition-all">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-mono font-bold bg-zinc-200 dark:bg-zinc-850 text-zinc-550 dark:text-zinc-400 px-2.5 py-0.5 rounded-lg">
                                            رقم الفاتورة: #{getShortId(sale.id)}
                                        </span>
                                        <span className="text-[11px] text-zinc-400 font-mono">
                                            {new Date(sale.sale_date).toLocaleString('ar-IQ')}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                            sale.payment_method === 'Cash' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            {sale.payment_method === 'Cash' ? 'نقدي' : 'آجل / أقساط'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                                        👤 العميل: {sale.customer_name || "زبون نقدي"}
                                    </h4>
                                    
                                    {/* Sale Items */}
                                    <div className="text-xs text-zinc-500 space-y-1 bg-white dark:bg-[#0c0c0f]/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-900">
                                        <div className="font-bold text-[10px] text-zinc-400 mb-1">المواد المبيعة بالفاتورة:</div>
                                        {sale.items && sale.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center gap-4">
                                                <span>• {item.product?.brand} - {item.product?.name}</span>
                                                <span className="font-mono text-zinc-400">{parseFloat(item.price).toLocaleString()} د.ع</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-200 dark:border-zinc-900">
                                    <div className="text-right">
                                        <div className="text-[10px] text-zinc-400">إجمالي الفاتورة</div>
                                        <div className="text-base font-mono font-bold text-rose-400">
                                            {parseFloat(sale.total_amount).toLocaleString()} د.ع
                                        </div>
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={() => handleRefund(sale.id, sale.customer_name, sale.total_amount)}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-600/10 flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Icon name="rotate-ccw" className="w-3.5 h-3.5" />
                                        استرجاع المبيعات
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
