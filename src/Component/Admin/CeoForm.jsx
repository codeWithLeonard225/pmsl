import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function CeoForm() {
  const [companyId, setCompanyId] = useState("");
  const [companyShortCode, setCompanyShortCode] = useState("");
  const [branchIdsInput, setBranchIdsInput] = useState(""); // Comma-separated (e.g. "001, 002, 003")
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");

  const [ceos, setCeos] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const ceoCollection = collection(db, "ceo");

  const fetchCeos = async () => {
    try {
      const data = await getDocs(ceoCollection);
      setCeos(data.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching CEOs:", error);
    }
  };

  useEffect(() => {
    fetchCeos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!companyId || !companyShortCode || !username || !code) {
      alert("Please fill all required fields!");
      return;
    }

    // Convert comma-separated string into a clean array of strings
    // e.g. "001, 002, 003" -> ["001", "002", "003"]
    const branchIds = branchIdsInput
      ? branchIdsInput
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b.length > 0)
      : [];

    const ceoData = {
      companyId: companyId.trim().toUpperCase(),
      companyShortCode: companyShortCode.trim().toUpperCase(),
      branchIds: branchIds, // Stored as array
      username: username.trim().toLowerCase(),
      code: code.trim(),
      role: "ceo",
    };

    try {
      if (editingId) {
        const ceoDoc = doc(db, "ceo", editingId);
        await updateDoc(ceoDoc, ceoData);
        setEditingId(null);
      } else {
        await addDoc(ceoCollection, {
          ...ceoData,
          createdAt: serverTimestamp(),
        });
      }

      // Reset Form
      setCompanyId("");
      setCompanyShortCode("");
      setBranchIdsInput("");
      setUsername("");
      setCode("");

      fetchCeos();
    } catch (error) {
      console.error("Error saving CEO account: ", error);
      alert("Failed to save CEO account.");
    }
  };

  const handleEdit = (ceoUser) => {
    setEditingId(ceoUser.id);
    setCompanyId(ceoUser.companyId || "");
    setCompanyShortCode(ceoUser.companyShortCode || "");
    // Convert array back to comma-separated string for editing
    setBranchIdsInput(
      Array.isArray(ceoUser.branchIds)
        ? ceoUser.branchIds.join(", ")
        : ceoUser.branchIds || ""
    );
    setUsername(ceoUser.username || "");
    setCode(ceoUser.code || "");
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this CEO account?")) {
      try {
        await deleteDoc(doc(db, "ceo", id));
        fetchCeos();
      } catch (error) {
        console.error("Error deleting CEO:", error);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Form Section */}
      <div className="bg-white shadow-lg rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">
          {editingId ? "Edit CEO Account" : "Add New CEO Account"}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Company ID (e.g. PMC_3240)"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value.toUpperCase())}
            className="border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="Company Short Code (e.g. PMC)"
            value={companyShortCode}
            onChange={(e) => setCompanyShortCode(e.target.value.toUpperCase())}
            className="border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="Branch IDs (e.g. 001, 002, 003 or leave blank for all)"
            value={branchIdsInput}
            onChange={(e) => setBranchIdsInput(e.target.value)}
            className="border p-2 rounded-lg md:col-span-2"
          />
          <input
            type="text"
            placeholder="CEO Username (e.g. ceo_john)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <input
            type="password"
            placeholder="CEO Access Code / Password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              {editingId ? "Update CEO Account" : "Add CEO Account"}
            </button>
          </div>
        </form>
      </div>

      {/* CEO List Table */}
      <div className="bg-white shadow-lg rounded-2xl p-6 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">CEO Accounts List</h2>
        <table className="w-full table-auto border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="border px-2 py-2">Company ID</th>
              <th className="border px-2 py-2">Short Code</th>
              <th className="border px-2 py-2">Allowed Branches</th>
              <th className="border px-2 py-2">Username</th>
              <th className="border px-2 py-2">Role</th>
              <th className="border px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {ceos.map((ceoUser) => (
              <tr key={ceoUser.id} className="text-center">
                <td className="border px-2 py-2">{ceoUser.companyId}</td>
                <td className="border px-2 py-2">{ceoUser.companyShortCode}</td>
                <td className="border px-2 py-2">
                  {Array.isArray(ceoUser.branchIds) && ceoUser.branchIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {ceoUser.branchIds.map((bId, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium"
                        >
                          {bId}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">All Branches</span>
                  )}
                </td>
                <td className="border px-2 py-2 font-semibold">{ceoUser.username}</td>
                <td className="border px-2 py-2">
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-semibold">
                    CEO
                  </span>
                </td>
                <td className="border px-2 py-2 space-x-1">
                  <button
                    onClick={() => handleEdit(ceoUser)}
                    className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ceoUser.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {ceos.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-4 text-gray-500">
                  No CEO accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}