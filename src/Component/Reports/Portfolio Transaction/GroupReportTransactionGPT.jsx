import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { FaSpinner, FaPrint } from "react-icons/fa";

// Currency formatter
const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-SL", { style: "currency", currency: "SLE" }).format(amount);

// Date formatter
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
    const [staffList, setStaffList] = useState([]);
    const [branchId, setBranchId] = useState("");
    const [error, setError] = useState("");
    const [noData, setNoData] = useState(false);

    // 🔐 Load branchId from session
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        let found = null;

        keys.forEach((key) => {
            const val = sessionStorage.getItem(key);
            if (val && val.includes("branchId")) {
                try {
                    found = JSON.parse(val);
                } catch { }
            }
        });

        setBranchId(found?.branchId || sessionStorage.getItem("branchId") || "");
    }, []);

    // 👨‍💼 Load staff list (branch-based)
    useEffect(() => {
        if (!branchId) return;

        const fetchStaff = async () => {
            const snap = await getDocs(
                query(
                    collection(db, "staffMembers"),
                    where("branchId", "==", branchId)
                )
            );
            setStaffList(snap.docs.map((d) => d.data().fullName));
        };

        fetchStaff();
    }, [branchId]);

    // 📊 Fetch & filter report (JS filtering)
    const fetchReport = async () => {
        setLoading(true);
        setError("");
        setNoData(false);
        setReportData({});

        if (!startDate || !endDate) {
            setError("Please select start and end dates.");
            setLoading(false);
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setError("Start date cannot be after end date.");
            setLoading(false);
            return;
        }

        try {
            const q = query(
                collection(db, "loans"),
                where("branchId", "==", branchId)
            );

            const snap = await getDocs(q);
            const start = new Date(startDate);
            const end = new Date(endDate);
            let temp = {};

            snap.forEach((doc) => {
                const loan = doc.data();
                const loanDate = new Date(loan.disbursementDate);

                // JS date filter
                if (loanDate < start || loanDate > end) return;

                // Staff filter
                if (staffFilter && loan.staffName !== staffFilter) return;

                const group = loan.groupName || "N/A";
                const principal = parseFloat(loan.principal || 0);

                if (!temp[group]) {
                    temp[group] = {
                        loans: [],
                        groupTotal: { count: 0, principal: 0 },
                    };
                }

                temp[group].loans.push({
                    id: doc.id,
                    clientId: loan.clientId,
                    clientName: loan.clientName,
                    loanId: loan.loanId,
                    principal,
                    disbursementDate: loan.disbursementDate,
                });

                temp[group].groupTotal.count += 1;
                temp[group].groupTotal.principal += principal;
            });

            setReportData(temp);
            if (Object.keys(temp).length === 0) setNoData(true);
        } catch (err) {
            console.error(err);
            setError("Failed to load report.");
        } finally {
            setLoading(false);
        }
    };

    // Totals
    const overallTotals = Object.values(reportData).reduce(
        (acc, g) => {
            acc.count += g.groupTotal.count;
            acc.principal += g.groupTotal.principal;
            return acc;
        },
        { count: 0, principal: 0 }
    );

    // 🖨 Print
    const handlePrint = () => {
        const content = document.getElementById("printArea").innerHTML;
        const win = window.open("", "", "width=900,height=650");
        win.document.write(`<html><body>${content}</body></html>`);
        win.document.close();
        win.print();
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="bg-white p-6 rounded shadow max-w-6xl mx-auto">
                <h2 className="text-2xl font-bold mb-4">Group Transaction Report</h2>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <select
                        value={staffFilter}
                        onChange={(e) => setStaffFilter(e.target.value)}
                        className="border p-2 rounded"
                    >
                        <option value="">All Staff</option>
                        {staffList.map((s, i) => (
                            <option key={i}>{s}</option>
                        ))}
                    </select>

                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded" />
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded" />

                    <button onClick={fetchReport} className="bg-blue-600 text-white px-4 rounded">
                        {loading ? <FaSpinner className="animate-spin" /> : "Filter"}
                    </button>

                    <button onClick={handlePrint} disabled={!Object.keys(reportData).length} className="bg-green-600 text-white px-4 rounded">
                        <FaPrint />
                    </button>
                </div>

                {error && <div className="text-red-600 mb-2">{error}</div>}
                {noData && <div className="text-yellow-600 mb-2">No data found.</div>}

                {/* Report */}
                <div id="printArea">
                    {Object.keys(reportData).map((group) => (
                        <div key={group} className="mb-6">
                            <h3 className="font-bold text-lg mb-2">Group: {group}</h3>
                            <table className="w-full border text-sm">
                              
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border p-2 text-left">Client ID</th>
                                            <th className="border p-2 text-left">Client Name</th>
                                            <th className="border p-2 text-left">Loan ID</th>
                                            <th className="border p-2 text-left">Principal</th>
                                            <th className="border p-2 text-left">Disbursement Date</th>
                                        </tr>
                                  

                                </thead>
                                <tbody>
                                    {reportData[group].loans.map((loan) => (
                                        <tr key={loan.id} className="hover:bg-gray-50">
                                            <td className="border p-2">{loan.clientId}</td>
                                            <td className="border p-2">{loan.clientName}</td>
                                            <td className="border p-2">{loan.loanId}</td>
                                            <td className="border p-2 text-right">
                                                {formatCurrency(loan.principal)}
                                            </td>
                                            <td className="border p-2">
                                                {formatDate(loan.disbursementDate)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                            <div className="text-right font-bold mt-2">
                                Total ({reportData[group].groupTotal.count} loans):{" "}
                                {formatCurrency(reportData[group].groupTotal.principal)}
                            </div>
                        </div>
                    ))}

                    {Object.keys(reportData).length > 0 && (
                        <div className="border-t pt-4 font-bold text-right">
                            Overall Total ({overallTotals.count} loans):{" "}
                            {formatCurrency(overallTotals.principal)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
