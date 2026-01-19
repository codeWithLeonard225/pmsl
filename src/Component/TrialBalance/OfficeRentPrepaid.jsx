import { useState, useEffect } from "react";
import { FaCalendarAlt, FaCalculator, FaTrash } from "react-icons/fa";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../firebase";

/* -------------------- Reusable Components -------------------- */
const Input = ({ label, type = "text", value, onChange, readOnly = false, placeholder }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 ${
        readOnly ? "bg-gray-100 cursor-not-allowed" : ""
      }`}
    />
  </div>
);

/* -------------------- MAIN COMPONENT -------------------- */

function OfficeRentPrepaid({ branch }) {
  const [branchId, setBranchId] = useState("");
  const [rentDate, setRentDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState("");
  const [rentList, setRentList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-calculated fields
  const monthlyAmount = totalAmount ? (parseFloat(totalAmount) / 12).toFixed(2) : 0;
  
  const getClosingDate = (startDate) => {
    if (!startDate) return "";
    const date = new Date(startDate);
    date.setFullYear(date.getFullYear() + 1); // Add 1 year
    return date.toISOString().slice(0, 10);
  };

  const closingDate = getClosingDate(rentDate);

  useEffect(() => {
    const id = branch?.branchId || sessionStorage.getItem("branchId");
    if (id) setBranchId(id);
  }, [branch]);

  // Load Prepaid Rent History
  useEffect(() => {
    if (!branchId) return;
    const q = query(collection(db, "officeRentPrepaid"), where("branchId", "==", branchId));
    const unsub = onSnapshot(q, (snap) => {
      setRentList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [branchId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!totalAmount || totalAmount <= 0) return alert("Please enter a valid amount");

    setIsSaving(true);
    try {
      await addDoc(collection(db, "officeRentPrepaid"), {
        branchId,
        totalAmount: parseFloat(totalAmount),
        monthlyAmortization: parseFloat(monthlyAmount),
        startDate: rentDate,
        closingDate: closingDate,
        description: "Yearly Prepaid Rent",
        createdAt: serverTimestamp(),
      });
      setTotalAmount("");
      alert("Prepaid Rent Recorded Successfully!");
    } catch (err) {
      console.error(err);
      alert("Error saving record");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this record?")) {
      await deleteDoc(doc(db, "officeRentPrepaid", id));
    }
  };

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FaCalendarAlt className="text-blue-600" /> Office Rent Prepaid (Yearly)
        </h1>

        {/* INPUT CARD */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-8">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="Start Date" 
              type="date" 
              value={rentDate} 
              onChange={(e) => setRentDate(e.target.value)} 
            />
            
            <Input 
              label="Yearly Rent Amount (Total)" 
              type="number" 
              value={totalAmount} 
              onChange={(e) => setTotalAmount(e.target.value)} 
              placeholder="e.g. 12000"
            />

            {/* Calculations Display */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase mb-1">Monthly Breakdown</p>
              <p className="text-2xl font-mono font-bold text-blue-800">
                ${Number(monthlyAmount).toLocaleString()} <span className="text-sm font-normal">/ month</span>
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-600 font-bold uppercase mb-1">Closing Date (12 Months)</p>
              <p className="text-2xl font-mono font-bold text-green-800">
                {closingDate}
              </p>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg disabled:bg-gray-400"
              >
                {isSaving ? "Saving..." : "Record Yearly Prepaid Rent"}
              </button>
            </div>
          </form>
        </div>

        {/* HISTORY TABLE */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-gray-700">Prepaid Rent Records</h2>
          </div>
          <table className="min-w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4 text-xs font-bold uppercase text-gray-600">Start Date</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-600">Closing Date</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-600 text-right">Total Yearly</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-600 text-right">Monthly</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {rentList.map((rent) => (
                <tr key={rent.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 text-sm">{rent.startDate}</td>
                  <td className="p-4 text-sm font-medium text-orange-600">{rent.closingDate}</td>
                  <td className="p-4 text-sm font-bold text-right">${rent.totalAmount?.toLocaleString()}</td>
                  <td className="p-4 text-sm text-blue-600 font-semibold text-right">${rent.monthlyAmortization?.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDelete(rent.id)} className="text-red-500 hover:text-red-700">
                      <FaTrash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rentList.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OfficeRentPrepaid;