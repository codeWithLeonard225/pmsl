import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase"; // Matches your saved config path
import { FaSpinner, FaPrint, FaSearch } from "react-icons/fa";

// Currency formatter for Sierra Leone
const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-SL", { 
        style: "currency", 
        currency: "SLE",
        minimumFractionDigits: 2 
    }).format(amount);

// Date formatter
const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString("en-SL", options);
};

export default function GroupReportTransactionGPT() {
    const [reportData, setReportData] = useState({});
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [staffFilter, setStaffFilter] = useState("");
    const [staffList, setStaffList] = useState([]);
    const [branchId, setBranchId] = useState("");
    const [error, setError] = useState("");
    const [noData, setNoData] = useState(false);

    // 🔐 Load branchId from session with a fallback to your saved db exports
    useEffect(() => {
        const getSessionBranch = () => {
            const keys = Object.keys(sessionStorage);
            for (let key of keys) {
                const val = sessionStorage.getItem(key);
                try {
                    const parsed = JSON.parse(val);
                    if (parsed?.branchId) return parsed.branchId;
                } catch { continue; }
            }
            return sessionStorage.getItem("branchId") || "";
        };
        setBranchId(getSessionBranch());
    }, []);

    // 👨‍💼 Load staff list based on branch
    useEffect(() => {
        if (!branchId) return;

        const fetchStaff = async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, "staffMembers"), where("branchId", "==", branchId))
                );
                const names = snap.docs.map((d) => d.data().fullName).filter(Boolean);
                setStaffList([...new Set(names)]); // Remove duplicates
            } catch (err) {
                console.error("Staff fetch error:", err);
            }
        };

        fetchStaff();
    }, [branchId]);

    const fetchReport = async () => {
        if (!branchId) {
            setError("No Branch ID found. Please log in again.");
            return;
        }
        if (!startDate || !endDate) {
            setError("Please select both start and end dates.");
            return;
        }

        setLoading(true);
        setError("");
        setNoData(false);

        try {
            const q = query(collection(db, "loans"), where("branchId", "==", branchId));
            const snap = await getDocs(q);
            
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include the full end day

            let temp = {};

            snap.forEach((doc) => {
                const loan = doc.data();
                const loanDate = new Date(loan.disbursementDate);

                // Filters
                if (loanDate < start || loanDate > end) return;
                if (staffFilter && loan.staffName !== staffFilter) return;

                const group = loan.groupName || "Individual / No Group";
                const principal = parseFloat(loan.principal || 0);

                if (!temp[group]) {
                    temp[group] = {
                        loans: [],
                        groupTotal: { count: 0, principal: 0 },
                    };
                }

                temp[group].loans.push({
                    id: doc.id,
                    ...loan,
                    principal
                });

                temp[group].groupTotal.count += 1;
                temp[group].groupTotal.principal += principal;
            });

            setReportData(temp);
            if (Object.keys(temp).length === 0) setNoData(true);
        } catch (err) {
            console.error("Report error:", err);
            setError("Failed to generate report. Check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const overallTotals = Object.values(reportData).reduce(
        (acc, g) => {
            acc.count += g.groupTotal.count;
            acc.principal += g.groupTotal.principal;
            return acc;
        },
        { count: 0, principal: 0 }
    );

 const handlePrint = () => {
    const printContent = document.getElementById("printArea");

    const printWindow = window.open("", "_blank", "width=900,height=800");

    const selectedStaff = staffFilter ? staffFilter : "All Staff";
    const today = new Date().toLocaleDateString("en-SL");

    printWindow.document.write(`
        <html>
            <head>
                <title>Group Transaction Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h2 { margin-bottom: 5px; }
                    .report-info { margin-bottom: 20px; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
                    th { background-color: #f3f4f6; }
                    .text-right { text-align: right; }
                    .footer { margin-top: 40px; font-size: 12px; }
                </style>
            </head>
            <body>
                <h2 style="text-align:center;">Group Transaction Report</h2>

                <div class="report-info">
                    <p><strong>Staff:</strong> ${selectedStaff}</p>
                    <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
                    <p><strong>Printed On:</strong> ${today}</p>
                </div>

                ${printContent.innerHTML}

                <div class="footer">
                    <p>__________________________</p>
                    <p>Authorized Signature</p>
                </div>
            </body>
        </html>
    `);

    printWindow.document.close();

    printWindow.onload = function () {
        printWindow.focus();
        printWindow.print();
    };
};



    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="bg-white p-6 rounded-xl shadow-sm max-w-6xl mx-auto border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Group Transaction Report</h2>

                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Field Staff</label>
                        <select
                            value={staffFilter}
                            onChange={(e) => setStaffFilter(e.target.value)}
                            className="border p-2 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">All Staff</option>
                            {staffList.map((s, i) => <option key={i} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">From</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded-lg outline-none" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded-lg outline-none" />
                    </div>

                    <div className="flex items-end gap-2 md:col-span-2">
                        <button 
                            onClick={fetchReport} 
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? <FaSpinner className="animate-spin" /> : <><FaSearch /> Filter</>}
                        </button>

                        <button 
                            onClick={handlePrint} 
                            disabled={!Object.keys(reportData).length} 
                            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <FaPrint />
                        </button>
                    </div>
                </div>

                {error && <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-lg border border-red-200">{error}</div>}
                {noData && <div className="p-3 mb-4 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">No transactions found for the selected criteria.</div>}

                {/* Report Content */}
                <div id="printArea">
                    {Object.keys(reportData).map((group) => (
                        <div key={group} className="mb-10">
                            <div className="bg-gray-100 p-3 rounded-t-lg border-x border-t flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 uppercase tracking-wide">Group: {group}</h3>
                                <span className="text-sm font-medium">{reportData[group].groupTotal.count} Loans</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-200">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="border p-3 text-left">Client ID</th>
                                            <th className="border p-3 text-left">Client Name</th>
                                            <th className="border p-3 text-left">Loan ID</th>
                                            <th className="border p-3 text-right">Principal</th>
                                            <th className="border p-3 text-left">Disbursement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData[group].loans.map((loan) => (
                                            <tr key={loan.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="border p-3">{loan.clientId}</td>
                                                <td className="border p-3 font-medium">{loan.clientName}</td>
                                                <td className="border p-3 text-gray-600">{loan.loanId}</td>
                                                <td className="border p-3 text-right font-semibold">
                                                    {formatCurrency(loan.principal)}
                                                </td>
                                                <td className="border p-3 whitespace-nowrap">
                                                    {formatDate(loan.disbursementDate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-bold">
                                            <td colSpan="3" className="border p-3 text-right">Group Total:</td>
                                            <td className="border p-3 text-right text-blue-700">
                                                {formatCurrency(reportData[group].groupTotal.principal)}
                                            </td>
                                            <td className="border p-3"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ))}

                    {Object.keys(reportData).length > 0 && (
                        <div className="mt-8 p-6 bg-blue-900 text-white rounded-xl flex justify-between items-center">
                            <div>
                                <p className="text-blue-200 text-sm uppercase font-bold">Overall Summary</p>
                                <p className="text-3xl font-bold">{overallTotals.count} <span className="text-lg font-normal">Loans Total</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-blue-200 text-sm uppercase font-bold">Total Disbursed</p>
                                <p className="text-3xl font-bold">{formatCurrency(overallTotals.principal)}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}