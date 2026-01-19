import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

export default function BranchForm() {
  const [branchId, setBranchId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [branchManager, setBranchManager] = useState("");
  const [bgColor, setBgColor] = useState("bg-gray-100");
  const [branches, setBranches] = useState([]);
  const [editingId, setEditingId] = useState(null); // track branch being edited
  const [companyId, setCompanyId] = useState("");
  const [companyShortCode, setCompanyShortCode] = useState("");


  const branchesRef = collection(db, "branches");

  const fetchBranches = async () => {
    const snapshot = await getDocs(branchesRef);
    setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !companyId ||
      !companyShortCode ||
      !branchId ||
      !branchName ||
      !branchLocation ||
      !branchManager
    ) {
      alert("Please fill in all fields!");
      return;
    }


    try {
      if (editingId) {
        // Update branch
        const branchDoc = doc(db, "branches", editingId);
        await updateDoc(branchDoc, {
          companyId,
          companyShortCode,
          branchId: `${companyShortCode}-${branchId}`,
          branchName,
          branchLocation,
          branchManager,
          bgColor,
        });

        setEditingId(null);
        alert("Branch updated successfully!");
      } else {
        // Add new branch
        await addDoc(branchesRef, {
          companyId,
          companyShortCode,
          branchId: `${companyShortCode}-${branchId}`,
          branchName,
          branchLocation,
          branchManager,
          bgColor,
          createdAt: serverTimestamp(),
        });

        alert("Branch added successfully!");
      }

      // Reset form
      setBranchId("");
      setBranchName("");
      setBranchLocation("");
      setBranchManager("");
      setBgColor("bg-gray-100");
      fetchBranches();
      setCompanyId("");
      setCompanyShortCode("");

    } catch (error) {
      console.error("Error saving branch: ", error);
      alert("Failed to save branch");
    }
  };

 const handleEdit = (branch) => {
  setBranchId(branch.branchId || "");
  setBranchName(branch.branchName || "");
  setBranchLocation(branch.branchLocation || "");
  setBranchManager(branch.branchManager || "");
  setBgColor(branch.bgColor || "bg-gray-100");
  setEditingId(branch.id);
  setCompanyId(branch.companyId || "");
  setCompanyShortCode(branch.companyShortCode || "");
};


  const handleDelete = async (id) => {
    const branchDoc = doc(db, "branches", id);
    await deleteDoc(branchDoc);
    fetchBranches();
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-2xl p-6">
      <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Branch" : "Add New Branch"}</h2>
      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <input
          type="text"
          placeholder="Company ID (e.g. PMC_001)"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value.toUpperCase())}
          className="w-full border p-2 rounded-lg"
        />

        <input
          type="text"
          placeholder="Company Short Code (e.g. PMC)"
          value={companyShortCode}
          onChange={(e) => setCompanyShortCode(e.target.value.toUpperCase())}
          className="w-full border p-2 rounded-lg"
        />

        <input type="text" placeholder="Branch ID" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border p-2 rounded-lg" />
        <input type="text" placeholder="Branch Name" value={branchName} onChange={(e) => setBranchName(e.target.value)} className="w-full border p-2 rounded-lg" />
        <input type="text" placeholder="Branch Location" value={branchLocation} onChange={(e) => setBranchLocation(e.target.value)} className="w-full border p-2 rounded-lg" />
        <input type="text" placeholder="Branch Manager" value={branchManager} onChange={(e) => setBranchManager(e.target.value)} className="w-full border p-2 rounded-lg" />
        <div>
          <label className="block mb-1 font-medium">Dashboard Color</label>
          <select value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full border p-2 rounded-lg">
            <option value="">Select a color</option>
            <option value="bg-blue-900">Blue</option>
            <option value="bg-red-100">Red</option>
            <option value="bg-green-100">Green</option>
            <option value="bg-yellow-100">Yellow</option>
            <option value="bg-purple-100">Purple</option>
            <option value="bg-pink-100">Pink</option>
            <option value="bg-gray-100">Gray</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          {editingId ? "Update Branch" : "Save Branch"}
        </button>
      </form>

      {/* Branches Table */}
      <h2 className="text-xl font-bold mb-4">Branches List</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-4 py-2">Company ID</th>
            <th className="border px-4 py-2">Code</th>
            <th className="border px-4 py-2">Branch ID</th>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Location</th>
            <th className="border px-4 py-2">Manager</th>
            <th className="border px-4 py-2">Color</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {branches.map((branch) => (
            <tr key={branch.id} className={branch.bgColor}>
              <td className="border px-4 py-2">{branch.companyId}</td>
              <td className="border px-4 py-2 font-bold">
                {branch.companyShortCode}
              </td>
              <td className="border px-4 py-2">{branch.branchId}</td>
              <td className="border px-4 py-2">{branch.branchName}</td>
              <td className="border px-4 py-2">{branch.branchLocation}</td>
              <td className="border px-4 py-2">{branch.branchManager}</td>
              <td className="border px-4 py-2">{branch.bgColor}</td>
              <td className="border px-4 py-2 space-x-2">
                <button
                  onClick={() => handleEdit(branch)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(branch.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </td>
            </tr>

          ))}
        </tbody>
      </table>
    </div>
  );
}
