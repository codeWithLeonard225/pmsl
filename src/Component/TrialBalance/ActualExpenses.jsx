import { useState, useEffect } from "react";
import { FaEdit, FaTrash, FaPlusCircle } from "react-icons/fa";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase";

/* -------------------- Reusable Components -------------------- */
const Input = ({ id, label, type = "text", value, onChange, placeholder, readOnly = false, disabled = false, error = false, helpText = "" }) => (
  <div className="flex flex-col space-y-1">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
    <input
      id={id} type={type} value={value} onChange={onChange} readOnly={readOnly} disabled={disabled} placeholder={placeholder}
      className={`w-full p-2 border ${error ? "border-red-500" : "border-gray-300"} rounded-md focus:ring-2 focus:ring-purple-500 ${disabled || readOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
    />
    {helpText && <p className={`text-xs ${error ? "text-red-500" : "text-gray-500"}`}>{helpText}</p>}
  </div>
);

const Button = ({ children, onClick, type = "button", disabled = false, className = "" }) => (
  <button type={type} onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
    {children}
  </button>
);

const Modal = ({ show, onClose, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative w-full max-w-sm">
        <button onClick={onClose} className="absolute top-2 right-3 text-xl text-gray-500">&times;</button>
        {children}
      </div>
    </div>
  );
};

/* -------------------- MAIN COMPONENT -------------------- */

function ActualExpenses({ branch }) {
  const ADMIN_PASSWORD = "1234";

  const [branchId, setBranchId] = useState("");
  const [branchIdError, setBranchIdError] = useState(null);

  // --- New Category State (Removed ID) ---
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);

  // --- Form States ---
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [expenseCategories, setExpenseCategories] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const id = branch?.branchId || sessionStorage.getItem("branchId");
    if (id) setBranchId(id);
    else setBranchIdError("Branch ID could not be determined.");
  }, [branch]);

  /* Load Dropdown Categories */
  useEffect(() => {
    if (!branchId) return;
    const q = query(collection(db, "expenses"), where("branchId", "==", branchId));
    const unsub = onSnapshot(q, (snap) => {
      setExpenseCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [branchId]);

  /* Load Actual Expenses List */
  useEffect(() => {
    if (!branchId) return;
    const q = query(collection(db, "actualExpenses"), where("branchId", "==", branchId));
    const unsub = onSnapshot(q, (snap) => {
      setExpensesList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [branchId]);

  /* ADD NEW CATEGORY LOGIC */
  const handleAddCategory = async () => {
    if (!newCatName) return;
    setIsAddingCat(true);
    try {
      await addDoc(collection(db, "expenses"), {
        expenseName: newCatName,
        branchId: branchId,
        createdAt: serverTimestamp(),
      });
      setNewCatName("");
      setSaveSuccess("Category added! 📂");
    } catch (err) {
      setSaveError("Failed to add category.");
    } finally {
      setIsAddingCat(false);
    }
  };

  /* SUBMIT ACTUAL EXPENSE */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!expenseName || !amount) {
      setSaveError("Please select an expense type and enter an amount.");
      return;
    }

    setIsSaving(true);
    const data = {
      expenseName,
      amount: parseFloat(amount),
      expenseDate,
      description,
      branchId,
      updatedAt: serverTimestamp(),
      createdAt: editingId ? undefined : serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "actualExpenses", editingId), data);
        setSaveSuccess("Updated! ✅");
      } else {
        await addDoc(collection(db, "actualExpenses"), data);
        setSaveSuccess("Recorded! ✨");
      }
      clearForm();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const clearForm = () => {
    setExpenseName("");
    setAmount("");
    setDescription("");
    setEditingId(null);
  };

  const handleEdit = (exp) => {
    setEditingId(exp.id);
    setExpenseName(exp.expenseName);
    setAmount(exp.amount);
    setExpenseDate(exp.expenseDate);
    setDescription(exp.description || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (deletePassword !== ADMIN_PASSWORD) {
      setDeleteError("Incorrect password");
      return;
    }
    await deleteDoc(doc(db, "actualExpenses", deleteTargetId));
    setShowDeleteConfirm(false);
  };

  // Calculate Total
  const totalExpenses = expensesList.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="container mx-auto p-6 bg-gray-100 min-h-screen">
      {/* ADD CATEGORY SETUP (Simplied - Name Only) */}
      <div className="bg-purple-50 p-6 rounded-xl border border-purple-200 mb-8 shadow-sm">
        <h2 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
          <FaPlusCircle /> Add New Category to Dropdown
        </h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <Input 
              value={newCatName} 
              onChange={(e) => setNewCatName(e.target.value)} 
              placeholder="e.g. Electricity, Internet, Repairs..." 
            />
          </div>
          <Button onClick={handleAddCategory} disabled={isAddingCat || !newCatName}>
            {isAddingCat ? "Adding..." : "Add to List"}
          </Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
        <h1 className="text-3xl font-bold mb-6">{editingId ? "Edit Expense" : "Record Actual Expense"}</h1>

        {(saveError || saveSuccess) && (
          <p className={`mb-4 p-3 rounded ${saveError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {saveError || saveSuccess}
          </p>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Input label="Branch" value={branchId} readOnly />

          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium">Select Expense Type</label>
            <select
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">-- Choose Category --</option>
              {expenseCategories.map((e) => (
                <option key={e.id} value={e.expenseName}>{e.expenseName}</option>
              ))}
            </select>
          </div>

          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <div className="lg:col-span-2">
            <Input label="Description/Note" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="col-span-full flex space-x-4 pt-2">
            <Button type="submit">{editingId ? "Update Record" : "Save Record"}</Button>
            {editingId && <Button onClick={clearForm} className="bg-gray-500">Cancel</Button>}
          </div>
        </form>
      </div>

      {/* TABLE */}
      <div className="bg-white p-8 rounded-xl shadow-lg overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold">Expense History</h2>
          <div className="w-full md:w-1/3">
            <Input placeholder="Search name or description..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-sm">Date</th>
                <th className="p-4 font-semibold text-sm">Category</th>
                <th className="p-4 font-semibold text-sm">Description</th>
                <th className="p-4 font-semibold text-sm text-right">Amount</th>
                <th className="p-4 font-semibold text-sm text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expensesList
                .filter(e => e.expenseName?.toLowerCase().includes(searchTerm.toLowerCase()) || e.description?.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate))
                .map((e) => (
                  <tr key={e.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-sm">{e.expenseDate}</td>
                    <td className="p-4 text-sm font-medium">{e.expenseName}</td>
                    <td className="p-4 text-sm text-gray-500">{e.description || "-"}</td>
                    <td className="p-4 text-sm font-bold text-red-600 text-right">${e.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="p-4 flex justify-center space-x-4">
                      <FaEdit className="text-purple-600 cursor-pointer hover:scale-110 transition" onClick={() => handleEdit(e)} />
                      <FaTrash className="text-red-500 cursor-pointer hover:scale-110 transition" onClick={() => { setDeleteTargetId(e.id); setShowDeleteConfirm(true); }} />
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="bg-purple-50 font-bold">
              <tr>
                <td colSpan="3" className="p-4 text-purple-900 text-right">GRAND TOTAL:</td>
                <td className="p-4 text-red-700 text-right text-lg border-t-2 border-purple-200">
                  ${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* DELETE MODAL */}
      <Modal show={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <h3 className="font-bold mb-3 text-lg text-gray-800">Confirm Deletion</h3>
        <p className="text-sm text-gray-600 mb-4">Are you sure? This cannot be undone. Enter password to confirm:</p>
        <Input label="Admin Password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} error={!!deleteError} helpText={deleteError} />
        <div className="flex justify-end space-x-3 mt-6">
          <Button onClick={() => setShowDeleteConfirm(false)} className="bg-gray-400">Cancel</Button>
          <Button onClick={confirmDelete} className="bg-red-600">Delete Permanently</Button>
        </div>
      </Modal>
    </div>
  );
}

export default ActualExpenses;