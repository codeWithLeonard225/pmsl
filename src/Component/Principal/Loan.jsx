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
 */
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

/**
 * A custom button component for the form.
 * @param {object} props - The component props.
 * @param {function} props.onClick - The click event handler.
 * @param {React.ReactNode} props.children - The content of the button.
 * @param {string} props.className - Additional Tailwind classes.
 */
const Button = ({ onClick, children, className = "" }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 ${className}`}
    >
        {children}
    </button>
);

/**
 * Spinner component with Tailwind CSS animation.
 */
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

// ✅ Add the branchId prop here
function Loan({ branch }) {
    // State for all form fields

    // NEW: State for Branch ID
    const [branchId, setBranchId] = useState('');

    const [loanId, setLoanId] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
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

    // State for managing groups (these groups will also be stored in Firestore)
    const [groupList, setGroupList] = useState([]);
    const [tempGroupId, setTempGroupId] = useState('');
    const [tempGroupName, setTempGroupName] = useState('');

    // State for the list of loans and the currently editing loan ID
    const [loanList, setLoanList] = useState([]);
    const [editingLoanId, setEditingLoanId] = useState(null); // Stores Firestore document ID

    // State for the search term
    const [searchTerm, setSearchTerm] = useState('');

    // Loading state for data fetching
    const [loading, setLoading] = useState(true);
    const [clientLoading, setClientLoading] = useState(false); // New loading state for client lookup

    // Define the PIN for delete confirmation (WARNING: not for production)
    const DELETE_PIN = "1234";

    // Firestore collection references
    const loansCollectionRef = collection(db, "loans");
    const groupsCollectionRef = collection(db, "groups"); // New collection for groups
    const clientsCollectionRef = collection(db, "clients"); // Reference to clients collection

    // NEW: useEffect to set the branchId state from the prop when the component mounts or the prop changes
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

        // ✅ Query loans specific to the branchId
        const q = query(
            loansCollectionRef,
            where('branchId', '==', branch.branchId), // Correct
          
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
    }, [branchId]); // 🔄 Re-run effect when branchId changes

    // NEW useEffect to fetch client details when clientId changes
    useEffect(() => {
        if (!clientId) {
            setClientName('');
            setStaffName('');
            return;
        }

        setClientLoading(true);

        try {
            // ✅ Query clients specific to both clientId and branchId
           const q = query(clientsCollectionRef, where('clientId', '==', clientId), where('branchId', '==', branch.branchId)); // Correct
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const clientData = snapshot.docs[0].data();
                    setClientName(clientData.fullName);
                    setStaffName(clientData.staffName);
                } else {
                    setClientName('');
                    setStaffName('');
                }
                setClientLoading(false);
            });

            return () => unsubscribe(); // ✅ cleanup listener
        } catch (error) {
            console.error("Error fetching client details:", error);
            setClientName('');
            setStaffName('');
            setClientLoading(false);
        }
    }, [clientId, branchId]); // 🔄 Re-run when clientId or branchId changes


// Derived state: Filtered loan list based on the search term AND branchId
const filteredLoans = loanList.filter(loan => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    // First, filter by the branchId. If the loan's branchId doesn't match, it's excluded.
    const isFromCurrentBranch = loan.branchId === branchId;
    
    // Second, filter by the search term. Check if the search term is in clientName, clientId, or staffName.
    const matchesSearchTerm = 
        (loan.clientName || "").toLowerCase().includes(lowerCaseSearchTerm) ||
        (loan.clientId || "").toLowerCase().includes(lowerCaseSearchTerm) ||
        (loan.staffName || "").toLowerCase().includes(lowerCaseSearchTerm);

    // Return true only if both conditions are met.
    return isFromCurrentBranch && matchesSearchTerm;
});

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

    // Function to clear the form fields
    const clearForm = () => {
        setClientId('');
        setClientName('');
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
    };

    // Handle adding a new group to Firestore
    const handleAddGroup = async () => {
        if (tempGroupId && tempGroupName) {
            const newGroupData = { groupId: tempGroupId, groupName: tempGroupName };
            try {
                const existingGroup = groupList.find(group => group.groupId === tempGroupId);
                if (existingGroup) {
                    alert("A group with this ID already exists. Please use a unique Group ID.");
                    return;
                }
                await addDoc(groupsCollectionRef, newGroupData);
                alert("Group added successfully! 🤝");
                setTempGroupId('');
                setTempGroupName('');
            } catch (error) {
                console.error("Error adding group to Firestore:", error);
                alert("Failed to add group. Please try again.");
            }
        } else {
            alert("Please provide both Group ID and Group Name.");
        }
    };

    // Handle form submission (add new or update existing loan)
    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!clientId || !clientName || !staffName || !loanOutcome || !loanType || !principal || !repaymentStartDate || !interestRate || !paymentWeeks) {
            alert("Please fill in all required loan details.");
            return;
        }

        const loanData = {
            loanId,
            clientId,
            clientName,
            staffName,
            loanOutcome,
            loanType,
            processingFee: parseFloat(processingFee) || 0,
            itFee: parseFloat(itFee) || 0,
            riskPremium: parseFloat(riskPremium) || 0,
            gFund: parseFloat(gFund) || 0,
            disbursementDate,
            principal: parseFloat(principal) || 0,
            repaymentStartDate,
            interestRate: parseFloat(interestRate) || 0,
            paymentWeeks: parseInt(paymentWeeks, 10) || 0,
            groupId,
            groupName,
            // ✅ Include branchId in the loan data
            branchId,
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
            console.error("Error saving loan data to Firestore:", error);
            alert("Failed to save loan data. Please try again. Check the console for more details.");
        }
    };

    // Handle the "Edit" button click
    const handleEdit = (loan) => {
        setEditingLoanId(loan.id);
        setLoanId(loan.loanId);
        setClientId(loan.clientId);
        setClientName(loan.clientName);
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
    };

    // Handle the "Delete" button click with PIN confirmation
    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this loan? This action cannot be undone.")) {
            return;
        }

        const enteredPin = prompt("Please enter the delete PIN to confirm:");
        if (enteredPin === null) {
            alert("Deletion cancelled.");
            return;
        }
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
            alert("Failed to delete loan data. Please try again.");
        }
    };

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
                    {editingLoanId ? 'Edit Loan Disbursement' : 'Loan Disbursement Form'}
                </h1>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Loan Details Section */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="loanId" className="text-sm font-medium text-gray-700">Loan ID</label>
                                <Input
                                    id="loanId"
                                    type="text"
                                    value={loanId}
                                    readOnly={true}
                                    placeholder="Auto-generated"
                                />
                            </div>
                            <Input
                                id="clientId"
                                label="Client ID"
                                type="text"
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                placeholder="e.g., cmcs-01"
                            />
                            {/* Client Name (read-only, populated from client ID) */}
                            <Input
                                id="clientName"
                                label="Client Name"
                                type="text"
                                value={clientName}
                                readOnly={true}
                                placeholder={clientLoading ? "Loading..." : "Auto-populated"}
                            />
                            {/* Staff Name (read-only, populated from client ID) */}
                            <Input
                                id="staffName"
                                label="Staff Name"
                                type="text"
                                value={staffName}
                                readOnly={true}
                                placeholder={clientLoading ? "Loading..." : "Auto-populated"}
                            />
                        </div>
                    </div>

                    {/* Loan Process Fragment */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 border-t pt-6 mt-6 border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Loan Process</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Loan Outcome Dropdown */}
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="loanOutcome" className="text-sm font-medium text-gray-700">Loan Outcome</label>
                                <select
                                    id="loanOutcome"
                                    value={loanOutcome}
                                    onChange={(e) => setLoanOutcome(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                                >
                                    <option value="">Select Outcome</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>

                            {/* Loan Type Dropdown */}
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="loanType" className="text-sm font-medium text-gray-700">Loan Type</label>
                                <select
                                    id="loanType"
                                    value={loanType}
                                    onChange={(e) => setLoanType(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                                >
                                    <option value="">Select Type</option>
                                    <option value="Personal">Personal</option>
                                    <option value="Business">Business</option>
                                    <option value="Educational">Educational</option>
                                </select>
                            </div>

                            <Input id="processingFee" label="Loan Processing Fee" type="number" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} placeholder="e.g., 50.00" />
                            <Input id="itFee" label="IT Fee" type="number" value={itFee} onChange={(e) => setItFee(e.target.value)} placeholder="e.g., 10.00" />
                            <Input id="riskPremium" label="Risk Premium" type="number" value={riskPremium} onChange={(e) => setRiskPremium(e.target.value)} placeholder="e.g., 20.00" />
                            <Input id="gFund" label="G_fund" type="number" value={gFund} onChange={(e) => setGFund(e.target.value)} placeholder="e.g., 100.00" />
                        </div>
                    </div>

                    {/* Principal and Repayment Fragment */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 border-t pt-6 mt-6 border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Principal & Repayment</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Input id="disbursementDate" label="Disbursement Date" type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
                            <Input id="principal" label="Principal" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="e.g., 5000.00" />
                            <Input id="repaymentStartDate" label="Repayment Start Date" type="date" value={repaymentStartDate} onChange={(e) => setRepaymentStartDate(e.target.value)} />
                            <Input id="interestRate" label="Interest %" type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="e.g., 10" />
                            <Input id="paymentWeeks" label="Payment Weeks" type="number" value={paymentWeeks} onChange={(e) => setPaymentWeeks(e.target.value)} placeholder="e.g., 12" />
                        </div>
                    </div>

                    {/* Group Section Fragment */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 border-t pt-6 mt-6 border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Group Section</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                            <Input
                                id="tempGroupId"
                                label="Group ID"
                                type="text"
                                value={tempGroupId}
                                onChange={(e) => setTempGroupId(e.target.value)}
                                placeholder="Group ID"
                            />
                            <Input
                                id="tempGroupName"
                                label="Group Name"
                                type="text"
                                value={tempGroupName}
                                onChange={(e) => setTempGroupName(e.target.value)}
                                placeholder="Group Name"
                            />
                            <Button className="h-10 col-span-1" onClick={handleAddGroup}>
                                Add Group
                            </Button>
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="selectGroup" className="text-sm font-medium text-gray-700">Select Group</label>
                                <select
                                    id="selectGroup"
                                    value={groupId}
                                    onChange={(e) => {
                                        const selectedGroup = groupList.find(g => g.groupId === e.target.value);
                                        if (selectedGroup) {
                                            setGroupId(selectedGroup.groupId);
                                            setGroupName(selectedGroup.groupName);
                                        } else {
                                            setGroupId('');
                                            setGroupName('');
                                        }
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                                >
                                    <option value="">Select Group</option>
                                    {groupList.map((group) => (
                                        <option key={group.id} value={group.groupId}>
                                            {group.groupName} ({group.groupId})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-6">
                        <button
                            type="submit"
                            className="w-full py-3 bg-indigo-600 text-white rounded-md font-bold text-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
                        >
                            {editingLoanId ? 'Update Loan' : 'Save Loan'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Loan List Table */}
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Disbursed Loans</h2>
                {loading ? (
                    <Spinner />
                ) : loanList.length > 0 ? (
                    <>
                        <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0">
                            <Input
                                id="search"
                                label="Search by Client Name"
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Enter Client Name"
                            />
                            <div className="text-sm font-medium text-gray-600">
                                Showing {filteredLoans.length} of {loanList.length} loans
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">G_fund</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredLoans.map((loan) => (
                                        <tr key={loan.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.loanId}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loan.clientName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${loan.principal}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${loan.gFund}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loan.groupName} ({loan.groupId})</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(loan)}
                                                        className="text-green-600 hover:text-green-900"
                                                    >
                                                        <FaEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(loan.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        <FaTrash size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className="text-center text-gray-500 py-8">No loans disbursed yet.</p>
                )}
            </div>
        </div>
    );
}

export default Loan;