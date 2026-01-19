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
    onSnapshot,
    query,
    where,
    getDocs, 
    writeBatch,
} from 'firebase/firestore';

/**
 * Reusable UI Components
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

const Button = ({ onClick, children, className = "", disabled = false }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 ${className}`}
    >
        {children}
    </button>
);

const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" role="status">
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);

function StaffForm() {
    // --- FORM STATES ---
    const [staffId, setStaffId] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [age, setAge] = useState('');
    const [placeOfBirth, setPlaceOfBirth] = useState('');
    const [nationality, setNationality] = useState('');
    const [telephone, setTelephone] = useState('');
    const [address, setAddress] = useState('');
    const [registrationDate, setRegistrationDate] = useState(new Date().toISOString().slice(0, 10));

    // --- AUTH/SESSION STATES ---
    const [companyShortCode, setCompanyShortCode] = useState('');
    const [currentBranchId, setCurrentBranchId] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // --- PHOTO STATES ---
    const [photoUrl, setPhotoUrl] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef(null);

    // --- DATA STATES ---
    const [staffList, setStaffList] = useState([]);
    const [editingStaffId, setEditingStaffId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const DELETE_PIN = "1234";
    const staffCollectionRef = collection(db, "staffMembers");

    // --- EFFECT: Network Status ---
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

    // --- EFFECT: Retrieve Session Data (Handles JSON String or Flat Items) ---
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        let foundData = null;

        keys.forEach(key => {
            const val = sessionStorage.getItem(key);
            if (val && val.includes("companyShortCode")) {
                try {
                    foundData = JSON.parse(val);
                } catch (e) { console.error("Session parse error", e); }
            }
        });

        if (foundData) {
            if (foundData.branchId) setCurrentBranchId(foundData.branchId);
            if (foundData.companyShortCode) setCompanyShortCode(foundData.companyShortCode);
        } else {
            setCurrentBranchId(sessionStorage.getItem('branchId') || '');
            setCompanyShortCode(sessionStorage.getItem('companyShortCode') || '');
        }
    }, []);

    // --- EFFECT: Real-time Listener (Filtered by Branch) ---
    useEffect(() => {
        if (!currentBranchId) return;
        setLoading(true);
        const q = query(staffCollectionRef, where("branchId", "==", currentBranchId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedStaff = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
            setStaffList(fetchedStaff);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentBranchId]);

    // --- EFFECT: Age Calculation ---
    useEffect(() => {
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            const today = new Date();
            let calculatedAge = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) calculatedAge--;
            setAge(calculatedAge.toString());
        } else {
            setAge('');
        }
    }, [dateOfBirth]);

    // --- EFFECT: Sequential ID Generation ---
    useEffect(() => {
        if (!editingStaffId) {
            const code = (companyShortCode || "STAFF").toLowerCase();
            
            const latestStaffNumber = staffList.reduce((max, staff) => {
                const regex = new RegExp(`^${code}-sd-(\\d+)$`, 'i');
                const numMatch = (staff.staffId || "").match(regex);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);

            const newNumber = latestStaffNumber + 1;
            const formattedId = `${code.toUpperCase()}-sd-${String(newNumber).padStart(2, '0')}`;
            setStaffId(formattedId);
        }
    }, [staffList, editingStaffId, companyShortCode]);

    // --- HANDLER: Image Upload ---
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
                const data = await response.json();
                setPhotoUrl(data.secure_url);
                alert("Photo uploaded! 📸");
            } catch (error) {
                alert("Upload failed. Check Cloudinary settings.");
            } finally {
                setImageUploading(false);
            }
        }
    };

    const clearForm = () => {
        setFullName(''); setGender(''); setDateOfBirth(''); setAge('');
        setPlaceOfBirth(''); setNationality(''); setTelephone('');
        setAddress(''); setPhotoUrl(''); setImagePreviewUrl('');
        setEditingStaffId(null);
        setRegistrationDate(new Date().toISOString().slice(0, 10));
    };

    // --- HANDLER: Firestore Save/Update ---
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!fullName || !gender || !currentBranchId) {
            alert("Please fill required fields (Name, Gender, Branch).");
            return;
        }

        const staffData = {
            staffId, fullName, gender, dateOfBirth, age,
            placeOfBirth, nationality, telephone, address,
            registrationDate, photoUrl, branchId: currentBranchId,
        };

        try {
            if (editingStaffId) {
                await updateDoc(doc(db, "staffMembers", editingStaffId), staffData);
                alert("Staff updated! ✅");
            } else {
                await addDoc(staffCollectionRef, staffData);
                alert("Staff registered! 🎉");
            }
            clearForm();
        } catch (error) {
            console.error(error);
            alert("Error saving record.");
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
        if (!window.confirm("Confirm deletion?")) return;
        const enteredPin = prompt("Enter DELETE PIN:");
        if (enteredPin !== DELETE_PIN) {
            alert("Wrong PIN.");
            return;
        }
        try {
            await deleteDoc(doc(db, "staffMembers", id));
            alert("Deleted 🗑️");
        } catch (error) { console.error(error); }
    };

    const filteredStaff = staffList.filter(staff =>
        (staff.fullName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto p-6 bg-gray-100 min-h-screen font-sans">
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">
                        {editingStaffId ? 'Edit Staff Details' : 'Staff Registration Form'}
                    </h1>
                    <span className={`text-sm font-semibold ${isOnline ? "text-green-600" : "text-red-600"}`}>
                        {isOnline ? "✅ Online" : "⚠️ Offline"}
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Input id="registrationDate" label="Reg. Date" type="date" value={registrationDate} readOnly />
                    
                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">Staff ID</label>
                        <div className="p-2 border border-gray-300 rounded-md bg-gray-50 font-bold text-indigo-700">
                            {staffId || "Generating..."}
                        </div>
                    </div>

                    <Input id="branchId" label="Branch ID" value={currentBranchId} readOnly />
                    <Input id="fullName" label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" />

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">Gender</label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} className="p-2 border border-gray-300 rounded-md">
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>

                    <Input id="dob" label="DOB" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                    <Input id="age" label="Age" value={age} readOnly />
                    <Input id="telephone" label="Telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                    <Input id="address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

                    <div className="col-span-full flex flex-col items-center py-4 border-t mt-4">
                        <div className="w-24 h-24 rounded-full border-2 border-indigo-200 bg-gray-50 overflow-hidden mb-3">
                            {imageUploading ? <Spinner /> : imagePreviewUrl ? <img src={imagePreviewUrl} className="w-full h-full object-cover" /> : <User size={40} className="m-7 text-gray-300" />}
                        </div>
                        <Button onClick={() => fileInputRef.current.click()} disabled={imageUploading}>
                            <Upload size={16} className="mr-2" /> {imageUploading ? 'Uploading...' : 'Import Photo'}
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handlePhotoImport} className="hidden" accept="image/*" />
                    </div>

                    <div className="col-span-full">
                        <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-md font-bold text-lg hover:bg-indigo-700 shadow-lg">
                            {editingStaffId ? 'Update Record' : 'Save Registration'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-4">Registered Staff</h2>
                <input 
                    className="mb-4 p-2 border rounded w-full md:w-1/3" 
                    placeholder="Search by name..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
                
                {loading ? <Spinner /> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Staff ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Gender</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium">{staff.staffId}</td>
                                        <td className="px-6 py-4">{staff.fullName}</td>
                                        <td className="px-6 py-4">{staff.gender}</td>
                                        <td className="px-6 py-4 flex space-x-4">
                                            <button onClick={() => handleEdit(staff)} className="text-blue-600 hover:text-blue-800"><Pencil size={18} /></button>
                                            <button onClick={() => handleDelete(staff.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StaffForm;