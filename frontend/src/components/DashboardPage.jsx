import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getShopSettings } from '../App';
import { getShortId } from '../utils';

export default function DashboardPage({ accounts, entries, sales, products, setActiveReceiptToPrint, setCurrentTab }) {
    const [salesSearchQuery, setSalesSearchQuery] = useState('');
    const [dynamicReceivables, setDynamicReceivables] = useState(0);

    useEffect(() => {
        fetch('/customers/')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const total = data.reduce((sum, c) => sum + (parseFloat(c.current_debt) || 0), 0);
                    setDynamicReceivables(total);
                }
            })
            .catch(e => console.error("Error fetching customers receivables:", e));
    }, [entries, sales]);
    
    const calculateTotals = () => {
        let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
        let cashInBox = 0;

        accounts.forEach(acc => {
            let bal = 0;
            entries.forEach(entry => {
                entry.items.forEach(item => {
                    if (item.account_id === acc.id) {
                        bal += (parseFloat(item.debit) - parseFloat(item.credit));
                    }
                });
            });

            if (acc.type === 'Asset') {
                assets += bal;
                if (acc.code === '1010') cashInBox += bal;
            }
            else if (acc.type === 'Liability') liabilities += -bal;
            else if (acc.type === 'Equity') equity += -bal;
            else if (acc.type === 'Revenue') revenue += -bal;
            else if (acc.type === 'Expense') expenses += bal;
        });

        return { assets, liabilities, equity, revenue, expenses, cashInBox, receivables: dynamicReceivables };
    };

    const totals = calculateTotals();
    const totalStockItems = products.reduce((acc, p) => acc + p.items.filter(i => i.status === 'Available').length, 0);
    const netProfit = totals.revenue - totals.expenses;
    
    const s = getShopSettings();
    const currency = s.currency || 'د.ع';

    return (
        <div className="space-y-6">
            {/* Top Row Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs font-bold block mb-1">المبيعات الإجمالية</span>
                        <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate font-mono">
                            {totals.revenue.toLocaleString()} <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">{currency}</span>
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Icon name="trending-up" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                </div>

                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs font-bold block mb-1">الكاش في الصندوق</span>
                        <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 truncate font-mono">
                            {totals.cashInBox.toLocaleString()} <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">{currency}</span>
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-sky-500/10 flex items-center justify-center">
                        <Icon name="wallet" className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                </div>

                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs font-bold block mb-1">ديون العملاء (Credit)</span>
                        <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 truncate font-mono">
                            {totals.receivables.toLocaleString()} <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">{currency}</span>
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <Icon name="users" className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                </div>

                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
                    <div>
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs font-bold block mb-1">صافي الأرباح المقدرة</span>
                        <div className={`text-2xl font-extrabold truncate font-mono ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {netProfit.toLocaleString()} <span className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">{currency}</span>
                        </div>
                    </div>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                        <Icon name="pie-chart" className={`w-5 h-5 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
                    </div>
                </div>
            </div>

            {/* Secondary Row Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Warehouse Status */}
                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between h-[400px]">
                    <div>
                        <h3 className="font-bold text-base mb-5 text-emerald-600 dark:text-emerald-450 flex items-center gap-2">
                            <Icon name="package" className="w-4 h-4" />
                            حالة المخزن المتوفر
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800/60 pb-3">
                                <span className="text-zinc-650 dark:text-zinc-300 text-sm">إجمالي الأجهزة للبيع</span>
                                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">{totalStockItems} جهاز</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800/60 pb-3">
                                <span className="text-zinc-650 dark:text-zinc-300 text-sm">إجمالي قيمة المخزن</span>
                                <span className="font-extrabold text-sm text-sky-600 dark:text-sky-400 font-mono">
                                    {products.reduce((acc, p) => acc + (parseFloat(p.purchase_price) * p.items.filter(i => i.status === 'Available').length), 0).toLocaleString()} <span className="text-xs font-bold text-zinc-500">{currency}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between h-[400px]">
                    <div>
                        <h3 className="font-bold text-base mb-4 text-rose-600 dark:text-rose-450 flex items-center gap-2">
                            <Icon name="alert-triangle" className="w-4 h-4" />
                            بضائع توشك على النفاد (الكمية 2 أو أقل)
                        </h3>
                        <div className="space-y-2.5 overflow-y-auto max-h-[290px] pr-1">
                            {products.filter(p => p.type !== 'Maintenance').map(p => {
                                const availableCount = p.items.filter(i => i.status === 'Available').length;
                                return { product: p, count: availableCount };
                            }).filter(x => x.count <= 2).map(x => (
                                <div key={x.product.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-900 rounded-xl">
                                    <div>
                                        <div className="font-bold text-[11px] text-zinc-800 dark:text-zinc-200">{x.product.brand} - {x.product.name}</div>
                                        <div className="text-[9px] text-zinc-500 mt-0.5">{x.product.type === 'Phone' ? 'موبايل' : 'إكسسوار'}</div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                        x.count === 0 
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    }`}>
                                        {x.count === 0 ? 'نافذ تماماً' : `متبقي: ${x.count}`}
                                    </span>
                                </div>
                            ))}
                            {products.filter(p => p.type !== 'Maintenance').map(p => {
                                return p.items.filter(i => i.status === 'Available').length;
                            }).filter(c => c <= 2).length === 0 && (
                                <div className="text-center py-12 text-zinc-500 text-xs">
                                    🟢 كل البضائع متوفرة بكميات كافية في المخزن!
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sales Invoices History */}
                <div className="p-6 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm h-[400px] flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-base text-emerald-600 dark:text-emerald-450 flex items-center gap-2">
                                <Icon name="receipt" className="w-4 h-4" />
                                سجل فواتير المبيعات
                            </h3>
                            <input 
                                type="text"
                                placeholder="بحث بالفواتير..."
                                value={salesSearchQuery}
                                onChange={e => setSalesSearchQuery(e.target.value)}
                                className="w-36 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-3 overflow-y-auto max-h-[290px] pr-1">
                            {sales.filter(sale => 
                                (sale.customer_name || '').toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
                                ('INV-' + getShortId(sale.id)).toLowerCase().includes(salesSearchQuery.toLowerCase())
                            ).slice().reverse().map(sale => (
                                <div 
                                    key={sale.id} 
                                    onClick={() => {
                                        const formattedItems = (sale.items || []).map(si => ({
                                            brand: si.product?.brand || '',
                                            name: si.product?.name || '',
                                            price: si.price,
                                            imei: si.inventory_item?.imei || '',
                                            battery_health: si.inventory_item?.battery_health || null
                                        }));
                                        setActiveReceiptToPrint({
                                            id: sale.id,
                                            type: (sale.items || []).every(si => si.product?.type === 'Maintenance') ? 'maintenance' : 'sale',
                                            date: new Date(sale.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                                            customer: sale.customer_name || "زبون نقدي",
                                            customerPhone: sale.customer_phone || "",
                                            paymentMethod: sale.payment_method,
                                            items: formattedItems,
                                            total: sale.total_amount,
                                            maintenanceNote: sale.maintenance_note || '',
                                            warrantyDays: sale.warranty_days || '30'
                                        });
                                    }}
                                    className="p-4 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl flex justify-between items-center cursor-pointer transition-all duration-200"
                                >
                                    <div>
                                        <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">INV-{getShortId(sale.id)} - {sale.customer_name || 'زبون نقدي'}</div>
                                        <div className="text-[10px] text-zinc-500 mt-1 font-mono">{new Date(sale.sale_date).toLocaleDateString('en-GB')}</div>
                                    </div>
                                    <div className="text-left flex flex-col items-end gap-1">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                            sale.payment_method === 'Cash' 
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/10' 
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/10'
                                        }`}>{sale.payment_method === 'Cash' ? 'نقداً' : 'آجل'}</span>
                                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">{parseFloat(sale.total_amount).toLocaleString()} {currency}</div>
                                    </div>
                                </div>
                            ))}
                            {sales.length === 0 && (
                                <div className="text-center text-zinc-500 py-12 flex flex-col items-center justify-center gap-2">
                                    <Icon name="inbox" className="w-8 h-8 text-zinc-700 dark:text-zinc-500" />
                                    <span className="text-sm">لم يتم إجراء أي عملية بيع بعد.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
