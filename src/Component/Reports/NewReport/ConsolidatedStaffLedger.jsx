import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../../../../firebase"; // Adjust based on your React structure
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function ProfessionalConsolidatedLedger() {
    const [branchId, setBranchId] = useState('');
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Initialize Branch ID from Session
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Listen to both collections simultaneously
    useEffect(() => {
        if (!branchId) return;

        const qPay = query(collection(db, "payments"), where("branchId", "==", branchId));
        const qSave = query(collection(db, "savings"), where("branchId", "==", branchId));

        const unsubPay = onSnapshot(qPay, (snap) => {
            setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSave = onSnapshot(qSave, (snap) => {
            setSavings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => { unsubPay(); unsubSave(); };
    }, [branchId]);

    // 3. Helper Functions for Formatting
    const getDayName = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long' });
    const formatDateFull = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // 4. Advanced Data Merging (The Tree Logic)
    const ledgerData = useMemo(() => {
        const tree = {};

        // Process Payments into Tree
        payments.forEach(pay => {
            const d = pay.date;
            const s = pay.staffName || "Unassigned";
            const g = pay.groupName || "Individual";

            if (!tree[d]) tree[d] = {};
            if (!tree[d][s]) tree[d][s] = {};
            if (!tree[d][s][g]) tree[d][s][g] = { security: 0, repaid: 0 };

            tree[d][s][g].repaid += parseFloat(pay.repaymentAmount || 0);
        });

        // Merge Savings into same Tree (Assuming savings has groupName/staffName)
        // If your savings collection lacks groupName, it defaults to "Individual"
        savings.forEach(save => {
            const d = save.date;
            const s = save.staffName || "Unassigned"; 
            const g = save.groupName || "Individual";

            if (!tree[d]) tree[d] = {};
            if (!tree[d][s]) tree[d][s] = {};
            if (!tree[d][s][g]) tree[d][s][g] = { security: 0, repaid: 0 };

            const totalSaved = parseFloat(save.compulsoryAmount || 0) + parseFloat(save.voluntarySavings || 0);
            tree[d][s][g].security += totalSaved;
        });

        // Convert Map to Sorted Array for Rendering
        return Object.keys(tree).sort((a, b) => new Date(b) - new Date(a)).map(date => ({
            date,
            staffMembers: tree[date]
        }));
    }, [payments, savings]);

    if (loading) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">GENERATING CONSOLIDATED LEDGER...</div>;

    return (
        <div className="p-6 bg-slate-100 min-h-screen font-sans text-slate-900">
            <div className="max-w-5xl mx-auto">
                
                {/* Header */}
                <div className="mb-6 flex justify-between items-end border-b-4 border-slate-900 pb-2">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Consolidated Ledger</h1>
                        <p className="text-xs font-bold text-slate-500 italic uppercase">Branch Report — {branchId}</p>
                    </div>
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 text-xs font-black uppercase rounded hover:bg-slate-700 transition-colors">Print Ledger</button>
                </div>

                {ledgerData.map((day) => {
                    let daySecurityTotal = 0;
                    let dayRepaidTotal = 0;

                    return (
                        <div key={day.date} className="mb-10 bg-white shadow-xl rounded-lg overflow-hidden border border-slate-300 print:break-inside-avoid">
                            {/* DAY HEADER */}
                            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                                <span className="text-xl font-black uppercase tracking-widest">{getDayName(day.date)}, {formatDateFull(day.date)}</span>
                                <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full uppercase font-bold">Verified Data</span>
                            </div>

                            {Object.entries(day.staffMembers).map(([staffName, groups]) => (
                                <div key={staffName} className="border-b-2 border-slate-100 last:border-b-0">
                                    <div className="bg-slate-50 px-6 py-2 border-b border-slate-200">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Field Officer:</span>
                                        <span className="ml-3 text-sm font-black text-indigo-900 uppercase">{staffName}</span>
                                    </div>

                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-white text-[10px] uppercase text-slate-400 font-black border-b">
                                                <th className="px-6 py-3 text-left w-1/3">Group Identity</th>
                                                <th className="px-6 py-3 text-center">Security (Savings)</th>
                                                <th className="px-6 py-3 text-center">Loan Repayment</th>
                                                <th className="px-6 py-3 text-right bg-slate-50">Total Collection</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {Object.entries(groups).map(([groupName, totals]) => {
                                                const groupTotal = totals.security + totals.repaid;
                                                daySecurityTotal += totals.security;
                                                dayRepaidTotal += totals.repaid;

                                                return (
                                                    <tr key={groupName} className="hover:bg-indigo-50/30 transition-colors">
                                                        <td className="px-6 py-3 text-sm font-bold text-slate-800 uppercase">{groupName}</td>
                                                        <td className="px-6 py-3 text-center text-sm font-mono font-bold text-orange-600">
                                                            {totals.security.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-center text-sm font-mono font-bold text-green-700">
                                                            {totals.repaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-sm font-mono font-black text-slate-900 bg-slate-50/50">
                                                            {groupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ))}

                            {/* DAILY SUMMARY FOOTER */}
                            <div className="bg-slate-900 text-white px-6 py-5 flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Close of Day Summary:</span>
                                <div className="flex gap-10">
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase text-slate-500 font-bold">Total Savings</p>
                                        <p className="font-mono font-bold text-orange-400">{daySecurityTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase text-slate-500 font-bold">Total Repaid</p>
                                        <p className="font-mono font-bold text-green-400">{dayRepaidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right border-l border-slate-700 pl-10">
                                        <p className="text-[9px] uppercase text-slate-500 font-bold">Grand Daily Collection</p>
                                        <p className="text-xl font-mono font-black text-white">
                                            {(daySecurityTotal + dayRepaidTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {ledgerData.length === 0 && (
                    <div className="bg-white p-20 text-center rounded-xl shadow-inner border-2 border-dashed">
                        <p className="text-slate-400 font-black uppercase tracking-widest">No transaction history available</p>
                    </div>
                )}
            </div>
        </div>
    );
}