import { useState, useEffect } from "react";
import { FaScaleBalanced, FaPrint, FaFileInvoiceDollar, FaWallet, FaBuildingColumns } from "react-icons/fa6";

/* -------------------- Reusable Row Component -------------------- */
const TrialBalanceRow = ({ item, type, onUpdate, isSpecial = false }) => {
  // Calculate Net Total: (Previous + Dr) - Cr
  const netTotal = isSpecial ? item.value : (item.prev + item.dr - item.cr);

  return (
    <tr className={`border-b hover:bg-gray-50 transition text-sm ${isSpecial ? "bg-amber-50/50" : ""}`}>
      <td className="p-4 text-gray-800 font-medium border-r flex items-center gap-2 min-w-[200px]">
        {item.label === "Cash in hand" && <FaWallet className="text-amber-600" />}
        {item.label === "Bank" && <FaBuildingColumns className="text-blue-600" />}
        {item.label}
      </td>

      {/* Previous Column */}
      <td className="p-2 border-r w-32">
        <input
          type="number"
          value={item.prev || 0}
          onChange={(e) => onUpdate(item.id, "prev", e.target.value, type)}
          className="w-full p-1 text-right bg-transparent focus:bg-white border border-transparent focus:border-gray-300 rounded outline-none font-mono"
        />
      </td>

      {/* Dr Column */}
      <td className={`p-2 border-r w-32 bg-blue-50/20`}>
        {!isSpecial ? (
          <input
            type="number"
            value={item.dr || 0}
            onChange={(e) => onUpdate(item.id, "dr", e.target.value, type)}
            className="w-full p-1 text-right bg-transparent focus:bg-white border border-transparent focus:border-blue-300 rounded outline-none font-mono text-blue-700"
          />
        ) : (
          <div className="text-center text-gray-400">-</div>
        )}
      </td>

      {/* Cr Column */}
      <td className={`p-2 border-r w-32 bg-emerald-50/20`}>
        {!isSpecial ? (
          <input
            type="number"
            value={item.cr || 0}
            onChange={(e) => onUpdate(item.id, "cr", e.target.value, type)}
            className="w-full p-1 text-right bg-transparent focus:bg-white border border-transparent focus:border-emerald-300 rounded outline-none font-mono text-emerald-700"
          />
        ) : (
          <div className="text-center text-gray-400">-</div>
        )}
      </td>

      {/* Net Balance Column */}
      <td className={`p-4 text-right font-mono w-40 font-bold ${netTotal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
        {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );
};

/* -------------------- MAIN COMPONENT -------------------- */

function TrialBalance({ branch }) {
  const [branchId, setBranchId] = useState("");

  // Manual Input State for Debits
  const [drItems, setDrItems] = useState([
    // { id: 1, label: "Repayment", prev: 0, dr: 0, cr: 0 },
    // { id: 2, label: "G-Fund", prev: 0, dr: 0, cr: 0 },
    // { id: 3, label: "LPF", prev: 0, dr: 0, cr: 0 },
    // { id: 4, label: "Risk Premium", prev: 0, dr: 0, cr: 0 },
    // { id: 5, label: "IT Fees", prev: 0, dr: 0, cr: 0 },
    // { id: 6, label: "Branch Cancel", prev: 0, dr: 0, cr: 0 },
  ]);

  // Manual Input State for Credits
  const [crItems, setCrItems] = useState([
    { id: 7, label: "Saving Withdrawal", prev: 0, dr: 0, cr: 0 },
    // { id: 8, label: "Loan Disbursement", prev: 0, dr: 0, cr: 0 },
    { id: 9, label: "Bank Charges", prev: 0, dr: 0, cr: 0 },
     { id: 1, label: "Repayment", prev: 0, dr: 0, cr: 0 },
    { id: 2, label: "G-Fund", prev: 0, dr: 0, cr: 0 },
    { id: 3, label: "LPF", prev: 0, dr: 0, cr: 0 },
    { id: 4, label: "Risk Premium", prev: 0, dr: 0, cr: 0 },
    { id: 5, label: "IT Fees", prev: 0, dr: 0, cr: 0 },
    { id: 6, label: "Branch Cancel", prev: 0, dr: 0, cr: 0 },
  ]);

  // Special Liquid Balances
  const [cashInHand, setCashInHand] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);

  useEffect(() => {
    const id = branch?.branchId || sessionStorage.getItem("branchId");
    if (id) setBranchId(id);
  }, [branch]);

  // Update Handler
  const handleUpdate = (id, field, value, type) => {
    const numValue = parseFloat(value) || 0;
    if (type === "dr") {
      setDrItems(prev => prev.map(item => item.id === id ? { ...item, [field]: numValue } : item));
    } else {
      setCrItems(prev => prev.map(item => item.id === id ? { ...item, [field]: numValue } : item));
    }
  };

  // Final Calculations
  const totalPrev = [...drItems, ...crItems].reduce((acc, curr) => acc + curr.prev, 0);
  const totalDr = drItems.reduce((acc, curr) => acc + curr.dr, 0);
  const totalCr = crItems.reduce((acc, curr) => acc + curr.cr, 0);
  
  // Grand Total = Cash + Bank + (Total Prev + Total Dr) - Total Cr
  const grandTotal = cashInHand + bankBalance + (totalPrev + totalDr) - totalCr;

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
        
        <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <FaFileInvoiceDollar className="text-2xl text-blue-400" />
            <h1 className="text-xl font-bold uppercase tracking-widest">Manual Trial Balance</h1>
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 px-4 py-2 rounded text-sm print:hidden">
            <FaPrint className="inline mr-2" /> Print
          </button>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto border rounded-lg border-gray-300">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b">
                  <th className="p-4 text-left border-r">Details / Account Particulars</th>
                  <th className="p-4 text-right border-r w-32">Previous ($)</th>
                  <th className="p-4 text-right border-r w-32">Dr ($)</th>
                  <th className="p-4 text-right border-r w-32">Cr ($)</th>
                  <th className="p-4 text-right w-40">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* SPECIAL ROWS */}
                <tr className="bg-amber-100/30 border-b">
                  <td className="p-4 border-r flex items-center gap-2"><FaWallet className="text-amber-600"/> Cash in hand</td>
                  <td colSpan="3" className="p-2 border-r bg-amber-50/20">
                    <input type="number" value={cashInHand} onChange={(e)=>setCashInHand(parseFloat(e.target.value)||0)} 
                    className="w-full p-1 text-right font-mono bg-transparent outline-none font-bold" />
                  </td>
                  <td className="p-4 text-right font-mono font-bold">{cashInHand.toLocaleString()}</td>
                </tr>
                <tr className="bg-amber-100/30 border-b">
                  <td className="p-4 border-r flex items-center gap-2"><FaBuildingColumns className="text-blue-600"/> Bank</td>
                  <td colSpan="3" className="p-2 border-r bg-amber-50/20">
                    <input type="number" value={bankBalance} onChange={(e)=>setBankBalance(parseFloat(e.target.value)||0)} 
                    className="w-full p-1 text-right font-mono bg-transparent outline-none font-bold" />
                  </td>
                  <td className="p-4 text-right font-mono font-bold">{bankBalance.toLocaleString()}</td>
                </tr>
                <tr className="bg-amber-100/30 border-b">
                  <td className="p-4 border-r flex items-center gap-2"><FaBuildingColumns className="text-blue-600"/> Portfolio Regular/ 6 Months</td>
                  <td colSpan="3" className="p-2 border-r bg-amber-50/20">
                    <input type="number" value={bankBalance} onChange={(e)=>setBankBalance(parseFloat(e.target.value)||0)} 
                    className="w-full p-1 text-right font-mono bg-transparent outline-none font-bold" />
                  </td>
                  <td className="p-4 text-right font-mono font-bold">{bankBalance.toLocaleString()}</td>
                </tr>
                <tr className="bg-amber-100/30 border-b">
                  <td className="p-4 border-r flex items-center gap-2"><FaBuildingColumns className="text-blue-600"/> Portfolio Special/ 8 Months</td>
                  <td colSpan="3" className="p-2 border-r bg-amber-50/20">
                    <input type="number" value={bankBalance} onChange={(e)=>setBankBalance(parseFloat(e.target.value)||0)} 
                    className="w-full p-1 text-right font-mono bg-transparent outline-none font-bold" />
                  </td>
                  <td className="p-4 text-right font-mono font-bold">{bankBalance.toLocaleString()}</td>
                </tr>

                  {/* CREDITS */}
                <tr className="bg-emerald-50/50"><td colSpan="5" className="px-4 py-2 text-[10px] font-bold text-emerald-800 border-b border-t italic uppercase">Credit Accounts</td></tr>
                {crItems.map((item) => (
                  <TrialBalanceRow key={item.id} item={item} type="cr" onUpdate={handleUpdate} />
                ))}


                {/* DEBITS */}
                <tr className="bg-blue-50/50"><td colSpan="5" className="px-4 py-2 text-[10px] font-bold text-blue-800 border-b italic uppercase">Debit Accounts</td></tr>
                {drItems.map((item) => (
                  <TrialBalanceRow key={item.id} item={item} type="dr" onUpdate={handleUpdate} />
                ))}

              
              </tbody>

              <tfoot className="bg-slate-900 text-white font-bold">
                <tr>
                  <td className="p-5 text-right uppercase text-xs border-r border-slate-700">Total Calculation</td>
                  <td className="p-5 text-right font-mono text-gray-300 border-r border-slate-700">{totalPrev.toLocaleString()}</td>
                  <td className="p-5 text-right font-mono text-blue-300 border-r border-slate-700">{totalDr.toLocaleString()}</td>
                  <td className="p-5 text-right font-mono text-emerald-300 border-r border-slate-700">{totalCr.toLocaleString()}</td>
                  <td className="p-5 text-right font-mono text-white text-lg underline decoration-double">{grandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrialBalance;