// UserForm.jsx
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

export default function UserForm() {
  const [branchId, setBranchId] = useState("");
  const [userCode, setUserCode] = useState("");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [companyId, setCompanyId] = useState("");
  const [companyShortCode, setCompanyShortCode] = useState("");


  const usersCollection = collection(db, "users");

  // Fetch users from Firebase
  const fetchUsers = async () => {
    const data = await getDocs(usersCollection);
    setUsers(data.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!companyId || !companyShortCode || !branchId || !userCode || !username) {
      alert("Please fill all fields!");
      return;
    }

    try {
      if (editingId) {
        const userDoc = doc(db, "users", editingId);
        await updateDoc(userDoc, { companyId, companyShortCode, branchId, userCode, username });
        setEditingId(null);
      } else {
        await addDoc(usersCollection, { companyId, companyShortCode, branchId, userCode, username, createdAt: serverTimestamp() });
      }

      setBranchId("");
      setUserCode("");
      setUsername("");
      fetchUsers();
      setCompanyId("");
setCompanyShortCode("");

    } catch (error) {
      console.error("Error saving user: ", error);
      alert("Failed to save user");
    }
  };

  const handleEdit = (user) => {
  setBranchId(user.branchId || "");
  setUserCode(user.userCode || "");
  setUsername(user.username || "");
  setEditingId(user.id);
  setCompanyId(user.companyId || "");
  setCompanyShortCode(user.companyShortCode || "");
};


  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      await deleteDoc(doc(db, "users", id));
      fetchUsers();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Form */}
      <div className="bg-white shadow-lg rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">{editingId ? "Edit User" : "Add New User"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <input
            type="text"
            placeholder="Branch ID"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="User Code"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            className="w-full border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border p-2 rounded-lg"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {editingId ? "Update User" : "Add User"}
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Users List</h2>
        <table className="w-full table-auto border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100"><th className="border px-4 py-2">Company ID</th>
              <th className="border px-4 py-2">Code</th>

              <th className="border px-4 py-2">Branch ID</th>
              <th className="border px-4 py-2">User Code</th>
              <th className="border px-4 py-2">Username</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="border px-4 py-2">{user.companyId}</td>
                <td className="border px-4 py-2">{user.companyShortCode}</td>

                <td className="border px-4 py-2">{user.branchId}</td>
                <td className="border px-4 py-2">{user.userCode}</td>
                <td className="border px-4 py-2">{user.username}</td>
                <td className="border px-4 py-2 space-x-2">
                  <button
                    onClick={() => handleEdit(user)}
                    className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
               <td colSpan="6" className="text-center py-4">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
