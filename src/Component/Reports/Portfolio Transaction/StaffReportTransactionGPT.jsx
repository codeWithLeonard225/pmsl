import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { FaSpinner, FaPrint } from "react-icons/fa";

// Helper: format as SLE
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-SL", { style: "currency", currency: "SLE" }).format(amount);

export default function StaffReportTransactionGPT() {
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [noData, setNoData] = useState(false);
  const [error, setError] = useState("");
  const [overallTotals, setOverallTotals] = useState({
    count: 0,
    principal: 0,
    interest: 0,
    outstanding: 0,
  });

  const getCurrentDate = () => {
    return new Date().toLocaleDateString("en-SL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 🔐 Load branchId and Staff List
  useEffect(() => {
    const id = sessionStorage.getItem("branchId");
    if (id) {
      setBranchId(id);
      const fetchStaffList = async () => {
        try {
          const q = query(collection(db, "staffMembers"), where("branchId", "==", id));
          const staffSnap = await getDocs(q);
          const list = staffSnap.docs.map((doc) => doc.data().fullName);
          setStaffList([...new Set(list)].sort());
        } catch (err) {
          setError("Failed to load staff list.");
        }
      };
      fetchStaffList();
    }
  }, []);

  // 📊 Fetch report (Client-Side Filtering)
  const fetchReport = async () => {
    if (!branchId) {
      setError("No Branch ID found. Please log in.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Please select both dates.");
      return;
    }

    setLoading(true);
    setNoData(false);
    setError("");
    setReportData({});
    setOverallTotals({ count: 0, principal: 0, interest: 0, outstanding: 0 });

    try {
      // Step A: Fetch by Branch only (Avoids composite index error)
      const q = query(collection(db, "loans"), where("branchId", "==", branchId));
      const snapshot = await getDocs(q);

      let tempData = {};
      let tempOverall = { count: 0, principal: 0, interest: 0, outstanding: 0 };
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
        const staff = loan.staffName || "Unknown Staff";

        // Step B: Filter in JS
        const matchesDate = loanDate >= start && loanDate <= end;
        const matchesStaff = !staffFilter || staff === staffFilter;

        if (matchesDate && matchesStaff) {
          const principal = parseFloat(loan.principal || 0);
          const interestRate = parseFloat(loan.interestRate || 0);
          const interest = (principal * interestRate) / 100;
          const outstanding = principal + interest;
          const groupId = loan.groupId || "N/A";

          if (!tempData[staff]) {
            tempData[staff] = {
              groups: {},
              staffTotal: { count: 0, principal: 0, interest: 0, outstanding: 0 },
            };
          }

          if (!tempData[staff].groups[groupId]) {
            tempData[staff].groups[groupId] = {
              groupId,
              groupName: loan.groupName || "N/A",
              count: 0,
              principal: 0,
              interest: 0,
              outstanding: 0,
            };
          }

          // Update Data
          const g = tempData[staff].groups[groupId];
          g.count += 1; g.principal += principal; g.interest += interest; g.outstanding += outstanding;

          const s = tempData[staff].staffTotal;
          s.count += 1; s.principal += principal; s.interest += interest; s.outstanding += outstanding;

          tempOverall.count += 1; tempOverall.principal += principal; 
          tempOverall.interest += interest; tempOverall.outstanding += outstanding;
        }
      });

      if (Object.keys(tempData).length === 0) {
        setNoData(true);
      } else {
        setReportData(tempData);
        setOverallTotals(tempOverall);
      }
    } catch (err) {
      setError("Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  // 🖨️ Improved Print Logic (Force Borders)
  const handlePrint = () => {
    const content = document.getElementById("printArea").innerHTML;
    const win = window.open("", "", "width=900,height=700");
    win.document.write(`
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid black !important; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2 !important; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 no-print">
          <h2 className="text-2xl font-bold text-gray-800">Staff Transaction Report</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="border p-2 rounded-lg bg-white"
            >
              <option value="">-- All Staff --</option>
              {staffList.map((name, idx) => (
                <option key={idx} value={name}>{name}</option>
              ))}
            </select>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded-lg" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded-lg" />
            <button onClick={fetchReport} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">
              {loading ? <FaSpinner className="animate-spin" /> : "FILTER"}
            </button>
            <button onClick={handlePrint} disabled={Object.keys(reportData).length === 0} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">
              <FaPrint className="mr-2 inline" /> PRINT
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>}
        {noData && <div className="p-3 bg-yellow-100 text-yellow-700 rounded mb-4">No data found.</div>}

        {/* Report Area */}
        <div id="printArea">
          <div className="header">
            <h1 className="text-2xl font-bold uppercase">{sessionStorage.getItem("companyShortCode") || "Staff"} Report</h1>
            <p className="text-sm">Branch ID: {branchId} | Printed: {getCurrentDate()}</p>
          </div>

          {Object.keys(reportData).length > 0 && (
            <>
              <h2 className="text-center text-xl font-bold mb-4 uppercase underline">Loan Portfolio Transaction Summary</h2>
              <p className="mb-4 font-semibold text-center">Period: {startDate} to {endDate}</p>

              {Object.keys(reportData).map((staff) => (
                <div key={staff} className="mb-8">
                  <h4 className="text-md font-bold mb-2 border-b-2 border-black">Field Officer: {staff}</h4>
                  <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-black p-2">Group ID</th>
                        <th className="border border-black p-2">Group Name</th>
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
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan="2" className="border border-black p-2 text-right">OFFICER TOTAL:</td>
                        <td className="border border-black p-2 text-center">{reportData[staff].staffTotal.count}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(reportData[staff].staffTotal.principal)}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(reportData[staff].staffTotal.interest)}</td>
                        <td className="border border-black p-2 text-right">{formatCurrency(reportData[staff].staffTotal.outstanding)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Grand Total Table */}
              <div className="mt-8">
                <h4 className="text-lg font-bold mb-2 uppercase">Overall Report Summary</h4>
                <table className="w-full border-collapse border-2 border-black">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border border-black p-2 text-center">Total Loans</th>
                      <th className="border border-black p-2 text-right">Total Principal</th>
                      <th className="border border-black p-2 text-right">Total Interest</th>
                      <th className="border border-black p-2 text-right">Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-bold text-lg bg-blue-50">
                      <td className="border border-black p-2 text-center">{overallTotals.count}</td>
                      <td className="border border-black p-2 text-right">{formatCurrency(overallTotals.principal)}</td>
                      <td className="border border-black p-2 text-right">{formatCurrency(overallTotals.interest)}</td>
                      <td className="border border-black p-2 text-right">{formatCurrency(overallTotals.outstanding)}</td>
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