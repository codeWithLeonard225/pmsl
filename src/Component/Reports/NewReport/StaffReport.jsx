import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function StaffReportLedger() {
    const [branchId, setBranchId] = useState("");
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]); // New state for savings
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(parsed.branchId);
            } catch {}
        });
    }, []);

    useEffect(() => {
        if (!branchId) return;

        // Query both collections
        const qPay = query(collection(db, "payments"), where("branchId", "==", branchId));
        const qSav = query(collection(db, "savings"), where("branchId", "==", branchId));

        const unsubPay = onSnapshot(qPay, (snap) => {
            setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSav = onSnapshot(qSav, (snap) => {
            setSavings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => { unsubPay(); unsubSav(); };
    }, [branchId]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const dateObj = new Date(dateStr);
        const parts = new Intl.DateTimeFormat('en-GB', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        }).formatToParts(dateObj);
        const p = {};
        parts.forEach(({ type, value }) => { p[type] = value; });
        return `${p.month} ${p.day} ${p.weekday} ${p.year}`;
    };

   const ledgerData = useMemo(() => {
        const staffMap = {};

        const ensurePath = (staff, group, date) => {
            if (!staffMap[staff]) staffMap[staff] = {};
            if (!staffMap[staff][group]) staffMap[staff][group] = {};
            if (!staffMap[staff][group][date]) {
                staffMap[staff][group][date] = { clients: new Set(), repaid: 0, savings: 0 };
            }
        };

        // 1. Process Payments
        payments.forEach(pay => {
            const staff = (pay.staffName || "Unassigned").toUpperCase();
            const group = (pay.groupName || "Individual").toUpperCase();
            const date = pay.date || "No Date";
            ensurePath(staff, group, date);
            staffMap[staff][group][date].clients.add(pay.clientId || pay.id);
            staffMap[staff][group][date].repaid += parseFloat(pay.repaymentAmount || 0);
        });

        // 2. Process Savings
        savings.forEach(sav => {
            const staff = (sav.staffName || "Unassigned").toUpperCase();
            const group = (sav.groupName || "Individual").toUpperCase();
            const date = sav.date || "No Date";
            ensurePath(staff, group, date);
            staffMap[staff][group][date].clients.add(sav.clientId || sav.id);
            const totalSav = parseFloat(sav.compulsoryAmount || 0) + parseFloat(sav.voluntarySavings || 0);
            staffMap[staff][group][date].savings += totalSav;
        });

        return staffMap;
    }, [payments, savings]);

    // Helper function to sort dates biggest to smallest
    const getSortedDates = (datesObj) => {
        return Object.entries(datesObj).sort((a, b) => {
            // Sort "No Date" to the bottom, otherwise sort by date value descending
            if (a[0] === "No Date") return 1;
            if (b[0] === "No Date") return -1;
            return new Date(b[0]) - new Date(a[0]);
        });
    };

    if (loading) return <div className="p-10 text-center text-gray-400 italic">Generating Staff Ledger...</div>;

    return (
        <div className="p-4 md:p-10 bg-white min-h-screen">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center border-b-4 border-black pb-4 mb-8">
                    <h1 className="text-3xl font-black uppercase tracking-tighter">Staff Report Ledger</h1>
                    <button onClick={() => window.print()} className="print:hidden border-2 border-black px-4 py-1 font-bold hover:bg-black hover:text-white transition-all">
                        PRINT LEDGER
                    </button>
                </div>

                {Object.entries(ledgerData).map(([staff, groups]) => (
                    <div key={staff} className="mb-16 print:break-inside-avoid">
                        {Object.entries(groups).map(([group, dates]) => (
                            <div key={group} className="mb-10 border-t-2 border-gray-100 pt-6">
                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <div className="flex gap-4">
                                        <span className="font-bold text-gray-400 uppercase">Field Staff</span>
                                        <span className="font-black text-gray-900 border-b border-black w-full">{staff}</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="font-bold text-gray-400 uppercase">Group</span>
                                        <span className="font-black text-gray-900 border-b border-black w-full">{group}</span>
                                    </div>
                                </div>

                                <table className="w-full text-left mb-4">
                                    <thead>
                                        <tr className="border-b-2 border-gray-800 text-[11px] uppercase font-black text-gray-500">
                                            <th className="py-2">Collection Date</th>
                                            <th className="py-2 text-center">Client Count</th>
                                            <th className="py-2 text-right">Repaid (SLE)</th>
                                            <th className="py-2 text-right">Savings (SLE)</th>
                                            <th className="py-2 text-right">Sub-Total</th>
                                        </tr>
                                    </thead>
                                 <tbody className="divide-y divide-gray-100">
    {/* Use the sort helper here */}
    {getSortedDates(dates).map(([date, stats]) => {
        const subTotal = stats.repaid + stats.savings;
        return (
            <tr key={date} className="text-sm">
                <td className="py-3 font-semibold text-gray-700">{formatDate(date)}</td>
                <td className="py-3 text-center font-bold text-gray-500">{stats.clients.size}</td>
                <td className="py-3 text-right tabular-nums">
                    {stats.repaid.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td className="py-3 text-right tabular-nums text-blue-600 font-medium">
                    {stats.savings.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td className="py-3 text-right font-black text-gray-900 bg-gray-50/50">
                    SLE {subTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
            </tr>
        );
    })}
</tbody>
                                </table>
                                
                                <div className="flex justify-end pr-0">
                                    <div className="bg-black text-white px-4 py-2 text-xs font-bold uppercase">
                                        Total for {group}: SLE {Object.values(dates).reduce((acc, curr) => acc + (curr.repaid + curr.savings), 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}