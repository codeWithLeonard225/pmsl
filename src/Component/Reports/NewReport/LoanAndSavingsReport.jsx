import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../../../../firebase"; 
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const ConsolidatedDailyReport = () => {
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [branchId, setBranchId] = useState('');
    const [loading, setLoading] = useState(true);

    // 1. Get Branch ID
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Dual Listeners (Payments & Savings)
    useEffect(() => {
        if (!branchId) return;

        const qPayments = query(collection(db, "payments"), where("branchId", "==", branchId));
        const qSavings = query(collection(db, "savings"), where("branchId", "==", branchId));

        const unsubPayments = onSnapshot(qPayments, (snap) => {
            setPayments(snap.docs.map(doc => doc.data()));
        });

        const unsubSavings = onSnapshot(qSavings, (snap) => {
            setSavings(snap.docs.map(doc => doc.data()));
            setLoading(false);
        });

        return () => { unsubPayments(); unsubSavings(); };
    }, [branchId]);

    // 3. Merging Logic: Group by Date
    const dailyData = useMemo(() => {
        const masterMap = {};

        // Process Payments
        payments.forEach(p => {
            const d = p.date;
            if (!masterMap[d]) masterMap[d] = { savings: 0, repaid: 0 };
            masterMap[d].repaid += parseFloat(p.repaymentAmount || 0);
        });

        // Process Savings (Compulsory + Voluntary)
        savings.forEach(s => {
            const d = s.date;
            if (!masterMap[d]) masterMap[d] = { savings: 0, repaid: 0 };
            const totalSaved = parseFloat(s.compulsoryAmount || 0) + parseFloat(s.voluntarySavings || 0);
            masterMap[d].savings += totalSaved;
        });

        // Convert Map to Sorted Array
        return Object.keys(masterMap)
            .sort((a, b) => new Date(b) - new Date(a)) // Newest first
            .map(date => ({
                date,
                day: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
                savingsTotal: masterMap[date].savings,
                repaidTotal: masterMap[date].repaid,
                dailyTotal: masterMap[date].savings + masterMap[date].repaid
            }));
    }, [payments, savings]);

    if (loading) return <div className="p-10 text-center font-bold uppercase">Consolidating Ledger...</div>;

    return (
        <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
            <div className="max-w-5xl mx-auto bg-white shadow-xl border border-gray-200 rounded-lg overflow-hidden">
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-widest">Consolidated Daily Ledger</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Branch: {branchId}</p>
                    </div>
                    <button onClick={() => window.print()} className="bg-white text-slate-900 px-4 py-2 text-xs font-black rounded hover:bg-slate-200 print:hidden">
                        PRINT PDF
                    </button>
                </div>

                {/* Report Table */}
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b border-gray-300 text-[11px] font-black text-slate-500 uppercase">
                            <th className="px-6 py-4">Day</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4 text-center">Savings Saved</th>
                            <th className="px-6 py-4 text-center">Total Repaid</th>
                            <th className="px-6 py-4 text-right bg-slate-200 text-slate-900">Daily Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {dailyData.map((row, index) => (
                            <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-600">{row.day}</td>
                                <td className="px-6 py-4 font-mono text-sm">{row.date}</td>
                                <td className="px-6 py-4 text-center font-mono font-bold text-blue-600">
                                    {row.savingsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 text-center font-mono font-bold text-green-600">
                                    {row.repaidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-black text-slate-900 bg-slate-50">
                                    {row.dailyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {dailyData.length === 0 && (
                    <div className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest">
                        No transactions found for this branch
                    </div>
                )}

                {/* Footer Summary */}
                <div className="bg-slate-900 p-6 text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-4">Grand Total Collection:</span>
                    <span className="text-2xl font-mono font-black text-white">
                        {dailyData.reduce((acc, curr) => acc + curr.dailyTotal, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ConsolidatedDailyReport;