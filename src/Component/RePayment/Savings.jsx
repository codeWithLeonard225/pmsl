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
    // NEW: State for Branch ID
    const [branchId, setBranchId] = useState('');

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

    // State for client ID lookup
    const [isLoadingClient, setIsLoadingClient] = useState(false);
    const [clientLookupError, setClientLookupError] = useState('');

    // --- State for Delete Confirmation ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const [deleteError, setDeleteError] = useState('');

    // IMPORTANT: Define your ADMIN_PASSWORD here.
    // In a real application, this should NOT be hardcoded in client-side code.
    // It should be fetched securely from an environment variable or a backend service.
    const ADMIN_PASSWORD = "1234"; // ⚠️ Change this to a strong, actual password!

    // NEW: useEffect to set the branchId state from the prop when the component mounts or the prop changes
    useEffect(() => {
        if (branch && branch.branchId) {
            setBranchId(branch.branchId);
        }
    }, [branch]);


    // --- useEffect for fetching clientName when clientId changes ---
    useEffect(() => {
        if (clientId && !editingSavingsId) {
            const fetchClientName = async () => {
                setIsLoadingClient(true);
                setClientLookupError('');
                setClientName('');

                try {
                    const clientsCollectionRef = collection(db, "clients");
                    const q = query(clientsCollectionRef, where("clientId", "==", clientId));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const clientData = querySnapshot.docs[0].data();
                        setClientName(clientData.fullName || 'N/A');
                    } else {
                        setClientLookupError("Client ID not found.");
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
    }, [clientId, editingSavingsId]);

   // UseEffect to fetch savings data from Firestore in real-time
    useEffect(() => {
        const savingsCollectionRef = collection(db, 'savings');
        const q = query(savingsCollectionRef, orderBy('createdAt', 'desc'));

        setLoadingSavings(true);
        setSavingsFetchError('');

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedSavings = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.date,
                    // Check if createdAt exists and is a Timestamp before converting
                    createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
                        ? data.createdAt.toDate().toISOString() 
                        : null,
                    // Check if updatedAt exists and is a Timestamp before converting
                    updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' 
                        ? data.updatedAt.toDate().toISOString() 
                        : null
                };
            });
            setSavingsList(fetchedSavings);
            setLoadingSavings(false);
        }, (error) => {
            console.error("Error fetching savings from Firestore:", error);
            setSavingsFetchError("Failed to load savings. Please try again.");
            setLoadingSavings(false);
        });

        return () => unsubscribe();
    }, []);

  

    const filteredSavings = savingsList.filter(savings =>
    savings.branchId === branchId && (
        savings.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        savings.clientId.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
            branchId, // NEW: Include the branchId in the data
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

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
                    {editingSavingsId ? 'Edit Savings Record' : 'Savings Form'}
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
                    <Input id="date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving} />
                    <Input
                        id="clientId"
                        label="Client ID"
                        type="text"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="e.g., cmcs-01"
                        readOnly={editingSavingsId !== null}
                        disabled={editingSavingsId !== null || isSaving}
                        error={!!clientLookupError}
                        helpText={isLoadingClient ? "Searching for client..." : clientLookupError}
                    />
                    <Input
                        id="clientName"
                        label="Client Name"
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Auto-populated from Client ID"
                        readOnly={isLoadingClient || !clientId || editingSavingsId !== null}
                        disabled={isLoadingClient || !clientId || editingSavingsId !== null || isSaving}
                        helpText={clientName && !clientLookupError ? "Auto-populated" : ""}
                    />
                    <Input id="compulsoryAmount" label="Compulsory Amount" type="number" value={compulsoryAmount} onChange={(e) => setCompulsoryAmount(e.target.value)} placeholder="e.g., 50.00" disabled={isSaving} />
                    <Input id="voluntarySavings" label="Voluntary Savings" type="number" value={voluntarySavings} onChange={(e) => setVoluntarySavings(e.target.value)} placeholder="e.g., 25.00" disabled={isSaving} />

                    {isSaving && <p className="col-span-full text-blue-500">Saving data...</p>}
                    {saveError && <p className="col-span-full text-red-500">{saveError}</p>}
                    {saveSuccess && <p className="col-span-full text-green-600">{saveSuccess}</p>}

                    <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-6 flex gap-4">
                        <Button
                            type="submit"
                            className="w-full py-3 font-bold text-lg shadow-md"
                            disabled={isSaving || (!editingSavingsId && (isLoadingClient || clientLookupError || !clientName))}
                        >
                            {isSaving ? 'Saving...' : (editingSavingsId ? 'Update Savings' : 'Save Savings')}
                        </Button>
                        {editingSavingsId && (
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

            {/* Savings List Table */}
            {loadingSavings ? (
                <p className="text-center text-gray-600">Loading savings records...</p>
            ) : savingsFetchError ? (
                <p className="text-center text-red-500">{savingsFetchError}</p>
            ) : savingsList.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Savings Records</h2>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0">
                        <Input
                            id="search"
                            label="Search by Client Name or ID"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Enter Client Name or ID"
                        />
                        <div className="text-sm font-medium text-gray-600">
                            Showing {filteredSavings.length} of {savingsList.length} records
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comp. Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vol. Savings</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSavings.map((savings) => (
                                    <tr key={savings.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{savings.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{savings.clientId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{savings.clientName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${savings.compulsoryAmount?.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${savings.voluntarySavings?.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleEdit(savings)}
                                                    className="text-green-600 hover:text-green-900"
                                                >
                                                    <FaEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(savings.id)}
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
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteConfirm} onClose={cancelDelete}>
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Confirm Deletion ⚠️</h3>
                <p className="text-gray-700 mb-4">
                    To delete this record, please enter the administrator password.
                </p>
                <Input
                    id="deletePassword"
                    label="Administrator Password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password"
                    error={!!deleteError}
                    helpText={deleteError}
                />
                <div className="flex justify-end space-x-3 mt-6">
                    <Button
                        onClick={cancelDelete}
                        className="bg-gray-400 hover:bg-gray-500 text-white"
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDelete}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={isSaving}
                    >
                        {isSaving ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

export default Savings;