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
 * @param {object} props - The component props.
 * @param {string} props.id - The ID of the input.
 * @param {string} props.label - The label text for the input.
 * @param {string} props.type - The type of input (e.g., 'text', 'date', 'number').
 * @param {any} props.value - The current value of the input.
 * @param {function} props.onChange - The change event handler.
 * @param {string} props.placeholder - The placeholder text.
 * @param {boolean} props.readOnly - If true, the input is read-only.
 * @param {boolean} props.disabled - If true, the input is disabled.
 */
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, disabled = false }) => (
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
            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
    </div>
);

/**
 * A custom button component for the form.
 * @param {object} props - The component props.
 * @param {function} props.onClick - The click event handler.
 * @param {React.ReactNode} props.children - The content of the button.
 * @param {string} props.className - Additional Tailwind classes.
 * @param {string} props.type - Button type (e.g., "button", "submit").
 * @param {boolean} props.disabled - If true, the button is disabled.
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

/**
 * The main Payments Form component.
 * It manages all form state and a table with search, edit, and delete functionality.
 */
function Payments({ branch }) {
    // NEW: State for Branch ID
    const [branchId, setBranchId] = useState('');
    // State for all form fields
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

    // New states for handling loading and errors during data fetching
    const [isLoadingLoanDetails, setIsLoadingLoanDetails] = useState(false);
    const [loanDetailsError, setLoanDetailsError] = useState('');

    // States for Firestore operations (save/update/delete)
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    // State for the list of payments and the currently editing payment ID
    const [paymentsList, setPaymentsList] = useState([]);
    const [editingPaymentId, setEditingPaymentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [paymentsError, setPaymentsError] = useState('');

    // Refactored to avoid redundant fetching
    const [isLoanDataFetched, setIsLoanDataFetched] = useState(false);

    // ✅ ADDED: New state for loading loan/group lists
    const [loading, setLoading] = useState(true);
    // ✅ ADDED: State for the lists of loans and groups
    const [loanList, setLoanList] = useState([]);
    const [groupList, setGroupList] = useState([]);

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

    useEffect(() => {
        if (branch && branch.branchId) {
            setBranchId(branch.branchId);
        }
    }, [branch]);

    // Effect to fetch loans and groups from Firestore in real-time
    useEffect(() => {
        if (!branch) {
            console.warn("branchId is not provided. Cannot fetch loans.");
            setLoading(false);
            return;
        }

        setLoading(true);

        // ✅ ADDED: Define collection references here
        const loansCollectionRef = collection(db, "loans");
        const groupsCollectionRef = collection(db, "groups");

        // ✅ Query loans specific to the branchId
        const q = query(
            loansCollectionRef,
            where('branchId', '==', branch.branchId),
        );

        const unsubscribeLoans = onSnapshot(q, (snapshot) => {
            const fetchedLoans = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setLoanList(fetchedLoans);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching real-time loan data:", error);
            alert("Failed to load loan data in real-time. Please check your internet connection and Firebase rules.");
            setLoading(false);
        });

        // Subscribe to groups collection (no branch filter needed here, assuming groups are shared)
        const unsubscribeGroups = onSnapshot(groupsCollectionRef, (snapshot) => {
            const fetchedGroups = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            setGroupList(fetchedGroups);
        }, (error) => {
            console.error("Error fetching real-time group data:", error);
            alert("Failed to load group data.");
        });

        // Cleanup function: unsubscribe from listeners when component unmounts
        return () => {
            unsubscribeLoans();
            unsubscribeGroups();
        };
    }, [branch, branchId]); // Corrected dependencies to include `branch` and `branchId`

    // useEffect Hook to Fetch Loan Details based on loanId
    useEffect(() => {
        const fetchLoanDetails = async () => {
            if (loanId && !editingPaymentId) {
                setIsLoadingLoanDetails(true);
                setLoanDetailsError('');
                setIsLoanDataFetched(false);

                try {
                    const loansCollectionRef = collection(db, "loans");
                    const q = query(loansCollectionRef, where("loanId", "==", loanId), where('branchId', '==', branchId)); // Use branchId from state
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const loanDoc = querySnapshot.docs[0];
                        const loanData = loanDoc.data();

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
                        if (currentPaymentWeeks > 0) {
                            setActualAmount(String(outstanding / currentPaymentWeeks));
                        } else {
                            setActualAmount('0');
                        }

                        setIsLoanDataFetched(true);
                        setLoanDetailsError('');
                    } else {
                        setLoanDetailsError(`Loan ID "${loanId}" not found in database.`);
                        clearLoanDependentFields();
                    }
                } catch (error) {
                    console.error("Error fetching loan details:", error);
                    setLoanDetailsError("Failed to fetch loan details. Please check your network or try again.");
                    clearLoanDependentFields();
                } finally {
                    setIsLoadingLoanDetails(false);
                }
            } else if (!loanId && !editingPaymentId) {
                clearLoanDependentFields();
                setLoanDetailsError('');
                setIsLoanDataFetched(false);
            }
        };

        fetchLoanDetails();
    }, [loanId, editingPaymentId, branchId]); // Added `branchId` to the dependency array

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
        const paymentsCollectionRef = collection(db, 'payments');
        // You may want to add a `where` clause here to filter by `branchId` as well.
        const q = query(paymentsCollectionRef, orderBy('createdAt', 'desc'));

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
    }, []);


  // Derived state: Filtered payments list based on search term AND branchId
