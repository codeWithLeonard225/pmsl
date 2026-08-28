import React, { useState, useEffect } from 'react';
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const Spinner = () => (
    <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" role="status">
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);

export default function ClientPortfolio({ branch }) {
    // ----------------------------------------------------------------
    // 1. STATE MANAGEMENT
    // ----------------------------------------------------------------
    const [branchId, setBranchId] = useState('');
    const [branchIdError, setBranchIdError] = useState(null);
    
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // ----------------------------------------------------------------
    // 2. RESOLVE BRANCH ID
    // ----------------------------------------------------------------
    useEffect(() => {
        let id;
        if (branch && branch.branchId) {
            id = branch.branchId;
        } else {
            id = sessionStorage.getItem("branchId");
        }

        if (id) {
            setBranchId(id);
            setBranchIdError(null);
        } else {
            setBranchIdError("Branch ID could not be determined. Please log in again.");
            setLoading(false);
        }
    }, [branch]);

    // ----------------------------------------------------------------
    // 3. REAL-TIME FIRESTORE LISTENERS
    // ----------------------------------------------------------------
    useEffect(() => {
        if (!branchId || branchIdError) return;

        setLoading(true);

        // Queries filtered by current branch
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

    // ----------------------------------------------------------------
    // 4. DATA AGGREGATION & PORTFOLIO CALCULATIONS
    // ----------------------------------------------------------------
    const portfolioMap = {};

    // Step A: Aggregate Loan Data
    loans.forEach((loan) => {
        const cId = loan.clientId;
        if (!cId) return;

        if (!portfolioMap[cId]) {
            portfolioMap[cId] = {
                clientId: cId,
                clientName: loan.clientName || 'N/A',
                disbursementDate: loan.disbursementDate || 'N/A',
                principal: 0,
                interestRate: loan.interestRate || 0,
                totalRepaid: 0,
                totalSavings: 0,
            };
        }

        portfolioMap[cId].principal += parseFloat(loan.principal || 0);
        // Keep the latest disbursement date if multiple loans exist
        if (loan.disbursementDate) {
            portfolioMap[cId].disbursementDate = loan.disbursementDate;
        }
    });

    // Step B: Aggregate Repayment Payments
    payments.forEach((payment) => {
        const cId = payment.clientId;
        if (!cId) return;

        if (!portfolioMap[cId]) {
            portfolioMap[cId] = {
                clientId: cId,
                clientName: payment.fullName || 'N/A',
                disbursementDate: 'N/A',
                principal: 0,
                interestRate: payment.interestRate || 0,
                totalRepaid: 0,
                totalSavings: 0,
            };
        }

        portfolioMap[cId].totalRepaid += parseFloat(payment.repaymentAmount || 0);
    });

    // Step C: Aggregate Savings
    savings.forEach((sav) => {
        const cId = sav.clientId;
        if (!cId) return;

        if (!portfolioMap[cId]) {
            portfolioMap[cId] = {
                clientId: cId,
                clientName: sav.clientName || 'N/A',
                disbursementDate: 'N/A',
                principal: 0,
                interestRate: 0,
                totalRepaid: 0,
                totalSavings: 0,
            };
        }

        const compulsory = parseFloat(sav.compulsoryAmount || 0);
        const voluntary = parseFloat(sav.voluntarySavings || 0);
        portfolioMap[cId].totalSavings += (compulsory + voluntary);
    });

    // Step D: Calculate final computed metrics per client
    const portfolioList = Object.values(portfolioMap).map((client) => {
        const principal = client.principal;
        const rate = client.interestRate;
        const interestAmount = (principal * rate) / 100;
        const principalPlusInterest = principal + interestAmount;
        const balance = principalPlusInterest - client.totalRepaid;

        return {
            ...client,
            principal,
            interestRate: rate,
            principalPlusInterest,
            repaymentAmount: client.totalRepaid,
            balance: balance < 0 ? 0 : balance, // Prevent negative balance displays
            savings: client.totalSavings
        };
    });

    // ----------------------------------------------------------------
    // 5. SEARCH & FILTERING
    // ----------------------------------------------------------------
    const filteredPortfolios = portfolioList.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            (item.clientId || '').toLowerCase().includes(term) ||
            (item.clientName || '').toLowerCase().includes(term)
        );
    });

    // Format currency helper
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val || 0);
    };

    // ----------------------------------------------------------------
    // 6. RENDER VIEW
    // ----------------------------------------------------------------
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Client Portfolio Ledger</h1>
                        <p className="text-sm text-gray-500">
                            Overview of loan disbursements, total repayments, current balances, and savings deposits.
                        </p>
                    </div>

                    {/* Search Input */}
                    <div className="w-full md:w-72">
                        <input
                            type="text"
                            placeholder="Search by ID or Name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Error Banner */}
                {branchIdError && (
                    <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                        {branchIdError}
                    </div>
                )}

                {/* Table Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <Spinner />
                    ) : filteredPortfolios.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No client portfolios found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                                        <th className="py-3 px-4">Client ID</th>
                                        <th className="py-3 px-4">Client Name</th>
                                        <th className="py-3 px-4">Disbursement Date</th>
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
                                            <td className="py-3.5 px-4 font-semibold text-gray-800">
                                                {item.clientId}
                                            </td>
                                            <td className="py-3.5 px-4 font-medium text-gray-900">
                                                {item.clientName}
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500">
                                                {item.disbursementDate}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium">
                                                {formatCurrency(item.principal)}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
                                                    {item.interestRate}%
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-semibold text-gray-800">
                                                {formatCurrency(item.principalPlusInterest)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-green-600 font-semibold">
                                                {formatCurrency(item.repaymentAmount)}
                                            </td>
                                            <td className={`py-3.5 px-4 text-right font-bold ${item.balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                {formatCurrency(item.balance)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-purple-600 font-semibold">
                                                {formatCurrency(item.savings)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}