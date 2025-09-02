import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { FaSpinner, FaPrint } from "react-icons/fa";

// Helper: format as USD
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-SL", { style: "currency", currency: "SLE" }).format(amount);

// Helper: format date
const formatDate = (dateString) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-SL", options);
};

export default function GroupReportTransactionGPT() {
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [staffFilter, setStaffFilter] = useState(""); 
  const [staffList, setStaffList] = useState([]); // List of staff fullName
  const [noData, setNoData] = useState(false);
  const [error, setError] = useState("");

  // 🔍 Fetch all staff fullName from staffMembers for the filter dropdown
  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        const staffSnap = await getDocs(collection(db, "staffMembers"));
        const list = staffSnap.docs.map((doc) => doc.data().fullName);
        setStaffList(list);
      } catch (err) {
        console.error("Error fetching staff list:", err);
        setError("Failed to load staff list.");
      }
    };
    fetchStaffList();
  }, []);

  // 🔍 Fetch report from Firestore
  const fetchReport = async () => {
    setLoading(true);
    setNoData(false);
    setError("");
    setReportData({}); // Clear previous report data

    if (!startDate || !endDate) {
      setError("Please select both a start and end date.");
      setLoading(false);
      return;
    }

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
        where("disbursementDate", "<=", endDate)
      );

      const snapshot = await getDocs(q);
      let tempData = {};

      if (snapshot.empty) {
        setReportData({});
        setNoData(true);
        return;
      }

      snapshot.forEach((doc) => {
        const loan = doc.data();
        const staff = loan.staffName || "Unknown Staff";
        const group = loan.groupName || "N/A";

        // Apply staff filter
        if (staffFilter && staff !== staffFilter) return;

        // Group data by group name
        if (!tempData[group]) {
          tempData[group] = {
            loans: [],
            groupTotal: { count: 0, principal: 0 },
          };
        }

        const principal = parseFloat(loan.principal || 0);

        // Add the loan details to the group
        tempData[group].loans.push({
          id: doc.id,
          clientId: loan.clientId,
          clientName: loan.clientName,
          groupId: loan.groupId,
          loanId: loan.loanId,
          principal: principal,
          disbursementDate: loan.disbursementDate,
        });
        
        // Update group totals
        tempData[group].groupTotal.count += 1;
        tempData[group].groupTotal.principal += principal;
      });

      setReportData(tempData);
      if (Object.keys(tempData).length === 0) setNoData(true);
    } catch (err) {
      console.error("Error fetching report:", err);
      setError("Failed to fetch report. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall totals for the report summary
  const overallTotals = Object.values(reportData).reduce(
    (acc, group) => {
      acc.count += group.groupTotal.count;
      acc.principal += group.groupTotal.principal;
      return acc;
    },
    { count: 0, principal: 0 }
  );

  // 🖨️ Print only the report area
  // 🖨️ Print only the report area without refreshing the page
const handlePrint = () => {
    // Get the HTML content of the printable area
    const printContents = document.getElementById("printArea").innerHTML;
    
    // Create a new hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow.document;

    // Write the print-specific CSS and the report content to the iframe
    iframeDoc.open();
    iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Report</title>
            <style>
                /* Add any specific print styles here */
                @media print {
                    body {
                        font-family: sans-serif;
                        margin: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        border: 1px solid #ccc;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    h1, h3, h4, h5 {
                        color: #333;
                    }
                    .text-right {
                        text-align: right;
                    }
                    /* Hide any non-printable elements */
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            ${printContents}
        </body>
        </html>
    `);
    iframeDoc.close();
    
    // Trigger the print dialog for the iframe
    iframe.contentWindow.print();
    
    // Clean up the iframe after a short delay
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 500);
};

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Group Transaction Report</h2>
          <div className="flex flex-col md:flex-row gap-2">
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="border border-gray-300 rounded-lg p-2"
            >
              <option value="">-- All Staff --</option>
              {staffList.map((name, idx) => (
                <option key={idx} value={name}>
                  {name}
                </option>
              ))}
            </select>
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

        {/* Error / Empty */}
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        {noData && !loading && (
          <div className="bg-yellow-100 text-yellow-700 p-3 rounded mb-4">
            No transactions found for selected criteria.
          </div>
        )}

        {/* Printable Report Area */}
        <div id="printArea" className="space-y-6">
          {Object.keys(reportData).length > 0 && (
            <>
              <h1 className="text-center text-2xl font-bold p-4">Loan Portfolio Transaction Summary</h1>
              <h3 className="text-lg font-semibold mb-4">
                Report for {staffFilter || "All Staff"} from {formatDate(startDate)} to {formatDate(endDate)}
              </h3>
            </>
          )}
          {Object.keys(reportData).map((groupName) => (
            <div key={groupName} className="mb-8">
              <h4 className="text-xl font-bold mb-2 p-2 bg-gray-100 rounded-lg">Group: {groupName}</h4>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border p-2 text-left">Client ID</th>
                    <th className="border p-2 text-left">Client Name</th>
                    <th className="border p-2 text-left">Loan ID</th>
                    <th className="border p-2 text-left">Principal</th>
                    <th className="border p-2 text-left">Disbursement Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData[groupName].loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="border p-2">{loan.clientId}</td>
                      <td className="border p-2">{loan.clientName}</td>
                      <td className="border p-2">{loan.loanId}</td>
                      <td className="border p-2 text-right">{formatCurrency(loan.principal)}</td>
                      <td className="border p-2">{formatDate(loan.disbursementDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 font-bold text-right text-base text-gray-700">
                Group Total ({reportData[groupName].groupTotal.count} loans): {formatCurrency(reportData[groupName].groupTotal.principal)}
              </div>
            </div>
          ))}
          {Object.keys(reportData).length > 0 && (
            <div className="mt-8 pt-4 border-t-2 border-gray-300">
              <h4 className="text-xl font-bold mb-2">Overall Summary</h4>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Total Loans Count</th>
                    <th className="border p-2">Total Principal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50 font-bold">
                    <td className="border p-2 text-center">{overallTotals.count}</td>
                    <td className="border p-2 text-right">{formatCurrency(overallTotals.principal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}