import React, { useEffect, useState } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

export default function CompaniesForm() {
  const [companyName, setCompanyName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [status, setStatus] = useState("active");
  const [companies, setCompanies] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const companiesRef = collection(db, "companies");

  // 🔑 Auto-generate companyId
  const generateCompanyId = (code) => {
    return `${code}_${Date.now().toString().slice(-4)}`;
  };

  // 📥 Fetch companies
  const fetchCompanies = async () => {
    const snapshot = await getDocs(companiesRef);
    setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // 💾 Save / Update company
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!companyName || !shortCode) {
      alert("Please fill in all fields");
      return;
    }

    const upperCode = shortCode.toUpperCase();

    // 🔐 Enforce unique shortCode
    const q = query(companiesRef, where("shortCode", "==", upperCode));
    const existing = await getDocs(q);

    if (!existing.empty && !editingId) {
      alert("Company short code already exists!");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "companies", editingId), {
          companyName,
          shortCode: upperCode,
          status,
          updatedAt: serverTimestamp(),
        });
        alert("Company updated successfully!");
        setEditingId(null);
      } else {
        await addDoc(companiesRef, {
          companyId: generateCompanyId(upperCode),
          companyName,
          shortCode: upperCode,
          status,
          createdAt: serverTimestamp(),
        });
        alert("Company added successfully!");
      }

      setCompanyName("");
      setShortCode("");
      setStatus("active");
      fetchCompanies();
    } catch (error) {
      console.error(error);
      alert("Failed to save company");
    }
  };

  // ✏️ Edit
  const handleEdit = (company) => {
    setCompanyName(company.companyName);
    setShortCode(company.shortCode);
    setStatus(company.status);
    setEditingId(company.id);
  };

  // 🗑 Delete
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this company?")) return;
    await deleteDoc(doc(db, "companies", id));
    fetchCompanies();
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-2xl p-6">
      <h2 className="text-xl font-bold mb-4">
        {editingId ? "Edit Company" : "Add Company"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <input
          type="text"
          placeholder="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border p-2 rounded-lg"
        />

        <input
          type="text"
          placeholder="Company Short Code (e.g. PMC)"
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value.toUpperCase())}
          className="w-full border p-2 rounded-lg"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border p-2 rounded-lg"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          {editingId ? "Update Company" : "Save Company"}
        </button>
      </form>

      {/* Companies Table */}
      <h2 className="text-xl font-bold mb-4">Companies List</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-4 py-2">Company ID</th>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Code</th>
            <th className="border px-4 py-2">Status</th>
            <th className="border px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map(company => (
            <tr key={company.id}>
              <td className="border px-4 py-2">{company.companyId}</td>
              <td className="border px-4 py-2">{company.companyName}</td>
              <td className="border px-4 py-2 font-bold">{company.shortCode}</td>
              <td className="border px-4 py-2">{company.status}</td>
              <td className="border px-4 py-2 space-x-2">
                <button
                  onClick={() => handleEdit(company)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(company.id)}
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
