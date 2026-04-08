import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function StaffPerformanceReport() {
    const [branchId, setBranchId] = useState("");
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Resolve Branch ID
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(parsed.branchId);
            } catch {}
        });
    }, []);

    // 2. Fetch Global Data for Branch
    useEffect(() => {
        if (!branchId) return;

        const qLoans = query(collection(db, "loans"), where("branchId", "==", branchId));
        const qPayments = query(collection(db, "payments"), where("branchId", "==", branchId));

        const unsubLoans = onSnapshot(qLoans, (snap) => {
            setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubPayments = onSnapshot(qPayments, (snap) => {
            setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => { unsubLoans(); unsubPayments(); };
    }, [branchId]);

    // 3. Aggregate Performance Logic
    const performanceData = useMemo(() => {
        const staffMap = {};

        loans.forEach(loan => {
            const staff = loan.staffName || "Unassigned";
            const group = loan.groupName || "Individual";

            if (!staffMap[staff]) staffMap[staff] = {};
            if (!staffMap[staff][group]) {
                staffMap[staff][group] = {
                    clientsCount: new Set(),
                    principalTotal: 0,
                    interestTotal: 0,
                    paidTotal: 0,
                    savingsTotal: 0
                };
            }

            const metrics = staffMap[staff][group];
            metrics.clientsCount.add(loan.clientId || loan.fullName);
            metrics.principalTotal += parseFloat(loan.principal || 0);
            metrics.interestTotal += parseFloat(loan.interestAmount || 0);
        });

        // Add Payment Data (Repayments & Savings)
        payments.forEach(pay => {
            const staff = pay.staffName || "Unassigned";
            const group = pay.groupName || "Individual";

            if (staffMap[staff] && staffMap[staff][group]) {
                staffMap[staff][group].paidTotal += parseFloat(pay.repaymentAmount || 0);
                staffMap[staff][group].savingsTotal += parseFloat(pay.securityCollected || 0);
            }
        });

        return staffMap;
    }, [loans, payments]);

    if (loading) return <div className="p-10 text-center font-bold">Calculating Portfolio Performance...</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-lg shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase">Staff & Group Portfolio Tracking</h1>
                    <p className="text-sm text-gray-500 font-bold">Branch: {branchId}</p>
                </div>
                <button onClick={() => window.print()} className="no-print bg-blue-700 text-white px-8 py-2 rounded font-black hover:bg-blue-800">
                    PRINT PERFORMANCE
                </button>
            </div>

            {Object.entries(performanceData).map(([staffName, groups]) => {
                const groupList = Object.entries(groups);
                return (
                    <div key={staffName} className="mb-12 bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                        {/* STAFF HEADER */}
                        <div className="bg-gray-900 text-white p-6">
                            <h2 className="text-xl font-black uppercase tracking-widest">{staffName}</h2>
                            <p className="text-blue-400 font-bold text-xs uppercase mt-1">
                                Managing {groupList.length} Group(s)
                            </p>
                        </div>

                        {/* PERFORMANCE TABLE */}
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 border-b-2 border-gray-200 text-[10px] font-black uppercase text-gray-600">
                                <tr>
                                    <th className="p-4">GroupName</th>
                                    <th className="p-4 text-center">ClientsTotal</th>
                                    <th className="p-4 text-right">PrincipalTotal</th>
                                    <th className="p-4 text-right">InterestTotal</th>
                                    <th className="p-4 text-right">PaidBalance</th>
                                    <th className="p-4 text-right bg-blue-50 text-blue-900">Total Savings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {groupList.map(([groupName, stats]) => {
                                    const osBalance = (stats.principalTotal + stats.interestTotal) - stats.paidTotal;
                                    return (
                                        <tr key={groupName} className="hover:bg-gray-50">
                                            <td className="p-4 font-black text-gray-800 uppercase text-xs">{groupName}</td>
                                            <td className="p-4 text-center font-bold">{stats.clientsCount.size}</td>
                                            <td className="p-4 text-right tabular-nums">
                                                {stats.principalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 text-right tabular-nums">
                                                {stats.interestTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className={`p-4 text-right font-bold tabular-nums ${osBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {stats.paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-4 text-right font-black bg-blue-50/50 text-blue-900 tabular-nums">
                                                {stats.savingsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            <div className="hidden print:block mt-10 text-center text-[10px] font-bold text-gray-400">
                Performance Audit — LeoTech Academy Portfolio Management — {new Date().toLocaleDateString()}
            </div>
        </div>
    );
}