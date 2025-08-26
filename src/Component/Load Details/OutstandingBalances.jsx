// src/components/OutstandingBalances.jsx

import React, { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * A report that lists all loans with an outstanding balance.
 * This component fetches both loans and payments data to accurately calculate balances
 * and the Bal(P) metric based on a user-provided formula.
 */
export default function OutstandingBalances() {
  const [outstandingLoans, setOutstandingLoans] = useState([]);
  const [loansData, setLoansData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [staffNames, setStaffNames] = useState([]);
  const [staffNameFilter, setStaffNameFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch both loans and payments data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [loansSnapshot, paymentsSnapshot] = await Promise.all([
          getDocs(collection(db, "loans")),
          getDocs(collection(db, "payments")),
        ]);

        const fetchedLoans = loansSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const fetchedPayments = paymentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setLoansData(fetchedLoans);
        setPaymentsData(fetchedPayments);

        // Extract unique staff names from loans data for the dropdown filter
        const uniqueStaffNames = [...new Set(fetchedLoans.map((loan) => loan.staffName))];
        setStaffNames(uniqueStaffNames);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load outstanding balances report. Please try again.");
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Process and filter the data whenever the loans/payments lists or filters change
  useEffect(() => {
    if (loading) return;

    // Create a map to count payments made and sum up total repayment amount for each loan
    const paymentsSummaryMap = paymentsData.reduce((acc, payment) => {
      const loanId = payment.loanId;
      if (!acc[loanId]) {
        acc[loanId] = {
          paymentsMade: 0,
          repaymentAmount: 0,
        };
      }
      acc[loanId].paymentsMade += 1;
      acc[loanId].repaymentAmount += parseFloat(payment.repaymentAmount || 0);
      return acc;
    }, {});

    const filteredLoans = loansData.filter(loan => {
      // Apply filters first to narrow down the list
      if (staffNameFilter && loan.staffName.toLowerCase() !== staffNameFilter.toLowerCase()) {
        return false;
      }
      if (startDateFilter && loan.repaymentStartDate < startDateFilter) {
        return false;
      }
      if (endDateFilter && loan.repaymentStartDate > endDateFilter) {
        return false;
      }

      // Filter for loans where the outstanding balance is greater than 0
      const paymentInfo = paymentsSummaryMap[loan.loanId];
      if (paymentInfo && (loan.principal - paymentInfo.repaymentAmount) > 0) {
        return true;
      }

      // If a loan has no payments, it's still outstanding
      if (!paymentInfo && parseFloat(loan.principal) > 0) {
        return true;
      }
      return false;
    }).map(loan => {
      const paymentInfo = paymentsSummaryMap[loan.loanId] || { paymentsMade: 0, repaymentAmount: 0 };
      
      // Bal(P) calculation using the provided formula
      // (principal / paymentWeeks) * number of payments made - principal
      const principalPerWeek = parseFloat(loan.principal) / parseInt(loan.paymentWeeks);
      const balP = (principalPerWeek * paymentInfo.paymentsMade) - parseFloat(loan.principal);
      
      const outstandingBalance = parseFloat(loan.principal) - paymentInfo.repaymentAmount;

      return {
        ...loan,
        // Map the clientName from the loans collection to the fullName property for display
        fullName: loan.clientName,
        paymentsMade: paymentInfo.paymentsMade,
        repaymentAmount: paymentInfo.repaymentAmount,
        outstandingBalance,
        balP: balP || 0,
      };
    });

    setOutstandingLoans(filteredLoans);
  }, [loansData, paymentsData, staffNameFilter, startDateFilter, endDateFilter]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading outstanding balances...
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Outstanding Balances Report</h2>
        <p className="text-gray-600 mb-6">
          A list of all loans that have not yet been fully paid.
        </p>
        <div className="flex flex-col md:flex-row md:items-end md:space-x-4 mb-4">
          <div className="flex-1 mb-2 md:mb-0">
            <label htmlFor="staffName" className="block text-sm font-medium text-gray-700">Staff Name</label>
            <select
              id="staffName"
              value={staffNameFilter}
              onChange={(e) => setStaffNameFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            >
              <option value="">All Staff</option>
              {staffNames.map((name, index) => (
                <option key={index} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 mb-2 md:mb-0">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
          <div className="flex-1 mb-2 md:mb-0">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
        </div>
      </div>
      
      {outstandingLoans.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          No outstanding loans match your criteria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-inner">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="border px-4 py-2">Client ID</th>
                <th className="border px-4 py-2">Full Name</th>
                <th className="border px-4 py-2">Loan ID</th>
                <th className="border px-4 py-2">Loan Type</th>
                <th className="border px-4 py-2">Principal (SLE)</th>
                <th className="border px-4 py-2">Payments Made</th>
                <th className="border px-4 py-2">Total Paid (SLE)</th>
                <th className="border px-4 py-2">Outstanding Balance (SLE)</th>
                <th className="border px-4 py-2">Bal(P) (SLE)</th>
              </tr>
            </thead>
            <tbody>
              {outstandingLoans.map((loan, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border px-4 py-2 text-sm text-gray-700">{loan.clientId}</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{loan.fullName}</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{loan.loanId}</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{loan.loanType}</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{parseFloat(loan.principal).toLocaleString()} SLE</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{loan.paymentsMade}</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{parseFloat(loan.repaymentAmount).toLocaleString()} SLE</td>
                  <td className="border px-4 py-2 text-sm text-red-600 font-semibold">{parseFloat(loan.outstandingBalance).toLocaleString()} SLE</td>
                  <td className="border px-4 py-2 text-sm text-gray-700">{parseFloat(loan.balP).toLocaleString()} SLE</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
