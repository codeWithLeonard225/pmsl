import { useState, useEffect, useRef } from 'react';
import { FaUpload, FaUser, FaPencilAlt, FaTrashAlt, FaCalendarAlt, FaMapMarkerAlt, FaPhone, FaHome, FaBirthdayCake, FaHeart, FaBriefcase, FaSpinner } from 'react-icons/fa';
import {
    db,
    cloudinaryConfig,
} from '../../../firebase';

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
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, icon: Icon = null }) => (
    <div className="flex flex-col space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={18} className="text-gray-400" />
                </div>
            )}
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 ${Icon ? 'pl-10' : ''}`}
            />
        </div>
    </div>
);

/**
 * A custom button component for the form.
 * @param {object} props - The component props.
 * @param {function} props.onClick - The click event handler.
 * @param {React.ReactNode} props.children - The content of the button.
 * @param {string} props.className - Additional Tailwind classes.
 * @param {boolean} props.disabled - If true, the button is disabled.
 */
const Button = ({ onClick, children, className = "", disabled = false }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                ${className}`}
    >
        {children}
    </button>
);
const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <FaSpinner className="animate-spin text-indigo-600 text-4xl" role="status" aria-label="Loading" />
    </div>
);


function ClientDetails({ branch }) { // Add branch to props
    // State for each form field
    const [clientId, setClientId] = useState('');
    const [registrationDate, setRegistrationDate] = useState(new Date().toISOString().slice(0, 10)); // Default to today's date
    const [staffName, setStaffName] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [age, setAge] = useState('');
    const [placeOfBirth, setPlaceOfBirth] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [telephone, setTelephone] = useState('');
    const [address, setAddress] = useState('');

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

    // NEW: State for Branch ID
    const [branchId, setBranchId] = useState('');


    // State for photo URL from Cloudinary and a ref for the hidden file input
    const [photoUrl, setPhotoUrl] = useState('');
    const fileInputRef = useRef(null);

    // NEW: State for local image preview URL and upload status
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // New state to indicate form submission in progress

    // State for the list of clients fetched from Firestore
    const [clientList, setClientList] = useState([]);
    // State to track if we are editing an existing client (stores Firestore document ID)
    const [editingClientId, setEditingClientId] = useState(null);

    // State for the search term
    const [searchTerm, setSearchTerm] = useState('');

    // Loading state for initial client data fetch
    const [loading, setLoading] = useState(true);

    // NEW: State for staff members and staff loading
    const [staffMembers, setStaffMembers] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);

    // Define the PIN for delete confirmation.
    // WARNING: For a production application, do NOT hardcode sensitive passwords/PINs like this
    // directly in client-side code. This should be handled securely on a backend (e.g., Firebase Cloud Functions).
    const DELETE_PIN = "1234"; // Example PIN

    // Reference to the Firestore 'clients' collection
    const clientsCollectionRef = collection(db, "clients");
    // Reference to the Firestore 'staffMembers' collection
    const staffMembersCollectionRef = collection(db, "staffMembers");

    // NEW: useEffect to set the branchId state from the prop when the component mounts or the prop changes
    useEffect(() => {
        if (branch && branch.branchId) {
            setBranchId(branch.branchId);
        }
    }, [branch]);

   // useEffect hook for the real-time Firestore listener for clients.
