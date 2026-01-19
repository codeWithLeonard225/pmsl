import React, { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { FaSpinner, FaPrint } from "react-icons/fa";

// Helper: format as USD
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-SL", {
    style: "currency",
    currency: "SLE",
  }).format(amount);
};

export default function GeneralReportTransactionGPT() {
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noData, setNoData] = useState(false);
  const [error, setError] = useState("");
  const [overallTotals, setOverallTotals] = useState({
    count: 0,
    principal: 0,
    interest: 0,
    outstanding: 0,
  });

  const getCurrentDate = () => {
  const now = new Date();
  return now.toLocaleDateString("en-SL", {
    weekday: "long", 
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};



  // 🔍 Fetch report from Firestore
  const fetchReport = async () => {
    setLoading(true);
    setNoData(false);
    setError("");
    setOverallTotals({ count: 0, principal: 0, interest: 0, outstanding: 0 }); // Reset overall totals

    if (!startDate || !endDate) {
      setError("Please select both a start and end date.");
      setLoading(false);
      return;
    }

    // Basic date order validation
    if (new Date(startDate) > new Date(endDate)) {
        setError("Start date cannot be after end date.");
        setLoading(false);
        return;
    }

    try {
      const loansRef = collection(db, "loans");
      let q = query(
        loansRef,
        where("disbursementDate", ">=", startDate),
        where("disbursementDate", "<=", endDate),
        where("branchId", branchId),
      );

      const snapshot = await getDocs(q);
      let tempData = {};
      let tempOverallTotals = { count: 0, principal: 0, interest: 0, outstanding: 0 };

      if (snapshot.empty) {
        setReportData({});
        setNoData(true);
        return;
      }

      snapshot.forEach((doc) => {
        const loan = doc.data();
        const staff = loan.staffName || "Unknown Staff";
        const groupId = loan.groupId || "N/A";
        const groupName = loan.groupName || "N/A";

        const principal = parseFloat(loan.principal || 0);
        const interestRate = parseFloat(loan.interestRate || 0);
        const actualInterest = (principal * interestRate) / 100;
        const outstanding = principal + actualInterest;

        if (!tempData[staff]) {
          tempData[staff] = {
            groups: {},
            staffTotal: { count: 0, principal: 0, interest: 0, outstanding: 0 },
          };
        }
        if (!tempData[staff].groups[groupId]) {
          tempData[staff].groups[groupId] = {
            groupId,
            groupName,
            count: 0,
            principal: 0,
            interest: 0,
            outstanding: 0,
          };
        }

        // Update group totals
        tempData[staff].groups[groupId].count += 1;
        tempData[staff].groups[groupId].principal += principal;
        tempData[staff].groups[groupId].interest += actualInterest;
        tempData[staff].groups[groupId].outstanding += outstanding;

        // Update staff totals
        tempData[staff].staffTotal.count += 1;
        tempData[staff].staffTotal.principal += principal;
        tempData[staff].staffTotal.interest += actualInterest;
        tempData[staff].staffTotal.outstanding += outstanding;

        // Update overall totals
        tempOverallTotals.count += 1;
        tempOverallTotals.principal += principal;
        tempOverallTotals.interest += actualInterest;
        tempOverallTotals.outstanding += outstanding;
      });

      setReportData(tempData);
      setOverallTotals(tempOverallTotals);
    } catch (err) {
      console.error("Error fetching report:", err);
      setError("Failed to fetch report. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // 🖨️ Print only the report area
  const handlePrint = () => {
    const printContents = document.getElementById("printArea").innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-6">
        {/* 🔧 Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-800">General Transaction Report</h2>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg p-2"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg p-2"
            />
            <button
              onClick={fetchReport}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow disabled:bg-gray-400"
            >
              {loading ? <FaSpinner className="animate-spin inline" /> : "Filter"}
            </button>
            <button
              onClick={handlePrint}
              disabled={Object.keys(reportData).length === 0 || loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow disabled:bg-gray-400"
            >
              <FaPrint className="inline-block mr-2" /> Print Report
            </button>
          </div>
        </div>

        {/* ⚠️ Error / Empty messages */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
        )}
        {noData && !loading && (
          <div className="bg-yellow-100 text-yellow-700 p-3 rounded mb-4">
            No transactions found in the selected range.
          </div>
        )}

        {/* 🖨️ Printable content */}
        <div id="printArea">
          <p className="text-sm text-gray-600 mb-2">Printed on: {getCurrentDate()}</p>
          <hr />
          {!loading && !error && Object.keys(reportData).length > 0 && (
            <>
            
            <h1 className="text-center text-2xl font-bold p-4">Loan Portfolio Transaction Summary</h1>
              <h3 className="text-lg font-semibold mb-4">
                Report from {startDate} to {endDate}
              </h3>
              {Object.keys(reportData).map((staff) => (
                <div key={staff} className="mb-6">
                  <h4 className="text-md font-bold mb-2">Staff: {staff}</h4>
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2">Group ID</th>
                        <th className="border p-2">Group Name</th>
                        <th className="border p-2">Count</th>
                        <th className="border p-2">Principal</th>
                        <th className="border p-2">Interest</th>
                        <th className="border p-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(reportData[staff].groups).map((group) => (
                        <tr key={group.groupId}>
                          <td className="border p-2">{group.groupId}</td>
                          <td className="border p-2">{group.groupName}</td>
                          <td className="border p-2 text-center">{group.count}</td>
                          <td className="border p-2 text-right">{formatCurrency(group.principal)}</td>
                          <td className="border p-2 text-right">{formatCurrency(group.interest)}</td>
                          <td className="border p-2 text-right">{formatCurrency(group.outstanding)}</td>
                        </tr>
                      ))}
                      {/* Grand Total per Staff Row */}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan="2" className="border p-2 text-right">Staff Total:</td>
                        <td className="border p-2 text-center">{reportData[staff].staffTotal.count}</td>
                        <td className="border p-2 text-right">{formatCurrency(reportData[staff].staffTotal.principal)}</td>
                        <td className="border p-2 text-right">{formatCurrency(reportData[staff].staffTotal.interest)}</td>
                        <td className="border p-2 text-right">{formatCurrency(reportData[staff].staffTotal.outstanding)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Overall Footer Summary */}
              <div className="mt-8 pt-4 border-t-2 border-gray-300">
                <h4 className="text-lg font-bold mb-2">Overall Report Summary</h4>
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2">Total Loans Count</th>
                      <th className="border p-2">Total Principal</th>
                      <th className="border p-2">Total Interest</th>
                      <th className="border p-2">Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-50 font-bold">
                      <td className="border p-2 text-center">{overallTotals.count}</td>
                      <td className="border p-2 text-right">{formatCurrency(overallTotals.principal)}</td>
                      <td className="border p-2 text-right">{formatCurrency(overallTotals.interest)}</td>
                      <td className="border p-2 text-right">{formatCurrency(overallTotals.outstanding)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}