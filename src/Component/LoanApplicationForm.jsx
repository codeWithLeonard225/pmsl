// src/UpdateLoanOutcome.jsx

import React, { useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

export default function UpdateLoanOutcome() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const loansRef = collection(db, "payments");
      const snapshot = await getDocs(loansRef);

      let updatedCount = 0;

      for (const loanDoc of snapshot.docs) {
        const data = loanDoc.data();
        let newOutcome = null;

        if (data.loanType === "Personal") {
          newOutcome = "Regular";
        } else if (data.loanType === "Business") {
          newOutcome = "Special";
        } 

        if (newOutcome) {
          await updateDoc(doc(db, "payments", loanDoc.id), {
            loanType: newOutcome,
          });
          updatedCount++;
        }
      }

      setStatus(`✅ Successfully updated ${updatedCount} records!`);
    } catch (error) {
      console.error("Error updating loan outcomes:", error);
      setStatus("❌ Error while updating loan outcomes.");
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Bulk Update Loan Outcomes</h2>
      <button
        onClick={handleUpdate}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Updating..." : "Run Update"}
      </button>
      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
