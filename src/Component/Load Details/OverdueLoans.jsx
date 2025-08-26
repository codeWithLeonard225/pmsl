// src/components/OverdueLoans.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import {
    collection,
    getDocs,
    onSnapshot,
} from 'firebase/firestore';

/**
 * Calculates the number of full weeks that have passed between two dates.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number}
 */
const getWeeksPassed = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const diffInMilliseconds = endDate.getTime() - startDate.getTime();
    return Math.floor(diffInMilliseconds / oneWeek);
};

/**
 * A report that identifies and lists loans that are considered overdue.
 * A loan is considered overdue if the total number of payments made is less than
 * the number of weeks that have passed since the repayment start date, AND
 * there is still an outstanding loan balance.
 */
function OverdueLoans() {
    const [overdueLoans, setOverdueLoans] = useState([]);
    const [loansData, setLoansData] = useState([]);
    const [paymentsData, setPaymentsData] = useState([]);
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

                const fetchedLoans = loansSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                const fetchedPayments = paymentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                setLoansData(fetchedLoans);
                setPaymentsData(fetchedPayments);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load overdue loans report. Please try again.");
                setLoading(false);
            }
        };

        fetchAllData();
    }, []);

    // Process data to find overdue loans whenever loans or payments data changes
    useEffect(() => {
        if (loading) return;

        // Group payments by loan ID to get a count of payments made
        const paymentsCountMap = paymentsData.reduce((acc, payment) => {
            const loanId = payment.loanId;
            acc[loanId] = (acc[loanId] || 0) + 1;
            return acc;
        }, {});

        // Create a map of loans for quick lookup
        const loansMap = loansData.reduce((acc, loan) => {
            acc[loan.loanId] = loan;
            return acc;
        }, {});
        
        // Process payments and check for overdue status
        const processedLoans = paymentsData.reduce((acc, payment) => {
            // Check if this loan has already been processed and added
            const isProcessed = acc.find(loan => loan.loanId === payment.loanId);
            if (isProcessed) return acc;
            
            const loanDetails = loansMap[payment.loanId];
            if (!loanDetails) return acc; // Skip if no matching loan data found

            const paymentsMade = paymentsCountMap[payment.loanId] || 0;
            const startDate = new Date(loanDetails.repaymentStartDate);
            const weeksPassed = getWeeksPassed(startDate, new Date());
            
            // Bal(P) calculation using the provided formula
            // (principal / paymentWeeks) * number of payments made - principal
            const principalPerWeek = parseFloat(loanDetails.principal) / parseInt(loanDetails.paymentWeeks);
            const balP = (principalPerWeek * paymentsMade) - parseFloat(loanDetails.principal);

            // An overdue loan has a balance and fewer payments than weeks passed
            if (loanDetails.loanOutstanding > 0 && weeksPassed > paymentsMade) {
                acc.push({
                    ...loanDetails,
                    paymentsMade,
                    weeksPassed,
                    balP: balP || 0
                });
            }

            return acc;
        }, []);

        setOverdueLoans(processedLoans);
    }, [loansData, paymentsData, loading]);

    if (loading) {
        return <div className="container mx-auto p-6 text-center text-gray-600">Loading overdue loans report...</div>;
    }

    if (error) {
        return <div className="container mx-auto p-6 text-center text-red-500">{error}</div>;
    }

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Overdue Loans Report</h1>
                <p className="text-gray-600 mb-6">
                    Loans that are behind on their payments.
                </p>
                
                {overdueLoans.length === 0 ? (
                    <p className="text-center text-gray-500">No overdue loans found. Great job!</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-inner">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-red-600 text-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Client ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Principal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Payments Made</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Weeks Passed</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Bal(P) (SLE)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {overdueLoans.map((loan, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.clientId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.fullName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.loanId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.loanType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.principal?.toLocaleString()} SLE</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.paymentsMade}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.weeksPassed}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{loan.balP?.toLocaleString()} SLE</td>
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

export default OverdueLoans;
