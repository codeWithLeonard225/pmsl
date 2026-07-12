import { useState, useEffect, useRef } from 'react';
import { db } from '../../../firebase';

// Import Firestore functions
import {
    collection,
    onSnapshot,
    query,
    where
} from 'firebase/firestore';

const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
            role="status"
            aria-label="Loading"
        >
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);

function LoanReport({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [error, setError] = useState(null);
    const [loanList, setLoanList] = useState([]);
    const [globalPaymentsList, setGlobalPaymentsList] = useState([]);
    
    // Dropdown Selection States
    const [selectedStaff, setSelectedStaff] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');
    
    const [loading, setLoading] = useState(true);
    const reportRef = useRef();

    const loansCollectionRef = collection(db, "loans");
    const paymentsCollectionRef = collection(db, "payments");

    useEffect(() => {
        let id = branch?.branchId || sessionStorage.getItem("branchId");
        if (id) {
            setBranchId(id);
            setError(null);
        } else {
            setError("Branch ID could not be determined. Please ensure you are logged in.");
            setLoading(false);
        }
    }, [branch]);

    // Fetch Loans in real-time
    useEffect(() => {
        if (!branchId || error) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const qLoans = query(loansCollectionRef, where('branchId', '==', branchId));

        const unsubscribeLoans = onSnapshot(qLoans, (snapshot) => {
            const fetchedLoans = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setLoanList(fetchedLoans);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching real-time loan data:", error);
            setError("Failed to load loan data.");
            setLoading(false);
        });

        return () => unsubscribeLoans();
    }, [branchId, error]);

    // Real-time listener to fetch branch payments
    useEffect(() => {
        if (!branchId || error) return;

        const qPayments = query(paymentsCollectionRef, where('branchId', '==', branchId));

        const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
            const fetchedPayments = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setGlobalPaymentsList(fetchedPayments);
        }, (error) => {
            console.error("Error fetching real-time payments snapshot data:", error);
        });

        return () => unsubscribePayments();
    }, [branchId, error]);

    const calculateClosingDate = (disburseDateStr, weeks) => {
        if (!disburseDateStr || !weeks) return "N/A";
        const date = new Date(disburseDateStr);
        if (isNaN(date.getTime())) return "Invalid Date";
        
        date.setDate(date.getDate() + (parseInt(weeks, 10) * 7));
        return date.toISOString().slice(0, 10);
    };

    const getLoanRepaymentsTotal = (targetLoanId) => {
        return globalPaymentsList
            .filter(payment => payment.loanId === targetLoanId)
            .reduce((sum, current) => sum + (parseFloat(current.repaymentAmount) || 0), 0);
    };

    // Computes status based on outstanding balance and maturity date
    const computeLoanStatus = (balanceRemaining, closingDateStr) => {
        if (balanceRemaining <= 0.01) {
            return { label: 'Fully Paid', classes: 'bg-green-100 text-green-800' };
        }
        
        const todayStr = new Date().toISOString().slice(0, 10);
        if (closingDateStr !== "N/A" && closingDateStr !== "Invalid Date" && todayStr > closingDateStr) {
            return { label: 'Overdue', classes: 'bg-red-100 text-red-800 font-bold' };
        }

        return { label: 'Processing', classes: 'bg-blue-100 text-blue-800' };
    };

    // Extract dynamic unique staff names from current database entries for the Dropdown menu
    const uniqueStaffNames = Array.from(
        new Set(loanList.map(loan => loan.staffName).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // Print Handler
    const handlePrint = () => {
        window.print();
    };

    // Processes, calculates metrics, filters, and sorts the baseline loan objects
    const processedLoans = loanList.map(loan => {
        const loanPrincipal = parseFloat(loan.principal || 0);
        const interestAmount = (loanPrincipal * (parseFloat(loan.interestRate || 0))) / 100;
        const totalOwed = loanPrincipal + interestAmount;
        
        const totalPaidSoFar = getLoanRepaymentsTotal(loan.loanId);
        const balanceRemaining = Math.max(0, totalOwed - totalPaidSoFar);
        const closingDate = calculateClosingDate(loan.disbursementDate, loan.paymentWeeks);
        const statusMeta = computeLoanStatus(balanceRemaining, closingDate);

        return {
            ...loan,
            loanPrincipal,
            totalOwed,
            totalPaidSoFar,
            balanceRemaining,
            closingDate,
            computedStatus: statusMeta.label,
            statusClasses: statusMeta.classes
        };
    });

    // Apply Dropdown Criteria Filters exclusively & Sort Alphabetically by Client Name
    const filteredLoans = processedLoans
        .filter(loan => {
            const matchesBranch = loan.branchId === branchId;
            const matchesStaff = selectedStaff === 'All' || loan.staffName === selectedStaff;
            const matchesStatus = selectedStatus === 'All' || loan.computedStatus === selectedStatus;
            
            return matchesBranch && matchesStaff && matchesStatus;
        })
        .sort((a, b) => (a.clientName || "").localeCompare(b.clientName || ""));

    // Group the resulting filtered loans array by Staff Representative
    const groupedLoansByStaff = filteredLoans.reduce((groups, loan) => {
        const staff = loan.staffName || "Unassigned Staff";
        if (!groups[staff]) {
            groups[staff] = [];
        }
        groups[staff].push(loan);
        return groups;
    }, {});

    const sortedStaffNames = Object.keys(groupedLoansByStaff).sort((a, b) => a.localeCompare(b));

    if (error) return <div className="text-red-600 p-4 bg-red-100 rounded-md font-medium no-print">{error}</div>;
    if (loading) return <Spinner />;

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            
            {/* CSS Print Styles Utility */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body { background: white; color: black; padding: 0; margin: 0; }
                    .no-print { display: none !important; }
                    .print-container { box-shadow: none !important; border: none !important; padding: 0 !important; background: transparent !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            `}} />

            {/* FILTER DROPDOWNS & CONTROL BAR (Hidden on print layouts) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Staff Selector Dropdown */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="staffDropdown" className="text-sm font-medium text-gray-700">Staff Representative</label>
                        <select
                            id="staffDropdown"
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        >
                            <option value="All">All Staff Members</option>
                            {uniqueStaffNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Selector Dropdown */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="statusDropdown" className="text-sm font-medium text-gray-700">Account Status</label>
                        <select
                            id="statusDropdown"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Fully Paid">Fully Paid</option>
                            <option value="Processing">Processing</option>
                            <option value="Overdue">Overdue</option>
                        </select>
                    </div>

                </div>
                <div>
                    <button
                        onClick={handlePrint}
                        className="w-full md:w-auto inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm"
                    >
                        Print Report
                    </button>
                </div>
            </div>

            {/* LOAN REPORT CONTENT AREA */}
            <div ref={reportRef} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden p-6 space-y-8 print-container">
                <div className="border-b pb-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Distributed Loans Portfolio Report</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Branch ID Reference: <span className="font-semibold text-gray-700">{branchId}</span></p>
                    </div>
                    <div className="text-right text-xs text-gray-400 no-print">
                        Generated: {new Date().toLocaleDateString()}
                    </div>
                </div>
                
                {sortedStaffNames.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No records match the current filter selection parameter parameters.</p>
                ) : (
                    sortedStaffNames.map((staff) => {
                        const loans = groupedLoansByStaff[staff];
                        return (
                            <div key={staff} className="space-y-3" style={{ pageBreakInside: 'avoid' }}>
                                <div className="bg-gray-100 border-l-4 border-gray-700 px-4 py-2 rounded-r-md flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        Staff Representative: <span className="font-bold">{staff}</span>
                                    </h3>
                                    <span className="text-xs bg-gray-200 text-gray-800 px-2.5 py-0.5 rounded-full font-medium">
                                        {loans.length} {loans.length === 1 ? 'Record' : 'Records'}
                                    </span>
                                </div>

                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                                        <thead className="bg-gray-50 font-semibold text-gray-700 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2.5">Loan ID</th>
                                                <th className="px-3 py-2.5">Group Name</th>
                                                <th className="px-3 py-2.5">Client ID</th>
                                                <th className="px-3 py-2.5">Client Full Name</th>
                                                <th className="px-3 py-2.5">Type</th>
                                                <th className="px-3 py-2.5">Principal</th>
                                                <th className="px-3 py-2.5">Total Owed</th>
                                                <th className="px-3 py-2.5 text-green-800 bg-green-50/50">Total Paid</th>
                                                <th className="px-3 py-2.5 text-red-800 bg-red-50/50">Outstanding</th>
                                                <th className="px-3 py-2.5">Weeks</th>
                                                <th className="px-3 py-2.5 text-indigo-900 bg-indigo-50/30">Maturity Date</th>
                                                <th className="px-3 py-2.5 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white text-gray-600">
                                            {loans.map((loan) => (
                                                <tr key={loan.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{loan.loanId}</td>
                                                    <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{loan.groupName}</td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">{loan.clientId}</td>
                                                    <td className="px-3 py-2.5 font-medium text-gray-800">{loan.clientName}</td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">{loan.loanType}</td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">${loan.loanPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">${loan.totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    
                                                    <td className="px-3 py-2.5 text-green-700 bg-green-50/30 whitespace-nowrap">
                                                        ${loan.totalPaidSoFar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>

                                                    <td className={`px-3 py-2.5 font-semibold bg-red-50/30 whitespace-nowrap ${loan.balanceRemaining <= 0 ? 'text-gray-400' : 'text-red-700'}`}>
                                                        ${loan.balanceRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>

                                                    <td className="px-3 py-2.5 whitespace-nowrap">{loan.paymentWeeks} wks</td>
                                                    <td className="px-3 py-2.5 font-medium text-indigo-950 bg-indigo-50/20 whitespace-nowrap">
                                                        {loan.closingDate}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ${loan.statusClasses}`}>
                                                            {loan.computedStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default LoanReport;