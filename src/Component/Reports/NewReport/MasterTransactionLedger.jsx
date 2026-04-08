import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { FaPrint, FaBook, FaUserTie, FaUsers } from "react-icons/fa";

export default function MasterTransactionLedger() {
    const [branchId, setBranchId] = useState("");
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    // ----------------------------------------
    // GET BRANCH FROM SESSION
    // ----------------------------------------
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(parsed.branchId);
            } catch {}
        });
    }, []);

    // ----------------------------------------
    // FETCH DATA
    // ----------------------------------------
    useEffect(() => {
        if (!branchId) return;

        const q = query(
            collection(db, "payments"),
            where("branchId", "==", branchId)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setPayments(data);
            setLoading(false);
        });

        return () => unsub();
    }, [branchId]);

    // ----------------------------------------
    // BUILD NESTED DATA TREE
    // ----------------------------------------
    const ledger = useMemo(() => {
        const tree = {};

        payments.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((pay) => {
            const date = pay.date;
            const staff = pay.staffName || "Unassigned Staff";
            const group = pay.groupName || "Individual";
            const client = pay.fullName || "Unknown Client";

            const savings = parseFloat(pay.securityCollected || 0);
            const repaid = parseFloat(pay.repaymentAmount || 0);

            if (!tree[date]) tree[date] = {};
            if (!tree[date][staff]) tree[date][staff] = {};
            if (!tree[date][staff][group]) tree[date][staff][group] = {};
            if (!tree[date][staff][group][client]) {
                tree[date][staff][group][client] = { savings: 0, repaid: 0 };
            }

            tree[date][staff][group][client].savings += savings;
            tree[date][staff][group][client].repaid += repaid;
        });

        return tree;
    }, [payments]);

    const formatDate = (d) =>
        new Date(d).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
        });

    if (loading) return (
        <div className="flex justify-center items-center h-screen font-sans text-gray-500">
            <div className="animate-spin mr-3">🌀</div> Generating Ledger...
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen font-sans text-gray-800">
            {/* HEADER AREA */}
            <div className="flex justify-between items-center mb-8 border-b-2 border-blue-600 pb-4 no-print">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-3 rounded-lg text-white text-2xl">
                        <FaBook />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight text-blue-900">Master Ledger</h1>
                        <p className="text-sm text-gray-500 font-medium">Branch ID: {branchId}</p>
                    </div>
                </div>
                <button 
                    onClick={() => window.print()}
                    className="flex items-center bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-md transition-all shadow-lg text-sm font-bold"
                >
                    <FaPrint className="mr-2" /> PRINT REPORT
                </button>
            </div>

            {Object.entries(ledger).map(([date, staffData]) => (
                <div key={date} className="mb-12 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden break-after-page">
                    
                    {/* DATE STRIP */}
                    <div className="bg-blue-900 text-white px-6 py-3 flex justify-between items-center">
                        <h2 className="text-lg font-bold tracking-wide">{formatDate(date)}</h2>
                        <span className="text-xs bg-blue-700 px-2 py-1 rounded">Daily Summary</span>
                    </div>

                    {Object.entries(staffData).map(([staff, groupData]) => (
                        <div key={staff} className="p-6 border-b last:border-b-0">
                            {/* STAFF HEADER */}
                            <div className="flex items-center text-blue-800 mb-4">
                                <FaUserTie className="mr-2" />
                                <h3 className="font-bold uppercase text-sm tracking-widest">Officer: {staff}</h3>
                            </div>

                            {Object.entries(groupData).map(([group, clients]) => {
                                let gSavings = 0;
                                let gRepaid = 0;

                                return (
                                    <div key={group} className="ml-0 md:ml-6 mb-8 last:mb-0">
                                        {/* GROUP HEADER */}
                                        <div className="flex items-center text-gray-600 mb-2 italic">
                                            <FaUsers className="mr-2 text-xs" />
                                            <span className="text-sm font-semibold">Group: {group}</span>
                                        </div>

                                        <div className="overflow-x-auto rounded-lg border border-gray-100 shadow-sm">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3 border-b">Client Full Name</th>
                                                        <th className="px-4 py-3 border-b text-right text-purple-700">Savings (NLe)</th>
                                                        <th className="px-4 py-3 border-b text-right text-blue-700">Repayment (NLe)</th>
                                                        <th className="px-4 py-3 border-b text-right bg-gray-100">Total Inflow</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {Object.entries(clients).map(([client, vals]) => {
                                                        const rowTotal = vals.savings + vals.repaid;
                                                        gSavings += vals.savings;
                                                        gRepaid += vals.repaid;

                                                        return (
                                                            <tr key={client} className="hover:bg-blue-50/50 transition-colors">
                                                                <td className="px-4 py-3 font-medium text-gray-900">{client}</td>
                                                                <td className="px-4 py-3 text-right tabular-nums">{vals.savings.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right tabular-nums">{vals.repaid.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-bold tabular-nums bg-gray-50/50">
                                                                    {rowTotal.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-blue-50/30 font-black">
                                                    <tr>
                                                        <td className="px-4 py-3 text-blue-900 uppercase text-[10px]">Group Sub-Total</td>
                                                        <td className="px-4 py-3 text-right text-purple-800">{gSavings.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-blue-800">{gRepaid.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-green-800 bg-green-50">
                                                            {(gSavings + gRepaid).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}

            {/* PRINT STYLES */}
            <style jsx>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; }
                    .break-after-page { page-break-after: always; }
                    table { border: 1px solid #eee !important; }
                    th { background-color: #f9fafb !important; color: black !important; }
                    .bg-blue-900 { background-color: #1e3a8a !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
}