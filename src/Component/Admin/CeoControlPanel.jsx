import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function CeoControlPanel() {
  const navigate = useNavigate();

  const [ceoUser, setCeoUser] = useState(null);
  const [branchList, setBranchList] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. NEW STATE: Dedicated state for standalone branch fetching
  const [branchDirectory, setBranchDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  useEffect(() => {
    // 1. Retrieve CEO session data
    const storedCeo = sessionStorage.getItem("ceoData");
    if (!storedCeo) {
      navigate("/");
      return;
    }

    const parsedCeo = JSON.parse(storedCeo);
    setCeoUser(parsedCeo);

    // 2. Load assigned branches (Unchanged)
    loadBranches(parsedCeo);

    // 3. NEW CALL: Fetch branch IDs and Names using our standalone function
    fetchBranchesSeparately(parsedCeo);
  }, [navigate]);

  // =========================================================================
  // NEW FUNCTION: Custom fetch for branchId and branchName from Firestore
  // =========================================================================
  const fetchBranchesSeparately = async (ceo) => {
    try {
      setDirectoryLoading(true);
      const branchesRef = collection(db, "branches");

      // Query by companyId or fallback to companyShortCode
      let q = query(branchesRef, where("companyId", "==", ceo.companyId || ""));
      let snapshot = await getDocs(q);

      if (snapshot.empty && ceo.companyShortCode) {
        q = query(branchesRef, where("companyShortCode", "==", ceo.companyShortCode));
        snapshot = await getDocs(q);
      }

      const fetchedData = snapshot.docs.map((doc) => {
        const data = doc.data();
        const storedBranchId = data.branchId || doc.id; // e.g. "PMC-001"
        
        // Extract raw number/code if formatted as "PREFIX-CODE"
        const rawCode = storedBranchId.includes("-")
          ? storedBranchId.split("-").pop()
          : storedBranchId;

        return {
          id: doc.id,
          fullBranchId: storedBranchId,     // e.g. "PMC-001"
          shortBranchId: rawCode,            // e.g. "001"
          branchName: data.branchName || "Unnamed Branch",
          companyShortCode: data.companyShortCode || ceo.companyShortCode || ""
        };
      });

      setBranchDirectory(fetchedData);
    } catch (error) {
      console.error("Error fetching branch ID and Name separately:", error);
    } finally {
      setDirectoryLoading(false);
    }
  };

  // UNCHANGED FUNCTION
  const loadBranches = async (ceo) => {
    try {
      setLoading(true);

      // Extract branch IDs array directly from CEO session data
      const assignedIds = Array.isArray(ceo.branchIds)
        ? ceo.branchIds.map((id) => String(id).trim())
        : [];

      // Fetch all branch metadata from Firestore to enrich details if available
      let firestoreBranchMap = {};
      try {
        const branchesRef = collection(db, "branches");

        // Query by companyId or companyShortCode
        let q = query(branchesRef, where("companyId", "==", ceo.companyId || ""));
        let snapshot = await getDocs(q);

        if (snapshot.empty && ceo.companyShortCode) {
          q = query(branchesRef, where("companyShortCode", "==", ceo.companyShortCode));
          snapshot = await getDocs(q);
        }

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const key = String(data.branchId || data.code || doc.id).trim();
          firestoreBranchMap[key] = { id: doc.id, ...data };
        });
      } catch (err) {
        console.warn("Could not fetch extra branch details, falling back to CEO branchIds:", err);
      }

      // Merge CEO branchIds array with Firestore data so EVERY ID is clickable
      const mergedBranches = assignedIds.map((id) => {
        const extraDetails = firestoreBranchMap[id] || {};
        return {
          branchId: id,
          branchName: extraDetails.branchName || extraDetails.name || `Branch ${id}`,
          companyId: ceo.companyId,
          companyShortCode: ceo.companyShortCode,
          ...extraDetails,
        };
      });

      setBranchList(mergedBranches);
    } catch (error) {
      console.error("Error loading branches:", error);
    } finally {
      setLoading(false);
    }
  };

  // UNCHANGED FUNCTION
  const handleOpenBranch = (branch) => {
    // Save selected branch to session storage
    sessionStorage.setItem("activeBranch", JSON.stringify(branch));
    sessionStorage.setItem("branchId", branch.branchId);

    // Direct navigate to branch dashboard
    navigate(`/dashboard?branchId=${branch.branchId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-lg animate-pulse">Loading Control Panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="border-b border-slate-700 pb-6 text-center md:text-left">
          <h1 className="text-3xl font-extrabold tracking-widest text-indigo-400 uppercase">
            CEO Control Panel
          </h1>
          <p className="text-xl font-semibold mt-2 text-white">
            Welcome, <span className="text-indigo-300">{ceoUser?.username || "CEO"}</span>
          </p>

          <div className="flex flex-wrap gap-6 mt-4 text-sm text-slate-400">
            <div>
              <span className="font-medium text-slate-300">Company ID:</span>{" "}
              <span className="text-white font-mono">{ceoUser?.companyId || "N/A"}</span>
            </div>
            <div>
              <span className="font-medium text-slate-300">Code:</span>{" "}
              <span className="text-indigo-400 font-bold">{ceoUser?.companyShortCode || "PMC"}</span>
            </div>
            <div>
              <span className="font-medium text-slate-300">Total Assigned Branches:</span>{" "}
              <span className="text-indigo-300 font-bold">{branchList.length}</span>
            </div>
          </div>
        </div>

        {/* NEW DISPLAY SECTION: Render the dynamically fetched Branch IDs & Names */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-300 mb-4">
            Fetched Branch Directory
          </h2>

          {directoryLoading ? (
            <p className="text-xs text-slate-400 animate-pulse">Loading directory records...</p>
          ) : branchDirectory.length === 0 ? (
            <p className="text-xs text-slate-500">No branch records found in database.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {branchDirectory.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.branchName}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      Full ID: <span className="text-indigo-400">{item.fullBranchId}</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2 py-1 rounded">
                    #{item.shortBranchId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branch Cards Grid (Unchanged) */}
        <div>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            Select a Branch to Access:
          </h2>

          {branchList.length === 0 ? (
            <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 text-center text-slate-400">
              No branch IDs are assigned to this CEO account.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {branchList.map((b) => (
                <div
                  key={b.branchId}
                  className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-lg hover:border-indigo-500 hover:shadow-indigo-500/10 transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition">
                      {b.branchName}
                    </h3>
                    <p className="text-sm text-slate-400 mt-2 font-mono">
                      Branch ID: <span className="text-indigo-300 font-bold">{b.branchId}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenBranch(b)}
                    className="mt-6 w-full flex items-center justify-between bg-indigo-600/20 text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white px-4 py-2.5 rounded-xl font-medium text-sm transition"
                  >
                    <span>Open Branch {b.branchId}</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}