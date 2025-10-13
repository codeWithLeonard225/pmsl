// AdminPanel.jsx
import React, { useState, useEffect } from "react";
import {
  MdDashboard,
  MdBook,
  MdPeople,
  MdAssignment,
  MdEdit,
  MdKeyboardArrowDown,
  MdPerson,
  MdAttachMoney,
  MdAssignmentTurnedIn,
  MdBarChart,
  MdFormatListBulleted,
  MdDescription,
  MdTrendingUp,
  MdWarning,
  MdCheckCircle,
  MdRemoveCircle,
} from "react-icons/md";

// --- Import your components ---
import StaffForm from "../Forms/StaffDetails";
import ClientDetails from "../Forms/ClientDetails";
import Loan from "../Principal/Loan";
import Payments from "../RePayment/Payments";
import Savings from "../RePayment/Savings";
import Withdrawal from "../RePayment/Withdrawal";
import GeneralReportTransactionGPT from "../Reports/Portfolio Transaction/GeneralReportTransactionGPT";
import StaffReportTransactionGPT from "../Reports/Portfolio Transaction/StaffReportTransactionGPT";
import OverdueLoans from "../Load Details/OverdueLoans";
import DisbursedLoans from "../Load Details/DisbursedLoans";
import OutstandingBalances from "../Load Details/OutstandingBalances";
import FullPaid from "../Load Details/FullPaid";
import PaymentDetails from "../Load Details/PaymentDetails";
import ProcessingFee from "../Fees Collection/ProcessingFee";
import GroupReportTransactionGPT from "../Reports/Portfolio Transaction/GroupReportTransactionGPT";
import ClientReport from "../Reports/ClientsReport/ClientReport";
import GroupManager from "../Principal/GroupManager";

// --- NAV ITEMS ---
const NAV_ITEMS = [
  {
    key: "forms",
    label: "Forms",
    icon: <MdEdit />,
    children: [
      { key: "staffForm", label: "Staff Form", icon: <MdPerson /> },
      { key: "clientForm", label: "Client Form", icon: <MdPeople /> },
    ],
  },
  {
    key: "disbursement",
    label: "Disbursement",
    icon: <MdAttachMoney />,
    children: [
      { key: "loan", label: "Loan", icon: <MdAssignment /> },
      { key: "group", label: "Groups", icon: <MdPeople /> },
    ],
  },
  {
    key: "repayment",
    label: "Repayment",
    icon: <MdBook />,
    children: [
      { key: "repaymentSchedule", label: "Repayment Schedule", icon: <MdAssignment /> },
      { key: "savings", label: "Savings", icon: <MdBook /> },
      { key: "withdrawal", label: " Withdrawal", icon: <MdBook /> },
    ],
  },
  {
    key: "feesCollection",
    label: "Fees Collection",
    icon: <MdAssignmentTurnedIn />,
    children: [
      { key: "processingFees", label: "Processing Fees", icon: <MdAttachMoney /> },
      { key: "otherFees", label: "Other Fees", icon: <MdAssignmentTurnedIn /> },
    ],
  },
  {
    key: "report",
    label: "Reports",
    icon: <MdBarChart />,
    children: [
      {
        key: "PortfolioTransactoin",
        label: "Portfolio Transactoin",
        icon: <MdDescription />,
        children: [
          { key: "generalportfolio", label: "General Portfolio", icon: <MdBarChart /> },
          { key: "staffportfolio", label: "Staff Portfolio", icon: <MdFormatListBulleted /> },
          { key: "groupReportTransactionGPT", label: "GroupReport", icon: <MdFormatListBulleted /> },
        ],
      },
      {
        key: "loanReports",
        label: "Loan Reports",
        icon: <MdAssignment />,
        children: [
          { key: "overdueLoans", label: "Overdue Loans", icon: <MdWarning /> },
          { key: "disbursedLoans", label: "Disbursed Loans", icon: <MdCheckCircle /> },
          { key: "outstandingBalances", label: "Outstanding Balances", icon: <MdRemoveCircle /> },
          { key: "fullypaid", label: "Fully Paid", icon: <MdRemoveCircle /> },
          { key: "paymentdetails", label: "Payment Details", icon: <MdRemoveCircle /> },
        ],
      },
      {
        key: "systemReports",
        label: "System Reports",
        icon: <MdBarChart />,
        children: [
          { key: "transactionReports", label: "Transaction Logs", icon: <MdAssignment /> },
          { key: "auditLogs", label: "Audit Logs", icon: <MdBook /> },
        ],
      },
    ],
  },
];

// --- Helper function ---
const findPath = (items, targetKey, currentPath = []) => {
  for (const item of items) {
    const newPath = [...currentPath, item.key];
    if (item.key === targetKey) return newPath;
    if (item.children) {
      const result = findPath(item.children, targetKey, newPath);
      if (result) return result;
    }
  }
  return null;
};

