import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';

const printStyles = `
@media print {
    @page { size: landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; background: white; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #000; padding: 4px; text-align: center; }
    th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
    .text-red-500 { color: #ef4444 !important; font-weight: bold; }
}
`;

function FieldCollectionSheet({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loadingLoans, setLoadingLoans] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [loadingSavings, setLoadingSavings] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [clientDates, setClientDates] = useState({});
    const printAreaRef = useRef(null);

    // 1. Determine branchId
    useEffect(() => {
        let id = branch?.branchId || sessionStorage.getItem("branchId");
        if (id) setBranchId(id);
    }, [branch]);

    // 2. Real-time Listeners
    useEffect(() => {
        if (!branchId) return;

        const loansQuery = query(collection(db, 'loans'), where('branchId', '==', branchId));
        const unsubscribeLoans = onSnapshot(loansQuery, snapshot => {
            setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingLoans(false);
        }, err => { setError("Failed to load loans."); setLoadingLoans(false); });

        const paymentsQuery = query(collection(db, 'payments'), where('branchId', '==', branchId));
        const unsubscribePayments = onSnapshot(paymentsQuery, snapshot => {
            setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingPayments(false);
        }, err => { setError("Failed to load payments."); setLoadingPayments(false); });

        const savingsQuery = query(collection(db, 'savings'), where('branchId', '==', branchId));
        const unsubscribeSavings = onSnapshot(savingsQuery, snapshot => {
            setSavings(snapshot.docs.map(doc => doc.data()));
            setLoadingSavings(false);
        }, err => { setError("Failed to load savings."); setLoadingSavings(false); });

        return () => {
            unsubscribeLoans();
            unsubscribePayments();
            unsubscribeSavings();
        };
    }, [branchId]);

    // 3. Precise Metrics Calculation Logic
    const calculateMetrics = (client, dateStr) => {
        const targetDate = new Date(dateStr);
        const lastPayDate = client.latestPaymentDate ? new Date(client.latestPaymentDate) : client.repaymentStartDate;

        if (!lastPayDate) return { expected: 0, overdue: 0 };

        const diffTime = targetDate - lastPayDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const totalWeeksElapsed = Math.floor(diffDays / 7);

        let expected = 0;
        let overdue = 0;

        if (totalWeeksElapsed <= 0) {
            expected = 0;
            overdue = 0;
        } else if (totalWeeksElapsed === 1) {
            expected = client.weeklyRate || 0;
            overdue = 0;
        } else {
            expected = client.weeklyRate || 0;
            overdue = (totalWeeksElapsed - 1) * (client.weeklyRate || 0);
        }

        return { expected, overdue };
    };

    // 4. Data Merging & True Running Balances Engine
    const buildLoanReport = (loans, payments, savings) => {
        const paymentMap = {};
        payments.forEach(p => {
            if (!p.loanId) return;
            if (!paymentMap[p.loanId]) paymentMap[p.loanId] = [];
            paymentMap[p.loanId].push(p);
        });

        const savingsLookup = savings.reduce((acc, s) => {
            if (!acc[s.clientId]) acc[s.clientId] = { comp: 0, vol: 0 };
            acc[s.clientId].comp += s.compulsoryAmount || 0;
            acc[s.clientId].vol += s.voluntarySavings || 0;
            return acc;
        }, {});

        return loans.map(loan => {
            const loanPayments = paymentMap[loan.loanId] || [];
            
            let totalRepayment = 0;
            let latestPaymentDate = null;
            let weeklyRate = 0;
            let runningOutstanding = parseFloat(loan.principal || 0);

            // Sort payments chronically to trace the true latest balance accurately
            const sortedPayments = [...loanPayments].sort((a, b) => new Date(a.date) - new Date(b.date));

            sortedPayments.forEach(p => {
                totalRepayment += p.repaymentAmount || 0;
                const pDate = new Date(p.date);
                
                // Track latest details dynamically matching ClientReport.jsx setup
                if (!latestPaymentDate || pDate > latestPaymentDate) {
                    latestPaymentDate = pDate;
                    weeklyRate = p.actualAmount || weeklyRate;
                    // Fall back cleanly if snapshot fields vary down-chain
                    if (p.loanOutstanding !== undefined) {
                        runningOutstanding = parseFloat(p.loanOutstanding);
                    }
                }
            });

            // If no collections found, fall back safely to base calculation structures
            if (weeklyRate === 0) {
                const totalPrincipal = parseFloat(loan.principal || 0);
                const interest = totalPrincipal * ((loan.interestRate || 0) / 100);
                const totalToPay = totalPrincipal + interest;
                weeklyRate = totalToPay / (parseInt(loan.paymentWeeks) || 1);
            }

            const clientSavings = savingsLookup[loan.clientId] || { comp: 0, vol: 0 };

            return {
                clientId: loan.clientId,
                fullName: loan.clientName || loan.fullName,
                staffName: loan.staffName,
                groupId: loan.groupId,
                groupName: loan.groupName,
                loanId: loan.loanId,
                loanProduct: [loan.loanOutcome, loan.loanType].filter(Boolean).join(" - "),
                loanOutstanding: runningOutstanding, 
                compSavingsBal: clientSavings.comp,
                volSavingsBal: clientSavings.vol,
                repaymentCount: loanPayments.length, 
                totalRepaymentSoFar: totalRepayment,
                weeklyRate: weeklyRate,
                latestPaymentDate: latestPaymentDate,
                repaymentStartDate: loan.repaymentStartDate ? new Date(loan.repaymentStartDate) : null,
            };
        });
    };

    const finalReportData = buildLoanReport(loans, payments, savings).map(client => ({
        ...client,
        isFullyPaid: client.loanOutstanding <= 0 && client.repaymentCount > 0,
    }));

    const filteredReportData = finalReportData
        .filter(c => !c.isFullyPaid)
        .filter(c => !selectedStaff || c.staffName === selectedStaff)
        .filter(c => !selectedGroup || `${c.groupName} (${c.groupId})` === selectedGroup);

    const uniqueStaff = [...new Set(loans.map(l => l.staffName).filter(Boolean))];
    const uniqueGroups = [...new Set(loans.map(l => `${l.groupName} (${l.groupId})`).filter(Boolean))];

    const handlePrint = () => {
        const printContents = printAreaRef.current.innerHTML;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`<html><head><title>Field Collection</title><style>${printStyles}</style></head><body>${printContents}</body></html>`);
        doc.close();
        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            document.body.removeChild(iframe);
        }, 500);
    };

    const isLoading = loadingPayments || loadingSavings || loadingLoans;

    return (
        <div className="container mx-auto p-4 bg-gray-50 min-h-screen font-sans">
            <div className="bg-white rounded-lg shadow-md p-6 no-print mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">Field Collection Sheet</h1>
                    <div className="flex gap-4">
                        <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className="border rounded p-2 text-sm">
                            <option value="">All Staff</option>
                            {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="border rounded p-2 text-sm">
                            <option value="">All Groups</option>
                            {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Print Sheet</button>
                    </div>
                </div>
            </div>

            <div id="printArea" ref={printAreaRef} className="bg-white p-4 rounded shadow">
                <div className="mb-4 text-center">
                    <h2 className="text-xl font-bold underline">FIELD COLLECTION REPORT</h2>
                    <div className="flex justify-between text-xs mt-2 px-4">
                        <span><strong>Staff:</strong> {selectedStaff || 'All'}</span>
                        <span><strong>Group:</strong> {selectedGroup || 'All'}</span>
                        <span><strong>Date:</strong> {new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-10 text-gray-400">Updating records...</div>
                ) : error ? (
                    <div className="text-center py-4 text-red-600 bg-red-50 rounded border border-red-200">{error}</div>
                ) : (
                    <table className="w-full text-[11px] border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border">Client ID</th>
                        <th className="border">Name</th>
                        <th className="border">Savings Balance</th>
                        <th className="border">Loan Product</th>
                        <th className="border">Last Pay Date</th>
                        <th className="border">Weeks Paid</th>
                        <th className="border">Weekly Rate</th>
                        <th className="border">Outstanding Bal</th>
                        <th className="border">Total Paid</th>
                        <th className="border">Expected</th>
                        <th className="border">Overdue</th>
                        <th className="border p-2">Realise Amount</th>
                        <th className="border no-print">Calc Date</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredReportData.map(client => {
                        const rowDateStr = clientDates[client.clientId] || new Date().toISOString().slice(0, 10);
                        const metrics = calculateMetrics(client, rowDateStr);

                        // 🌟 EXACT REPLICATED CALCULATION LOGIC 🌟
                        const actualAmount = client.weeklyRate || 0;
                        const totalRepaymentSoFar = client.totalRepaymentSoFar || 0;
                        
                        const weeksPaid = (actualAmount !== 0) 
                            ? totalRepaymentSoFar / actualAmount 
                            : 0;

                        return (
                            <tr key={client.loanId}>
                                <td className="border p-1">{client.clientId}</td>
                                <td className="border p-1 text-left">{client.fullName}</td>
                                <td className="border p-1">{(client.compSavingsBal + client.volSavingsBal).toFixed(2)}</td>
                                <td className="border p-1">{client.loanProduct}</td>
                                <td className="border p-1">
                                    {client.latestPaymentDate ? client.latestPaymentDate.toLocaleDateString() : 'New'}
                                </td>
                                {/* Displays rounded value with "week/s" label exactly like ClientReport */}
                                <td className="border p-1 font-semibold text-gray-700">
                                    {Math.round(weeksPaid)} week/s
                                </td>
                                <td className="border p-1">SLE {client.weeklyRate.toFixed(2)}</td>
                                <td className="border p-1 font-semibold text-indigo-700">SLE {client.loanOutstanding.toFixed(2)}</td>
                                <td className="border p-1 text-emerald-700">SLE {client.totalRepaymentSoFar.toFixed(2)}</td>
                                <td className="border p-1 font-semibold text-gray-800">SLE {metrics.expected.toFixed(2)}</td>
                                <td className={`border p-1 font-bold ${metrics.overdue > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    SLE {metrics.overdue.toFixed(2)}
                                </td>
                                <td className="border p-2"> </td>
                                <td className="border p-1 no-print">
                                    <input
                                        type="date"
                                        value={rowDateStr}
                                        className="border rounded text-[10px] p-0.5"
                                        onChange={e => setClientDates({ ...clientDates, [client.clientId]: e.target.value })}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
                )}
            </div>
        </div>
    );
}

export default FieldCollectionSheet;