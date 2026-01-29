import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { FaSpinner, FaPrint } from "react-icons/fa";

// Helper: format as SLE
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
  const [branchId, setBranchId] = useState("");
  const [overallTotals, setOverallTotals] = useState({
    count: 0,
    principal: 0,
    interest: 0,
    outstanding: 0,
  });

  // Load branchId on mount
  useEffect(() => {
    const id = sessionStorage.getItem("branchId");
    if (id) setBranchId(id);
  }, []);

  const getCurrentDate = () => {
    return new Date().toLocaleDateString("en-SL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 📊 Fetch report using Client-Side Filtering (No Index needed)
  const fetchReport = async () => {
    if (!branchId) {
      setError("Branch ID not found. Please log in again.");
      return;
    }

    setLoading(true);
    setNoData(false);
    setError("");
    setReportData({});
    setOverallTotals({ count: 0, principal: 0, interest: 0, outstanding: 0 });

    if (!startDate || !endDate) {
      setError("Please select both a start and end date.");
      setLoading(false);
      return;
    }

    try {
      // Fetch all branch loans to bypass complex index requirement
      const loansRef = collection(db, "loans");
      const q = query(loansRef, where("branchId", "==", branchId));

      const snapshot = await getDocs(q);
      let tempData = {};
      let tempOverallTotals = { count: 0, principal: 0, interest: 0, outstanding: 0 };

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (snapshot.empty) {
        setNoData(true);
        setLoading(false);
        return;
      }

      snapshot.forEach((doc) => {
        const loan = doc.data();
        const loanDate = new Date(loan.disbursementDate);

        // JavaScript Filter
        if (loanDate >= start && loanDate <= end) {
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

          tempData[staff].groups[groupId].count += 1;
          tempData[staff].groups[groupId].principal += principal;
          tempData[staff].groups[groupId].interest += actualInterest;
          tempData[staff].groups[groupId].outstanding += outstanding;

          tempData[staff].staffTotal.count += 1;
          tempData[staff].staffTotal.principal += principal;
          tempData[staff].staffTotal.interest += actualInterest;
          tempData[staff].staffTotal.outstanding += outstanding;

          tempOverallTotals.count += 1;
          tempOverallTotals.principal += principal;
          tempOverallTotals.interest += actualInterest;
          tempOverallTotals.outstanding += outstanding;
        }
      });

      if (Object.keys(tempData).length === 0) {
        setNoData(true);
      } else {
        setReportData(tempData);
        setOverallTotals(tempOverallTotals);
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setError("Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  // 🖨 Custom Print Handler to force borders
  const handlePrint = () => {
    const printContents = document.getElementById("printArea").innerHTML;
    const win = window.open("", "", "width=1000,height=700");
    win.document.write(`
      <html>
        <head>
          <title>General Transaction Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid black !important; padding: 6px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .mb-4 { margin-bottom: 16px; }
            .flex { display: flex; justify-content: space-between; }
            .grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 10px; }
            .summary-box { border: 2px solid black; padding: 15px; margin-top: 20px; }
            .border { border: 1px solid black; padding: 5px; }
            .no-print { display: none; }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-6 print-container">
        
        {/* 🔧 Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 no-print">
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow disabled:bg-gray-400 font-bold"
            >
              {loading ? <FaSpinner className="animate-spin" /> : "FILTER"}
            </button>
            <button
              onClick={handlePrint}
              disabled={Object.keys(reportData).length === 0 || loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow disabled:bg-gray-400 font-bold"
            >
              <FaPrint className="inline-block mr-2" /> PRINT
            </button>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 no-print">{error}</div>}
        {noData && !loading && (
          <div className="bg-yellow-100 text-yellow-700 p-3 rounded mb-4 no-print">
            No transactions found for these dates.
          </div>
        )}

        {/* 🖨️ Printable content Area */}
        <div id="printArea">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold uppercase">{sessionStorage.getItem("companyShortCode") || "Company"}</h1>
              <p className="text-sm text-gray-600 font-bold">Branch ID: {branchId}</p>
            </div>
            <p className="text-xs text-gray-500 text-right font-bold">Printed on:<br/>{getCurrentDate()}</p>
          </div>
          
          <hr className="mb-4 border-black" />

          {Object.keys(reportData).length > 0 && (
            <>
              <h2 className="text-center text-xl font-bold mb-1 uppercase">Loan Portfolio Transaction Summary</h2>
              <p className="text-center text-sm mb-6">Period: {startDate} to {endDate}</p>

              {Object.keys(reportData).map((staff) => (
                <div key={staff} className="mb-8">
                  <h4 className="text-md font-bold mb-2 border-b-2 border-gray-800">Field Officer: {staff}</h4>
                  <table className="w-full border-collapse border border-black text-xs">
                    <thead>
                      <tr className="bg-gray-100 font-bold">
                        <th className="border border-black p-2 text-left">Group ID</th>
                        <th className="border border-black p-2 text-left">Group Name</th>
                        <th className="border border-black p-2 text-center">Count</th>
                        <th className="border border-black p-2 text-right">Principal</th>
                        <th className="border border-black p-2 text-right">Interest</th>
                        <th className="border border-black p-2 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(reportData[staff].groups).map((group) => (
                        <tr key={group.groupId}>
                          <td className="border border-black p-2">{group.groupId}</td>
                          <td className="border border-black p-2">{group.groupName}</td>
                          <td className="border border-black p-2 text-center">{group.count}</td>
                          <td className="border border-black p-2 text-right">{formatCurrency(group.principal)}</td>
                          <td className="border border-black p-2 text-right">{formatCurrency(group.interest)}</td>
                          <td className="border border-black p-2 text-right">{formatCurrency(group.outstanding)}</td>
                        </tr>
                      ))}
                      {/* Staff Subtotal Row */}
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan="2" className="border border-black p-2 text-right text-xs uppercase font-black">Officer Sub-Total:</td>
                        <td className="border border-black p-2 text-center">{reportData[staff].staffTotal.count}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(reportData[staff].staffTotal.principal)}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(reportData[staff].staffTotal.interest)}</td>
                        <td className="border border-black p-2 text-right font-black">{formatCurrency(reportData[staff].staffTotal.outstanding)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Overall Final Summary */}
              <div className="summary-box">
                <h4 className="text-lg font-bold mb-3 text-center uppercase">Grand Total Report Summary</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                   <div className="border border-black p-2 font-bold bg-gray-50">Total Loans: {overallTotals.count}</div>
                   <div className="border border-black p-2 font-bold bg-gray-50">Principal: {formatCurrency(overallTotals.principal)}</div>
                   <div className="border border-black p-2 font-bold bg-gray-50">Interest: {formatCurrency(overallTotals.interest)}</div>
                   <div className="border border-black p-2 font-black bg-blue-50">Outstanding: {formatCurrency(overallTotals.outstanding)}</div>
                </div>
              </div>

              {/* Signature Section */}
              <div className="mt-16 flex justify-between px-4">
                 <div className="border-t-2 border-black w-48 text-center text-xs pt-1 font-bold">Prepared By (Field Officer)</div>
                 <div className="border-t-2 border-black w-48 text-center text-xs pt-1 font-bold">Verified By (Manager)</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}