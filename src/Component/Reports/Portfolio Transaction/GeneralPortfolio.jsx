import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const Spinner = () => (
    <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
);

const formatCurrency = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function GeneralPortfolio({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [branchError, setBranchError] = useState(null);

    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaff, setSelectedStaff] = useState('ALL');

    useEffect(() => {
        let id = branch?.branchId || sessionStorage.getItem('branchId');
        if (id) {
            setBranchId(id);
            setBranchError(null);
        } else {
            setBranchError('Branch ID could not be determined. Please log in again.');
            setLoading(false);
        }
    }, [branch]);

    useEffect(() => {
        if (!branchId || branchError) return;

        setLoading(true);

        const qLoans = query(collection(db, 'loans'), where('branchId', '==', branchId));
        const qPayments = query(collection(db, 'payments'), where('branchId', '==', branchId));
        const qSavings = query(collection(db, 'savings'), where('branchId', '==', branchId));

        const unsubLoans = onSnapshot(qLoans, (snapshot) => {
            setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, err => console.error('Error fetching loans:', err));

        const unsubPayments = onSnapshot(qPayments, (snapshot) => {
            setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, err => console.error('Error fetching payments:', err));

        const unsubSavings = onSnapshot(qSavings, (snapshot) => {
            setSavings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, err => console.error('Error fetching savings:', err));

        return () => {
            unsubLoans();
            unsubPayments();
            unsubSavings();
        };
    }, [branchId, branchError]);

    // Build portfolio records matched to Staff Portfolio calculations
    const staffSummaries = useMemo(() => {
        const clientStaffMap = new Map();
        const clientGroupMap = new Map();

        loans.forEach(l => {
            const cId = String(l.clientId || '').trim();
            if (cId) {
                if (l.staffName) clientStaffMap.set(cId, l.staffName.trim());
                if (l.groupName || l.group) clientGroupMap.set(cId, (l.groupName || l.group).trim());
            }
        });

        payments.forEach(p => {
            const cId = String(p.clientId || '').trim();
            if (cId) {
                if (p.staffName && !clientStaffMap.has(cId)) clientStaffMap.set(cId, p.staffName.trim());
                if ((p.groupName || p.group) && !clientGroupMap.has(cId)) {
                    clientGroupMap.set(cId, (p.groupName || p.group).trim());
                }
            }
        });

        savings.forEach(s => {
            const cId = String(s.clientId || '').trim();
            if (cId && (s.groupName || s.group) && !clientGroupMap.has(cId)) {
                clientGroupMap.set(cId, (s.groupName || s.group).trim());
            }
        });

        // 1. Calculate individual client records first
        const portfolioMap = new Map();

        const getClientRecord = (cId, staffName) => {
            if (!portfolioMap.has(cId)) {
                portfolioMap.set(cId, {
                    clientId: cId,
                    staffName: staffName || 'Unassigned',
                    groupName: clientGroupMap.get(cId) || 'N/A',
                    principal: 0,
                    interestRate: 0,
                    totalRepaid: 0,
                    totalSavings: 0,
                });
            }
            return portfolioMap.get(cId);
        };

        loans.forEach(loan => {
            const cId = String(loan.clientId || '').trim();
            if (!cId) return;
            const staffName = loan.staffName?.trim() || 'Unassigned';
            const record = getClientRecord(cId, staffName);
            record.principal += parseFloat(loan.principal) || 0;
            record.interestRate = parseFloat(loan.interestRate) || record.interestRate;
        });

        payments.forEach(payment => {
            const cId = String(payment.clientId || '').trim();
            if (!cId) return;
            const staffName = payment.staffName?.trim() || clientStaffMap.get(cId) || 'Unassigned';
            const record = getClientRecord(cId, staffName);
            record.totalRepaid += parseFloat(payment.repaymentAmount) || 0;
            if (payment.interestRate && !record.interestRate) {
                record.interestRate = parseFloat(payment.interestRate) || 0;
            }
        });

        savings.forEach(sav => {
            const cId = String(sav.clientId || '').trim();
            if (!cId) return;
            const staffName = clientStaffMap.get(cId) || 'Unassigned';
            const record = getClientRecord(cId, staffName);
            const compulsory = parseFloat(sav.compulsoryAmount) || 0;
            const voluntary = parseFloat(sav.voluntarySavings) || 0;
            record.totalSavings += compulsory + voluntary;
        });

        // 2. Aggregate client outputs by staff name
        const staffMap = new Map();

        portfolioMap.forEach(client => {
            const staffName = client.staffName;
            if (!staffMap.has(staffName)) {
                staffMap.set(staffName, {
                    staffName,
                    clientSet: new Set(),
                    groupSet: new Set(),
                    totalPrincipal: 0,
                    totalPrincipalPlusInterest: 0,
                    totalRepaid: 0,
                    totalBalance: 0,
                    totalSavings: 0,
                });
            }

            const staffObj = staffMap.get(staffName);
            const interestAmt = (client.principal * client.interestRate) / 100;
            const principalPlusInterest = client.principal + interestAmt;
            const clientBal = principalPlusInterest - client.totalRepaid;

            staffObj.clientSet.add(client.clientId);
            if (client.groupName && client.groupName !== 'N/A') {
                staffObj.groupSet.add(client.groupName);
            }

            staffObj.totalPrincipal += client.principal;
            staffObj.totalPrincipalPlusInterest += principalPlusInterest;
            staffObj.totalRepaid += client.totalRepaid;
            staffObj.totalBalance += clientBal < 0 ? 0 : clientBal;
            staffObj.totalSavings += client.totalSavings;
        });

        return Array.from(staffMap.values()).map(record => ({
            ...record,
            totalClients: record.clientSet.size,
            totalGroups: record.groupSet.size,
        }));
    }, [loans, payments, savings]);

    const staffList = useMemo(() => staffSummaries.map(item => item.staffName).sort(), [staffSummaries]);

    const filteredSummaries = useMemo(() => {
        return staffSummaries.filter(item => {
            const matchesStaff = selectedStaff === 'ALL' || item.staffName.toLowerCase() === selectedStaff.toLowerCase();
            const queryText = searchTerm.toLowerCase().trim();
            const matchesSearch = !queryText || item.staffName.toLowerCase().includes(queryText);
            return matchesStaff && matchesSearch;
        });
    }, [staffSummaries, selectedStaff, searchTerm]);

    const grandTotals = useMemo(() => {
        const globalClients = new Set();
        const globalGroups = new Set();

        let totalPrincipal = 0;
        let totalPrincipalPlusInterest = 0;
        let totalRepaid = 0;
        let totalBalance = 0;
        let totalSavings = 0;

        filteredSummaries.forEach(curr => {
            curr.clientSet.forEach(c => globalClients.add(c));
            curr.groupSet.forEach(g => globalGroups.add(g));

            totalPrincipal += curr.totalPrincipal;
            totalPrincipalPlusInterest += curr.totalPrincipalPlusInterest;
            totalRepaid += curr.totalRepaid;
            totalBalance += curr.totalBalance;
            totalSavings += curr.totalSavings;
        });

        return {
            totalClients: globalClients.size,
            totalGroups: globalGroups.size,
            totalPrincipal,
            totalPrincipalPlusInterest,
            totalRepaid,
            totalBalance,
            totalSavings
        };
    }, [filteredSummaries]);

    const handlePrint = () => window.print();

    if (branchError) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <p className="font-semibold">{branchError}</p>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <style>
                {`
    @media print {
      /* 1. Force Landscape Page Orientation */
      @page {
        size: landscape;
        margin: 10mm;
      }

      /* 2. Hide everything by default */
      body * {
        visibility: hidden;
      }

      /* 3. Make only the table area and print header visible */
      .print-area,
      .print-area *,
      .print-header,
      .print-header * {
        visibility: visible;
      }

      /* 4. Position the printed table at the top left */
      .print-area {
        position: absolute;
        left: 0;
        top: 80px; /* Offset to leave room for the header */
        width: 100% !important;
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
      }

      .print-header {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        display: block !important;
        text-align: center;
      }

      /* 5. Styling adjustments for print clarity */
      body {
        background: white !important;
      }

      table {
        width: 100% !important;
        font-size: 11px !important;
        border-collapse: collapse !important;
      }

      th, td {
        border: 1px solid #cbd5e1 !important;
        padding: 6px 8px !important;
      }
    }
  `}
            </style>

            <div className="max-w-7xl mx-auto space-y-6">

                <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">General Portfolio Report</h1>
                        <p className="text-sm text-gray-500 mt-1">Summary of portfolio financials, groups, and clients grouped by Staff Name.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="w-full sm:w-56">
                            <label htmlFor="staffFilter" className="block text-xs font-semibold text-gray-600 uppercase mb-1">Filter By Staff</label>
                            <select
                                id="staffFilter"
                                value={selectedStaff}
                                onChange={(e) => setSelectedStaff(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                                <option value="ALL">All Staff Members ({staffList.length})</option>
                                {staffList.map((staff) => (
                                    <option key={staff} value={staff}>{staff}</option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full sm:w-56">
                            <label htmlFor="searchInput" className="block text-xs font-semibold text-gray-600 uppercase mb-1">Search Staff</label>
                            <input
                                id="searchInput"
                                type="text"
                                placeholder="Search Staff Name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>

                        <button
                            onClick={handlePrint}
                            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-sm"
                        >
                            Print Report
                        </button>
                    </div>
                </div>

                <div className="hidden print-header">
                    <h2 className="text-xl font-bold">General Portfolio Summary Report</h2>
                    <p className="text-xs text-gray-600">Branch ID: {branchId} | Generated Date: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="print-area bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <Spinner />
                    ) : filteredSummaries.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No portfolio records found matching your filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-semibold uppercase text-xs tracking-wider">
                                        <th className="p-4">Staff Name</th>
                                        <th className="p-4 text-center">Total Clients</th>
                                        <th className="p-4 text-center">Total Groups</th>
                                        <th className="p-4 text-right">Total Principal</th>
                                        <th className="p-4 text-right">Total Principal + Interest</th>
                                        <th className="p-4 text-right">Total Repaid</th>
                                        <th className="p-4 text-right">Total Balance</th>
                                        <th className="p-4 text-right">Total Savings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredSummaries.map((item) => (
                                        <tr key={item.staffName} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="p-4 font-semibold text-indigo-700">{item.staffName}</td>
                                            <td className="p-4 text-center font-medium text-gray-700">{item.totalClients}</td>
                                            <td className="p-4 text-center font-medium text-gray-700">{item.totalGroups}</td>
                                            <td className="p-4 text-right text-gray-800">{formatCurrency(item.totalPrincipal)}</td>
                                            <td className="p-4 text-right font-medium text-indigo-600">{formatCurrency(item.totalPrincipalPlusInterest)}</td>
                                            <td className="p-4 text-right font-medium text-emerald-600">{formatCurrency(item.totalRepaid)}</td>
                                            <td className="p-4 text-right font-semibold text-amber-600">{formatCurrency(item.totalBalance)}</td>
                                            <td className="p-4 text-right font-semibold text-purple-600">{formatCurrency(item.totalSavings)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-200/60 font-bold border-t-2 border-gray-300 text-gray-900">
                                        <td className="p-4 uppercase text-xs">Grand Total</td>
                                        <td className="p-4 text-center text-gray-900">{grandTotals.totalClients}</td>
                                        <td className="p-4 text-center text-gray-900">{grandTotals.totalGroups}</td>
                                        <td className="p-4 text-right">{formatCurrency(grandTotals.totalPrincipal)}</td>
                                        <td className="p-4 text-right text-indigo-700">{formatCurrency(grandTotals.totalPrincipalPlusInterest)}</td>
                                        <td className="p-4 text-right text-emerald-700">{formatCurrency(grandTotals.totalRepaid)}</td>
                                        <td className="p-4 text-right text-amber-700">{formatCurrency(grandTotals.totalBalance)}</td>
                                        <td className="p-4 text-right text-purple-700">{formatCurrency(grandTotals.totalSavings)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}