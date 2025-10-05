import { useState, useEffect } from 'react';
import { FaEdit, FaTrash } from "react-icons/fa";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDocs,
    where
} from 'firebase/firestore';
import { db } from '../../../firebase'; // Your Firebase db instance

/**
 * A simple, reusable Input component with basic styling.
 * @param {object} props - The component props.
 * @param {string} props.id - The ID of the input.
 * @param {string} props.label - The label text for the input.
 * @param {string} props.type - The type of input (e.g., 'text', 'date', 'number', 'password').
 * @param {any} props.value - The current value of the input.
 * @param {function} props.onChange - The change event handler.
 * @param {string} props.placeholder - The placeholder text.
 * @param {boolean} props.readOnly - If true, the input is read-only.
 * @param {boolean} props.disabled - If true, the input is disabled.
 * @param {boolean} props.error - If true, applies error styling to the input border.
 * @param {string} props.helpText - Additional text displayed below the input.
 */
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, disabled = false, error = false, helpText = '' }) => (
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
            className={`w-full p-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200 ${disabled || readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        {helpText && <p className={`text-xs ${error ? 'text-red-500' : 'text-gray-500'}`}>{helpText}</p>}
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
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 bg-purple-600 text-white hover:bg-purple-700 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {children}
    </button>
);

// Define a simple modal component for delete confirmation
const Modal = ({ show, onClose, children }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl"
                >
                    &times;
                </button>
                {children}
            </div>
        </div>
    );
};

/**
 * The main Savings Form component.
 * It manages all form state and a table with search, edit, and delete functionality.
 */
function Savings({ branch }) {
    // State for all form fields
    // NEW: State for Branch ID and its error
    const [branchId, setBranchId] = useState('');
    const [branchIdError, setBranchIdError] = useState(null); // ADDED: Error state for branchId

    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [compulsoryAmount, setCompulsoryAmount] = useState('');
    const [voluntarySavings, setVoluntarySavings] = useState('');

    // State for the list of savings and the currently editing savings ID
    const [savingsList, setSavingsList] = useState([]);
    const [editingSavingsId, setEditingSavingsId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // States for Firestore operation feedback
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [loadingSavings, setLoadingSavings] = useState(true);
    const [savingsFetchError, setSavingsFetchError] = useState('');
    const [loading, setLoading] = useState(true); // ADDED: General loading state

    // State for client ID lookup
    const [isLoadingClient, setIsLoadingClient] = useState(false);
    const [clientLookupError, setClientLookupError] = useState('');

    // --- State for Delete Confirmation ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const [deleteError, setDeleteError] = useState('');

    const ADMIN_PASSWORD = "1234"; // ⚠️ Change this to a strong, actual password!


    // ----------------------------------------------------------------
    // 1. USE EFFECT: Determine and set branchId from props or session storage
    // ----------------------------------------------------------------
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


    // --- useEffect for fetching clientName when clientId changes ---
    // (Existing logic remains here, just needs to be aware of branchIdError)
    useEffect(() => {
        // Prevent lookup if branchId is missing or has an error
        if (!branchId || branchIdError) return;
        
        if (clientId && !editingSavingsId) {
            const fetchClientName = async () => {
                setIsLoadingClient(true);
                setClientLookupError('');
                setClientName('');

                try {
                    const clientsCollectionRef = collection(db, "clients");
                    // NEW: Filter by branchId AND clientId for security and correctness
                    const q = query(
                        clientsCollectionRef, 
                        where("clientId", "==", clientId),
                        where("branchId", "==", branchId) // ADDED branchId filter
                    );
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const clientData = querySnapshot.docs[0].data();
                        setClientName(clientData.fullName || 'N/A');
                    } else {
                        setClientLookupError("Client ID not found for this branch."); // Improved error message
                        setClientName('');
                    }
                } catch (error) {
                    console.error("Error fetching client details:", error);
                    setClientLookupError("Failed to fetch client details.");
                    setClientName('');
                } finally {
                    setIsLoadingClient(false);
                }
            };

            const handler = setTimeout(fetchClientName, 500);
            return () => clearTimeout(handler);
        } else if (!clientId && !editingSavingsId) {
            setClientName('');
            setClientLookupError('');
        }
    }, [clientId, editingSavingsId, branchId, branchIdError]); // ADDED branchId and branchIdError dependencies


    // ----------------------------------------------------------------
    // 2. USE EFFECT: Fetch savings data from Firestore in real-time
    // ----------------------------------------------------------------
    useEffect(() => {
        // Run only if branchId is set and no critical error
        if (!branchId || branchIdError) {
            setLoadingSavings(false);
            return;
        }

        const savingsCollectionRef = collection(db, 'savings');
        // MODIFIED: Filter by branchId AND order by createdAt
        const q = query(
            savingsCollectionRef, 
            where('branchId', '==', branchId), // ADDED branchId filter
            // orderBy('createdAt', 'desc')
        );

        setLoadingSavings(true);
        setSavingsFetchError('');

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedSavings = snapshot.docs.map(doc => {
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
            // No need for client-side filtering if the query is correct
            setSavingsList(fetchedSavings);
            setLoadingSavings(false);
        }, (error) => {
            console.error("Error fetching savings from Firestore:", error);
            setSavingsFetchError("Failed to load savings. Please try again.");
            setLoadingSavings(false);
        });

        return () => unsubscribe();
    }, [branchId, branchIdError]); // ADDED branchId and branchIdError dependencies

  

    // MODIFIED: Simplified filteredSavings since the onSnapshot query handles branchId filtering
    const filteredSavings = savingsList.filter(savings =>
        (savings.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (savings.clientId || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const clearForm = () => {
        setDate(new Date().toISOString().slice(0, 10));
        setClientId('');
        setClientName('');
        setCompulsoryAmount('');
        setVoluntarySavings('');
        setEditingSavingsId(null);
        setSaveError('');
        setSaveSuccess('');
        setClientLookupError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        // Check for Branch ID error before proceeding
        if (branchIdError) {
            setSaveError(branchIdError);
            return;
        }

        if (!clientId || !clientName || compulsoryAmount === '' || voluntarySavings === '') {
            setSaveError("Please fill in Client ID, Client Name, Compulsory Amount, and Voluntary Savings.");
            return;
        }

        if (!editingSavingsId && (isLoadingClient || clientLookupError)) {
            setSaveError(clientLookupError || "Still loading client details. Please wait.");
            return;
        }

        const compAmountNum = parseFloat(compulsoryAmount);
        const volSavingsNum = parseFloat(voluntarySavings);

        if (isNaN(compAmountNum) || isNaN(volSavingsNum)) {
            setSaveError("Compulsory Amount and Voluntary Savings must be valid numbers.");
            return;
        }

        setIsSaving(true);
        setSaveError('');
        setSaveSuccess('');

        const savingsData = {
            date,
            clientId,
            clientName,
            compulsoryAmount: compAmountNum,
            voluntarySavings: volSavingsNum,
            branchId, // Included branchId
            createdAt: editingSavingsId ? savingsList.find(s => s.id === editingSavingsId)?.createdAt : serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            if (editingSavingsId) {
                const savingsDocRef = doc(db, "savings", editingSavingsId);
                await updateDoc(savingsDocRef, savingsData);
                setSaveSuccess("Savings record updated successfully! ✅");
            } else {
                const savingsCollectionRef = collection(db, "savings");
                await addDoc(savingsCollectionRef, savingsData);
                setSaveSuccess("Savings record saved successfully! ✨");
            }
            clearForm();
        } catch (e) {
            console.error("Error saving savings record:", e);
            setSaveError(`Failed to save savings record: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (savings) => {
        setEditingSavingsId(savings.id);
        setDate(savings.date);
        setClientId(savings.clientId);
        setClientName(savings.clientName);
        setCompulsoryAmount(String(savings.compulsoryAmount));
        setVoluntarySavings(String(savings.voluntarySavings));
        setSaveError('');
        setSaveSuccess('');
        setClientLookupError('');
    };

    // --- Modified handleDelete to open confirmation modal ---
    const handleDelete = (id) => {
        setDeleteTargetId(id);
        setShowDeleteConfirm(true);
        setDeletePassword(''); // Clear any previous password
        setDeleteError(''); // Clear any previous error
    };

    // --- New function to confirm deletion with password ---
    const confirmDelete = async () => {
        if (deletePassword === ADMIN_PASSWORD) { // Check if entered password matches
            setIsSaving(true);
            setSaveError('');
            setSaveSuccess('');
            setDeleteError(''); // Clear delete specific errors

            try {
                await deleteDoc(doc(db, "savings", deleteTargetId));
                setSaveSuccess("Savings record deleted successfully! 🗑️");
                setShowDeleteConfirm(false); // Close modal
                setDeleteTargetId(null);
                setDeletePassword('');
            } catch (error) {
                console.error("Error deleting savings record:", error);
                setSaveError(`Failed to delete savings record: ${error.message}`);
                setDeleteError("Failed to delete record.");
            } finally {
                setIsSaving(false);
            }
        } else {
            setDeleteError("Incorrect password. Please try again.");
        }
    };

    // --- Function to cancel delete confirmation ---
    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setDeleteTargetId(null);
        setDeletePassword('');
        setDeleteError('');
    };

    // If branchId has a critical error, display a message instead of the form
    if (branchIdError) {
        return (
            <div className="container mx-auto p-6 text-center text-red-600 bg-red-100 border border-red-400 rounded-lg shadow-lg mt-10">
                <h2 className="text-xl font-semibold mb-2">Configuration Error</h2>
                <p>{branchIdError}</p>
                <p className="mt-4">Please log in or contact support if the issue persists.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
                    {editingSavingsId ? 'Edit Savings Record' : 'Savings Form'}
                </h1>

                {/* Display Success or Error Messages */}
                {saveError && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <span className="block sm:inline">{saveError}</span>
                    </div>
                )}
                {saveSuccess && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <span className="block sm:inline">{saveSuccess}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Branch ID Input Field (Read-Only) */}
                    <Input
                        id="branchId"
                        label="Branch ID"
                        type="text"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        placeholder="e.g., B001"
                        readOnly // Make this read-only
                        disabled={isSaving}
                        helpText="Automatically determined from login session."
                    />
                    <Input id="date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving} />
                    <Input
                        id="clientId"
                        label="Client ID"
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="e.g., C001"
                        disabled={isSaving || editingSavingsId !== null} // Disable for editing
                        helpText={isLoadingClient ? 'Searching for client...' : clientLookupError ? clientLookupError : 'Enter the client ID.'}
                        error={!!clientLookupError}
                    />
                    
                    <Input
                        id="clientName"
                        label="Client Name"
                        type="text"
                        value={clientName}
                        readOnly
                        disabled
                        placeholder="Auto-populated"
                        className="col-span-1"
                    />
                    <Input
                        id="compulsoryAmount"
                        label="Compulsory Amount"
                        type="number"
                        value={compulsoryAmount}
                        onChange={(e) => setCompulsoryAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isSaving}
                    />
                    <Input
                        id="voluntarySavings"
                        label="Voluntary Savings"
                        type="number"
                        value={voluntarySavings}
                        onChange={(e) => setVoluntarySavings(e.target.value)}
                        placeholder="0.00"
                        disabled={isSaving}
                    />

                    <div className="flex space-x-4 col-span-full pt-4">
                        <Button type="submit" disabled={isSaving || !!branchIdError}>
                            {isSaving ? (editingSavingsId ? 'Updating...' : 'Saving...') : (editingSavingsId ? 'Update Savings' : 'Save New Savings')}
                        </Button>
                        <Button type="button" onClick={clearForm} className="bg-gray-500 hover:bg-gray-600">
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>

            {/* Savings List */}
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
                    Savings Records ({filteredSavings.length})
                </h2>
                
                {/* Search Bar */}
                <Input
                    id="search"
                    label="Search by Client Name or ID"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search records..."
                    className="mb-4"
                />

                {loadingSavings ? (
                    <p className="text-center text-gray-500">Loading savings data...</p>
                ) : savingsFetchError ? (
                    <p className="text-center text-red-500">{savingsFetchError}</p>
                ) : filteredSavings.length === 0 ? (
                    <p className="text-center text-gray-500">No savings records found for this branch.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compulsory</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voluntary</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSavings.map((savings) => (
                                    <tr key={savings.id} className={editingSavingsId === savings.id ? 'bg-purple-50' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{savings.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{savings.clientId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{savings.clientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(savings.compulsoryAmount || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(savings.voluntarySavings || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <button
                                                onClick={() => handleEdit(savings)}
                                                className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                                                title="Edit"
                                                disabled={isSaving}
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(savings.id)}
                                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                title="Delete"
                                                disabled={isSaving}
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteConfirm} onClose={cancelDelete}>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
                <p className="mb-4 text-gray-600">
                    Are you sure you want to delete this savings record? This action cannot be undone.
                    Please enter the administrator password to confirm.
                </p>
                <Input
                    id="deletePassword"
                    label="Admin Password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password"
                    error={!!deleteError}
                    helpText={deleteError}
                />
                <div className="flex justify-end space-x-3 mt-6">
                    <Button onClick={cancelDelete} className="bg-gray-500 hover:bg-gray-600">
                        Cancel
                    </Button>
                    <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isSaving}>
                        {isSaving ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

export default Savings; // Add this line if you need to export the component