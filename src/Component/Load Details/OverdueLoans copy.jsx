import { useState, useEffect } from 'react';
import { FaEdit, FaTrash } from "react-icons/fa";
import { db } from '../../../firebase';

// Import Firestore functions
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    where
} from 'firebase/firestore';

const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false }) => (
    <div className="flex flex-col space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={placeholder}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
        />
    </div>
);

const Button = ({ onClick, children, className = "" }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 ${className}`}
    >
        {children}
    </button>
);

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

function Loan({ branch }) {
    // State for all form fields
    const [branchId, setBranchId] = useState('');
    const [error, setError] = useState(null);
    const [loanId, setLoanId] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [staffId, setStaffId] = useState('');
    const [staffName, setStaffName] = useState('');
    const [loanOutcome, setLoanOutcome] = useState('');
    const [loanType, setLoanType] = useState('');
    const [processingFee, setProcessingFee] = useState('');
    const [itFee, setItFee] = useState('');
    const [riskPremium, setRiskPremium] = useState('');
    const [gFund, setGFund] = useState('');
    const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().slice(0, 10));
    const [principal, setPrincipal] = useState('');
    const [repaymentStartDate, setRepaymentStartDate] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [paymentWeeks, setPaymentWeeks] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [groupList, setGroupList] = useState([]);
    const [tempGroupId, setTempGroupId] = useState('');
    const [tempGroupName, setTempGroupName] = useState('');
    const [loanList, setLoanList] = useState([]);
    const [editingLoanId, setEditingLoanId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [clientLoading, setClientLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [branchCouncil, setBranchCouncil] = useState('');

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const DELETE_PIN = "1234";

    const loansCollectionRef = collection(db, "loans");
    const groupsCollectionRef = collection(db, "groups");
    const clientsCollectionRef = collection(db, "clients");

    useEffect(() => {
        let id;
        if (branch && branch.branchId) {
            id = branch.branchId;
        } else {
            id = sessionStorage.getItem("branchId");
        }

        if (id) {
            setBranchId(id);
            setError(null);
        } else {
            setError("Branch ID could not be determined. Please ensure you are logged in or the branch prop is provided.");
            setLoading(false);
        }
    }, [branch]);

    useEffect(() => {
        if (!branchId || error) return;

        const qGroups = query(groupsCollectionRef, where('branchId', '==', branchId));

        const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
            const fetchedGroups = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setGroupList(fetchedGroups);
        }, (error) => {
            console.error("Error fetching real-time group data:", error);
            setError("Failed to load group data.");
        });

        return () => unsubscribeGroups();
    }, [branchId, error]);

    useEffect(() => {
        if (!editingLoanId && branchId) {
            const latestGroupNumber = groupList.reduce((max, group) => {
                const numMatch = (group.groupId || "").match(/-(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);

            const newNumber = latestGroupNumber + 1;
            const formattedId = `${branchId}-${String(newNumber).padStart(2, '0')}`;
            setTempGroupId(formattedId);
        }
    }, [groupList, editingLoanId, branchId]);

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
            alert("Failed to load loan data in real-time.");
            setLoading(false);
        });

        return () => unsubscribeLoans();
    }, [branchId, error]);

    useEffect(() => {
        if (!clientId || error) {
            setClientName('');
            setStaffName('');
            setStaffId('');
            return;
        }

        setClientLoading(true);

        try {
            const q = query(clientsCollectionRef, where('clientId', '==', clientId), where('branchId', '==', branchId));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const clientData = snapshot.docs[0].data();
                    setClientName(clientData.fullName);
                    setStaffName(clientData.staffName);
                    setStaffId(clientData.staffId || '');
                } else {
                    setClientName('');
                    setStaffName('');
                    setStaffId('');
                }
                setClientLoading(false);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error fetching client details:", error);
            setClientName('');
            setStaffName('');
            setStaffId('');
            setClientLoading(false);
        }
    }, [clientId, branchId, error]);

    useEffect(() => {
        if (!editingLoanId && loanList.length > 0) {
            const latestLoanNumber = loanList.reduce((max, loan) => {
                const numMatch = (loan.loanId || "loan-00").match(/^loan-(\d+)$/i);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);

            const newNumber = latestLoanNumber + 1;
            const formattedId = `loan-${String(newNumber).padStart(2, '0')}`;
            setLoanId(formattedId);
        } else if (!editingLoanId && loanList.length === 0) {
            setLoanId('loan-01');
        }
    }, [loanList, editingLoanId]);

    useEffect(() => {
        if (disbursementDate) {
            const date = new Date(disbursementDate);
            date.setDate(date.getDate() + 7);
            const formattedDate = date.toISOString().slice(0, 10);
            setRepaymentStartDate(formattedDate);
        }
    }, [disbursementDate]);

    useEffect(() => {
        if (editingLoanId) return;

        switch (loanType) {
            case 'Regular':
                setInterestRate('18');
                setPaymentWeeks('24');
                break;
            case 'Special':
                setInterestRate('24');
                setPaymentWeeks('24');
                break;
            default:
                setInterestRate('');
                setPaymentWeeks('');
                break;
        }
    }, [loanType, editingLoanId]);

    const filteredLoans = loanList.filter(loan => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const isFromCurrentBranch = loan.branchId === branchId;
        const matchesSearchTerm =
            (loan.clientName || "").toLowerCase().includes(lowerCaseSearchTerm) ||
            (loan.clientId || "").toLowerCase().includes(lowerCaseSearchTerm) ||
            (loan.staffName || "").toLowerCase().includes(lowerCaseSearchTerm);

        return isFromCurrentBranch && matchesSearchTerm;
    });

    const groupedLoansByStaff = filteredLoans.reduce((groups, loan) => {
        const staff = loan.staffName || "Unassigned Staff";
        if (!groups[staff]) {
            groups[staff] = [];
        }
        groups[staff].push(loan);
        return groups;
    }, {});

    // 🌟 NEW: Dynamic calculation helper for Closing/Maturity Date
    const calculateClosingDate = (disburseDateStr, weeks) => {
        if (!disburseDateStr || !weeks) return "N/A";
        const date = new Date(disburseDateStr);
        if (isNaN(date.getTime())) return "Invalid Date";
        
        // Multiply duration weeks by 7 to yield the complete life span in days
        date.setDate(date.getDate() + (parseInt(weeks, 10) * 7));
        return date.toISOString().slice(0, 10);
    };

    const clearForm = () => {
        setClientId('');
        setClientName('');
        setStaffId('');
        setStaffName('');
        setLoanOutcome('');
        setLoanType('');
        setProcessingFee('');
        setItFee('');
        setRiskPremium('');
        setGFund('');
        setDisbursementDate(new Date().toISOString().slice(0, 10));
        setPrincipal('');
        setRepaymentStartDate('');
        setInterestRate('');
        setPaymentWeeks('');
        setGroupId('');
        setGroupName('');
        setEditingLoanId(null);
        setBranchCouncil('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (error) { alert(error); return; }
        if (!clientId || !clientName || !staffName || !loanOutcome || !loanType || !principal || !repaymentStartDate || !interestRate || !paymentWeeks) {
            alert("Please fill in all required loan details.");
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);

        const loanData = {
            loanId, clientId, clientName, staffId, staffName, loanOutcome, loanType, branchCouncil,
            processingFee: parseFloat(processingFee) || 0,
            itFee: parseFloat(itFee) || 0,
            riskPremium: parseFloat(riskPremium) || 0,
            gFund: parseFloat(gFund) || 0,
            disbursementDate,
            principal: parseFloat(principal) || 0,
            repaymentStartDate,
            interestRate: parseFloat(interestRate) || 0,
            paymentWeeks: parseInt(paymentWeeks, 10) || 0,
            groupId, groupName, branchId,
        };

        try {
            if (editingLoanId) {
                const loanDocRef = doc(db, "loans", editingLoanId);
                await updateDoc(loanDocRef, loanData);
                alert("Loan details updated successfully! ✅");
            } else {
                await addDoc(loansCollectionRef, loanData);
                alert("Loan disbursed successfully! 🎉");
            }
            clearForm();
        } catch (error) {
            console.error("Error saving loan data:", error);
            alert("Failed to save loan data.");
        }
        setTimeout(() => setIsSubmitting(false), 5000);
    };

    const handleEdit = (loan) => {
        setEditingLoanId(loan.id);
        setLoanId(loan.loanId);
        setClientId(loan.clientId);
        setClientName(loan.clientName);
        setStaffId(loan.staffId || '');
        setStaffName(loan.staffName);
        setLoanOutcome(loan.loanOutcome);
        setLoanType(loan.loanType);
        setProcessingFee(loan.processingFee);
        setItFee(loan.itFee);
        setRiskPremium(loan.riskPremium);
        setGFund(loan.gFund);
        setDisbursementDate(loan.disbursementDate);
        setPrincipal(loan.principal);
        setRepaymentStartDate(loan.repaymentStartDate);
        setInterestRate(loan.interestRate);
        setPaymentWeeks(loan.paymentWeeks);
        setGroupId(loan.groupId);
        setGroupName(loan.groupName);
        setBranchCouncil(loan.branchCouncil || '');
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this loan?")) return;
        const enteredPin = prompt("Please enter the delete PIN to confirm:");
        if (enteredPin !== DELETE_PIN) {
            alert("Incorrect PIN. Deletion cancelled.");
            return;
        }

        try {
            const loanDocRef = doc(db, "loans", id);
            await deleteDoc(loanDocRef);
            alert("Loan deleted successfully! 🗑️");
        } catch (error) {
            console.error("Error deleting loan data:", error);
        }
    };

    if (error) return <div className="text-red-600 p-4 bg-red-100 rounded-md font-medium">{error}</div>;
    if (loading) return <Spinner />;

    return (
        <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
            {/* Form & input sections go here... */}
            
            {/* SEARCH BAR */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <Input
                    id="search"
                    label="Search Loans"
                    placeholder="Search by Client Name, ID, or Staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* LOAN TABLES SECTION GROUPED BY STAFF */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden p-6 space-y-8">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Distributed Loans Report</h2>
                
                {Object.keys(groupedLoansByStaff).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No loan records found.</p>
                ) : (
                    Object.entries(groupedLoansByStaff).map(([staff, loans]) => (
                        <div key={staff} className="space-y-3">
                            <div className="bg-indigo-50 border-l-4 border-indigo-600 px-4 py-2 rounded-r-md">
                                <h3 className="text-md font-semibold text-indigo-900">
                                    Staff Representative: <span className="font-bold">{staff}</span> 
                                    <span className="ml-2 text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">
                                        {loans.length} {loans.length === 1 ? 'loan' : 'loans'}
                                    </span>
                                </h3>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                    <thead className="bg-gray-100 font-semibold text-gray-700">
                                        <tr>
                                            <th className="px-4 py-3">Loan ID</th>
                                            <th className="px-4 py-3">Client ID</th>
                                            <th className="px-4 py-3">Full Name</th>
                                            <th className="px-4 py-3">Group Name</th>
                                            <th className="px-4 py-3">Principal</th>
                                            <th className="px-4 py-3">Interest Rate</th>
                                            <th className="px-4 py-3">Loan Type</th>
                                            <th className="px-4 py-3">Disbursement Date</th>
                                            <th className="px-4 py-3">Payment StartDate</th>
                                            <th className="px-4 py-3 font-bold text-indigo-700">Closing Date</th>
                                            <th className="px-4 py-3">Repayment Weeks</th>
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white text-gray-600">
                                        {loans.map((loan) => (
                                            <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-900">{loan.loanId}</td>
                                                <td className="px-4 py-3">{loan.clientId}</td>
                                                <td className="px-4 py-3 font-medium">{loan.clientName}</td>
                                                <td className="px-4 py-3">{loan.groupName || <span className="text-gray-400 italic">None</span>}</td>
                                                <td className="px-4 py-3">${loan.principal?.toLocaleString()}</td>
                                                <td className="px-4 py-3">{loan.interestRate}%</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        loan.loanType === 'Regular' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                                                    }`}>
                                                        {loan.loanType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">{loan.disbursementDate}</td>
                                                <td className="px-4 py-3">{loan.repaymentStartDate}</td>
                                                {/* DYNAMIC CLOSING DATE COLUMN */}
                                                <td className="px-4 py-3 font-semibold text-indigo-900 bg-indigo-50/50">
                                                    {calculateClosingDate(loan.disbursementDate, loan.paymentWeeks)}
                                                </td>
                                                <td className="px-4 py-3 text-center">{loan.paymentWeeks} wks</td>
                                                <td className="px-4 py-3 text-center space-x-2 whitespace-nowrap">
                                                    <button
                                                        onClick={() => handleEdit(loan)}
                                                        className="text-indigo-600 hover:text-indigo-900 inline-flex items-center p-1 rounded hover:bg-indigo-50"
                                                        title="Edit Loan"
                                                    >
                                                        <FaEdit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(loan.id)}
                                                        className="text-red-600 hover:text-red-900 inline-flex items-center p-1 rounded hover:bg-red-50"
                                                        title="Delete Loan"
                                                    >
                                                        <FaTrash className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Loan;