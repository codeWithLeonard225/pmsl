import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';

const printStyles = `
@media print {
    @page { size: landscape; margin: 20mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 4px; text-align: center; }
    th { background-color: #eee; }
    .text-red-500 { color: #ef4444 !important; }
}
`;

function FieldCollectionSheet({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [branchIdError, setBranchIdError] = useState(null);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [loadingSavings, setLoadingSavings] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [clientDates, setClientDates] = useState({});
    const printAreaRef = useRef(null);

    // Determine branchId
    useEffect(() => {
        let id = branch?.branchId || sessionStorage.getItem("branchId");
        if (id) setBranchId(id);
        else setBranchIdError("Branch ID could not be determined.");
    }, [branch]);

    // Fetch payments and savings
    useEffect(() => {
        if (!branchId) return;

        const paymentsRef = collection(db, 'payments');
        const paymentsQuery = query(paymentsRef, where('branchId', '==', branchId));
        const unsubscribePayments = onSnapshot(
            paymentsQuery,
            snapshot => {
                const data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    let createdAt = d.createdAt?.toDate?.() || new Date(d.createdAt);
                    return { id: doc.id, ...d, createdAt };
                });
                setPayments(data);
                setLoadingPayments(false);
            },
            err => { console.error(err); setError("Failed to load payments."); setLoadingPayments(false); }
        );

        const savingsRef = collection(db, 'savings');
        const savingsQuery = query(savingsRef, where('branchId', '==', branchId));
        const unsubscribeSavings = onSnapshot(
            savingsQuery,
            snapshot => {
                setSavings(snapshot.docs.map(doc => doc.data()));
                setLoadingSavings(false);
            },
            err => { console.error(err); setError("Failed to load savings."); setLoadingSavings(false); }
        );

        return () => {
            unsubscribePayments();
            unsubscribeSavings();
        };
    }, [branchId]);

    // Group payments & combine with savings
    const groupByClient = (payments, savings) => {
        const grouped = {};
        const savingsLookup = savings.reduce((acc, s) => {
            if (!acc[s.clientId]) acc[s.clientId] = { compulsoryAmount: 0, voluntarySavings: 0 };
            acc[s.clientId].compulsoryAmount += s.compulsoryAmount || 0;
            acc[s.clientId].voluntarySavings += s.voluntarySavings || 0;
            return acc;
        }, {});

        payments.forEach(p => {
            const key = `${p.clientId}-${p.groupId}-${p.loanId}`;
            const paymentDate = new Date(p.date);
            if (!grouped[key]) {
                const clientSavings = savingsLookup[p.clientId] || {};
                grouped[key] = {
                    clientId: p.clientId,
                    fullName: p.fullName,
                    loanOutstanding: p.loanOutstanding || 0,
                    compSvgBal: clientSavings.compulsoryAmount || 0,
                    volSvgBal: clientSavings.voluntarySavings || 0,
                    repaymentCount: 1,
                    actualAmount: p.actualAmount || 0,
                    totalRepaymentSoFar: p.repaymentAmount || 0,
                    latestPaymentDate: paymentDate,
                    firstPaymentDate: paymentDate,
                    staffName: p.staffName,
                    groupId: p.groupId,
                    groupName: p.groupName,
                    loanId: p.loanId,
                    loanProduct: [p.loanOutcome, p.loanType].filter(Boolean).join(" - "),
                    repaymentAmount: p.repaymentAmount || 0,
                };
            } else {
                grouped[key].repaymentCount += 1;
                grouped[key].totalRepaymentSoFar += p.repaymentAmount || 0;
                if (paymentDate > grouped[key].latestPaymentDate) {
                    grouped[key].latestPaymentDate = paymentDate;
                    grouped[key].actualAmount = p.actualAmount || 0;
                }
                if (paymentDate < grouped[key].firstPaymentDate) {
                    grouped[key].firstPaymentDate = paymentDate;
                }
            }
        });

        return Object.values(grouped);
    };

    // Prepare filtered report
    const finalReportData = groupByClient(payments, savings).map(client => ({
        ...client,
        isFullyPaid: (client.totalRepaymentSoFar || 0) >= (client.loanOutstanding || 0),
    }));

    const filteredReportData = finalReportData
        .filter(c => !c.isFullyPaid)
        .filter(c => !selectedStaff || c.staffName === selectedStaff)
        .filter(c => !selectedGroup || `${c.groupName} (${c.groupId})` === selectedGroup);

    // Unique filter options
    const uniqueStaff = [...new Set(payments.map(p => p.staffName).filter(Boolean))];
    const uniqueGroups = [...new Set(payments.map(p => `${p.groupName} (${p.groupId})`).filter(Boolean))];

    const isLoading = loadingPayments || loadingSavings;

    // Metrics calculation
    const calculateClientMetrics = (client, dateString) => {
        const calculationDate = new Date(dateString);
        let expectedPayment = 0, overdueAmount = 0;

        if (client.firstPaymentDate) {
            const start = client.firstPaymentDate;
            const diffDays = (calculationDate - start) / (1000 * 60 * 60 * 24);
            const weeksDue = diffDays > 0 ? diffDays / 7 : 0;
            expectedPayment = weeksDue * (client.actualAmount || 0);
            overdueAmount = Math.max(0, expectedPayment - (client.totalRepaymentSoFar || 0));
        }

        return { expectedPayment, overdueAmount };
    };

    const clientMetrics = filteredReportData.reduce((acc, client) => {
        const date = clientDates[client.clientId] || new Date().toISOString().slice(0, 10);
        acc[client.clientId] = calculateClientMetrics(client, date);
        return acc;
    }, {});

    const handlePrint = () => {
        const printContents = printAreaRef.current.innerHTML;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`<html><head><title>Field Collection Sheet</title><style>${printStyles}</style></head><body>${printContents}</body></html>`);
        doc.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    };

    const getCurrentDate = () => new Date().toLocaleDateString();

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <style>{printStyles}</style>
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2 no-print">Field Collection Sheet</h1>

                <div className="no-print mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-2">
                        <label className="font-medium text-gray-700">Staff:</label>
                        <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className="px-3 py-2 border rounded-md">
                            <option value="">All</option>
                            {uniqueStaff.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <label className="font-medium text-gray-700">Group:</label>
                        <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="px-3 py-2 border rounded-md">
                            <option value="">All</option>
                            {uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}
                        </select>
                    </div>

                    <button onClick={handlePrint} className="px-6 py-2 bg-green-600 text-white font-medium rounded-md shadow-md hover:bg-green-700 transition-colors duration-200">
                        Print Report
                    </button>
                </div>

                <div id="printArea" ref={printAreaRef}>
                    <p className="text-sm text-gray-600 mb-2">Printed on: {getCurrentDate()}</p>
                    <hr className="mb-4" />
                    <div className="mb-4">
                        <h2 className="font-semibold">Branch ID: {branchId}</h2>
                        <h2 className="font-semibold">Loan Officer: {selectedStaff || 'All'}</h2>
                        <h2 className="font-semibold">Group Name: {selectedGroup || 'All'}</h2>
                    </div>

                    {isLoading ? <div className="text-center py-4 text-gray-500">Loading...</div> :
                        error ? <div className="text-center py-4 text-red-500">{error}</div> :
                            <table className="w-full border-collapse border border-gray-300 text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border p-2">Client ID</th>
                                        <th className="border p-2">Client Name</th>
                                        <th className="border p-2">Comp Svg Bal</th>
                                        <th className="border p-2">Vol Svg Bal</th>
                                        <th className="border p-2">Total Bal</th>
                                        <th className="border p-2">Loan Prod</th>
                                        <th className="border p-2">Latest Payment Date</th>
                                        <th className="border p-2">Rpyt count</th>
                                        <th className="border p-2">Repayment Amount</th>
                                        <th className="border p-2">Loan Outstanding</th>
                                        <th className="border p-2">Total Repayment So Far</th>
                                        <th className="border p-2">Expected Payment</th>
                                        <th className="border p-2">Overdue Amount</th>
                                        <th className="border p-2 no-print">Calculation Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReportData.length > 0 ? filteredReportData.map(client => {
                                        const calculationDate = clientDates[client.clientId] || new Date().toISOString().slice(0, 10);
                                        const { expectedPayment, overdueAmount } = clientMetrics[client.clientId];
                                        return (
                                            <tr key={client.loanId}>
                                                <td className="border p-2">{client.clientId}</td>
                                                <td className="border p-2">{client.fullName}</td>
                                                <td className="border p-2">SLE {(client.compSvgBal || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(client.volSvgBal || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {((client.compSvgBal || 0) + (client.volSvgBal || 0)).toFixed(2)}</td>
                                                <td className="border p-2">{client.loanProduct}</td>
                                                <td className="border p-2">{client.latestPaymentDate.toLocaleDateString()}</td>
                                                <td className="border p-2">{client.repaymentCount}</td>
                                                <td className="border p-2">SLE {(client.actualAmount || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(client.loanOutstanding || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(client.totalRepaymentSoFar || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {expectedPayment.toFixed(2)}</td>
                                                <td className={`border p-2 ${overdueAmount > 0 ? 'text-red-500' : ''}`}>SLE {overdueAmount.toFixed(2)}</td>
                                                <td className="border p-2 no-print">
                                                    <input type="date" value={calculationDate}
                                                        onChange={e => setClientDates({ ...clientDates, [client.clientId]: e.target.value })}
                                                        className="w-full" />
                                                </td>
                                            </tr>
                                        );
                                    }) :
                                        <tr><td colSpan="14" className="text-center p-4 text-gray-500">No data available</td></tr>}
                                </tbody>
                            </table>
                    }
                </div>
            </div>
        </div>
    );
}

export default FieldCollectionSheet;