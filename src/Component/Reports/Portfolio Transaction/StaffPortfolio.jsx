import React, { useState, useEffect, useMemo } from 'react';
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const Spinner = () => (
    <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" role="status">
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);

export default function StaffPortfolio({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [branchIdError, setBranchIdError] = useState(null);

    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);

    const [loading, setLoading] = useState(true);
    const [selectedStaff, setSelectedStaff] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let id = branch?.branchId || sessionStorage.getItem("branchId");

        if (id) {
            setBranchId(id);
            setBranchIdError(null);
        } else {
            setBranchIdError("Branch ID could not be determined. Please log in again.");
            setLoading(false);
        }
    }, [branch]);

    useEffect(() => {
        if (!branchId || branchIdError) return;

        setLoading(true);

        const loansQ = query(collection(db, "loans"), where("branchId", "==", branchId));
        const paymentsQ = query(collection(db, "payments"), where("branchId", "==", branchId));
        const savingsQ = query(collection(db, "savings"), where("branchId", "==", branchId));

        const unsubLoans = onSnapshot(loansQ, (snapshot) => {
            setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubPayments = onSnapshot(paymentsQ, (snapshot) => {
            setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSavings = onSnapshot(savingsQ, (snapshot) => {
            setSavings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => {
            unsubLoans();
            unsubPayments();
            unsubSavings();
        };
    }, [branchId, branchIdError]);

    const { portfolioList, staffList } = useMemo(() => {
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

        const staffSet = new Set();
        const portfolioMap = new Map();

        const getClientRecord = (cId, defaultName, staffName, groupName) => {
            if (!portfolioMap.has(cId)) {
                portfolioMap.set(cId, {
                    clientId: cId,
                    clientName: defaultName || 'N/A',
                    groupName: groupName || clientGroupMap.get(cId) || 'N/A',
                    staffName: staffName || 'Unassigned',
                    disbursementDate: 'N/A',
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
            const groupName = loan.groupName?.trim() || loan.group?.trim() || clientGroupMap.get(cId) || 'N/A';
            staffSet.add(staffName);

            const record = getClientRecord(cId, loan.clientName, staffName, groupName);
            const principal = parseFloat(loan.principal) || 0;

            record.principal += principal;
            record.interestRate = parseFloat(loan.interestRate) || record.interestRate;
            if (loan.disbursementDate && (record.disbursementDate === 'N/A' || loan.disbursementDate < record.disbursementDate)) {
                record.disbursementDate = loan.disbursementDate;
            }
        });

        payments.forEach(payment => {
            const cId = String(payment.clientId || '').trim();
            if (!cId) return;

            const staffName = payment.staffName?.trim() || clientStaffMap.get(cId) || 'Unassigned';
            const groupName = payment.groupName?.trim() || payment.group?.trim() || clientGroupMap.get(cId) || 'N/A';
            staffSet.add(staffName);

            const record = getClientRecord(cId, payment.fullName, staffName, groupName);
            record.totalRepaid += parseFloat(payment.repaymentAmount) || 0;
            if (payment.interestRate && !record.interestRate) {
                record.interestRate = parseFloat(payment.interestRate) || 0;
            }
        });

        savings.forEach(sav => {
            const cId = String(sav.clientId || '').trim();
            if (!cId) return;

            const staffName = clientStaffMap.get(cId) || 'Unassigned';
            const groupName = sav.groupName?.trim() || sav.group?.trim() || clientGroupMap.get(cId) || 'N/A';
            staffSet.add(staffName);

            const record = getClientRecord(cId, sav.clientName, staffName, groupName);
            const compulsory = parseFloat(sav.compulsoryAmount) || 0;
            const voluntary = parseFloat(sav.voluntarySavings) || 0;
            record.totalSavings += compulsory + voluntary;
        });

        const fullList = Array.from(portfolioMap.values()).map(client => {
            const interestAmount = (client.principal * client.interestRate) / 100;
            const principalPlusInterest = client.principal + interestAmount;
            const balance = principalPlusInterest - client.totalRepaid;

            return {
                ...client,
                principalPlusInterest,
                repaymentAmount: client.totalRepaid,
                balance: balance < 0 ? 0 : balance,
                savings: client.totalSavings,
            };
        });

        return {
            portfolioList: fullList,
            staffList: Array.from(staffSet).filter(s => s !== 'Unassigned').sort(),
        };
    }, [loans, payments, savings]);

    const filteredPortfolios = useMemo(() => {
        return portfolioList.filter(item => {
            const matchesStaff = selectedStaff === 'ALL' || item.staffName.toLowerCase() === selectedStaff.toLowerCase();
            const term = searchTerm.toLowerCase().trim();
            const matchesSearch = !term ||
                (item.clientId || '').toLowerCase().includes(term) ||
                (item.clientName || '').toLowerCase().includes(term) ||
                (item.groupName || '').toLowerCase().includes(term) ||
                (item.staffName || '').toLowerCase().includes(term);

            return matchesStaff && matchesSearch;
        });
    }, [portfolioList, selectedStaff, searchTerm]);

    // Group items by Group Name when a specific staff is selected
    const groupedPortfolios = useMemo(() => {
        if (selectedStaff === 'ALL') return null;

        return filteredPortfolios.reduce((groups, item) => {
            const group = item.groupName || 'Ungrouped / Individual';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(item);
            return groups;
        }, {});
    }, [filteredPortfolios, selectedStaff]);

    const totalClients = useMemo(() => new Set(filteredPortfolios.map(item => item.clientId)).size, [filteredPortfolios]);

    const totalGroups = useMemo(() => {
        const groups = filteredPortfolios
            .map(item => item.groupName)
            .filter(g => g && g !== 'N/A');
        return new Set(groups).size;
    }, [filteredPortfolios]);

    const totalPrincipal = filteredPortfolios.reduce((sum, item) => sum + item.principal, 0);
    const totalExpected = filteredPortfolios.reduce((sum, item) => sum + item.principalPlusInterest, 0);
    const totalRepaid = filteredPortfolios.reduce((sum, item) => sum + item.repaymentAmount, 0);
    const totalBalance = filteredPortfolios.reduce((sum, item) => sum + item.balance, 0);
    const totalSavings = filteredPortfolios.reduce((sum, item) => sum + item.savings, 0);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val || 0);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Embedded Print CSS Rules */}
            <style>
                {`
                    @media print {
                        @page {
                            size: landscape;
                            margin: 10mm;
                        }
                        body { background: white !important; -webkit-print-color-adjust: exact; }
                        .no-print { display: none !important; }
                        .print-area { box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; }
                        table { width: 100% !important; font-size: 11px !important; border-collapse: collapse !important; }
                        th, td { border: 1px solid #cbd5e1 !important; padding: 6px 8px !important; }
                        tfoot tr { background-color: #f1f5f9 !important; font-weight: bold !important; }
                        .print-header { display: block !important; margin-bottom: 20px; text-align: center; }
                    }
                    .print-header { display: none; }
                `}
            </style>

            <div className="max-w-7xl mx-auto space-y-6 print-area">

                {/* Print Header */}
                <div className="print-header text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Staff Portfolio Report</h1>
                    <p className="text-sm text-gray-600">
                        {selectedStaff === 'ALL' ? 'All Staff Members' : `Staff Officer: ${selectedStaff}`} | Branch ID: {branchId}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Generated on: {new Date().toLocaleDateString()}</p>
                </div>

                {/* Interactive Controls */}
                <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Staff Portfolio Report</h1>
                        <p className="text-sm text-gray-500">
                            View client portfolios grouped and filtered by assigned Staff Officer.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        <div className="w-full sm:w-60">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Staff</label>
                            <select
                                value={selectedStaff}
                                onChange={(e) => setSelectedStaff(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="ALL">All Staff Members ({staffList.length})</option>
                                {staffList.map((staff) => (
                                    <option key={staff} value={staff}>
                                        {staff}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full sm:w-60">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
                            <input
                                type="text"
                                placeholder="Search ID, Name, Group..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <button
                            onClick={handlePrint}
                            className="mt-5 sm:mt-0 w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print Report
                        </button>
                    </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Clients</span>
                        <p className="text-lg font-bold text-blue-600 mt-1">{totalClients}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Groups</span>
                        <p className="text-lg font-bold text-teal-600 mt-1">{totalGroups}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase">Disbursed</span>
                        <p className="text-lg font-bold text-gray-800 mt-1">{formatCurrency(totalPrincipal)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase">Principal + Int.</span>
                        <p className="text-lg font-bold text-indigo-700 mt-1">{formatCurrency(totalExpected)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Repaid</span>
                        <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(totalRepaid)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 uppercase">Balance</span>
                        <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(totalBalance)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Savings</span>
                        <p className="text-lg font-bold text-purple-600 mt-1">{formatCurrency(totalSavings)}</p>
                    </div>
                </div>

                {branchIdError && (
                    <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                        {branchIdError}
                    </div>
                )}

                {/* Main Data View */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <Spinner />
                    ) : filteredPortfolios.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No portfolio records found for the selected filter.
                        </div>
                    ) : selectedStaff !== 'ALL' && groupedPortfolios ? (
                        /* Grouped View (When a Specific Staff is Selected) */
                        <div className="p-4 space-y-8">
                            {Object.entries(groupedPortfolios).map(([groupName, groupItems]) => {
                                const groupPrincipal = groupItems.reduce((s, i) => s + i.principal, 0);
                                const groupExpected = groupItems.reduce((s, i) => s + i.principalPlusInterest, 0);
                                const groupRepaid = groupItems.reduce((s, i) => s + i.repaymentAmount, 0);
                                const groupBalance = groupItems.reduce((s, i) => s + i.balance, 0);
                                const groupSavings = groupItems.reduce((s, i) => s + i.savings, 0);

                                return (
                                    <div key={groupName} className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex justify-between items-center">
                                            <h3 className="font-bold text-indigo-900 text-md">Group: {groupName}</h3>
                                            <span className="text-xs font-medium bg-indigo-200 text-indigo-800 px-2.5 py-1 rounded-full">
                                                {groupItems.length} {groupItems.length === 1 ? 'Client' : 'Clients'}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                                                        <th className="py-3 px-4">Client ID</th>
                                                        <th className="py-3 px-4">Client Name</th>
                                                        <th className="py-3 px-4">Staff Officer</th>
                                                        <th className="py-3 px-4">Disbursed Date</th>
                                                        <th className="py-3 px-4 text-right">Principal</th>
                                                        <th className="py-3 px-4 text-center">Interest Rate</th>
                                                        <th className="py-3 px-4 text-right">Principal + Interest</th>
                                                        <th className="py-3 px-4 text-right">Total Repaid</th>
                                                        <th className="py-3 px-4 text-right">Balance</th>
                                                        <th className="py-3 px-4 text-right">Savings</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                                                    {groupItems.map((item) => (
                                                        <tr key={item.clientId} className="hover:bg-gray-50 transition-colors">
                                                            <td className="py-3.5 px-4 font-semibold text-gray-800">{item.clientId}</td>
                                                            <td className="py-3.5 px-4 font-medium text-gray-900">{item.clientName}</td>
                                                            <td className="py-3.5 px-4 text-gray-600 font-medium">
                                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{item.staffName}</span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-gray-500">{item.disbursementDate}</td>
                                                            <td className="py-3.5 px-4 text-right font-medium">{formatCurrency(item.principal)}</td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{item.interestRate}%</span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right font-semibold text-gray-800">{formatCurrency(item.principalPlusInterest)}</td>
                                                            <td className="py-3.5 px-4 text-right text-green-600 font-semibold">{formatCurrency(item.repaymentAmount)}</td>
                                                            <td className={`py-3.5 px-4 text-right font-bold ${item.balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>{formatCurrency(item.balance)}</td>
                                                            <td className="py-3.5 px-4 text-right text-purple-600 font-semibold">{formatCurrency(item.savings)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-gray-100 text-gray-900 font-bold text-xs border-t-2 border-gray-300">
                                                        <td colSpan="4" className="py-3 px-4 uppercase text-gray-700">Group Subtotal ({groupName})</td>
                                                        <td className="py-3 px-4 text-right">{formatCurrency(groupPrincipal)}</td>
                                                        <td className="py-3 px-4 text-center">-</td>
                                                        <td className="py-3 px-4 text-right">{formatCurrency(groupExpected)}</td>
                                                        <td className="py-3 px-4 text-right text-green-700">{formatCurrency(groupRepaid)}</td>
                                                        <td className="py-3 px-4 text-right text-red-700">{formatCurrency(groupBalance)}</td>
                                                        <td className="py-3 px-4 text-right text-purple-700">{formatCurrency(groupSavings)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Flat Table View (When ALL Staff is Selected) */
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                                        <th className="py-3 px-4">Client ID</th>
                                        <th className="py-3 px-4">Client Name</th>
                                        <th className="py-3 px-4">Group Name</th>
                                        <th className="py-3 px-4">Staff Officer</th>
                                        <th className="py-3 px-4">Disbursed Date</th>
                                        <th className="py-3 px-4 text-right">Principal</th>
                                        <th className="py-3 px-4 text-center">Interest Rate</th>
                                        <th className="py-3 px-4 text-right">Principal + Interest</th>
                                        <th className="py-3 px-4 text-right">Total Repaid</th>
                                        <th className="py-3 px-4 text-right">Balance</th>
                                        <th className="py-3 px-4 text-right">Savings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                                    {filteredPortfolios.map((item) => (
                                        <tr key={item.clientId} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3.5 px-4 font-semibold text-gray-800">{item.clientId}</td>
                                            <td className="py-3.5 px-4 font-medium text-gray-900">{item.clientName}</td>
                                            <td className="py-3.5 px-4 text-gray-700">
                                                {item.groupName !== 'N/A' ? (
                                                    <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-medium border border-gray-200">
                                                        {item.groupName}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">N/A</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600 font-medium">
                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{item.staffName}</span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500">{item.disbursementDate}</td>
                                            <td className="py-3.5 px-4 text-right font-medium">{formatCurrency(item.principal)}</td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{item.interestRate}%</span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-semibold text-gray-800">{formatCurrency(item.principalPlusInterest)}</td>
                                            <td className="py-3.5 px-4 text-right text-green-600 font-semibold">{formatCurrency(item.repaymentAmount)}</td>
                                            <td className={`py-3.5 px-4 text-right font-bold ${item.balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>{formatCurrency(item.balance)}</td>
                                            <td className="py-3.5 px-4 text-right text-purple-600 font-semibold">{formatCurrency(item.savings)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 text-gray-900 font-bold text-xs border-t-2 border-gray-300">
                                        <td colSpan="5" className="py-3 px-4 uppercase text-gray-700">Overall Total</td>
                                        <td className="py-3 px-4 text-right">{formatCurrency(totalPrincipal)}</td>
                                        <td className="py-3 px-4 text-center">-</td>
                                        <td className="py-3 px-4 text-right">{formatCurrency(totalExpected)}</td>
                                        <td className="py-3 px-4 text-right text-green-700">{formatCurrency(totalRepaid)}</td>
                                        <td className="py-3 px-4 text-right text-red-700">{formatCurrency(totalBalance)}</td>
                                        <td className="py-3 px-4 text-right text-purple-700">{formatCurrency(totalSavings)}</td>
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