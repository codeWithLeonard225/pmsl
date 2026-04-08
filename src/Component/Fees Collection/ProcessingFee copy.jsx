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
    const printAreaRef = useRef(null);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [loadingSavings, setLoadingSavings] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [loading, setLoading] = useState(true); // ADDED: General loading state
    const [clientDates, setClientDates] = useState({});

    useEffect(() => {
        let id;
        if (branch && branch.branchId) {
            id = branch.branchId;
        } else {
            // Fallback: Check sessionStorage for branchId
            id = sessionStorage.getItem("branchId");
        }

        if (id) {
            setBranchId(id);
            setBranchIdError(null);
        } else {
            // Error handling if branchId cannot be determined
            setBranchIdError("Branch ID could not be determined. Please ensure you are logged in or the branch prop is provided.");
            setLoading(false); 
        }
    }, [branch]);

    useEffect(() => {
        if (!branchId) {
            setLoadingPayments(false);
            setLoadingSavings(false);
            return;
        }

        const paymentsCollectionRef = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollectionRef,
            where('branchId', '==', branchId),
        );
        const unsubscribePayments = onSnapshot(
            paymentsQuery,
            snapshot => {
                const fetchedPayments = snapshot.docs.map(doc => {
                    const data = doc.data();
                    let createdAt = null;
                    if (data.createdAt) {
                        createdAt = typeof data.createdAt.toDate === 'function'
                            ? data.createdAt.toDate()
                            : new Date(data.createdAt);
                    }
                    return { id: doc.id, ...data, createdAt };
                });
                setPayments(fetchedPayments);
                setLoadingPayments(false);
            },
            err => {
                console.error("Error fetching payments:", err);
                setError("Failed to load payments.");
                setLoadingPayments(false);
            }
        );

        const savingsCollectionRef = collection(db, 'savings');
        const savingsQuery = query(
            savingsCollectionRef,
            where('branchId', '==', branchId),
        );
        const unsubscribeSavings = onSnapshot(
            savingsQuery,
            snapshot => {
                const fetchedSavings = snapshot.docs.map(doc => doc.data());
                setSavings(fetchedSavings);
                setLoadingSavings(false);
            },
            err => {
                console.error("Error fetching savings:", err);
                setError("Failed to load savings.");
                setLoadingSavings(false);
            }
        );

        return () => {
            unsubscribePayments();
            unsubscribeSavings();
        };
    }, [branchId]);

 const groupByClient = (payments, savings) => {
    const groupedData = {};

    // Prepare savings lookup
    const savingsLookup = savings.reduce((acc, current) => {
        if (!acc[current.clientId]) {
            acc[current.clientId] = { compulsoryAmount: 0, voluntarySavings: 0 };
        }
        acc[current.clientId].compulsoryAmount += current.compulsoryAmount || 0;
        acc[current.clientId].voluntarySavings += current.voluntarySavings || 0;
        return acc;
    }, {});

    payments.forEach(payment => {
        const {
            clientId,
            fullName,
            actualAmount,
            repaymentAmount,
            date,
            loanOutstanding,
            staffName,
            groupId,
            groupName,
            loanOutcome,
            loanType,
            loanId,
        } = payment;

        const paymentDate = new Date(date);
        const key = `${clientId}-${groupId}-${loanId}`; // unique key per client loan

        if (!groupedData[key]) {
            const clientSavings = savingsLookup[clientId] || {};
            groupedData[key] = {
                clientId,
                fullName,
                loanOutstanding: loanOutstanding || 0,
                compSvgBal: clientSavings.compulsoryAmount || 0,
                volSvgBal: clientSavings.voluntarySavings || 0,
                repaymentCount: 0,
                actualAmount: actualAmount || 0,
                totalRepaymentSoFar: 0,
                latestPaymentDate: paymentDate,
                firstPaymentDate: paymentDate, // track first payment
                staffName,
                groupId,
                groupName,
                loanId,
                loanProduct: [loanOutcome, loanType].filter(Boolean).join(" - "),
                repaymentAmount: repaymentAmount || 0, // store regular repayment
            };
        } else {
            // Update first and latest payment dates
            if (paymentDate < groupedData[key].firstPaymentDate) {
                groupedData[key].firstPaymentDate = paymentDate;
            }
            if (paymentDate > groupedData[key].latestPaymentDate) {
                groupedData[key].latestPaymentDate = paymentDate;
                groupedData[key].actualAmount = actualAmount || 0; // latest actual
            }
        }

        groupedData[key].repaymentCount += 1;
        groupedData[key].totalRepaymentSoFar += repaymentAmount || 0;
    });

    return Object.values(groupedData);
};



    let finalReportData = groupByClient(payments, savings);

    if (selectedStaff) {
        finalReportData = finalReportData.filter(c => c.staffName === selectedStaff);
    }
    if (selectedGroup) {
        finalReportData = finalReportData.filter(c => `${c.groupName} (${c.groupId})` === selectedGroup);
    }

    const uniqueStaff = [...new Set(payments.map(p => p.staffName).filter(Boolean))];
    const uniqueGroups = [...new Set(payments.map(p => `${p.groupName} (${p.groupId})`).filter(Boolean))];

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
        doc.write(`
            <html>
                <head>
                    <title>Field Collection Sheet</title>
                    <style>${printStyles}</style>
                </head>
                <body>${printContents}</body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    };

    const getCurrentDate = () => new Date().toLocaleDateString();
    const isLoading = loadingPayments || loadingSavings;

   const calculateClientMetrics = (client, dateString) => {
    const calculationDate = new Date(dateString);
    let expectedPayment = 0;
    let overdueAmount = 0;
    let months = 0;

    if (client.firstPaymentDate) {
        const start = client.firstPaymentDate;

        // Calculate weeks due
        const diffTime = calculationDate - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weeksDue = diffDays > 0 ? diffDays / 7 : 0;

        expectedPayment = weeksDue * (client.actualAmount || 0);
        overdueAmount = Math.max(0, expectedPayment - (client.totalRepaymentSoFar || 0));

        // Optional: calculate months since first payment
        months = (calculationDate.getFullYear() - start.getFullYear()) * 12 +
                 (calculationDate.getMonth() - start.getMonth());
        months = months <= 0 ? 0 : months;
    }

    return { expectedPayment, overdueAmount, months };
};


    const clientMetrics = finalReportData.reduce((acc, client) => {
        const calculationDate = clientDates[client.clientId] || new Date().toISOString().slice(0, 10);
        acc[client.clientId] = calculateClientMetrics(client, calculationDate);
        return acc;
    }, {});


    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <style>{printStyles}</style>
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2 no-print">Field Collection Sheet</h1>

                <div className="no-print mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-2">
                        <label className="font-medium text-gray-700">Staff:</label>
                        <select
                            value={selectedStaff}
                            onChange={e => setSelectedStaff(e.target.value)}
                            className="px-3 py-2 border rounded-md"
                        >
                            <option value="">All</option>
                            {uniqueStaff.map(staff => (
                                <option key={staff} value={staff}>{staff}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <label className="font-medium text-gray-700">Group:</label>
                        <select
                            value={selectedGroup}
                            onChange={e => setSelectedGroup(e.target.value)}
                            className="px-3 py-2 border rounded-md"
                        >
                            <option value="">All</option>
                            {uniqueGroups.map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-green-600 text-white font-medium rounded-md shadow-md hover:bg-green-700 transition-colors duration-200"
                    >
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

                    {isLoading ? (
                        <div className="text-center py-4 text-gray-500">Loading...</div>
                    ) : error ? (
                        <div className="text-center py-4 text-red-500">{error}</div>
                    ) : (
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border p-2">Client ID</th>
                                    <th className="border p-2">Client Name</th>
                                    <th className="border p-2">Comp Svg Bal</th>
                                    <th className="border p-2">Vol Svg Bal</th>
                                    <th className="border p-2">Total Bal</th>
                                    <th className="border p-2">Comp Svg Col</th>
                                    <th className="border p-2">Vol Col</th>
                                    <th className="border p-2">Loan Prod</th>
                                    <th className="border p-2">Latest Payment Date</th>
                                    <th className="border p-2">Rpyt count</th>
                                    <th className="border p-2">Repayment Amount</th>
                                    <th className="border p-2">Loan Outstanding</th>
                                    <th className="border p-2">Total Repayment So Far</th>
                                    <th className="border p-2">
                                        <div className="flex flex-col items-center">
                                            <span>Expected Payment</span>
                                            <span className="no-print text-xs">(Set Date)</span>
                                        </div>
                                    </th>
                                    <th className="border p-2">
                                        <div className="flex flex-col items-center">
                                            <span>Overdue Amount</span>
                                            <span className="no-print text-xs">(Set Date)</span>
                                        </div>
                                    </th>
                                    <th className="border p-2">
                                        <div className="flex flex-col items-center">
                                            <span>Realise Amount</span>
                                            <span className="no-print text-xs">(Set Date)</span>
                                        </div>
                                    </th>
                                    <th className="border p-2 no-print">Calculation Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalReportData.length > 0 ? (
                                    finalReportData.map(client => {
                                        const calculationDate = clientDates[client.clientId] || new Date().toISOString().slice(0, 10);
                                        const { expectedPayment, overdueAmount, months } = calculateClientMetrics(client, calculationDate);

                                        return (
                                            <tr key={client.loanId}>
                                                <td className="border p-2">{client.clientId}</td>
                                                <td className="border p-2">{client.fullName}</td>
                                                <td className="border p-2">SLE {(client.compSvgBal || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(client.volSvgBal || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {((client.compSvgBal || 0) + (client.volSvgBal || 0)).toFixed(2)}</td>
                                                <td className="border p-2"></td>
                                                <td className="border p-2"></td>
                                                <td className="border p-2">{client.loanProduct}</td>
                                                <td className="border p-2">{client.latestPaymentDate.toLocaleDateString()}</td>
                                                <td className="border p-2">{client.repaymentCount}</td>
                                                <td className="border p-2">SLE {(client.actualAmount || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(client.loanOutstanding || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(client.totalRepaymentSoFar || 0).toFixed(2)}</td>
                                                <td className="border p-2">SLE {(expectedPayment || 0).toFixed(2)}</td>
                                                <td className={`border p-2 ${overdueAmount > 0 ? 'text-red-500' : ''}`}>
                                                    SLE {(overdueAmount || 0).toFixed(2)}
                                                </td>
                                                <td className="border p-2"> </td>
                                                <td className="border p-2 no-print">
                                                    <input
                                                        type="date"
                                                        value={calculationDate}
                                                        onChange={e => setClientDates({
                                                            ...clientDates,
                                                            [client.clientId]: e.target.value
                                                        })}
                                                        className="w-full"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="17" className="text-center p-4 text-gray-500">No data available</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-200 font-semibold">
                                <tr>
                                    <td className="border p-2 text-left" colSpan="2">
                                        No. of Clients: {finalReportData.length}
                                    </td>
                                    <td className="border p-2" colSpan="3"></td>
                                    <td className="border p-2" colSpan="2"></td>
                                    <td className="border p-2" colSpan="2"></td>
                                    <td className="border p-2" colSpan="1"></td>
                                    <td className="border p-2"></td>
                                    <td className="border p-2">
                                        SLE {finalReportData.reduce((sum, c) => sum + (c.repaymentAmount || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border p-2">
                                        SLE {finalReportData.reduce((sum, c) => sum + (c.loanOutstanding || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border p-2">
                                        SLE {finalReportData.reduce((sum, c) => sum + (c.totalRepaymentSoFar || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border p-2">
                                        SLE {finalReportData.reduce((sum, c) => sum + (clientMetrics[c.clientId].expectedPayment || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border p-2">
                                        SLE {finalReportData.reduce((sum, c) => sum + (clientMetrics[c.clientId].overdueAmount || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border p-2"></td>
                                    <td className="border p-2"></td>
                                    <td className="border p-2 no-print"></td>
                                </tr>
                            </tfoot>

                        </table>
                    )}
                    <div className="mt-10 text-sm">
                        <p className="mb-2">
                            CO's Signature ...............................................
                            BM's Signature ...............................................
                            Date: ...............................................
                        </p>
                        <p className="font-semibold mt-10">
                            Total Collection: ...............................................
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FieldCollectionSheet;