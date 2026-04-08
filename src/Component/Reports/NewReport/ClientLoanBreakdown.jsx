import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function ClientLoanBreakdown({ branch }) {
    const [branchId, setBranchId] = useState("");
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Resolve Branch ID
    useEffect(() => {
        const id = branch?.branchId || sessionStorage.getItem("branchId");
        if (id) setBranchId(id);
    }, [branch]);

    // 2. Fetch all necessary collections for the branch
    useEffect(() => {
        if (!branchId) return;

        const qLoans = query(collection(db, "loans"), where("branchId", "==", branchId));
        const qPayments = query(collection(db, "payments"), where("branchId", "==", branchId));
        const qSavings = query(collection(db, "savings"), where("branchId", "==", branchId));

        const unsubLoans = onSnapshot(qLoans, (snap) => setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubPayments = onSnapshot(qPayments, (snap) => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSavings = onSnapshot(qSavings, (snap) => {
            setSavings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => { unsubLoans(); unsubPayments(); unsubSavings(); };
    }, [branchId]);

    // 3. Calculation Logic
    const breakdown = useMemo(() => {
        return loans.map(loan => {
            const lId = loan.loanId;
            const cId = loan.clientId;

            const totalRepaid = payments
                .filter(p => p.loanId === lId)
                .reduce((sum, p) => sum + parseFloat(p.repaymentAmount || 0), 0);

            const totalSavings = savings
                .filter(s => s.clientId === cId)
                .reduce((sum, s) => sum + parseFloat(s.compulsoryAmount || 0) + parseFloat(s.voluntarySavings || 0), 0);

            const principal = parseFloat(loan.principal || 0);
            const interestRate = parseFloat(loan.interestRate || 0);
            const totalToPay = principal + (principal * interestRate / 100);
            const currentBalance = totalToPay - totalRepaid;
            const progress = (totalRepaid / totalToPay) * 100;

            return {
                clientName: loan.clientName || "Unknown",
                loanId: lId,
                totalToPay,
                totalRepaid,
                totalSavings,
                balance: currentBalance,
                progress: progress > 100 ? 100 : progress,
                status: currentBalance <= 0 ? "Settled" : "Active"
            };
        });
    }, [loans, payments, savings]);

    const activeLoanCount = breakdown.filter(b => b.status === "Active").length;

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
            <div className="spinner">Calculating...</div>
        </div>
    );

    return (
        <div style={styles.container}>
            {/* ACTION HEADER */}
            <div style={styles.noPrint}>
                <button onClick={() => window.print()} style={styles.printBtn}>
                    🖨 Print Official Report
                </button>
            </div>

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Client Loan & Security Breakdown</h1>
                    <p style={styles.subtitle}>Consolidated Branch Portfolio — {branchId}</p>
                </div>
                <div style={styles.statsCard}>
                    <span style={styles.statsLabel}>Active Loans</span>
                    <span style={styles.statsValue}>{activeLoanCount}</span>
                </div>
            </div>

            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Client Details</th>
                        <th style={styles.thRight}>Loan Exposure (P+I)</th>
                        <th style={styles.thRight}>Repayment Status</th>
                        <th style={styles.thRight}>Savings Collateral</th>
                        <th style={styles.thRight}>Outstanding Balance</th>
                    </tr>
                </thead>
                <tbody>
                    {breakdown.map((item, idx) => (
                        <tr key={idx} style={item.balance <= 0 ? styles.rowSettled : styles.row}>
                            <td style={styles.td}>
                                <div style={styles.clientBrand}>{item.clientName}</div>
                                <div style={styles.smallId}>ID: {item.loanId}</div>
                            </td>
                            <td style={styles.tdRight}>
                                <div style={styles.currency}>NLe {item.totalToPay.toLocaleString()}</div>
                            </td>
                            <td style={styles.tdRight}>
                                <div style={styles.progressContainer}>
                                    <div style={{...styles.progressBar, width: `${item.progress}%`, backgroundColor: item.progress === 100 ? '#27ae60' : '#2980b9'}} />
                                </div>
                                <div style={styles.progressText}>
                                    {item.totalRepaid.toLocaleString()} repaid ({Math.round(item.progress)}%)
                                </div>
                            </td>
                            <td style={styles.tdSavings}>
                                NLe {item.totalSavings.toLocaleString()}
                            </td>
                            <td style={{ ...styles.tdRight, ...styles.balanceCell }}>
                                <span style={item.balance <= 0 ? styles.settledText : styles.activeText}>
                                    {item.balance <= 0 ? "CLEARED" : `NLe ${item.balance.toLocaleString()}`}
                                </span>
                                {item.balance <= 0 && <span style={styles.check}> ★</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* PRINT CSS */}
            <style>{`
                @media print {
                    body { margin: 0; padding: 0; }
                    button { display: none !important; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: { padding: "30px", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" },
    noPrint: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
    printBtn: { padding: '8px 16px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px", borderBottom: "3px solid #1a1a1a", paddingBottom: "15px" },
    title: { margin: 0, fontSize: "26px", fontWeight: "900", letterSpacing: "-0.5px", textTransform: "uppercase" },
    subtitle: { margin: 0, color: "#888", fontSize: "14px", fontWeight: "500" },
    statsCard: { border: "2px solid #1a1a1a", padding: "10px 25px", textAlign: "center", backgroundColor: "#fff" },
    statsLabel: { display: "block", fontSize: "10px", fontWeight: "bold", color: "#1a1a1a", textTransform: "uppercase" },
    statsValue: { fontSize: "28px", fontWeight: "900", color: "#1a1a1a" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", padding: "15px", borderBottom: "2px solid #1a1a1a", backgroundColor: "#fbfbfb", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" },
    thRight: { textAlign: "right", padding: "15px", borderBottom: "2px solid #1a1a1a", backgroundColor: "#fbfbfb", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" },
    td: { padding: "15px", borderBottom: "1px solid #eee" },
    tdRight: { padding: "15px", borderBottom: "1px solid #eee", textAlign: "right" },
    tdSavings: { padding: "15px", borderBottom: "1px solid #eee", textAlign: "right", color: "#2980b9", fontWeight: "700" },
    clientBrand: { fontSize: "15px", fontWeight: "700", color: "#2c3e50" },
    currency: { fontWeight: "600", color: "#444" },
    progressContainer: { width: "100%", height: "6px", backgroundColor: "#eee", borderRadius: "10px", marginTop: "5px", overflow: "hidden" },
    progressBar: { height: "100%", transition: "width 0.3s ease" },
    progressText: { fontSize: "10px", color: "#888", marginTop: "4px", fontWeight: "bold" },
    balanceCell: { textAlign: "right", padding: "15px", borderBottom: "1px solid #eee" },
    settledText: { color: "#27ae60", fontWeight: "900", fontSize: "13px" },
    activeText: { color: "#e74c3c", fontWeight: "900", fontSize: "14px" },
    smallId: { fontSize: "10px", color: "#aaa", fontFamily: "monospace" },
    rowSettled: { backgroundColor: "#fafffa" },
    check: { color: "#27ae60", fontSize: "16px" }
};