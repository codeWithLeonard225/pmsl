import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import {
    collection,
    query,
    onSnapshot,
    orderBy
} from 'firebase/firestore';

/**
 * Renders a detailed report of all payments, grouped by client and loan.
 * It fetches payment data from Firestore and performs calculations for:
 * - The end date of the loan ('Close On')
 * - The current loan balance
 * - The principal balance ('Bal(P)')
 */
function PaymentDetails() {
    // State to store the fetched payments and the final, processed data
    const [paymentsList, setPaymentsList] = useState([]);
    const [groupedPayments, setGroupedPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /**
     * Helper function to calculate the loan close date.
     * @param {string} startDateString - The loan repayment start date string (YYYY-MM-DD).
     * @param {number} paymentWeeks - The total number of payment weeks.
     * @returns {string} - The calculated end date in a readable format.
     */
    const calculateCloseDate = (startDateString, paymentWeeks) => {
        if (!startDateString || paymentWeeks <= 0) {
            return 'N/A';
        }
        const startDate = new Date(startDateString);
        // Add paymentWeeks to the start date (each week is 7 days)
        const endDate = new Date(startDate.getTime());
        endDate.setDate(endDate.getDate() + paymentWeeks * 7);
        return endDate.toISOString().slice(0, 10);
    };

    /**
     * Main useEffect hook to fetch payment data from Firestore in real-time.
     * It listens for changes and then processes the data to create the grouped report.
     */
    useEffect(() => {
        const paymentsCollectionRef = collection(db, 'payments');
        const q = query(paymentsCollectionRef, orderBy('createdAt', 'desc'));

        setLoading(true);
        setError('');

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPayments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setPaymentsList(fetchedPayments);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching payments from Firestore:", err);
            setError("Failed to load payment details. Please check your network or try again.");
            setLoading(false);
        });

        // Clean up the subscription on unmount
        return () => unsubscribe();
    }, []);

    /**
     * useEffect hook to process the raw payments list into the final grouped report.
     * This runs whenever paymentsList changes.
     */
    useEffect(() => {
        // Use a Map to group payments by a unique key (clientId + loanId)
        const groupedMap = new Map();

        paymentsList.forEach(payment => {
            const key = `${payment.clientId}-${payment.loanId}`;

            if (!groupedMap.has(key)) {
                // If this is the first payment for this loan, initialize the entry
                groupedMap.set(key, {
                    clientId: payment.clientId,
                    fullName: payment.fullName,
                    loanId: payment.loanId,
                    loanType: payment.loanType,
                    repaymentStartDate: payment.repaymentStartDate,
                    principal: payment.principal,
                    paymentWeeks: payment.paymentWeeks,
                    paymentsMade: 0,
                    totalRepaymentAmount: 0,
                    loanOutstanding: payment.loanOutstanding, // Store the most recent outstanding value
                    allPayments: []
                });
            }

            // Get the current entry and update it with data from the current payment
            const entry = groupedMap.get(key);
            entry.paymentsMade += 1;
            entry.totalRepaymentAmount += payment.repaymentAmount;
            entry.loanOutstanding = payment.loanOutstanding; // Always use the latest loan outstanding
            entry.allPayments.push(payment);
        });

        // Convert the map values to an array and perform final calculations
        const processedPayments = Array.from(groupedMap.values()).map(entry => {
            // CloseOn: Calculate the end date based on the loan's terms
            const closeOn = calculateCloseDate(entry.repaymentStartDate, entry.paymentWeeks);

            // Loan Balance: Sum of all repayments minus the total loan outstanding
            // NOTE: The user's requested formula is 'sum(repaymentAmount) - loanOutstanding'.
            // This will result in a negative number for a non-fully paid loan.
            // A more conventional 'loan balance' would be 'loanOutstanding - totalRepaymentAmount'.
            // I am implementing the user's requested formula.
            const loanBalance = entry.totalRepaymentAmount - entry.loanOutstanding;

            // Bal(P): A calculation based on a formula provided by the user.
            // (principal / paymentWeeks) * number of payments made - principal
            const principalPerWeek = entry.principal / entry.paymentWeeks;
            const balP = (principalPerWeek * entry.paymentsMade) - entry.principal;
            
            return {
                clientId: entry.clientId,
                fullName: entry.fullName,
                loanId: entry.loanId,
                loanType: entry.loanType,
                repaymentStartDate: entry.repaymentStartDate,
                principal: entry.principal,
                paymentWeeks: entry.paymentWeeks,
                closeOn: closeOn,
                loanBalance: loanBalance,
                balP: balP,
            };
        });

        setGroupedPayments(processedPayments);
    }, [paymentsList]);

    if (loading) {
        return <div className="container mx-auto p-6 text-center text-gray-600">Loading payment details...</div>;
    }

    if (error) {
        return <div className="container mx-auto p-6 text-center text-red-500">{error}</div>;
    }

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Details Report</h1>
                <p className="text-gray-600 mb-6">
                    A summary of all payments, grouped by loan and client.
                </p>
                
                {groupedPayments.length === 0 ? (
                    <p className="text-center text-gray-500">No payment records found.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-inner">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-green-600 text-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Client ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Repayment Start Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Principal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Payment Weeks</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Close On</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Loan Balance</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Bal(P)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {groupedPayments.map((report, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{report.clientId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.fullName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.loanId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.loanType}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.repaymentStartDate}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${report.principal?.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.paymentWeeks}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.closeOn}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${report.loanBalance?.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${report.balP?.toFixed(2)}</td>
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

export default PaymentDetails;