// --- Button component ---
const Button = ({ variant = "default", onClick, className = "", children }) => {
  let baseStyles =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-950 disabled:pointer-events-none disabled:opacity-50";
  let variantStyles =
    variant === "default"
      ? "bg-indigo-600 text-white shadow hover:bg-indigo-700"
      : "hover:bg-indigo-100 hover:text-indigo-700 text-gray-700";

  return (
    <button onClick={onClick} className={`${baseStyles} ${variantStyles} ${className} h-9 px-4 py-2`}>
      {children}
    </button>
  );
};

// --- Dashboard placeholder ---
const Dashboard = ({ branch }) => {
  const branchName = branch?.branchName || "your Branch Dashboard";
  const branchId = branch?.branchId || "N/A";
  const branchLocation = branch?.branchLocation || "N/A";

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800">Welcome to {branchName}!</h2>
      <p className="mt-2 text-gray-600">Branch ID: {branchId}</p>
      <p className="mt-2 text-gray-600">Location: {branchLocation}</p>
      <p className="mt-2 text-gray-600">Select an item from the sidebar to get started.</p>
    </div>
  );
};

// --- MAIN ADMIN PANEL ---
function AdminPanel() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openNestedDropdowns, setOpenNestedDropdowns] = useState({});
  const [branch, setBranch] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // <-- Added toggle state

  // Load branch info
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("branchData");
      if (stored) setBranch(JSON.parse(stored));
    } catch (e) {
      console.error("Failed to parse branch data", e);
    }
  }, []);

  const toggleNestedDropdown = (key) => {
    setOpenNestedDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNavItems = (items, level = 0) =>
    items.map((item) => (
      <div key={item.key} className={level > 0 ? `pl-${level * 4} pt-1` : ""}>
        {item.children ? (
          <>
            <Button
              variant={openNestedDropdowns[item.key] ? "default" : "ghost"}
              onClick={() => toggleNestedDropdown(item.key)}
              className={`w-full justify-start flex items-center gap-2 py-2 ${
                level === 0 ? "text-base" : "text-sm"
              }`}
            >
              {item.icon} {item.label}
              <MdKeyboardArrowDown
                size={16}
                className={`ml-auto transition-transform ${
                  openNestedDropdowns[item.key] ? "rotate-180" : ""
                }`}
              />
            </Button>
            {openNestedDropdowns[item.key] && (
              <div className="space-y-1">{renderNavItems(item.children, level + 1)}</div>
            )}
          </>
        ) : (
          <Button
            variant={activeTab === item.key ? "default" : "ghost"}
            onClick={() => {
              setActiveTab(item.key);
              setSidebarOpen(false); // Close sidebar after click (mobile)
            }}
            className={`w-full justify-start flex items-center gap-2 py-1 ${
              level === 0 ? "text-base" : "text-sm"
            }`}
          >
            {item.icon} {item.label}
          </Button>
        )}
      </div>
    ));

  const renderContent = () => {
    const props = { branch };
    switch (activeTab) {
      case "staffForm": return <StaffForm {...props} />;
      case "clientForm": return <ClientDetails {...props} />;
      case "loan": return <Loan {...props} />;
      case "group": return <GroupManager {...props} />;
      case "repaymentSchedule": return <Payments {...props} />;
      case "savings": return <Savings {...props} />;
      case "withdrawal": return <Withdrawal {...props} />;
      case "processingFees": return <ProcessingFee {...props} />;
      case "generalportfolio": return <GeneralReportTransactionGPT {...props} />;
      case "staffportfolio": return <StaffReportTransactionGPT {...props} />;
      case "groupReportTransactionGPT": return <GroupReportTransactionGPT {...props} />;
      case "overdueLoans": return <OverdueLoans {...props} />;
      case "disbursedLoans": return <DisbursedLoans {...props} />;
      case "outstandingBalances": return <OutstandingBalances {...props} />;
      case "fullypaid": return <FullPaid {...props} />;
      case "paymentdetails": return <PaymentDetails {...props} />;
      case "dashboard": return <ClientReport {...props} />;
      default: return <Dashboard branch={branch} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 border-r border-gray-200 shadow-lg transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:block`}
      >
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">
          {branch?.branchName || "Admin Panel"}
        </h2>
        <div className="space-y-2 flex-grow">
          <Button
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            onClick={() => {
              setActiveTab("dashboard");
              setSidebarOpen(false);
            }}
            className="w-full justify-start flex items-center gap-2 text-base py-2 mb-2"
          >
            <MdDashboard /> Dashboard
          </Button>
          {renderNavItems(NAV_ITEMS)}
        </div>
      </div>

      {/* Overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main content */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-100">
        {/* Toggle Button (mobile only) */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <Button variant="default" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "Close Menu" : "Open Menu"}
          </Button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}

export default AdminPanel;
