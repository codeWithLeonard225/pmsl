import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// Helper for formatting date
const formatDate = (date) =>
  date instanceof Date && !isNaN(date) ? date.toLocaleDateString() : "N/A";

function StaffPage() {
  const [staffData, setStaffData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState(null);

  // 🔍 For grouped search box
  const [search, setSearch] = useState("");

  // --- STATES FOR DETAILED LOAN REPORT ---
  const [loanIdSearchTerm, setLoanIdSearchTerm] = useState("");
  const [detailedLoanId, setDetailedLoanId] = useState(null);
  // --- END STATES ---

  // ✅ Load logged-in staff data from sessionStorage
  useEffect(() => {
    const savedStaff = sessionStorage.getItem("staffData");
    if (savedStaff) {
      setStaffData(JSON.parse(savedStaff));
    }
  }, []);

  // ✅ Fetch only this staff's payments
  useEffect(() => {
    if (!staffData || !staffData.branchId || !staffData.fullName) {
      setLoadingPayments(false);
      return;
    }

    const paymentsCollectionRef = collection(db, "payments");
    const paymentsQuery = query(
      paymentsCollectionRef,
      where("branchId", "==", staffData.branchId),
      where("staffName", "==", staffData.fullName) // Keep filtering by staffName
    );

    const unsubscribePayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const fetchedPayments = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            let createdAt = null;
            if (data.createdAt) {
              createdAt =
                typeof data.createdAt.toDate === "function"
                  ? data.createdAt.toDate()
                  : new Date(data.createdAt);
            }
            // Added docId as per the second code block for table keys
            return { id: doc.id, ...data, createdAt, docId: doc.id };
          })
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
  }, [staffData]);

  // --- HANDLER FOR BUTTON CLICK SEARCH ---
  const handleSearchByLoanId = () => {
    const cleanedId = loanIdSearchTerm.trim();
    // This is the key: setting the state triggers the memoized filter below
    setDetailedLoanId(cleanedId || null); 
  };

  // ✅ Filtered payments for the detailed loan search (UNGROUPED)
  const detailedPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.loanId &&
        payment.loanId.trim().toLowerCase() ===
          (detailedLoanId || "").toLowerCase()
    );
  }, [payments, detailedLoanId]);
  
  // Determine the initial Principal for the detailed report
  const initialPrincipal = useMemo(() => {
    return detailedPayments.length > 0
      ? detailedPayments.find((p) => p.principal)?.principal || 0
      : 0;
  }, [detailedPayments]);


  // ✅ Grouping logic for staff’s clients (remains unchanged)
  const groupByClient = (payments) => {
    const groupedData = {};
    payments.forEach((payment) => {
      const {
        clientId,
        fullName,
        repaymentAmount,
        actualAmount,
        loanOutstanding,
        groupName,
        staffName,
        loanOutcome,
        loanType,
        loanId,
        date,
        principal,
      } = payment;

      const paymentDate = new Date(date);
      const key = `${clientId}-${loanId}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          clientId,
          fullName,
          repaymentCount: 0,
          repaymentAmount: repaymentAmount || 0,
          actualAmount: actualAmount || 0,
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
        groupedData[key].actualAmount =
          actualAmount || groupedData[key].actualAmount;
      }

      groupedData[key].repaymentCount += 1;
      groupedData[key].totalRepaymentSoFar += repaymentAmount || 0;
    });
    return Object.values(groupedData);
  };

  // Use useMemo for performance (for grouped report)
  const finalReportData = useMemo(() => groupByClient(payments), [payments]);

  // Use useMemo for filtering performance
  const filteredGroupedData = useMemo(() => {
    return finalReportData.filter((client) => {
      if (search === "") return true;
      const cleanedSearchTerm = search.trim().toLowerCase();
      const clientName = client.fullName.trim().toLowerCase();
      const clientId = String(client.clientId).trim().toLowerCase();

      return (
        clientId.includes(cleanedSearchTerm) ||
        clientName.includes(cleanedSearchTerm)
      );
    });
  }, [finalReportData, search]);


  return (
    <div className="font-sans">
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
          Staff Client Repayment Report
        </h1>

        {staffData && (
          <p className="mb-4 text-gray-600 text-sm md:text-base">
            <strong>Branch:</strong> {staffData.branchId} |{" "}
            <strong>Staff:</strong> {staffData.fullName}
          </p>
        )}

        {loadingPayments ? (
          <div className="text-center py-4 text-gray-500">
            Loading staff data...
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">{error}</div>
        ) : (
          <>
          
            <h2 className="text-xl md:text-2xl font-bold text-gray-700 mt-8 mb-4 border-b pb-2">
                Detailed Loan Transaction History
            </h2>

           
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:space-x-4 space-y-2 md:space-y-0">
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

         
            {detailedLoanId ? (
                detailedPayments.length > 0 ? (
                    <>
                        <h3 className="text-base md:text-lg font-semibold mb-2">
                            Transactions for Loan ID:{" "}
                            <span className="text-blue-600">{detailedLoanId}</span>
                        </h3>
                      
                        <div className="overflow-x-auto shadow-md rounded-lg mb-8"> 
                            <table className="w-full border-collapse border border-gray-300 text-xs md:text-sm min-w-[700px]">
                                <thead className="bg-blue-50">
                                    <tr>
                                        <th className="border p-2">Date</th>
                                        <th className="border p-2">Client ID</th>
                                        <th className="border p-2">Client Name</th>
                                        <th className="border p-2">Group Name</th>
                                        <th className="border p-2">Principal</th>
                                        <th className="border p-2">Repayment</th>
                                        <th className="border p-2">Outstanding Bal</th>
                                     
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
                                            <td className="border p-2 font-medium text-green-600">
                                                SLE {(payment.repaymentAmount || 0).toFixed(2)}
                                            </td>
                                            <td className="border p-2">SLE {(payment.loanOutstanding || 0).toFixed(2)}</td>
                                          
                                        </tr>
                                    ))}
                                    <tfoot className="bg-gray-200 font-semibold">
                                        <tr>
                                            <td colSpan="4" className="border p-2 text-right">
                                                Initial Principal:
                                            </td>
                                            <td className="border p-2">
                                                SLE {initialPrincipal.toFixed(2)}
                                            </td>
                                            <td className="border p-2 text-right">
                                                Total Repayment Paid:
                                            </td>
                                            <td className="border p-2 text-blue-700" colSpan="2">
                                                SLE {detailedPayments.reduce((sum, p) => sum + (p.repaymentAmount || 0), 0).toFixed(2)}
                                            </td>
                                            <td className="hidden md:table-cell"></td>
                                        </tr>
                                    </tfoot>
                                </tbody>
                            </table>
                        </div>
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

            <h2 className="text-xl md:text-2xl font-bold text-gray-700 mt-8 mb-4 border-b pb-2">
              Grouped Client Summary
            </h2>

            <div className="mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by Client ID or Name..."
                className="border p-2 rounded w-full"
              />
            </div>

            {/* Table wrapper for horizontal scroll on small screens */}
            <div className="overflow-x-auto shadow-md rounded-lg">
              <table className="w-full border-collapse border border-gray-300 text-xs md:text-sm min-w-[900px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Client ID</th>
                    <th className="border p-2">Client Name</th>
                    <th className="border p-2">Loan ID</th>
                    <th className="border p-2">Loan Prod</th>
                    <th className="border p-2">Group Name</th>
                  
                    <th className="border p-2">Principal</th>
                    <th className="border p-2">Amount (Per Week)</th>
                    <th className="border p-2">Outstanding (Latest)</th>
                    <th className="border p-2">Total Repayment</th>
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
                        actualAmount !== 0
                          ? totalRepaymentSoFar / actualAmount
                          : 0;
                      const rowKey = `${client.clientId}-${client.loanId}`;

                      return (
                        <tr key={rowKey} className="hover:bg-gray-50">
                          <td className="border p-2">{client.clientId}</td>
                          <td className="border p-2 text-left">{client.fullName}</td>
                          <td className="border p-2">{client.loanId}</td>
                          <td className="border p-2">{client.loanProduct}</td>
                          <td className="border p-2">{client.groupName}</td>
                       
                          <td className="border p-2">
                            SLE {(client.principal || 0).toFixed(2)}
                          </td>
                          <td className="border p-2">
                            SLE {actualAmount.toFixed(2)}
                          </td>
                          <td className="border p-2">
                            SLE {(client.loanOutstanding || 0).toFixed(2)}
                          </td>
                          <td className="border p-2 font-semibold text-blue-600">
                            SLE {totalRepaymentSoFar.toFixed(2)}
                          </td>
                          <td className="border p-2">
                            {Math.round(weeksPaid)}
                          </td>
                          <td className="border p-2 font-semibold text-red-600">
                            SLE{" "}
                            {(
                              (client.loanOutstanding || 0) - totalRepaymentSoFar
                            ).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="12" className="text-center p-4 text-gray-500">
                        No data available matching "{search}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StaffPage;