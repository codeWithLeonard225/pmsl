import { useState, useEffect } from 'react';
import { FaUsers, FaCloudUploadAlt, FaTrash, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { db } from '../../../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const BulkClientUpload = ({ branch }) => {
    const [rawNames, setRawNames] = useState('');
    const [branchId, setBranchId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);

    // Get Branch ID on load
    useEffect(() => {
        const id = branch?.branchId || sessionStorage.getItem("branchId");
        if (id) setBranchId(id);
    }, [branch]);

    const handleBulkSubmit = async () => {
        if (!rawNames.trim()) return alert("Please enter some names first.");
        if (!branchId) return alert("Branch ID not found. Please log in again.");

        setIsProcessing(true);
        setLogs(["Starting bulk upload..."]);

        // Split names by new lines or commas and clean them up
        const namesArray = rawNames
            .split(/[\n,]+/)
            .map(name => name.trim())
            .filter(name => name.length > 0);

        const clientsCollectionRef = collection(db, "clients");

        try {
            // 1. Get current max ID to continue sequence correctly
            const q = query(clientsCollectionRef, where("branchId", "==", branchId));
            const snapshot = await getDocs(q);
            let latestNumber = snapshot.docs.reduce((max, doc) => {
                const match = (doc.data().clientId || "").match(/^pmcd-(\d+)$/i);
                const num = match ? parseInt(match[1], 10) : 0;
                return num > max ? num : max;
            }, 0);

            // 2. Process each name
            for (const name of namesArray) {
                latestNumber++;
                const newId = `pmcd-${String(latestNumber).padStart(2, '0')}`;
                
                const newClient = {
                    clientId: newId,
                    fullName: name,
                    staffName: "Abdulai Mansaray", // Hardcoded as requested
                    branchId: branchId,
                    registrationDate: new Date().toISOString().slice(0, 10),
                    gender: "", 
                    dateOfBirth: "",
                    age: "",
                    address: "",
                    telephone: "",
                    photoUrl: "",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await addDoc(clientsCollectionRef, newClient);
                setLogs(prev => [...prev, `Added: ${name} (${newId})`]);
            }

            setLogs(prev => [...prev, "✅ All clients registered successfully!"]);
            setRawNames(''); // Clear input
        } catch (error) {
            console.error(error);
            setLogs(prev => [...prev, `❌ Error: ${error.message}`]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md">
            <div className="flex items-center space-x-3 mb-6 border-b pb-4">
                <FaUsers className="text-indigo-600 text-3xl" />
                <h2 className="text-2xl font-bold text-gray-800">Bulk Client Entry</h2>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste Client Names (One per line or separated by commas)
                </label>
                <textarea
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[200px] font-mono text-sm"
                    placeholder="Example:&#10;Adama Bangura&#10;Alile Bangura&#10;Yeawa Cole"
                    value={rawNames}
                    onChange={(e) => setRawNames(e.target.value)}
                />
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <button
                    onClick={handleBulkSubmit}
                    disabled={isProcessing}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                        isProcessing ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg'
                    }`}
                >
                    {isProcessing ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt />}
                    <span>{isProcessing ? "Processing..." : "Register All Clients"}</span>
                </button>
                
                <button
                    onClick={() => {setRawNames(''); setLogs([]);}}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                    Clear
                </button>
            </div>

            {/* Status Logs */}
            {logs.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 h-48 overflow-y-auto text-sm">
                    <h3 className="font-bold mb-2 text-gray-700">Upload Logs:</h3>
                    {logs.map((log, index) => (
                        <div key={index} className="flex items-center space-x-2 text-gray-600 mb-1">
                            {log.startsWith('Added') ? <FaCheckCircle className="text-green-500" /> : null}
                            <span>{log}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BulkClientUpload;