// StaffForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Upload, User, Pencil, Trash2 } from 'lucide-react';

// Import your Firebase and Cloudinary configurations
import { db, cloudinaryConfig } from '../../../firebase';

// Import Firestore functions
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    onSnapshot, // Used for real-time data fetching
    query, // Import query
    where, // Import where
    getDocs, writeBatch,
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
            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 ${readOnly ? 'bg-gray-100' : 'bg-white'}`}
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

/**
 * The main Staff Registration Form component.
 * It manages all form state and logic, including age calculation,
 * photo handling, and a table with edit/delete functionality.
 */
function StaffForm() {
    // State for each form field
    const [staffId, setStaffId] = useState(''); // Holds the sequential staff ID
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [age, setAge] = useState('');
    const [placeOfBirth, setPlaceOfBirth] = useState('');
    const [nationality, setNationality] = useState('');
    const [telephone, setTelephone] = useState('');
    const [address, setAddress] = useState('');
    const [registrationDate, setRegistrationDate] = useState(new Date().toISOString().slice(0, 10)); // Defaults to today's date

    const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    // State for photo URL from Cloudinary and a ref for the hidden file input
    const [photoUrl, setPhotoUrl] = useState('');
    const fileInputRef = useRef(null);

    // State for local image preview URL
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    // State for tracking image upload loading status
    const [imageUploading, setImageUploading] = useState(false);

    // State for the list of staff members fetched from Firestore
    const [staffList, setStaffList] = useState([]);
    // State to track if we are editing an existing staff member (stores Firestore document ID)
    const [editingStaffId, setEditingStaffId] = useState(null);

    // State for the search term used to filter the staff list
    const [searchTerm, setSearchTerm] = useState('');

    // Loading state for data fetching
    const [loading, setLoading] = useState(true); // Set to true initially as data is loading on mount

    // ✨ NEW: State for the current branchId, retrieved from session storage
    const [currentBranchId, setCurrentBranchId] = useState('');

    // Define the PIN for delete confirmation.
    const DELETE_PIN = "1234"; // Example PIN

    // Reference to the Firestore 'staffMembers' collection
    const staffCollectionRef = collection(db, "staffMembers");

    // useEffect hook to retrieve branchId from session storage on mount
    useEffect(() => {
        const branch = sessionStorage.getItem('branchId');
        if (branch) {
            setCurrentBranchId(branch);
        } else {
            console.error("Branch ID not found in session storage. Staff cannot be registered without a branch.");
            // You might want to redirect to login or show an error message to the user
        }
    }, []);

    // useEffect hook for the real-time Firestore listener.
    useEffect(() => {
        // Only set up the listener if we have a branch ID
        if (!currentBranchId) return;

        setLoading(true); // Start loading before fetching

        // ✨ NEW: Filter the data by the current branch ID
        const q = query(staffCollectionRef, where("branchId", "==", currentBranchId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedStaff = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id
            }));
            console.log("Real-time Staff Data Fetched:", fetchedStaff);
            setStaffList(fetchedStaff);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching real-time staff data:", error);
            alert("Failed to load staff data in real-time. Please check your internet connection and Firebase rules.");
            setLoading(false);
        });

        // Cleanup function
        return () => unsubscribe();
    }, [currentBranchId]); // Dependency: Re-run when currentBranchId is set

    // Derived state: Filtered staff list based on the search term
    const filteredStaff = staffList.filter(staff =>
        (staff.fullName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // useEffect hook to automatically calculate age when dateOfBirth changes
    useEffect(() => {
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            const today = new Date();
            let calculatedAge = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();

            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                calculatedAge--;
            }
            setAge(calculatedAge.toString());
        } else {
            setAge('');
        }
    }, [dateOfBirth]);

    // useEffect hook to auto-generate a new Staff ID using sequential logic.
    useEffect(() => {
        // Only generate a new ID if not in editing mode
        if (!editingStaffId) {
            const latestStaffNumber = staffList.reduce((max, staff) => {
                const numMatch = (staff.staffId || "pmsd-00").match(/^pmsd-(\d+)$/i);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);

            const newNumber = latestStaffNumber + 1;
            const formattedId = `pmsd-${String(newNumber).padStart(2, '0')}`;
            setStaffId(formattedId);
        }
    }, [staffList, editingStaffId]);

    // Handle photo file selection and Cloudinary upload using fetch API
    const handlePhotoImport = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setImagePreviewUrl(URL.createObjectURL(file));
            setImageUploading(true);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', cloudinaryConfig.uploadPreset);
            formData.append('folder', 'Pmc_images');

            try {
                const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                setPhotoUrl(data.secure_url);
                alert("Photo uploaded successfully! 📸");
            } catch (error) {
                console.error("Error uploading image to Cloudinary:", error);
                alert(`Failed to upload image. Please try again. Details: ${error.message || error}`);
                setImagePreviewUrl('');
                setPhotoUrl('');
            } finally {
                setImageUploading(false);
            }
        }
    };

    const handleImportButtonClick = () => {
        fileInputRef.current.click();
    };

    const clearForm = () => {
        setFullName('');
        setGender('');
        setDateOfBirth('');
        setAge('');
        setPlaceOfBirth('');
        setNationality('');
        setTelephone('');
        setAddress('');
        setPhotoUrl('');
        setImagePreviewUrl('');
        setImageUploading(false);
        setEditingStaffId(null);
        setRegistrationDate(new Date().toISOString().slice(0, 10));
    };

    const updateStaffNameEverywhere = async (oldName, newName) => {
        try {
            // Update in Clients
            const clientsSnap = await getDocs(query(collection(db, "clients"), where("staffName", "==", oldName)));
            const batch1 = writeBatch(db);
            clientsSnap.forEach(docSnap => {
                batch1.update(doc(db, "clients", docSnap.id), { staffName: newName });
            });
            await batch1.commit();

            // Update in Loans
            const loansSnap = await getDocs(query(collection(db, "loans"), where("staffName", "==", oldName)));
            const batch2 = writeBatch(db);
            loansSnap.forEach(docSnap => {
                batch2.update(doc(db, "loans", docSnap.id), { staffName: newName });
            });
            await batch2.commit();

            // Update in Payments
            const paymentsSnap = await getDocs(query(collection(db, "payments"), where("staffName", "==", oldName)));
            const batch3 = writeBatch(db);
            paymentsSnap.forEach(docSnap => {
                batch3.update(doc(db, "payments", docSnap.id), { staffName: newName });
            });
            await batch3.commit();

            console.log("✅ Staff name updated across all collections!");
        } catch (error) {
            console.error("Error updating staffName everywhere:", error);
        }
    };

    // Handle form submission (add new staff or update existing staff)
    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!fullName || !gender || !currentBranchId) {
            alert("Please fill in all required fields and ensure a Branch ID is available.");
            return;
        }

        // Create the staff data object to be saved to Firestore
        const staffData = {
            staffId,
            fullName,
            gender,
            dateOfBirth,
            age,
            placeOfBirth,
            nationality,
            telephone,
            address,
            registrationDate,
            photoUrl,
            branchId: currentBranchId, // ✨ NEW: Add the branchId to the data object
        };

        try {
            if (editingStaffId) {
                const staffDocRef = doc(db, "staffMembers", editingStaffId);

                // Get the old staff data first
                const oldStaff = staffList.find(s => s.id === editingStaffId);
                const oldName = oldStaff?.fullName;

                await updateDoc(staffDocRef, staffData);

                // If fullName changed, update it everywhere
                if (oldName && oldName !== fullName) {
                    await updateStaffNameEverywhere(oldName, fullName);
                }

                alert("Staff details updated successfully! ✅");
            } else {
                await addDoc(staffCollectionRef, staffData);
                alert("Staff registered successfully! 🎉");
            }


            clearForm();
        } catch (error) {
            console.error("Error saving staff data to Firestore:", error);
            alert("Failed to save staff data. Please try again. Check the console for more details.");
        }
    };

    const handleEdit = (staff) => {
        setEditingStaffId(staff.id);
        setStaffId(staff.staffId);
        setFullName(staff.fullName);
        setGender(staff.gender);
        setDateOfBirth(staff.dateOfBirth);
        setPlaceOfBirth(staff.placeOfBirth);
        setNationality(staff.nationality);
        setTelephone(staff.telephone);
        setAddress(staff.address);
        setPhotoUrl(staff.photoUrl);
        setImagePreviewUrl(staff.photoUrl);
        setRegistrationDate(staff.registrationDate || new Date().toISOString().slice(0, 10));
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this staff member? This action cannot be undone.")) {
            return;
        }
        const enteredPin = prompt("Please enter the delete PIN to confirm:");
        if (enteredPin === null || enteredPin !== DELETE_PIN) {
            alert("Incorrect PIN. Deletion cancelled.");
            return;
        }

        try {
            const staffDocRef = doc(db, "staffMembers", id);
            await deleteDoc(staffDocRef);
            alert("Staff deleted successfully! 🗑️");
        } catch (error) {
            console.error("Error deleting staff data:", error);
            alert("Failed to delete staff data. Please try again.");
        }
    };

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            {/* Staff Registration Form Section */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <div className="flex items-center justify-between text-center">
                    {/* Header Title */}
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 border-b pb-4">
                        {editingStaffId ? 'Edit Staff Details' : 'Staff Registration Form'}
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
                    {/* Registration Date (Read-only) */}
                    <Input id="registrationDate" label="Registration Date" type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} readOnly />

                    {/* Staff ID (Read-only display, now showing sequential ID) */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="staffIdDisplay" className="text-sm font-medium text-gray-700">Staff ID</label>
                        <div id="staffIdDisplay" className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                            {staffId}
                        </div>
                    </div>

                    {/* ✨ NEW: Branch ID (Read-only) */}
                    <Input id="branchId" label="Branch ID" value={currentBranchId} readOnly />

                    {/* Other Input Fields */}
                    <Input id="fullName" label="Full Name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />

                    {/* Gender Dropdown */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="gender" className="text-sm font-medium text-gray-700">Gender</label>
                        <select
                            id="gender"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                        >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <Input id="dob" label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                    <Input id="age" label="Age" type="text" value={age} placeholder="Age will be calculated" readOnly />
                    <Input id="placeOfBirth" label="Place of Birth" type="text" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} placeholder="City, Country" />
                    <Input id="nationality" label="Nationality" type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g., Sierra Leonean" />
                    <Input id="telephone" label="Telephone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+232-XXXXXXXX" />
                    <Input id="address" label="Address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Freetown" />

                    {/* Photo Section */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center space-y-4 pt-4 border-t border-gray-200 mt-4">
                        <h3 className="text-lg font-semibold text-gray-800">Staff Photo</h3>
                        <div className="w-32 h-32 rounded-full border-4 border-gray-300 flex items-center justify-center overflow-hidden bg-gray-200 relative">
                            {imageUploading ? (
                                <Spinner />
                            ) : imagePreviewUrl ? (
                                <img src={imagePreviewUrl} alt="Staff Preview" className="w-full h-full object-cover" />
                            ) : (
                                <User size={64} className="text-gray-400" />
                            )}
                        </div>
                        <div className="flex justify-center">
                            <Button onClick={handleImportButtonClick} disabled={imageUploading}>
                                {imageUploading ? 'Uploading...' : <><Upload size={18} className="mr-2" /> Import Photo</>}
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoImport}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-6">
                        <button
                            type="submit"
                            className="w-full py-3 bg-indigo-600 text-white rounded-md font-bold text-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
                        >
                            {editingStaffId ? 'Update Staff Details' : 'Save Staff Details'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Staff List Table Section */}
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Registered Staff</h2>

                {loading ? (
                    <Spinner />
                ) : staffList.length > 0 ? (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <Input
                                id="search"
                                label="Search by Full Name"
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Enter Full Name"
                            />
                            <div className="text-sm font-medium text-gray-600">
                                Showing {filteredStaff.length} of {staffList.length} staff
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredStaff.map((staff) => (
                                        <tr key={staff.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.staffId}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.fullName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.gender}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(staff)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(staff.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        <Trash2 size={18} />
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
                    <p className="text-center text-gray-500 py-8">No staff members registered yet.</p>
                )}
            </div>
        </div>
    );
}

export default StaffForm;