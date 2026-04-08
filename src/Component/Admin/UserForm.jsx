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
  const [companyId, setCompanyId] = useState("");
  const [companyShortCode, setCompanyShortCode] = useState("");
  const [role, setRole] = useState("admin"); // Default to admin
  const [dashboardPath, setDashboardPath] = useState("AdminDashboard2");
  
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const usersCollection = collection(db, "users");

  const fetchUsers = async () => {
    try {
      const data = await getDocs(usersCollection);
      setUsers(data.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!companyId || !companyShortCode || !branchId || !userCode || !username || !role || !dashboardPath) {
      alert("Please fill all fields!");
      return;
    }

    const userData = {
      companyId,
      companyShortCode,
      branchId,
      userCode,
      username,
      role,
      dashboardPath,
    };

    try {
      if (editingId) {
        const userDoc = doc(db, "users", editingId);
        await updateDoc(userDoc, userData);
        setEditingId(null);
      } else {
        await addDoc(usersCollection, { 
          ...userData, 
          createdAt: serverTimestamp() 
        });
      }

      // Reset Form
      setBranchId("");
      setUserCode("");
      setUsername("");
      setCompanyId("");
      setCompanyShortCode("");
      setRole("admin");
      setDashboardPath("AdminDashboard2");
      
      fetchUsers();
    } catch (error) {
      console.error("Error saving user: ", error);
      alert("Failed to save user");
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setBranchId(user.branchId || "");
    setUserCode(user.userCode || "");
    setUsername(user.username || "");
    setCompanyId(user.companyId || "");
    setCompanyShortCode(user.companyShortCode || "");
    setRole(user.role || "admin");
    setDashboardPath(user.dashboardPath || "AdminDashboard2");
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      await deleteDoc(doc(db, "users", id));
      fetchUsers();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Form Section */}
      <div className="bg-white shadow-lg rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">{editingId ? "Edit User" : "Add New User"}</h2>
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
            placeholder="Branch ID (e.g. 002)"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="User Code (e.g. 1126)"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="Role (e.g. admin)"
            value={role}
            onChange={(e) => setRole(e.target.value.toLowerCase())}
            className="border p-2 rounded-lg"
          />
          <input
            type="text"
            placeholder="Dashboard Path"
            value={dashboardPath}
            onChange={(e) => setDashboardPath(e.target.value)}
            className="border p-2 rounded-lg md:col-span-2"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {editingId ? "Update User" : "Add User"}
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-lg rounded-2xl p-6 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">Users List</h2>
        <table className="w-full table-auto border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="border px-2 py-2">Company</th>
              <th className="border px-2 py-2">Branch</th>
              <th className="border px-2 py-2">User Code</th>
              <th className="border px-2 py-2">Username</th>
              <th className="border px-2 py-2">Role</th>
              <th className="border px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {users.map((user) => (
              <tr key={user.id} className="text-center">
                <td className="border px-2 py-2">{user.companyId} ({user.companyShortCode})</td>
                <td className="border px-2 py-2">{user.branchId}</td>
                <td className="border px-2 py-2">{user.userCode}</td>
                <td className="border px-2 py-2 font-semibold">{user.username}</td>
                <td className="border px-2 py-2"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">{user.role}</span></td>
                <td className="border px-2 py-2"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">{user.dashboardPath}</span></td>
                <td className="border px-2 py-2 space-x-1">
                  <button onClick={() => handleEdit(user)} className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500 text-xs">Edit</button>
                  <button onClick={() => handleDelete(user.id)} className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-xs">Delete</button>
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