import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { MdPeople, MdTrendingUp, MdAttachMoney, MdOutlineGavel, MdOutlineWatchLater } from "react-icons/md";

// Helper for formatting large numbers to currency
const formatCurrency = (amount) => {
    return `SLE ${(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

// Helper for Card component
const StatCard = ({ icon, title, value, colorClass = "bg-blue-500" }) => (
    <div className={`p-5 rounded-xl shadow-lg text-white transform hover:scale-[1.02] transition-transform duration-300 ${colorClass}`}>
        <div className="flex items-center space-x-3">
            <div className="p-3 rounded-full bg-white bg-opacity-30">
                {React.cloneElement(icon, { size: 28 })}
            </div>
            <div>
                <p className="text-sm font-medium opacity-80">{title}</p>
                <h3 className="text-2xl font-bold mt-1">{value}</h3>
            </div>
        </div>
    </div>
);


function StaffDashboard() {
    const [staffData, setStaffData] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loans, setLoans] = useState([]); // Still fetch loans for Total Principal/Active Count
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1. Load logged-in staff data from sessionStorage
    useEffect(() => {
        const savedStaff = sessionStorage.getItem("staffData");
        if (savedStaff) {
            setStaffData(JSON.parse(savedStaff));
        }
    }, []);

    // 2. Fetch payments and loans filtered by staff's credentials
    useEffect(() => {
        if (!staffData || !staffData.branchId || !staffData.fullName) {
            setLoading(false);
            return;
        }

        const { branchId, fullName: staffName } = staffData;
        setLoading(true);
        setError(null);

        // --- Fetch Payments ---
        const paymentsCollectionRef = collection(db, "payments");
        const qPayments = query(
            paymentsCollectionRef,
            where("branchId", "==", branchId),
            where("staffName", "==", staffName)
        );

        const unsubscribePayments = onSnapshot(
            qPayments,
            (snapshot) => {
                const fetchedPayments = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setPayments(fetchedPayments);
            },
            (err) => {
                console.error("Error fetching payments:", err);
                setError("Failed to load payments data.");
            }
        );

        // --- Fetch Loans (Needed for total principal, active loan count, etc.) ---
        const loansCollectionRef = collection(db, "loans");
        const qLoans = query(
            loansCollectionRef,
            where("branchId", "==", branchId),
            where("staffName", "==", staffName)
        );

        const unsubscribeLoans = onSnapshot(qLoans, (snapshot) => {
            const fetchedLoans = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setLoans(fetchedLoans);
            setLoading(false); // Set loading to false once loans (the last collection) is fetched
        }, (err) => {
            console.error("Error fetching loans:", err);
            setError("Failed to load loan summary data.");
            setLoading(false);
        });


        return () => {
            unsubscribePayments();
            unsubscribeLoans();
        };
    }, [staffData]);

    // 3. Calculation Logic using useMemo for efficiency (Stats Card Data)
    const dashboardStats = useMemo(() => {
        // Total Clients: Unique clients found in the LOANS list (regardless of payment activity)
        const uniqueClientIds = [...new Set(loans.map(loan => loan.clientId))];
        const totalClients = uniqueClientIds.length;

        // Active Loans
        const activeLoans = loans.filter(loan => loan.loanOutcome === 'Disbursed').length;

        // Total Principal Disbursed
        const totalPrincipal = loans.reduce((sum, loan) => sum + (parseFloat(loan.principal) || 0), 0);

        // Total Repayment Collected
        const totalRepaid = payments.reduce((sum, payment) => sum + (parseFloat(payment.repaymentAmount) || 0), 0);

        // Repayment Ratio (Vs. Principal - Simple metric)
        const repaymentRatio = totalPrincipal > 0 ? (totalRepaid / totalPrincipal) * 100 : 0;

        return {
            totalClients,
            activeLoans,
            totalPrincipal,
            totalRepaid,
            repaymentRatio,
        };
    }, [payments, loans]);

    // 4. Grouping logic for the summary table (UPDATED DATE LOGIC HERE)
    const groupedLoanSummary = useMemo(() => {
        const summary = {};

        payments.forEach(p => {
            const loanId = p.loanId;
            const key = loanId;

            // Extract essential repayment figures from the payment record
            const loanOutstanding = parseFloat(p.loanOutstanding) || 0; // The total due (Principal + Interest)
            const principal = parseFloat(p.principal) || 0;
            const actualAmount = parseFloat(p.actualAmount) || 0; // Weekly/Periodic amount
            const repaymentAmount = parseFloat(p.repaymentAmount) || 0;

            // --- UPDATED DATE EXTRACTION LOGIC ---
            // Prioritize 'date' column, then fall back to 'createdAt' Firestore Timestamp/string
            let rawDate = p.date || p.createdAt;
let paymentDate = null;

if (rawDate) {
  paymentDate = typeof rawDate.toDate === "function"
    ? rawDate.toDate()
    : new Date(rawDate);
}

            // ------------------------------------

            if (!summary[key]) {
                // Initialize
                summary[key] = {
                    loanId,
                    clientName: p.fullName || 'N/A',
                    groupName: p.groupName || 'N/A',
                    principal,
                    loanOutstanding,
                    actualAmount,
                    totalRepaid: 0,
                    latestPaymentDate: paymentDate, // Use the extracted Date object
                };
            }

            // Sum the repayment amounts from ALL payments for this loan
            summary[key].totalRepaid += repaymentAmount;

            // Update latest payment date
            // Ensure paymentDate is a valid Date object before comparison
            if (paymentDate instanceof Date && !isNaN(paymentDate) &&
                (!summary[key].latestPaymentDate || paymentDate > summary[key].latestPaymentDate)) {

                summary[key].latestPaymentDate = paymentDate;

                // If this is the latest payment, update outstanding/actual amount fields too
                summary[key].loanOutstanding = loanOutstanding;
                summary[key].actualAmount = actualAmount;
            }

        });

        // Finalize calculations
        return Object.values(summary).map(loan => {
            const remainingBalance = loan.loanOutstanding - loan.totalRepaid;

            const weeksPaid =
                loan.actualAmount !== 0
                    ? loan.totalRepaid / loan.actualAmount
                    : 0;

            // Format the date for display
            const displayDate =
                loan.latestPaymentDate instanceof Date && !isNaN(loan.latestPaymentDate)
                    ? loan.latestPaymentDate.toLocaleDateString()
                    : 'N/A';

            return {
                ...loan,
                remainingBalance,
                weeksPaid: Math.round(weeksPaid), // Round weeks paid for display
                status: remainingBalance <= 0 ? "Paid Off" : "In Progress",
                latestPaymentDate: displayDate,
            };
        }).sort((a, b) => {
            // Sort by the actual Date object before it was converted to string, 
            // or fall back to comparing the loanId if dates are invalid/missing
            const dateA = a.latestPaymentDate === 'N/A' ? new Date(0) : new Date(a.latestPaymentDate);
            const dateB = b.latestPaymentDate === 'N/A' ? new Date(0) : new Date(b.latestPaymentDate);

            return dateB.getTime() - dateA.getTime();
        });
    }, [payments]);


    // 5. Render Logic (remains unchanged)
    if (!staffData) {
        return (
            <div className="p-8 text-center text-red-600 bg-white rounded-xl shadow-md">
                Error: Staff data not found. Please ensure you are logged in.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-md">
                Loading Staff Dashboard data for {staffData.fullName}...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-600 bg-white rounded-xl shadow-md">
                {error}
            </div>
        );
    }

    return (
        <div className="p-0 font-sans">
            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                    {staffData.fullName}'s Loan Portfolio Dashboard
                </h1>
                <p className="mb-6 text-gray-600">
                    Branch: <span className="font-semibold">{staffData.branchId}</span>
                </p>

                {/* --- STAT CARDS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <StatCard
                        icon={<MdPeople />}
                        title="Total Clients"
                        value={dashboardStats.totalClients}
                        colorClass="bg-indigo-600"
                    />
                    <StatCard
                        icon={<MdOutlineGavel />}
                        title="Active Loans"
                        value={dashboardStats.activeLoans}
                        colorClass="bg-green-600"
                    />
                    <StatCard
                        icon={<MdAttachMoney />}
                        title="Total Repayment Collected"
                        value={` (${dashboardStats.repaymentRatio.toFixed(1)}%)`}
                        colorClass="bg-yellow-600"
                    />

                    <StatCard
                        icon={<MdTrendingUp />}
                        title="Repayment Ratio (Vs. Principal)"
                        value={`${dashboardStats.repaymentRatio.toFixed(1)}%`}
                        colorClass="bg-red-600"
                    />
                </div>

                {/* --- LOAN SUMMARY TABLE --- */}
                <h2 className="text-xl md:text-2xl font-bold text-gray-700 mt-8 mb-4 border-b pb-2">
                    Loan Summary ({groupedLoanSummary.length} Loans with Repayments)
                </h2>

                <div className="overflow-x-auto shadow-md rounded-lg">
                    <table className="w-full border-collapse text-xs md:text-sm min-w-[1100px]">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border p-3 text-left">Client/Group</th>
                                <th className="border p-3">Loan ID</th>
                                <th className="border p-3">Principal (Start)</th>
                                <th className="border p-3">Weekly Amount</th>
                                <th className="border p-3">Total Outstanding (Due)</th>
                                <th className="border p-3">Total Repaid</th>
                                <th className="border p-3">Weeks Paid</th>
                                <th className="border p-3">Remaining Balance</th>
                                {/* <th className="border p-3">Latest Payment</th> */}
                                <th className="border p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedLoanSummary.length > 0 ? (
                                groupedLoanSummary.map((loan) => (
                                    <tr key={loan.loanId} className="hover:bg-gray-50 transition-colors">
                                        <td className="border p-3 text-left">
                                            <span className="font-semibold">{loan.clientName}</span>
                                            <br /><span className="text-xs text-gray-500">{loan.groupName}</span>
                                        </td>
                                        <td className="border p-3">{loan.loanId}</td>
                                        <td className="border p-3">{formatCurrency(loan.principal)}</td>
                                        <td className="border p-3">{formatCurrency(loan.actualAmount)}</td>
                                        <td className="border p-3">{formatCurrency(loan.loanOutstanding)}</td>
                                        <td className="border p-3 font-medium text-green-600">{formatCurrency(loan.totalRepaid)}</td>
                                        <td className="border p-3">{loan.weeksPaid}</td>
                                        <td className="border p-3 font-semibold text-red-600">{formatCurrency(loan.remainingBalance)}</td>
                                        {/* <td className="border p-3">{loan.latestPaymentDate}</td> */}
                                        <td className={`border p-3 font-semibold ${loan.status === 'Paid Off' ? 'text-blue-500' : 'text-orange-500'}`}>
                                            {loan.status}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="10" className="text-center p-4 text-gray-500">
                                        No loan repayment data found for your portfolio.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default StaffDashboard;