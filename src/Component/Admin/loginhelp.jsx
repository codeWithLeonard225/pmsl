// LoginPage.jsx
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

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        if (!branchId || !code || !username) {
            setError("Please fill in all fields!");
            return;
        }

        try {
            const usersRef = collection(db, "users");
            const trimmedBranchId = branchId.trim();
            const trimmedCode = code.trim();
            const trimmedUsername = username.trim().toLowerCase();

            // First query to find the user within the specified branch
            const q = query(
                usersRef,
                where("branchId", "==", trimmedBranchId),
                where("userCode", "==", trimmedCode),
                where("username", "==", trimmedUsername)
            );

            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const user = snapshot.docs[0].data();

                // Store the branchId and user data in a global context or session storage
                // For this example, we'll use session storage which is simple and effective.
                sessionStorage.setItem('branchId', user.branchId);
                sessionStorage.setItem('userData', JSON.stringify(user));

                // Fetch branch data
                const branchSnapshot = await getDocs(
                    query(collection(db, "branches"), where("branchId", "==", user.branchId))
                );
                let branchData = null;
                if (!branchSnapshot.empty) {
                    branchData = branchSnapshot.docs[0].data();
                    sessionStorage.setItem('branchData', JSON.stringify(branchData));
                }

                console.log("Login successful! Navigating to dashboard...");
                navigate("/dashboard");
            } else {
                setError("Invalid Branch ID, User Code, or Username.");
                console.log("Login failed: User not found");
            }
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
                    <div>
                        <label className="block mb-1 font-medium">Branch ID</label>
                        <input
                            type="text"
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            placeholder="Enter branch ID"
                            className="w-full p-2 border rounded-lg focus:ring focus:ring-blue-300"
                        />
                    </div>

                    <div className="relative">
                        <label className="block mb-1 font-medium">User Code</label>
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

                    <div>
                        <label className="block mb-1 font-medium">User Name</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
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