const filteredPayments = paymentsList.filter(payment => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    // First, filter by the branchId. If the payment's branchId doesn't match, it's excluded.
    const isFromCurrentBranch = payment.branchId === branchId;

    // Second, filter by the search term. Check if the search term is in fullName, loanId, or clientId.
    const matchesSearchTerm =
        (payment.fullName || "").toLowerCase().includes(lowerCaseSearchTerm) ||
        (payment.loanId || "").toLowerCase().includes(lowerCaseSearchTerm) ||
        (payment.clientId || "").toLowerCase().includes(lowerCaseSearchTerm);

    // Return true only if both conditions are met.
    return isFromCurrentBranch && matchesSearchTerm;
});

    const clearForm = () => {
        setDate(new Date().toISOString().slice(0, 10));
        setLoanId('');
        clearLoanDependentFields();
        setEditingPaymentId(null);
        setLoanDetailsError('');
        setSaveError('');
        setSaveSuccess('');
        setIsLoanDataFetched(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        // Basic validation
        if (!loanId || !fullName || !repaymentAmount) {
            setSaveError("Please fill in Loan ID, Full Name, and Repayment Amount.");
            return;
        }
        if (parseFloat(paymentWeeks) <= 0) {
            setSaveError("Payment Weeks must be greater than zero to calculate Actual Amount.");
            return;
        }

        setIsSaving(true);
        setSaveError('');
        setSaveSuccess('');

        const paymentData = {
            branchId: branchId, // ✅ ADDED: Include branchId in the payment data
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
            createdAt: editingPaymentId ? paymentsList.find(p => p.id === editingPaymentId)?.createdAt : serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            if (editingPaymentId) {
                const paymentDocRef = doc(db, "payments", editingPaymentId);
                await updateDoc(paymentDocRef, paymentData);
                setSaveSuccess("Payment updated successfully! ✅");
            } else {
                const paymentsCollectionRef = collection(db, "payments");
                const docRef = await addDoc(paymentsCollectionRef, paymentData);
                console.log("Document written with ID: ", docRef.id);
                setSaveSuccess("Payment saved successfully! ✨");
            }
            clearForm();
        } catch (e) {
            console.error("Error saving payment:", e);
            setSaveError(`Failed to save payment: ${e.message}`);
        } finally {
            setIsSaving(false);
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
        setLoanDetailsError('');
        setSaveError('');
        setSaveSuccess('');
        setIsLoanDataFetched(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this payment record?")) {
            return;
        }

        try {
            await deleteDoc(doc(db, "payments", id));
            setSaveSuccess("Payment deleted successfully! 🗑️");
        } catch (error) {
            console.error("Error deleting payment:", error);
            setSaveError(`Failed to delete payment: ${error.message}`);
        }
    };

    const areLoanFieldsReadOnly = isLoadingLoanDetails || isLoanDataFetched;

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
                    {editingPaymentId ? 'Edit Payment' : 'Payments Form'}
                </h1>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* NEW: Branch ID Input Field */}
                            <Input
                                id="branchId"
                                label="Branch ID"
                                type="text"
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                placeholder="e.g., B001"
                                readOnly // Make this read-only so users can't change the assigned branch

                            />
                    {/* General Details Section */}
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

                    {/* NEW: Client ID Input field */}
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
                    
                    {/* These fields will be populated from the fetched data and made read-only */}
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

                    {/* Other fields remain as they were, allowing manual input, but some can be read-only if from lookup */}
                    <Input
                        id="repaymentStartDate"
                        label="Repayment Start Date"
                        type="date"
                        value={repaymentStartDate}
                        onChange={(e) => setRepaymentStartDate(e.target.value)}
                        readOnly={areLoanFieldsReadOnly}
                        disabled={areLoanFieldsReadOnly}
                    />

                    {/* Loan Details Section - select inputs are not directly 'readOnly' by HTML, disabled is better */}
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

                    {/* Actual Amount is now calculated and read-only */}
                    <Input
                        id="actualAmount"
                        label="Calculated Weekly Payment"
                        type="number"
                        value={actualAmount}
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
                        value={loanOutstanding}
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
                            className="w-full py-3 font-bold text-lg shadow-md"
                            disabled={isLoadingLoanDetails || isSaving}
                        >
                            {isSaving ? 'Saving...' : (editingPaymentId ? 'Update Payment' : 'Save Payment')}
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
                <p className="text-center text-red-500">{paymentsError}</p>
            ) : paymentsList.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Records</h2>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0">
                        <Input
                            id="search"
                            label="Search by Full Name"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Enter Full Name"
                        />
                        <div className="text-sm font-medium text-gray-600">
                            Showing {filteredPayments.length} of {paymentsList.length} payments
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