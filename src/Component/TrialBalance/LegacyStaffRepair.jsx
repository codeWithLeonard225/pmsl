import React, { useState } from 'react';
import { db } from '../../../firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    writeBatch, 
    doc 
} from 'firebase/firestore';

const LegacyStaffRepair = () => {
    const [oldName, setOldName] = useState('Marie Hassan Sesay');
    const [newName, setNewName] = useState('Kadiatu Koroma');
    const [correctStaffId, setCorrectStaffId] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleRepair = async () => {
        if (!oldName || !newName || !correctStaffId) {
            alert("Please fill all fields: Old Name, New Name, and the Staff ID.");
            return;
        }

        const confirmAction = window.confirm(
            `This will rename "${oldName}" to "${newName}" across all Payments and Loans. Proceed?`
        );
        if (!confirmAction) return;

        setLoading(true);
        setStatus('Scanning Payments and Loans...');

        try {
            const batch = writeBatch(db);
            let paymentCount = 0;
            let loanCount = 0;

            // 1. Process PAYMENTS collection
            // Usually, in payment records, the field might be 'staffName' or 'collectedBy'
            // I'll use 'staffName' to match your previous logic
            const paymentsRef = collection(db, "payments");
            const qPayments = query(paymentsRef, where("staffName", "==", oldName));
            const paymentSnap = await getDocs(qPayments);

            paymentSnap.forEach((payDoc) => {
                batch.update(doc(db, "payments", payDoc.id), {
                    staffName: newName,
                    staffId: correctStaffId,
                    updatedAt: new Date().toISOString()
                });
                paymentCount++;
            });

            // 2. Process LOANS collection
            const loansRef = collection(db, "loans");
            const qLoans = query(loansRef, where("staffName", "==", oldName));
            const loanSnap = await getDocs(qLoans);

            loanSnap.forEach((loanDoc) => {
                batch.update(doc(db, "loans", loanDoc.id), {
                    staffName: newName,
                    staffId: correctStaffId,
                    updatedAt: new Date().toISOString()
                });
                loanCount++;
            });

            if (paymentCount === 0 && loanCount === 0) {
                setStatus(`No records found for "${oldName}" in Payments or Loans.`);
                setLoading(false);
                return;
            }

            await batch.commit();
            
            setStatus(`Update Successful!`);
            alert(`Repair Complete: \n- Payments Updated: ${paymentCount} \n- Loans Updated: ${loanCount}`);
            
        } catch (error) {
            console.error("Repair Error:", error);
            setStatus("Transaction failed. Check network or permissions.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-xl max-w-md mx-auto mt-10 border-t-8 border-indigo-600">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Financial Data Repair</h2>
            <p className="text-sm text-gray-500 mb-6">
                Update staff identity in **Payments** and **Loans** collections.
            </p>

            <div className="space-y-5">
                <div>
                    <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">Legacy Name (Search)</label>
                    <input 
                        type="text" 
                        value={oldName} 
                        onChange={(e) => setOldName(e.target.value)}
                        className="w-full p-3 border-2 border-gray-100 rounded-lg mt-1 focus:border-indigo-500 outline-none transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-black text-gray-600 uppercase tracking-widest">Target Name (Replace)</label>
                    <input 
                        type="text" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full p-3 border-2 border-gray-100 rounded-lg mt-1 focus:border-green-500 outline-none transition-all"
                    />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-xs font-black text-blue-700 uppercase tracking-widest">Official Staff ID</label>
                    <input 
                        type="text" 
                        value={correctStaffId} 
                        placeholder="e.g. pmsd-05"
                        onChange={(e) => setCorrectStaffId(e.target.value)}
                        className="w-full p-2 border-b-2 border-blue-200 bg-transparent mt-1 focus:border-blue-500 outline-none"
                    />
                </div>

                <button 
                    onClick={handleRepair}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-lg font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg active:transform active:scale-95 transition-all disabled:opacity-50"
                >
                    {loading ? "Syncing Ledger..." : "Update Financial Records"}
                </button>

                {status && (
                    <div className="mt-4 text-center text-sm font-bold animate-pulse text-indigo-600">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LegacyStaffRepair;