useEffect(() => {
    setLoading(true); // Start loading before fetching
    const q = query(clientsCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedClients = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id // Store the Firestore document ID for update/delete operations
        }));
        console.log("Real-time Client Data Fetched:", fetchedClients);
        setClientList(fetchedClients);
        setLoading(false); // Data loaded, set loading to false

        // Corrected Logic: Move the ID generation code out of the nested useEffect
        // and place it directly inside the onSnapshot callback.
        if (!editingClientId) {
            const branchClients = fetchedClients.filter(client => client.branchId === branchId);

            const latestClientNumber = branchClients.reduce((max, client) => {
                const numMatch = (client.clientId || "pmcd-00").match(/^pmcd-(\d+)$/i);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);

            const newNumber = latestClientNumber + 1;
            const formattedId = `pmcd-${String(newNumber).padStart(2, '0')}`;
            setClientId(formattedId);
        }

    }, (error) => {
        console.error("Error fetching real-time client data:", error);
        alert("Failed to load client data in real-time. Please check your internet connection and Firebase rules.");
        setLoading(false); // Also set loading to false on error
    });

    // Cleanup function: This is called when the component unmounts to prevent memory leaks
    return () => unsubscribe();
}, [editingClientId, branchId]); // Add branchId as a dependency to ensure correct filtering.

    // NEW: useEffect hook for fetching staff members
    // MODIFIED: useEffect hook for fetching staff members based on branchId
    useEffect(() => {
        if (!branchId) return; // Exit if branchId is not yet set
        setStaffLoading(true);

        const staffQuery = query(
            staffMembersCollectionRef,
            where('branchId', '==', branchId) // Filter by branchId only
        );

        const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const fetchedStaff = snapshot.docs.map((doc) => ({
                id: doc.id,
                fullName: doc.data().fullName
            }));

            // Sort the fetched staff members client-side
            const sortedStaff = [...fetchedStaff].sort((a, b) => a.fullName.localeCompare(b.fullName));

            setStaffMembers(sortedStaff);
            setStaffLoading(false);
        }, (error) => {
            console.error("Error fetching staff for branch:", error);
            alert("Failed to load staff data for this branch.");
            setStaffLoading(false);
        });

        return () => unsubscribe(); // Clean up on unmount or branchId change
    }, [branchId]); // Run whenever branchId changes

    // Derived state: Filtered client list based on the search term
    // Derived state: Filtered client list based on the search term AND branchId
    const filteredClients = clientList.filter(client =>
        client.branchId === branchId && // Only show clients from this branch
        ((client.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.clientId || "").toLowerCase().includes(searchTerm.toLowerCase()))
    );


    // Effect to automatically calculate age when dateOfBirth changes
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


    // Handle photo file selection and Cloudinary upload using fetch API
    const handlePhotoImport = async (event) => {
        const file = event.target.files[0];
        if (file) {
            // Set local preview URL immediately
            setImagePreviewUrl(URL.createObjectURL(file));
            setImageUploading(true); // Indicate that upload has started

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', cloudinaryConfig.uploadPreset);
            formData.append('folder', 'Pmc_clients'); // Optional: organize client uploads in a specific folder on Cloudinary

            try {
                const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }

                const data = await response.json(); // Parse the JSON response from Cloudinary
                console.log('Cloudinary upload success:', data);
                setPhotoUrl(data.secure_url); // Set the state with the Cloudinary URL
                alert("Photo uploaded successfully! 📸");
                // It's a good practice to revoke the object URL when it's no longer needed,
                // but if you want to keep the preview until form submission, you might delay this.
                // For simplicity here, we'll keep it as is, but be mindful of memory usage for many previews.
                // URL.revokeObjectURL(imagePreviewUrl); // Clean up local URL after successful upload
            } catch (error) {
                console.error("Error uploading image to Cloudinary:", error);
                alert(`Failed to upload image. Please try again. Details: ${error.message || error}`);
                // If upload fails, clear the preview and photoUrl
                setImagePreviewUrl('');
                setPhotoUrl('');
            } finally {
                setImageUploading(false); // Upload finished (success or failure)
            }
        }
    };

    // Programmatically trigger the hidden file input click when the "Import Photo" button is pressed
    const handleImportButtonClick = () => {
        fileInputRef.current.click();
    };

    // Function to clear all form fields and reset to initial state for a new entry
    const clearForm = () => {
        setFullName('');
        setGender('');
        setDateOfBirth('');
        setAge('');
        setPlaceOfBirth('');
        setMaritalStatus('');
        setTelephone('');
        setAddress('');
        setPhotoUrl('');
        setImagePreviewUrl(''); // Clear image preview
        setImageUploading(false); // Reset upload status
        setEditingClientId(null); // Clear editing state
        setRegistrationDate(new Date().toISOString().slice(0, 10)); // Reset registration date to current day
        setStaffName(''); // Clear staff name for new entry
        // Do NOT clear branchId here to keep the pre-filled value
        // setBranchId('');
        // The useEffect for clientId will automatically generate a new ID
    };

    // Handle form submission (add new client or update existing client)
    const handleSubmit = async (event) => {
        event.preventDefault(); // Prevent default browser form submission
        setIsSaving(true); // Set saving state to true

        // Basic client-side validation for required fields
        if (!fullName  || !staffName || !branchId) {
            alert("Please fill in all required fields and upload a photo.");
            setIsSaving(false);
            return;
        }

        // Create the client data object to be saved to Firestore
        const clientData = {
            clientId, // This will be the sequential ID (e.g., cmcs-01)
            registrationDate,
            staffName,
            branchId, // Add the new field
            fullName,
            gender,
            dateOfBirth,
            age,
            placeOfBirth,
            maritalStatus,
            telephone,
            address,
            // photoUrl, // Cloudinary URL
            createdAt: editingClientId ? clientList.find(c => c.id === editingClientId)?.createdAt : new Date().toISOString(), // Preserve original creation date if editing
            updatedAt: new Date().toISOString(), // Update timestamp on every save
        };

        try {
            if (editingClientId) {
                // If editingClientId is set, update an existing document
                const clientDocRef = doc(db, "clients", editingClientId);
                await updateDoc(clientDocRef, clientData);
                alert("Client details updated successfully! ✅");
            } else {
                // Otherwise, add a new document to the collection
                await addDoc(clientsCollectionRef, clientData);
                alert("Client registered successfully! 🎉");
            }

            clearForm(); // Clear form fields after successful submission/update
        } catch (error) {
            console.error("Error saving client data to Firestore:", error);
            alert("Failed to save client data. Please try again. Check the console for more details.");
        } finally {
            setIsSaving(false); // Reset saving state
        }
    };

    // Handle the "Edit" button click: Populates the form with the selected client's data
    const handleEdit = (client) => {
        setEditingClientId(client.id); // Set the Firestore document ID for update operations
        setClientId(client.clientId); // Populate with the existing sequential clientId
        setRegistrationDate(client.registrationDate);
        setStaffName(client.staffName);
        setBranchId(client.branchId || ''); // Populate the new Branch ID field
        setFullName(client.fullName);
        setGender(client.gender);
        setDateOfBirth(client.dateOfBirth);
        setPlaceOfBirth(client.placeOfBirth);
        setMaritalStatus(client.maritalStatus);
        setTelephone(client.telephone);
        setAddress(client.address);
        setPhotoUrl(client.photoUrl);
        setImagePreviewUrl(client.photoUrl); // Set preview to existing photo
    };

    // Handle the "Delete" button click with PIN confirmation
    const handleDelete = async (id) => {
        // First confirmation dialog
        if (!window.confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
            return; // If user cancels, stop the process
        }

        // Second confirmation: prompt for the delete PIN
        const enteredPin = prompt("Please enter the delete PIN to confirm:");

        // Check if user clicked cancel on the PIN prompt
        if (enteredPin === null) {
            alert("Deletion cancelled.");
            return;
        }

        // Check if the entered PIN matches the predefined PIN
        if (enteredPin !== DELETE_PIN) {
            alert("Incorrect PIN. Deletion cancelled.");
            return;
        }

        // If both confirmations pass, proceed with deletion from Firestore
        try {
            const clientDocRef = doc(db, "clients", id);
            await deleteDoc(clientDocRef);
            alert("Client deleted successfully! 🗑️");
        } catch (error) {
            console.error("Error deleting client data:", error);
            alert("Failed to delete client data. Please try again.");
        }
    };

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            {/* Client Registration Form Section */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <div className="flex items-center justify-between text-center">
                    {/* Header Title */}
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 border-b pb-4">
                        {editingClientId ? 'Edit Client Details' : 'Client Registration Form'}
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
                    <Input id="registrationDate" label="Registration Date" type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)}  icon={FaCalendarAlt} />

                    {/* Client ID (Read-only display, now showing sequential ID) */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="clientIdDisplay" className="text-sm font-medium text-gray-700">Client ID</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaBriefcase size={18} className="text-gray-400" />
                            </div>
                            <div id="clientIdDisplay" className="w-full p-2 pl-10 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                {clientId}
                            </div>
                        </div>
                    </div>

                    {/* NEW: Branch ID Input Field */}
                    <Input
                        id="branchId"
                        label="Branch ID"
                        type="text"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        placeholder="e.g., B001"
                        readOnly // Make this read-only so users can't change the assigned branch
                        icon={FaMapMarkerAlt}
                    />

                    {/* Staff Name Dropdown - Replaced Input with Select */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="staffName" className="text-sm font-medium text-gray-700">Staff Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaUser size={18} className="text-gray-400" />
                            </div>
                            {staffLoading ? ( // Show loading message while fetching staff
                                <div className="w-full p-2 pl-10 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                    Loading staff...
                                </div>
                            ) : (
                                <select
                                    id="staffName"
                                    value={staffName}
                                    onChange={(e) => setStaffName(e.target.value)}
                                    className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                                >
                                    <option value="">Select Staff Member</option> {/* Default empty option */}
                                    {staffMembers.map((staff) => ( // Map through fetched staff members to create options
                                        <option key={staff.id} value={staff.fullName}> {/* Corrected: Use staff.fullName */}
                                            {staff.fullName} {/* Corrected: Display staff.fullName */}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Full Name */}
                    <Input id="fullName" label="Full Name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" icon={FaUser} />

                    {/* Gender Dropdown */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="gender" className="text-sm font-medium text-gray-700">Gender</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaHeart size={18} className="text-gray-400" />
                            </div>
                            <select
                                id="gender"
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <Input id="dob" label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} icon={FaBirthdayCake} />
                    <Input id="age" label="Age" type="text" value={age} placeholder="Age will be calculated" readOnly icon={FaUser} />
                    <Input id="placeOfBirth" label="Place of Birth" type="text" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} placeholder="City, Country" icon={FaMapMarkerAlt} />

                    {/* Marital Status Dropdown */}
                    <div className="flex flex-col space-y-1">
                        <label htmlFor="maritalStatus" className="text-sm font-medium text-gray-700">Marital Status</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FaHeart size={18} className="text-gray-400" />
                            </div>
                            <select
                                id="maritalStatus"
                                value={maritalStatus}
                                onChange={(e) => setMaritalStatus(e.target.value)}
                                className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200"
                            >
                                <option value="">Select Status</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                                <option value="Widowed">Widowed</option>
                            </select>
                        </div>
                    </div>

                    <Input id="telephone" label="Telephone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+232-XXXXXXXX" icon={FaPhone} />
                    <Input id="address" label="Address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Freetown" icon={FaHome} />

                    {/* Photo Section */}
                    {/* <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center space-y-4 pt-4 border-t border-gray-200 mt-4">
                        <h3 className="text-lg font-semibold text-gray-800">Client Photo</h3>
                        <div className="w-32 h-32 rounded-full border-4 border-gray-300 flex items-center justify-center overflow-hidden bg-gray-200 relative">
                            {imageUploading ? (
                                <Spinner />
                            ) : imagePreviewUrl ? (
                                <img src={imagePreviewUrl} alt="Client Preview" className="w-full h-full object-cover" />
                            ) : (
                                <FaUser size={64} className="text-gray-400" />
                            )}
                        </div>
                        <div className="flex justify-center">
                            <Button onClick={handleImportButtonClick} disabled={imageUploading || isSaving}>
                                {imageUploading ? 'Uploading...' : <><FaUpload size={18} className="mr-2" /> Import Photo</>}
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoImport}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    </div> */}

                    {/* Submit Button */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-6">
                        <button
                            type="submit"
                            disabled={isSaving || imageUploading || staffLoading} // Disable while saving, uploading image, or staff is loading
                            className={`w-full py-3 rounded-md font-bold text-lg transition-colors duration-200 shadow-md
                                ${isSaving || imageUploading || staffLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {isSaving ? 'Saving...' : (editingClientId ? 'Update Client Details' : 'Save Client Details')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Client List Table Section */}
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Registered Clients</h2>

                {loading ? (
                    <Spinner />
                ) : clientList.length > 0 ? (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <Input
                                id="search"
                                label="Search by Full Name or Client ID"
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Enter Full Name or Client ID"
                                className="w-1/2"
                            />
                            <div className="text-sm font-medium text-gray-600">
                                Showing {filteredClients.length} of {clientList.length} clients
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">StaffNAme</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredClients.map((client) => (
                                        <tr key={client.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.clientId}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.fullName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.branchId}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.gender}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.staffName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(client)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                    >
                                                        <FaPencilAlt size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        <FaTrashAlt size={18} />
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
                    <div>No clients found.</div>
                )}
            </div>
        </div>
    );
}

export default ClientDetails;