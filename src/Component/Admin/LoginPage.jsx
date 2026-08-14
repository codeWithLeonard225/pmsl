import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [branchId, setBranchId] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);

  const navigate = useNavigate();

  const fetchBranchDetails = async (bId) => {
    try {
      // Look in the "branches" collection where branchId matches
      const branchRef = collection(db, "branches");
      const q = query(branchRef, where("branchId", "==", bId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const branchData = querySnapshot.docs[0].data();
        // Save the short code to session storage
        sessionStorage.setItem("companyShortCode", branchData.companyShortCode);
        return branchData;
      }
    } catch (err) {
      console.error("Error fetching branch details:", err);
    }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!code || !username) {
      setError("Please fill in all required fields!");
      return;
    }

    try {
      const trimmedBranchId = branchId.trim();
      const trimmedCode = code.trim();
      const trimmedUsername = username.trim().toLowerCase();

      // ================= USER LOGIN =================
      if (branchId) {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("branchId", "==", trimmedBranchId),
          where("userCode", "==", trimmedCode),
          where("username", "==", trimmedUsername)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const user = snapshot.docs[0].data();

          await fetchBranchDetails(user.branchId);

          sessionStorage.setItem("branchId", user.branchId);
          sessionStorage.setItem("userData", JSON.stringify(user));
          navigate("/dashboard");
          return;
        }
      }

      // ================= STAFF LOGIN =================
      const staffRef = collection(db, "staffMembers");
      const staffQ = query(
        staffRef,
        where("staffId", "==", trimmedCode),
        where("fullName", "==", username.trim()),
        where("branchId", "==", branchId.trim())
      );

      const staffSnap = await getDocs(staffQ);
      if (!staffSnap.empty) {
        const staffData = staffSnap.docs[0].data();
        
        await fetchBranchDetails(staffData.branchId);

        sessionStorage.setItem("staffData", JSON.stringify(staffData));
        sessionStorage.setItem("branchId", staffData.branchId);
        navigate("/StaffPanel");
        return;
      }

      // ================= CEO LOGIN =================
      const ceoRef = collection(db, "ceo");
      const ceoQ = query(
        ceoRef,
        where("username", "==", trimmedUsername),
        where("code", "==", trimmedCode)
      );

      const ceoSnap = await getDocs(ceoQ);

      if (!ceoSnap.empty) {
        const ceoData = ceoSnap.docs[0].data();

        // 1. Save base session items
        sessionStorage.setItem("ceoData", JSON.stringify(ceoData));
        sessionStorage.setItem("role", "ceo");
        sessionStorage.setItem("companyId", ceoData.companyId || "");

        // 2. Set companyShortCode (directly from record or by fetching a matching branch)
        if (ceoData.companyShortCode) {
          sessionStorage.setItem("companyShortCode", ceoData.companyShortCode);
        } else if (ceoData.companyId) {
          const branchRef = collection(db, "branches");
          const branchQ = query(
            branchRef,
            where("companyId", "==", ceoData.companyId)
          );
          const branchSnap = await getDocs(branchQ);

          if (!branchSnap.empty) {
            const shortCode = branchSnap.docs[0].data().companyShortCode;
            sessionStorage.setItem("companyShortCode", shortCode);
          }
        }

        console.log("CEO login successful!");
        navigate("/CeoControlPanel");
        return;
      }

      // If none matched
      setError("Invalid credentials. Please check your details.");

    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again later.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Microfinance Login
        </h2>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Branch ID (only needed for Users & Staff) */}
          <div>
            <label className="block mb-1 font-medium">Branch ID</label>
            <input
              type="text"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="Enter branch ID (optional for CEO)"
              className="w-full p-2 border rounded-lg focus:ring focus:ring-blue-300"
            />
          </div>

          {/* Code / Password */}
          <div className="relative">
            <label className="block mb-1 font-medium">Code</label>
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              className="w-full p-2 border rounded-lg focus:ring focus:ring-blue-300"
            />
            <span
              className="absolute right-2 top-9 cursor-pointer"
              onClick={() => setShowCode(!showCode)}
            >
              {showCode ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>

          {/* Username */}
          <div>
            <label className="block mb-1 font-medium">User Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username / full name"
              className="w-full p-2 border rounded-lg focus:ring focus:ring-blue-300"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}