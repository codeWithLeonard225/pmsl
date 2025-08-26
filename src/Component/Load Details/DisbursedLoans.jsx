import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import {
    collection,
    query,
    onSnapshot
} from 'firebase/firestore';

/**
 * A report that lists all loans that have been disbursed.
 * This component fetches data directly from the 'loans' collection and
 * calculates outstanding balances based on the payments collection.
 */
function DisbursedLoans() {
    const [disbursedLoans, setDisbursedLoans] = useState([]);
    const [loansData, setLoansData] = useState([]);
    const [paymentsData, setPaymentsData] = useState([]);
    const [staffNames, setStaffNames] = useState([]);
    const [staffNameFilter, setStaffNameFilter] = useState("");
    const [startDateFilter, setStartDateFilter] = useState("");
    const [endDateFilter, setEndDateFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch all loans and payments once when the component mounts
    useEffect(() => {
        const loansCollectionRef = collection(db, 'loans');
        const paymentsCollectionRef = collection(db, 'payments');

        setLoading(true);
        setError('');

        const unsubscribeLoans = onSnapshot(loansCollectionRef, (snapshot) => {
            const fetchedLoans = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            
            // Store all fetched loans in state to be filtered later
            setLoansData(fetchedLoans);

            // Extract unique staff names from fetched loans for the dropdown filter
            const uniqueStaffNames = [...new Set(fetchedLoans.map((loan) => loan.staffName))];
            setStaffNames(uniqueStaffNames);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching loans data:", err);
            setError("Failed to load disbursed loans report. Please try again.");
            setLoading(false);
        });

        const unsubscribePayments = onSnapshot(paymentsCollectionRef, (snapshot) => {
            const fetchedPayments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setPaymentsData(fetchedPayments);
        }, (err) => {
            console.error("Error fetching payments data:", err);
            setError("Failed to load payments data. Please try again.");
        });

        // Clean up the subscriptions on unmount
        return () => {
            unsubscribeLoans();
            unsubscribePayments();
        };
    }, []);

    // Apply filters and calculate outstanding balance whenever data or filters change
    useEffect(() => {
        if (loading) return;

        // Summarize payments by loanId for quick lookups
        const paymentsSummaryMap = paymentsData.reduce((acc, payment) => {
            const loanId = payment.loanId;
            if (!acc[loanId]) {
                acc[loanId] = { repaymentAmount: 0 };
            }
            acc[loanId].repaymentAmount += parseFloat(payment.repaymentAmount || 0);
            return acc;
        }, {});

        const filtered = loansData.filter(loan => {
            // Check if the loan's disbursement date is within the selected date range
            if (startDateFilter && loan.disbursementDate < startDateFilter) {
                return false;
            }
            if (endDateFilter && loan.disbursementDate > endDateFilter) {
                return false;
            }
            // Check if the loan's staff name matches the selected filter
            if (staffNameFilter && loan.staffName.toLowerCase() !== staffNameFilter.toLowerCase()) {
                return false;
            }
            return true;
        }).map(loan => {
            // Calculate outstanding balance
            const totalRepaid = paymentsSummaryMap[loan.loanId]?.repaymentAmount || 0;
            const outstandingBalance = (parseFloat(loan.principal) - totalRepaid).toFixed(2);
            return { ...loan, outstandingBalance };
        });

        setDisbursedLoans(filtered);
    }, [loansData, paymentsData, staffNameFilter, startDateFilter, endDateFilter, loading]);


    if (loading) {
        return <div className="container mx-auto p-6 text-center text-gray-600">Loading disbursed loans report...</div>;
    }

    if (error) {
        return <div className="container mx-auto p-6 text-center text-red-500">{error}</div>;
    }

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Disbursed Loans Report</h1>
                <p className="text-gray-600 mb-6">
                    A list of all loans that have been successfully approved and disbursed.
                </p>
                {/* Filters section */}
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

                {disbursedLoans.length === 0 ? (
                    <p className="text-center text-gray-500">No disbursed loans found matching your filters.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-inner">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-green-600 text-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Client ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Principal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Interest Rate</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Disbursement Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Repayment Weeks</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Outstanding Balance</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {disbursedLoans.map((loan, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.loanId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.clientId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.clientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${loan.principal?.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.interestRate}%</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.loanType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.disbursementDate}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.paymentWeeks}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-500">${loan.outstandingBalance}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DisbursedLoans;
