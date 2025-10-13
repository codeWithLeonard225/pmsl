import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaSave, FaTimes, FaSearch } from "react-icons/fa"; // Added FaSearch
import { db } from '../../../firebase';

// Import Firestore functions
import {
    collection,
    updateDoc,
    doc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy // Re-imported orderBy
} from 'firebase/firestore';

// --- Reusable Components (Assuming these are available via import or defined in this file) ---
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

const Button = ({ onClick, children, className = "", disabled = false }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'} ${className}`}
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
// ----------------------------------------------------------------------


function GroupManager({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [groupList, setGroupList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [newGroupName, setNewGroupName] = useState('');
    
    // NEW STATE for search
    const [searchTerm, setSearchTerm] = useState('');

    // Hardcoded PIN for delete confirmation (like in your Loan component)
    const DELETE_PIN = "1234"; 

    // Firestore collection reference
    const groupsCollectionRef = collection(db, "groups");

    // 1. Determine branchId from prop or session storage
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
            setError("Branch ID could not be determined. Group management disabled.");
            setLoading(false);
        }
    }, [branch]);

    // 2. Fetch groups in real-time for the determined branchId
    useEffect(() => {
        if (!branchId || error) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Query to filter by branchId and order by groupId
        // NOTE: This query requires a composite index on (branchId ASC, groupId ASC)
        const qGroups = query(
            groupsCollectionRef,
            where('branchId', '==', branchId), 
          
        );

        const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
            const fetchedGroups = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id // Firestore document ID
            }));
            setGroupList(fetchedGroups);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching real-time group data:", err);
            setError("Failed to load group data. Please check connection and Firestore indexes.");
            setLoading(false);
        });

        return () => unsubscribeGroups();
    }, [branchId, error]);

    // Derived State: Filtered list for the table
    const filteredGroups = groupList.filter(group => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        
        // Filter by either Group ID or Group Name
        return (
            (group.groupId || "").toLowerCase().includes(lowerCaseSearchTerm) ||
            (group.groupName || "").toLowerCase().includes(lowerCaseSearchTerm)
        );
    });

    // --- CRUD Operations ---

    // Enter Edit Mode
    const handleEditStart = (group) => {
        setEditingGroupId(group.id);
        setNewGroupName(group.groupName);
    };

    // Save Changes
    const handleUpdate = async () => {
        if (!newGroupName.trim()) {
            alert("Group Name cannot be empty.");
            return;
        }

        try {
            const groupDocRef = doc(db, "groups", editingGroupId);
            await updateDoc(groupDocRef, {
                groupName: newGroupName.trim(),
            });
            alert(`Group ${newGroupName.trim()} updated successfully!`);
            setEditingGroupId(null);
            setNewGroupName('');
        } catch (err) {
            console.error("Error updating group:", err);
            alert("Failed to update group. Please try again.");
        }
    };

    // Cancel Edit Mode
    const handleEditCancel = () => {
        setEditingGroupId(null);
        setNewGroupName('');
    };

    // Delete Group with PIN Confirmation
    const handleDelete = async (id, groupName) => {
        if (!window.confirm(`Are you sure you want to delete the group: ${groupName}? This action is irreversible.`)) {
            return;
        }

        const enteredPin = prompt("Please enter the delete PIN to confirm:");
        if (enteredPin !== DELETE_PIN) {
            alert("Incorrect PIN or deletion cancelled.");
            return;
        }

        try {
            const groupDocRef = doc(db, "groups", id);
            await deleteDoc(groupDocRef);
            alert(`Group ${groupName} deleted successfully! 🗑️`);
        } catch (err) {
            console.error("Error deleting group:", err);
            alert("Failed to delete group. Please try again.");
        }
    };

    // --- Render Logic ---

    if (error) {
        return <div className="text-red-600 p-4 bg-red-100 rounded-md font-medium text-center">{error}</div>;
    }

    if (loading) {
        return <Spinner />;
    }

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
                    Group Manager ({branchId})
                </h1>

                {/* NEW: Search Input Field */}
                <div className="mb-6 flex items-center space-x-3">
                    <FaSearch className="text-gray-400 text-lg" />
                    <input
                        type="text"
                        placeholder="Search by Group ID or Group Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                    />
                </div>
                {/* END NEW: Search Input Field */}


                {groupList.length === 0 ? (
                    <p className="text-gray-500 p-4 bg-yellow-50 rounded-md">No groups found for this branch. Please create a new group in the Loan Disbursement Form.</p>
                ) : (
                    <div className="overflow-x-auto">
                        
                        {filteredGroups.length === 0 && searchTerm !== '' ? (
                            <p className="text-gray-500 p-4 bg-yellow-100 rounded-md">No results found for "{searchTerm}".</p>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group Name</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {/* Map over filteredGroups instead of groupList */}
                                    {filteredGroups.map((group) => (
                                        <tr key={group.id} className="hover:bg-gray-50">
                                            {/* Group ID - Read-Only */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {group.groupId}
                                            </td>
                                            
                                            {/* Group Name - Editable */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingGroupId === group.id ? (
                                                    <Input 
                                                        id="newGroupName"
                                                        label=""
                                                        value={newGroupName}
                                                        onChange={(e) => setNewGroupName(e.target.value)}
                                                        placeholder="Enter new group name"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-gray-700">{group.groupName}</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {editingGroupId === group.id ? (
                                                    <div className="flex justify-end space-x-2">
                                                        <Button onClick={handleUpdate} className="bg-green-500 hover:bg-green-600">
                                                            <FaSave className="mr-1" /> Save
                                                        </Button>
                                                        <Button onClick={handleEditCancel} className="bg-red-500 hover:bg-red-600">
                                                            <FaTimes className="mr-1" /> Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end space-x-2">
                                                        <Button 
                                                            onClick={() => handleEditStart(group)} 
                                                            className="bg-blue-500 hover:bg-blue-600"
                                                        >
                                                            <FaEdit className="mr-1" /> Edit
                                                        </Button>
                                                        <Button 
                                                            onClick={() => handleDelete(group.id, group.groupName)} 
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            <FaTrash className="mr-1" /> Delete
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GroupManager;