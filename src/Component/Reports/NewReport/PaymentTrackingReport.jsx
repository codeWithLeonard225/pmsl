import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function PaymentTracking() {
    const [branchId, setBranchId] = useState("");
    const [payments, setPayments] = useState([]);
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
        const q = query(collection(db, "payments"), where("branchId", "==", branchId));
        const unsub = onSnapshot(q, (snap) => {
            setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [branchId]);

    // ---------------------------------------------------------
    // CUSTOM DATE FORMATTER: "January 3 Friday 2026"
    // ---------------------------------------------------------
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const dateObj = new Date(dateStr);
        
        // Check for invalid date
        if (isNaN(dateObj.getTime())) return dateStr;

        const month = dateObj.toLocaleDateString('en-GB', { month: 'long' });
        const dayNum = dateObj.getDate();
        const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
        const year = dateObj.getFullYear();

        return `${month} ${dayNum} ${weekday} ${year}`;
    };

    const reportData = useMemo(() => {
        const staffMap = {};
        payments.forEach(pay => {
            const staff = pay.staffName || "Unassigned";
            const date = pay.date || "No Date";
            const group = pay.groupName || "Individual";
            const repaid = parseFloat(pay.repaymentAmount || 0);
            const savings = parseFloat(pay.securityCollected || 0);

            if (!staffMap[staff]) staffMap[staff] = {};
            if (!staffMap[staff][date]) staffMap[staff][date] = {};
            if (!staffMap[staff][date][group]) {
                staffMap[staff][date][group] = {
                    clients: new Set(),
                    totalRepaid: 0,
                    totalSavings: 0
                };
            }

            staffMap[staff][date][group].clients.add(pay.fullName || pay.id);
            staffMap[staff][date][group].totalRepaid += repaid;
            staffMap[staff][date][group].totalSavings += savings;
        });
        return staffMap;
    }, [payments]);

    if (loading) return <div className="p-10 text-center italic text-gray-500">Loading Tracking Report...</div>;

    return (
        <div className="p-6 bg-gray-50 min-h-screen font-sans">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
                    Payment Tracking Ledger
                </h1>
                <div className="text-xs font-bold text-gray-400 uppercase">
                    Branch: {branchId}
                </div>
            </div>
            
            {Object.entries(reportData).map(([staff, dateData]) => (
                <div key={staff} className="mb-10 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
                        <h2 className="font-bold uppercase tracking-widest text-sm">
                            Staff: <span className="text-blue-400 ml-2">{staff}</span>
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left">Date</th>
                                    <th className="px-6 py-4 text-left">Group Name</th>
                                    <th className="px-6 py-4 text-center">Count</th>
                                    <th className="px-6 py-4 text-right">Repaid (SLE)</th>
                                    <th className="px-6 py-4 text-right">Savings (SLE)</th>
                                    <th className="px-6 py-4 text-right bg-blue-50 text-blue-900 font-black">Sub-Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(dateData).map(([date, groups]) => 
                                    Object.entries(groups).map(([group, stats], idx) => {
                                        const subTotal = stats.totalRepaid + stats.totalSavings;
                                        return (
                                            <tr key={`${date}-${group}`} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-6 py-4 font-bold text-blue-900 whitespace-nowrap">
                                                    {idx === 0 ? formatDate(date) : ""}
                                                </td>
                                                <td className="px-6 py-4 font-black text-gray-700 uppercase">
                                                    {group}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">
                                                        {stats.clients.size}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums font-medium">
                                                    {stats.totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums font-medium">
                                                    {stats.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black bg-blue-50/50 text-blue-900">
                                                    {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}