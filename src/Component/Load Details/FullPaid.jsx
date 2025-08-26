import React, { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { collection, onSnapshot } from "firebase/firestore";

/**
 * A report that lists all loans that have been fully paid.
 * This component fetches payments data in real-time and calculates
 * which loans have a total repayment amount equal to or greater than the outstanding balance.
 */
export default function FullPaid() {
    const [fullyPaidLoans, setFullyPaidLoans] = useState([]);
    const [paymentsData, setPaymentsData] = useState([]);
    const [staffNames, setStaffNames] = useState([]);
    const [staffNameFilter, setStaffNameFilter] = useState("");
    const [startDateFilter, setStartDateFilter] = useState("");
    const [endDateFilter, setEndDateFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch payments data in real-time using onSnapshot
    useEffect(() => {
        setLoading(true);
        setError('');

        const paymentsCollectionRef = collection(db, "payments");
        const unsubscribe = onSnapshot(
            paymentsCollectionRef,
            (snapshot) => {
                const fetchedData = snapshot.docs.map((doc) => doc.data());
                setPaymentsData(fetchedData);
                setLoading(false);

                // Extract unique staff names for the dropdown
                const uniqueStaffNames = [...new Set(fetchedData.map((p) => p.staffName))];
                setStaffNames(uniqueStaffNames);
            },
            (err) => {
                console.error("Error fetching payments:", err);
                setError("Failed to load fully paid loans report. Please try again.");
                setLoading(false);
            }
        );

        // Cleanup function to unsubscribe from real-time updates
        return () => unsubscribe();
    }, []);

    // Process and filter the data whenever the payments list or filters change
    useEffect(() => {
        if (loading) return;

        // Group payments by loanId
        const groupedPayments = paymentsData.reduce((acc, p) => {
            const key = p.loanId;
            if (!acc[key]) {
                acc[key] = { repaymentAmount: 0 };
            }
            acc[key].repaymentAmount += parseFloat(p.repaymentAmount || 0);
            return acc;
        }, {});

        // Process and filter the loans
        const results = paymentsData.filter(p => {
            // Apply staff name filter
            const matchesStaff = !staffNameFilter || p.staffName.toLowerCase() === staffNameFilter.toLowerCase();
            // Apply date range filter
            const matchesDate = (!startDateFilter || p.repaymentStartDate >= startDateFilter) &&
                                (!endDateFilter || p.repaymentStartDate <= endDateFilter);
            
            return matchesStaff && matchesDate;
        }).reduce((acc, p) => {
            const key = `${p.clientId}_${p.loanId}`;
            if (!acc[key]) {
                const totalRepaid = groupedPayments[p.loanId]?.repaymentAmount || 0;
                const loanBalance = parseFloat(totalRepaid) - parseFloat(p.loanOutstanding);
                const principalBalance = (parseFloat(p.principal || 0) - totalRepaid);
                
                acc[key] = {
                    ...p,
                    repaymentAmount: totalRepaid,
                    loanBalance,
                    principalBalance,
                };
            }
            return acc;
        }, {});

        // Filter for only loans that are fully paid
        setFullyPaidLoans(
            Object.values(results).filter(loan => loan.loanBalance >= 0)
        );

    }, [paymentsData, staffNameFilter, startDateFilter, endDateFilter, loading]);


    if (loading) {
        return (
            <div className="p-4 text-center text-gray-500">
                Loading fully paid loans...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-center text-red-500">
                {error}
            </div>
        );
    }

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Fully Paid Loans Report</h2>
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
            
            {fullyPaidLoans.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                    No fully paid loans match your criteria.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-inner">
                    <table className="min-w-full bg-white border border-gray-300">
                        <thead>
                            <tr className="bg-green-600 text-white">
                                <th className="border px-4 py-2">Client ID</th>
                                <th className="border px-4 py-2">Full Name</th>
                                <th className="border px-4 py-2">Loan ID</th>
                                <th className="border px-4 py-2">Loan Type</th>
                                <th className="border px-4 py-2">Principal (SLE)</th>
                                <th className="border px-4 py-2">Total Paid (SLE)</th>
                                <th className="border px-4 py-2">Loan Balance (SLE)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fullyPaidLoans.map((loan, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="border px-4 py-2">{loan.clientId}</td>
                                    <td className="border px-4 py-2">{loan.fullName}</td>
                                    <td className="border px-4 py-2">{loan.loanId}</td>
                                    <td className="border px-4 py-2">{loan.loanType}</td>
                                    <td className="border px-4 py-2">{loan.principal.toLocaleString()}</td>
                                    <td className="border px-4 py-2">{loan.repaymentAmount.toLocaleString()}</td>
                                    <td className="border px-4 py-2 font-semibold" style={{ color: loan.loanBalance >= 0 ? 'green' : 'red' }}>
                                        {loan.loanBalance.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
