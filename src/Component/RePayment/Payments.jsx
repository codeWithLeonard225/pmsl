import { useState, useEffect } from 'react';
import { FaEdit, FaTrash } from "react-icons/fa";
import { db } from '../../../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    onSnapshot,
    orderBy
} from 'firebase/firestore';

/**
 * A simple, reusable Input component with basic styling.
 */
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, disabled = false, className = "" }) => (
    <div className="flex flex-col space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
        />
    </div>
);

/**
 * A custom button component for the form.
 */
const Button = ({ onClick, children, className = "", type = "button", disabled = false }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 bg-green-600 text-white hover:bg-green-700 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {children}
    </button>
);

// Helper for Spinner (re-adding for completeness)
const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"
            role="status"
            aria-label="Loading"
        >
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);


/**
 * The main Payments Form component.
 */
function Payments({ branch }) {
    // ----------------------------------------------------------------
    // 1. ALL STATE DECLARATIONS
    // ----------------------------------------------------------------

    // Core States
    const [branchId, setBranchId] = useState('');
    const [branchIdError, setBranchIdError] = useState(null); // NEW ERROR STATE
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [loanId, setLoanId] = useState('');
    const [clientId, setClientId] = useState('');
    const [fullName, setFullName] = useState('');
    const [staffName, setStaffName] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [repaymentStartDate, setRepaymentStartDate] = useState('');
    const [loanOutcome, setLoanOutcome] = useState('');
    const [loanType, setLoanType] = useState('');
    const [actualAmount, setActualAmount] = useState('');
    const [repaymentAmount, setRepaymentAmount] = useState('');
    const [principal, setPrincipal] = useState('');
    const [loanOutstanding, setLoanOutstanding] = useState('');
    const [paymentWeeks, setPaymentWeeks] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Running Totals
    const [totalRepaymentSoFar, setTotalRepaymentSoFar] = useState('0.00');
    const [remainingBalanceCalc, setRemainingBalanceCalc] = useState('0.00');

    // List and Editing States
    const [paymentsList, setPaymentsList] = useState([]);
    const [editingPaymentId, setEditingPaymentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [paymentsError, setPaymentsError] = useState('');

    // Loading and Error States
    const [isLoadingLoanDetails, setIsLoadingLoanDetails] = useState(false);
    const [loanDetailsError, setLoanDetailsError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Misc States
    const [isLoanDataFetched, setIsLoanDataFetched] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loanList, setLoanList] = useState([]);
    const [groupList, setGroupList] = useState([]);

    const DELETE_PIN = "1234";

    // Derived State Logic
    const areLoanFieldsReadOnly = editingPaymentId !== null || isLoanDataFetched;

    // Helper function to clear fields dependent on loan lookup
    const clearLoanDependentFields = () => {
        setClientId('');
        setFullName('');
        setStaffName('');
        setGroupId('');
        setGroupName('');
        setRepaymentStartDate('');
        setLoanOutcome('');
        setLoanType('');
        setActualAmount('');
        setRepaymentAmount('');
        setPrincipal('');
        setLoanOutstanding('');
        setPaymentWeeks('');
        setInterestRate('');
    };

    const clearForm = () => {
        setDate(new Date().toISOString().slice(0, 10));
        setLoanId('');
        clearLoanDependentFields();
        setEditingPaymentId(null);
        setLoanDetailsError('');
        setSaveError('');
        setSaveSuccess('');
        setIsLoanDataFetched(false);
        // Clear running totals
        setTotalRepaymentSoFar('0.00');
        setRemainingBalanceCalc('0.00');
    };

    // ----------------------------------------------------------------
    // 2. USE EFFECTS 
    // ----------------------------------------------------------------

    // 🌟 FIX: Robust logic to determine branchId from prop or session storage
    useEffect(() => {
        let id;
        if (branch && branch.branchId) {
            id = branch.branchId;
        } else {
            // Fallback: Check sessionStorage for branchId
            id = sessionStorage.getItem("branchId");
        }

        if (id) {
            setBranchId(id);
            setBranchIdError(null);
        } else {
            // Error handling if branchId cannot be determined
            setBranchIdError("Branch ID could not be determined. Please ensure you are logged in or the branch prop is provided.");
            setLoading(false); 
        }
    }, [branch]);


    // Effect for Online/Offline status
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

    // Effect to fetch loans and groups from Firestore in real-time
    useEffect(() => {
        // Run only if branchId is set and no critical error
        if (!branchId || branchIdError) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const loansCollectionRef = collection(db, "loans");
        const groupsCollectionRef = collection(db, "groups");

        // Query loans specific to the branchId
        const qLoans = query(
            loansCollectionRef,
            where('branchId', '==', branchId), // Use local branchId state
        );

        const unsubscribeLoans = onSnapshot(qLoans, (snapshot) => {
            const fetchedLoans = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setLoanList(fetchedLoans);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching real-time loan data:", error);
            setLoading(false);
        });

        // Query groups specific to the branchId
        const qGroups = query(
            groupsCollectionRef,
            where('branchId', '==', branchId), // Filter groups by branchId
        );

        const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
            const fetchedGroups = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setGroupList(fetchedGroups);
        }, (error) => {
            console.error("Error fetching real-time group data:", error);
        });

        return () => {
            unsubscribeLoans();
            unsubscribeGroups();
        };
    }, [branchId, branchIdError]); // Depend on branchId and error

    // Effect Hook to Fetch Loan Details & Running Totals based on loanId
    useEffect(() => {
        const fetchLoanDetails = async () => {
            // Add branchIdError check
            if (!branchId || branchIdError) return;

            if (loanId && !editingPaymentId) {
                setIsLoadingLoanDetails(true);
                setLoanDetailsError('');
                setIsLoanDataFetched(false);

                try {
                    // 1. Fetch Loan details (Filtered by loanId AND branchId)
                    const loansCollectionRef = collection(db, "loans");
                    const loanQuery = query(loansCollectionRef, where("loanId", "==", loanId), where('branchId', '==', branchId));
                    const loanSnapshot = await getDocs(loanQuery);

                    if (!loanSnapshot.empty) {
                        const loanData = loanSnapshot.docs[0].data();

                        // Populate form fields from loan data
                        setClientId(loanData.clientId || '');
                        setFullName(loanData.clientName || '');
                        setStaffName(loanData.staffName || '');
                        setGroupId(loanData.groupId || '');
                        setGroupName(loanData.groupName || '');
                        setRepaymentStartDate(loanData.repaymentStartDate || '');
                        setLoanOutcome(loanData.loanOutcome || '');
                        setLoanType(loanData.loanType || '');
                        setRepaymentAmount(String(loanData.repaymentAmount || ''));
                        setPrincipal(String(loanData.principal || ''));
                        setPaymentWeeks(String(loanData.paymentWeeks || ''));
                        setInterestRate(String(loanData.interestRate || ''));

                        // Calculate Loan Outstanding (Principal + Actual_Interest)
                        const currentPrincipal = parseFloat(loanData.principal || 0);
                        const currentInterestRate = parseFloat(loanData.interestRate || 0);
                        const actualInterest = (currentPrincipal * currentInterestRate) / 100;
                        const outstanding = currentPrincipal + actualInterest;
                        setLoanOutstanding(String(outstanding));

                        // Calculate Actual Amount (Loan Outstanding / Payment Weeks)
                        const currentPaymentWeeks = parseFloat(loanData.paymentWeeks || 0);
                        let calculatedActualAmount = '0';
                        if (currentPaymentWeeks > 0) {
                            calculatedActualAmount = String(outstanding / currentPaymentWeeks);
                        }
                        setActualAmount(calculatedActualAmount);

                        // 2. Fetch all existing payments for this loan ID
                        const paymentsCollectionRef = collection(db, "payments");
                        const paymentsQuery = query(
                            paymentsCollectionRef, 
                            where("loanId", "==", loanId), 
                            where('branchId', '==', branchId) // Filter payments by branchId
                        );
                        const paymentsSnapshot = await getDocs(paymentsQuery);

                        let totalRepaid = 0;
                        paymentsSnapshot.forEach(doc => {
                            const paymentData = doc.data();
                            totalRepaid += parseFloat(paymentData.repaymentAmount || 0);
                        });

                        // 3. Calculate and set the running totals
                        const calculatedRemainingBalance = outstanding - totalRepaid;

                        setTotalRepaymentSoFar(totalRepaid.toFixed(2));
                        setRemainingBalanceCalc(calculatedRemainingBalance.toFixed(2));

                        setIsLoanDataFetched(true);
                        setLoanDetailsError('');
                    } else {
                        setLoanDetailsError(`Loan ID "${loanId}" not found for this branch.`);
                        clearLoanDependentFields();
                        setTotalRepaymentSoFar('0.00');
                        setRemainingBalanceCalc('0.00');
                    }
                } catch (error) {
                    console.error("Error fetching loan details:", error);
                    setLoanDetailsError("Failed to fetch loan details. Please check your network or try again.");
                    clearLoanDependentFields();
                    setTotalRepaymentSoFar('0.00');
                    setRemainingBalanceCalc('0.00');
                } finally {
                    setIsLoadingLoanDetails(false);
                }
            } else if (!loanId && !editingPaymentId) {
                clearLoanDependentFields();
                setLoanDetailsError('');
                setIsLoanDataFetched(false);
                // Clear running totals when loanId is cleared
                setTotalRepaymentSoFar('0.00');
                setRemainingBalanceCalc('0.00');
            }
        };

        fetchLoanDetails();
    }, [loanId, editingPaymentId, branchId, branchIdError, paymentsList]); // Add branchId and branchIdError

    // Recalculate Loan Outstanding and Actual Amount when principal, interestRate, or paymentWeeks change
    useEffect(() => {
        if (!editingPaymentId) {
            const currentPrincipal = parseFloat(principal || 0);
            const currentInterestRate = parseFloat(interestRate || 0);
            const currentPaymentWeeks = parseFloat(paymentWeeks || 0);

            // Calculate Loan Outstanding
            const actualInterest = (currentPrincipal * currentInterestRate) / 100;
            const calculatedOutstanding = currentPrincipal + actualInterest;
            setLoanOutstanding(String(calculatedOutstanding));

            // Calculate Actual Amount
            if (currentPaymentWeeks > 0) {
                setActualAmount(String(calculatedOutstanding / currentPaymentWeeks));
            } else {
                setActualAmount('0');
            }
        }
    }, [principal, interestRate, paymentWeeks, editingPaymentId]);

    // useEffect Hook to Fetch ALL Payments from Firestore in real-time
    useEffect(() => {
        // Run only if branchId is set and no critical error
        if (!branchId || branchIdError) {
            setLoadingPayments(false);
            return;
        }

        const paymentsCollectionRef = collection(db, 'payments');
        // Filter by branchId at the query level for efficiency if your rules allow
        const q = query(
            paymentsCollectionRef, 
            where('branchId', '==', branchId), // Filter at the query level
           
        );

        setLoadingPayments(true);
        setPaymentsError('');

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const fetchedPayments = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        date: data.date || '',
                        createdAt:
                            data.createdAt && typeof data.createdAt.toDate === 'function'
                                ? data.createdAt.toDate().toISOString()
                                : data.createdAt || null,
                        updatedAt:
                            data.updatedAt && typeof data.updatedAt.toDate === 'function'
                                ? data.updatedAt.toDate().toISOString()
                                : data.updatedAt || null,
                    };
                });
                
                // No need for a secondary filter, as the query now filters by branchId
                setPaymentsList(fetchedPayments); 
                setLoadingPayments(false);
            },
            (error) => {
                console.error('Error fetching payments from Firestore:', error);
                setPaymentsError('Failed to load payments. Please try again.');
                setLoadingPayments(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, branchIdError]); // Depend on branchId and error


    // ----------------------------------------------------------------
    // 3. ACTION HANDLERS
    // ----------------------------------------------------------------

    // Derived state: Filtered payments list based on search term (branchId filter is now in the useEffect)
    const filteredPayments = paymentsList.filter(payment => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        // Check if the search term is in fullName, loanId, or clientId.
        return (
            (payment.fullName || "").toLowerCase().includes(lowerCaseSearchTerm) ||
            (payment.loanId || "").toLowerCase().includes(lowerCaseSearchTerm) ||
            (payment.clientId || "").toLowerCase().includes(lowerCaseSearchTerm)
        );
    });

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (branchIdError) {
            setSaveError(branchIdError);
            return;
        }

        // Basic validation
        if (!loanId || !fullName || !repaymentAmount) {
            setSaveError("Please fill in Loan ID, Full Name, and Repayment Amount.");
            setIsSubmitting(false);
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);

        if (parseFloat(paymentWeeks) <= 0) {
            setSaveError("Payment Weeks must be greater than zero to calculate Actual Amount.");
            setIsSubmitting(false);
            return;
        }

        setIsSaving(true);
        setSaveError("");
        setSaveSuccess("");

        const paymentData = {
            branchId: branchId, // Use the state variable
            date,
            loanId,
            clientId,
            fullName,
            staffName,
            groupId,
            groupName,
            repaymentStartDate,
            loanOutcome,
            loanType,
            actualAmount: parseFloat(actualAmount || 0),
            repaymentAmount: parseFloat(repaymentAmount || 0),
            principal: parseFloat(principal || 0),
            interestRate: parseFloat(interestRate || 0),
            loanOutstanding: parseFloat(loanOutstanding || 0),
            paymentWeeks: parseInt(paymentWeeks || 0, 10),
            createdAt: editingPaymentId
                ? paymentsList.find((p) => p.id === editingPaymentId)?.createdAt
                : serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            if (editingPaymentId) {
                const paymentDocRef = doc(db, "payments", editingPaymentId);
                await updateDoc(paymentDocRef, paymentData);
                setSaveSuccess("Payment updated successfully! ✅");
            } else {
                const paymentsCollectionRef = collection(db, "payments");
                await addDoc(paymentsCollectionRef, paymentData);
                setSaveSuccess("Payment saved successfully! ✨");
            }
            clearForm();
        } catch (e) {
            console.error("Error saving payment:", e);
            setSaveError(`Failed to save payment: ${e.message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setIsSubmitting(false), 5000);
        }
    };


    const handleEdit = (payment) => {
        setEditingPaymentId(payment.id);
        setDate(payment.date);
        setLoanId(payment.loanId);
        setClientId(payment.clientId || '');
        setFullName(payment.fullName);
        setStaffName(payment.staffName);
        setGroupId(payment.groupId);
        setGroupName(payment.groupName);
        setRepaymentStartDate(payment.repaymentStartDate);
        setLoanOutcome(payment.loanOutcome);
        setLoanType(payment.loanType);
        setActualAmount(String(payment.actualAmount));
        setRepaymentAmount(String(payment.repaymentAmount));
        setPrincipal(String(payment.principal));
        setInterestRate(String(payment.interestRate));
        setLoanOutstanding(String(payment.loanOutstanding));
        setPaymentWeeks(String(payment.paymentWeeks));

        // Note: Running totals are not used in edit mode, but we clear the messages
        setLoanDetailsError('');
        setSaveError('');
        setSaveSuccess('');
        setIsLoanDataFetched(true);
    };

    const handleDelete = async (id) => {
        const pin = prompt("Enter PIN to confirm deletion (PIN: 1234)");
        if (pin !== DELETE_PIN) {
            alert("Incorrect PIN. Deletion cancelled.");
            return;
        }

        if (window.confirm("Are you sure you want to delete this payment record?")) {
            try {
                const paymentDocRef = doc(db, "payments", id);
                await deleteDoc(paymentDocRef);
                setSaveSuccess("Payment deleted successfully! 🗑️");
                setSaveError('');
            } catch (error) {
                console.error("Error deleting payment:", error);
                setSaveError("Failed to delete payment.");
            }
        }
    };

    // ----------------------------------------------------------------
    // 4. JSX RENDERING
    // ----------------------------------------------------------------

    if (branchIdError) {
        return <div className="text-red-600 p-4 bg-red-100 rounded-md font-medium">Critical Error: {branchIdError}</div>;
    }

    if (loading) {
        return <Spinner />;
    }

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <div className="flex items-center justify-between">
                    {/* Header Title */}
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 border-b pb-4">
                        {editingPaymentId ? 'Edit Payment' : 'Payments Form'}
                    </h1>

                    {/* Online / Offline Status */}
                    <span
                        className={`ml-4 text-sm font-semibold ${isOnline ? "text-green-600" : "text-red-600"
                            }`}
                    >
                        {isOnline ? "✅ Online" : "⚠️ Offline"}
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Header Row */}
                    <Input
                        id="branchId"
                        label="Branch ID"
                        type="text"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        placeholder="e.g., B001"
                        readOnly
                    />
                    <Input id="date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    <Input
                        id="loanId"
                        label="Loan ID"
                        type="text"
                        value={loanId}
                        onChange={(e) => setLoanId(e.target.value)}
                        placeholder="e.g., loan-01"
                        readOnly={editingPaymentId !== null}
                    />

                    {/* Display loading/error messages for form actions */}
                    {isLoadingLoanDetails && <p className="col-span-full text-sm text-blue-500">Fetching loan details...</p>}
                    {loanDetailsError && <p className="col-span-full text-sm text-red-500">{loanDetailsError}</p>}
                    {saveError && <p className="col-span-full text-sm text-red-500">{saveError}</p>}
                    {saveSuccess && <p className="col-span-full text-sm text-green-600">{saveSuccess}</p>}

                    {/* ✅ NEW: Total Repayment So Far */}
                    <Input
                        id="totalRepaymentSoFar"
                        label="Total Repayment So Far"
                        type="text"
                        value={`SLE ${totalRepaymentSoFar}`}
                        placeholder="Calculated Repaid"
                        readOnly={true}
                        disabled={true}
                        className="bg-blue-100 text-blue-800 font-semibold"  // ✅ Blue theme
                    />

                    {/* ✅ NEW: Remaining Balance */}
                    <Input
                        id="remainingBalanceCalc"
                        label="Remaining Balance (Calc)"
                        type="text"
                        value={`SLE ${remainingBalanceCalc}`}
                        placeholder="Calculated Balance"
                        readOnly={true}
                        disabled={true}
                        className="bg-red-100 text-yellow-800 font-semibold" // ✅ Yellow theme
                    />


                    {/* Client Details Section */}
                    <Input
                        id="clientId"
                        label="Client ID"
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="e.g., C-001"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="fullName"
                        label="Full Name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g., Jane Doe"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="staffName"
                        label="Staff Name"
                        type="text"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="e.g., Jack Smith"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="groupId"
                        label="Group ID"
                        type="text"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        placeholder="e.g., G-001"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="groupName"
                        label="Group Name"
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g., Team A"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="repaymentStartDate"
                        label="Repayment Start Date"
                        type="date"
                        value={repaymentStartDate}
                        onChange={(e) => setRepaymentStartDate(e.target.value)}
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />

                    {/* Loan Details Section */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="loanOutcome" className="text-sm font-medium text-gray-700">Loan Outcome</label>
                        <select
                            id="loanOutcome"
                            value={loanOutcome}
                            onChange={(e) => setLoanOutcome(e.target.value)}
                            disabled={areLoanFieldsReadOnly}
                            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 ${areLoanFieldsReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Outcome</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="loanType" className="text-sm font-medium text-gray-700">Loan Type</label>
                        <select
                            id="loanType"
                            value={loanType}
                            onChange={(e) => setLoanType(e.target.value)}
                            disabled={areLoanFieldsReadOnly}
                            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 ${areLoanFieldsReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Type</option>
                            <option value="Personal">Personal</option>
                            <option value="Business">Business</option>
                            <option value="Educational">Educational</option>
                        </select>
                    </div>

                    {/* Financial Inputs */}
                    <Input
                        id="actualAmount"
                        label="Calculated Weekly Payment"
                        type="number"
                        value={parseFloat(actualAmount).toFixed(2)}
                        onChange={(e) => setActualAmount(e.target.value)}
                        placeholder="Calculated"
                        readOnly={true}
                        disabled={true}
                    />
                    <Input
                        id="repaymentAmount"
                        label="Repayment Amount (Current)"
                        type="number"
                        value={repaymentAmount}
                        onChange={(e) => setRepaymentAmount(e.target.value)}
                        placeholder="e.g., 550"
                    />
                    <Input
                        id="principal"
                        label="Principal"
                        type="number"
                        value={principal}
                        onChange={(e) => setPrincipal(e.target.value)}
                        placeholder="e.g., 5000"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="interestRate"
                        label="Interest Rate (%)"
                        type="number"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        placeholder="e.g., 10"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />
                    <Input
                        id="loanOutstanding"
                        label="Total Loan Outstanding"
                        type="number"
                        value={parseFloat(loanOutstanding).toFixed(2)}
                        onChange={(e) => setLoanOutstanding(e.target.value)}
                        placeholder="Calculated"
                        readOnly={true}
                        disabled={true}
                    />
                    <Input
                        id="paymentWeeks"
                        label="Payment Weeks"
                        type="number"
                        value={paymentWeeks}
                        onChange={(e) => setPaymentWeeks(e.target.value)}
                        placeholder="e.g., 12"
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />

                    {/* Submit Button */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-6">
                        <Button
                            type="submit"
                            className={`w-full py-3 font-bold text-lg shadow-md transition-colors duration-200
                                ${isSaving || isLoadingLoanDetails || !isOnline || isSubmitting
                                    ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700"}
                            `}
                            disabled={isLoadingLoanDetails || isSaving || !isOnline || isSubmitting}
                        >
                            {isSaving
                                ? "💾 Saving..."
                                : isLoadingLoanDetails
                                    ? "⏳ Loading Loan..."
                                    : !isOnline
                                        ? "⚠️ Offline"
                                        : editingPaymentId
                                            ? "Update Payment"
                                            : "Save Payment"}
                        </Button>

                        {editingPaymentId && (
                            <Button
                                type="button"
                                onClick={clearForm}
                                className="w-full py-3 mt-2 bg-gray-500 hover:bg-gray-600 text-white font-bold text-lg shadow-md"
                                disabled={isSaving}
                            >
                                Cancel Edit
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            {/* Payments List Table */}
            {loadingPayments ? (
                <p className="text-center text-gray-600">Loading payments...</p>
            ) : paymentsError ? (
                <p className="col-span-full text-center text-red-500">{paymentsError}</p>
            ) : paymentsList.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Records</h2>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0">
                        <Input
                            id="search"
                            label="Search by Name/Loan ID/Client ID"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Enter Full Name, Loan ID, or Client ID"
                        />
                        <div className="text-sm font-medium text-gray-600">
                            Showing {filteredPayments.length} of {paymentsList.length} payments (in this branch)
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calculated Weekly Payment</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Loan Outstanding</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredPayments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.clientId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.fullName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.loanId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(payment.actualAmount || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(payment.repaymentAmount || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(payment.loanOutstanding || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(payment)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                title="Edit"
                                            >
                                                <FaEdit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(payment.id)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
                                            >
                                                <FaTrash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Payments;