import React, { useState, useEffect } from "react";
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// Helper for formatting date
const formatDate = (date) => date instanceof Date && !isNaN(date) ? date.toLocaleDateString() : 'N/A';

function ClientReport({ branch }) {
    const [branchId, setBranchId] = useState("");
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [error, setError] = useState(null);

    // State for the bottom (grouped) table search
    const [search, setSearch] = useState("");

    // --- STATES FOR DETAILED LOAN REPORT ---
    const [loanIdSearchTerm, setLoanIdSearchTerm] = useState("");
    const [detailedLoanId, setDetailedLoanId] = useState(null);
    // --- END STATES ---

    useEffect(() => {
        if (branch && branch.branchId) {
            setBranchId(branch.branchId);
        }
    }, [branch]);

    useEffect(() => {
        if (!branchId) {
            setLoadingPayments(false);
            return;
        }

        const paymentsCollectionRef = collection(db, "payments");
        const paymentsQuery = query(
            paymentsCollectionRef,
            where("branchId", "==", branchId)
        );

        const unsubscribePayments = onSnapshot(
            paymentsQuery,
            (snapshot) => {
                const fetchedPayments = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    let createdAt = null;
                    if (data.createdAt) {
                        createdAt =
                            typeof data.createdAt.toDate === "function"
                                ? data.createdAt.toDate()
                                : new Date(data.createdAt);
                    }
                    return { id: doc.id, ...data, createdAt, docId: doc.id }; // Added docId for key
                }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by date descending

                setPayments(fetchedPayments);
                setLoadingPayments(false);
            },
            (err) => {
                console.error("Error fetching payments:", err);
                setError("Failed to load payments.");
                setLoadingPayments(false);
            }
        );

        return () => unsubscribePayments();
    }, [branchId]);

    // --- HANDLER FOR BUTTON CLICK SEARCH ---
    const handleSearchByLoanId = () => {
        const cleanedId = loanIdSearchTerm.trim();
        setDetailedLoanId(cleanedId || null);
    };

    // --- DETAILED LOAN PAYMENTS DATA (UNGROUPED) ---
    const detailedPayments = payments.filter(
        (payment) => payment.loanId && payment.loanId.trim().toLowerCase() === (detailedLoanId || '').toLowerCase()
    );

    // Determine the initial Principal for the detailed report (assuming it's on the first transaction)
    const initialPrincipal = detailedPayments.length > 0
        ? (detailedPayments.find(p => p.principal)?.principal || 0)
        : 0;


    // --- GROUPED REPORT LOGIC ---
    const groupByClient = (payments) => {
        const groupedData = {};
        payments.forEach((payment) => {
            const {
                clientId, fullName,
                repaymentAmount,
                actualAmount, // ✅ Added actualAmount to destructuring
                loanOutstanding,
                groupId, groupName, staffName, loanOutcome, loanType,
                loanId, date, principal
            } = payment;

            const paymentDate = new Date(date);
            const key = `${clientId}-${loanId}`;

            if (!groupedData[key]) {
                groupedData[key] = {
                    clientId, fullName, repaymentCount: 0,
                    repaymentAmount: repaymentAmount || 0,
                    actualAmount: actualAmount || 0, // ✅ Storing actualAmount (Per Week)
                    loanOutstanding: loanOutstanding || 0,
                    principal: principal || 0,
                    totalRepaymentSoFar: 0,
                    latestPaymentDate: paymentDate,
                    loanProduct: [loanOutcome, loanType].filter(Boolean).join(" - "),
                    loanId: loanId || "",
                    groupName: groupName || "",
                    staffName: staffName || "",
                };
            } else {
                if (paymentDate > groupedData[key].latestPaymentDate) {
                    groupedData[key].latestPaymentDate = paymentDate;
                }
                // When grouping multiple payments for the same loan, keep the latest actualAmount
                // since it should be constant for the life of the loan.
                groupedData[key].actualAmount = actualAmount || groupedData[key].actualAmount; 
            }

            groupedData[key].repaymentCount += 1;
            // IMPORTANT: Total Repayment So Far remains summed from individual repaymentAmount transactions
            groupedData[key].totalRepaymentSoFar += repaymentAmount || 0; 
        });
        return Object.values(groupedData);
    };

    const finalReportData = groupByClient(payments);

    // Live search for grouped data
    const filteredGroupedData = finalReportData.filter(
        (client) => {
            if (search === "") {
                return true;
            }
            const cleanedSearchTerm = search.trim().toLowerCase();
            const clientName = client.fullName.trim().toLowerCase();
            const clientId = String(client.clientId).trim().toLowerCase();

            return clientId.includes(cleanedSearchTerm) || clientName.includes(cleanedSearchTerm);
        }
    );
    // --- END GROUPED REPORT LOGIC ---

    const isLoading = loadingPayments;

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Client Repayment Report</h1>

                {isLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading initial data...</div>
                ) : error ? (
                    <div className="text-center py-4 text-red-500">{error}</div>
                ) : (
                    <>
                        {/* ========================================================= */}
                        {/* 🌟 NEW SECTION: DETAILED LOAN TRANSACTIONS (UNGROUPED) 🌟 */}
                        {/* ========================================================= */}
                        <h2 className="text-2xl font-bold text-gray-700 mt-8 mb-4 border-b pb-2">
                            Detailed Loan Transaction History
                        </h2>

                        <div className="mb-6 flex items-center space-x-4">
                            <input
                                type="text"
                                value={loanIdSearchTerm}
                                onChange={(e) => setLoanIdSearchTerm(e.target.value)}
                                placeholder="Enter Loan ID (e.g., L-12345)"
                                className="border p-2 rounded-md flex-grow"
                            />
                            <button
                                onClick={handleSearchByLoanId}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md shadow-md hover:bg-blue-700 transition-colors"
                            >
                                View Loan Details
                            </button>
                        </div>

                        {/* Display the table only if a valid loan ID has been successfully searched */}
                        {detailedLoanId ? (
                            detailedPayments.length > 0 ? (
                                <>
                                    <h3 className="text-lg font-semibold mb-2">
                                        Transactions for Loan ID: <span className="text-blue-600">{detailedLoanId}</span>
                                    </h3>
                                    <table className="w-full border-collapse border border-gray-300 text-sm mb-8">
                                        <thead className="bg-blue-50">
                                            <tr>
                                                <th className="border p-2">Date</th>
                                                <th className="border p-2">Client ID</th>
                                                <th className="border p-2">Client Name</th>
                                                <th className="border p-2">Group Name</th>
                                                <th className="border p-2">Principal</th>
                                                <th className="border p-2">Repayment</th>
                                                <th className="border p-2">Outstanding Bal</th>
                                                <th className="border p-2">Staff Name</th>
                                                <th className="border p-2">Loan Product</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailedPayments.map((payment, index) => (
                                                <tr key={payment.docId || index}>
                                                    <td className="border p-2">{formatDate(payment.createdAt)}</td>
                                                    <td className="border p-2">{payment.clientId}</td>
                                                    <td className="border p-2 text-left">{payment.fullName}</td>
                                                    <td className="border p-2 text-left">{payment.groupName}</td>
                                                    <td className="border p-2">SLE {(payment.principal || 0).toFixed(2)}</td>
                                                    <td className="border p-2">SLE {(payment.repaymentAmount || 0).toFixed(2)}</td>
                                                    <td className="border p-2">SLE {(payment.loanOutstanding || 0).toFixed(2)}</td>
                                                    <td className="border p-2">{payment.staffName}</td>
                                                    <td className="border p-2">{[payment.loanOutcome, payment.loanType].filter(Boolean).join(" - ")}</td>
                                                </tr>
                                            ))}
                                            
                                            <tfoot className="bg-gray-200 font-semibold">
                                                <tr>
                                                    <td colSpan="4" className="border p-2 text-right">Initial Principal:</td>
                                                    <td className="border p-2">
                                                        SLE {initialPrincipal.toFixed(2)}
                                                    </td>
                                                    <td className="border p-2 text-right">Total Repayment Paid:</td>
                                                    <td className="border p-2" colSpan="3">
                                                        SLE {detailedPayments.reduce((sum, p) => sum + (p.repaymentAmount || 0), 0).toFixed(2)} 
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </tbody>
                                    </table>
                                </>
                            ) : (
                                <div className="text-center py-4 text-gray-500 border p-4 mb-8">
                                    No records found for Loan ID: **{detailedLoanId}**. Please check the ID and try again.
                                </div>
                            )
                        ) : (
                            <div className="text-center py-4 text-gray-500 border p-4 mb-8">
                                Enter a Loan ID and click "View Loan Details" to see transaction history.
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* 📉 ORIGINAL SECTION: GROUPED LOAN REPORT (SUMMARIZED) 📉 */}
                        {/* ========================================================= */}
                        <h2 className="text-2xl font-bold text-gray-700 mt-8 mb-4 border-b pb-2">
                            Grouped Client Summary Report
                        </h2>

                        {/* 🔍 Search Box for Grouped Data */}
                        <div className="mb-4">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter Grouped Report by Client ID or Name..."
                                className="border p-2 rounded w-full"
                            />
                        </div>

                        <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border p-2">Client ID</th>
                                    <th className="border p-2">Client Name</th>
                                    <th className="border p-2">Loan ID</th>
                                    <th className="border p-2">Loan Prod</th>
                                    <th className="border p-2">Group Name</th>
                                    <th className="border p-2">Staff Name</th>
                                    <th className="border p-2">Principal</th>
                                    <th className="border p-2">Amount (Per Week)</th> 
                                    <th className="border p-2">Loan Outstanding (Latest)</th>
                                    <th className="border p-2">Total Repayment So Far</th>
                                    <th className="border p-2">Weeks Paid</th>
                                    <th className="border p-2">Remaining Balance (Calc)</th> 
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGroupedData.length > 0 ? (
                                    filteredGroupedData.map((client) => {
                                        const actualAmount = client.actualAmount || 0; 
                                        const totalRepaymentSoFar = client.totalRepaymentSoFar || 0; 

                                        const weeksPaid =
                                            (actualAmount !== 0)
                                                ? totalRepaymentSoFar / actualAmount
                                                : 0;

                                        const rowKey = `${client.clientId}-${client.loanId}`;

                                        return (
                                            <tr key={rowKey}>
                                                <td className="border p-2">{client.clientId}</td>
                                                <td className="border p-2 text-left">{client.fullName}</td>
                                                <td className="border p-2">{client.loanId}</td>
                                                <td className="border p-2">{client.loanProduct}</td>
                                                <td className="border p-2 text-left">{client.groupName}</td>
                                                <td className="border p-2 text-left">{client.staffName}</td>
                                                <td className="border p-2">
                                                    SLE {(client.principal || 0).toFixed(2)}
                                                </td>
                                                <td className="border p-2">
                                                    SLE {actualAmount.toFixed(2)} 
                                                </td>
                                                <td className="border p-2">
                                                    SLE {(client.loanOutstanding || 0).toFixed(2)}
                                                </td>
                                                <td className="border p-2">
                                                    SLE {totalRepaymentSoFar.toFixed(2)} 
                                                </td>
                                                <td className="border p-2">
                                                    {Math.round(weeksPaid)} week/s
                                                </td>
                                          
                                                <td className="border p-2">
                                                    SLE {((client.loanOutstanding || 0) - totalRepaymentSoFar).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="13" className="text-center p-4 text-gray-500">
                                            No data available matching "{search}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </div>
    );
}

export default ClientReport;