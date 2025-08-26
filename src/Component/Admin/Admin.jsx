// AdminPanel.jsx
import React, { useState, useEffect } from "react";
// Don't need useLocation anymore
// import { useLocation } from "react-router-dom"; 
// --- Import react-icons ---
import {
  MdDashboard, // For LayoutDashboard
  MdBook, // For BookOpenText
  MdPeople, // For Users
  MdAssignment, // For ClipboardList
  MdEdit, // For FileEdit
  MdKeyboardArrowDown, // For ChevronDown
  MdPerson, // For User
  MdAttachMoney, // For DollarSign
  MdAssignmentTurnedIn, //For ClipboardCheck
  MdBarChart, // For BarChart2
  MdFormatListBulleted, // For List
  MdDescription, // For FileText
  MdTrendingUp, // For TrendingUp
  MdWarning, // For AlertTriangle
  MdCheckCircle, // For CheckCircle
  MdRemoveCircle, // For MinusCircle
} from "react-icons/md"; // Using Material Design icons for consistency

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

// --- Navigation Items Configuration (Defined First) ---
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
      { key: "groups", label: "Groups", icon: <MdPeople /> },
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
      { key: "PortfolioTransactoin", label: "Portfolio Transactoin", icon: <MdDescription />,
        children: [ // First level of nested children
          { key: "generalportfolio", label: "General Portfolio", icon: <MdBarChart /> },
          { key: "staffportfolio", label: "Staff Portfolio", icon: <MdFormatListBulleted /> },
        ]
      },
      { key: "loanReports", label: "Loan Reports", icon: <MdAssignment />,
        children: [ // First level of nested children
          { key: "overdueLoans", label: "Overdue Loans", icon: <MdWarning /> },
          { key: "disbursedLoans", label: "Disbursed Loans", icon: <MdCheckCircle /> },
          { key: "outstandingBalances", label: "Outstanding Balances", icon: <MdRemoveCircle /> },
          { key: "fullypaid", label: "Fully Paid", icon: <MdRemoveCircle /> },
          { key: "paymentdetails", label: "Payment Details", icon: <MdRemoveCircle /> },
        ]
      },
      { key: "clientReports", label: "Client Reports", icon: <MdPeople />,
        children: [ // First level of nested children
          { key: "clientSpecific", label: "Client Specific", icon: <MdPerson /> },
        ]
      },
      { key: "systemReports", label: "System Reports", icon: <MdBarChart />,
        children: [ // First level of nested children
          { key: "transactionReports", label: "Transaction Logs", icon: <MdAssignment /> },
          { key: "auditLogs", label: "Audit Logs", icon: <MdBook /> },
        ]
      },
    ],
  },
];

// --- Helper Functions (Defined after NAV_ITEMS) ---
const findPath = (items, targetKey, currentPath = []) => {
  for (const item of items) {
    const newPath = [...currentPath, item.key];
    if (item.key === targetKey) {
      return newPath;
    }
    if (item.children) {
      const result = findPath(item.children, targetKey, newPath);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

// A reusable Button component
const Button = ({ variant = "default", onClick, className = "", children }) => {
  let baseStyles =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-950 disabled:pointer-events-none disabled:opacity-50";
  let variantStyles = "";

  switch (variant) {
    case "default":
      variantStyles = "bg-indigo-600 text-white shadow hover:bg-indigo-700";
      break;
    case "ghost":
      variantStyles = "hover:bg-indigo-100 hover:text-indigo-700 text-gray-700";
      break;
    default:
      variantStyles = "bg-indigo-600 text-white shadow hover:bg-indigo-700";
      break;
  }

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles} ${className} h-9 px-4 py-2`}
    >
      {children}
    </button>
  );
};

// --- Placeholder Components ---
const Repayment = () => (
  <div className="p-6 bg-white rounded-xl shadow-md">
    <h2 className="text-2xl font-semibold text-gray-800">Repayment</h2>
    <p className="mt-2 text-gray-600">This section is for managing repayment schedules and collections.</p>
  </div>
);
const FeesCollection = () => (
  <div className="p-6 bg-white rounded-xl shadow-md">
    <h2 className="text-2xl font-semibold text-gray-800">Fees Collection</h2>
    <p className="mt-2 text-gray-600">This section manages fees, charges, and collection logs.</p>
  </div>
);

// New placeholder components for nested reports
const SummaryReport = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Summary Report</h2>
        <p className="mt-2 text-gray-600">Overview of key financial metrics.</p>
    </div>
);
const DetailedReport = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Detailed Report</h2>
        <p className="mt-2 text-gray-600">Granular data for in-depth analysis.</p>
    </div>
);
const PerformanceMetrics = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Performance Metrics</h2>
        <p className="mt-2 text-gray-600">Analysis of loan and savings performance.</p>
    </div>
);
const LoanAnalytics = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Loan Analytics</h2>
        <p className="mt-2 text-gray-600">Specific analytics related to loans.</p>
    </div>
);
const SavingsAnalytics = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Savings Analytics</h2>
        <p className="mt-2 text-gray-600">Specific analytics related to savings.</p>
    </div>
);

const ClientReports = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Client Specific Reports</h2>
        <p className="mt-2 text-gray-600">Reports tailored to individual clients.</p>
    </div>
);
const TransactionReports = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Transaction Reports</h2>
        <p className="mt-2 text-gray-600">Detailed log of all financial transactions.</p>
    </div>
);
const AuditLogs = () => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">Audit Logs</h2>
        <p className="mt-2 text-gray-600">Records of system activities and changes.</p>
    </div>
);

// --- The updated Dashboard component ---
const Dashboard = ({ branch }) => {
  const branchName = branch?.branchName || "your Branch Dashboard";
  const branchId = branch?.branchId || "N/A";
  const branchLocation = branch?.branchLocation || "N/A"; // Use branch.location based on your table example

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">
            Welcome to {branchName}!
        </h2>
        <p className="mt-2 text-gray-600">
            **Branch ID:** {branchId}
        </p>
        <p className="mt-2 text-gray-600">
            **Location:** {branchLocation}
        </p>
        <p className="mt-2 text-gray-600">
            Select an item from the sidebar to get started.
        </p>
    </div>
  );
};


/**
 * The main Admin Panel component.
 * It manages the state for the active tab and the open dropdown.
 */
function AdminPanel() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openNestedDropdowns, setOpenNestedDropdowns] = useState({});
  const [branch, setBranch] = useState(null); // Add state for branch data

  // New useEffect hook to load branch data from sessionStorage on component mount
  useEffect(() => {
    try {
      const storedBranchData = sessionStorage.getItem('branchData');
      if (storedBranchData) {
        setBranch(JSON.parse(storedBranchData));
      }
    } catch (e) {
      console.error("Failed to parse branch data from session storage", e);
    }
  }, []); // Empty dependency array ensures this runs only once

  const dashboardBgColor = branch?.bgColor || "bg-gray-100";
  const branchName = branch?.branchName || "Admin Panel Dashboard";

  const toggleNestedDropdown = (key) => {
    setOpenNestedDropdowns(prevState => {
      const newState = { ...prevState };
      if (newState[key]) {
        delete newState[key];
      } else {
        newState[key] = true;
      }
      return newState;
    });
  };

  const renderContent = () => {
    // Pass the branch object to components that need it for filtering
    const propsWithBranch = { branch };

    switch (activeTab) {
      case "staffForm": return <StaffForm {...propsWithBranch} />;
      case "clientForm": return <ClientDetails {...propsWithBranch} />;
      case "loan": return <Loan {...propsWithBranch} />;
      case "groups": return <div>Groups Management Component</div>;
      case "repaymentSchedule": return <Payments {...propsWithBranch} />;
      case "savings": return <Savings {...propsWithBranch} />;
      case "withdrawal": return <Withdrawal {...propsWithBranch} />;
      case "processingFees": return <ProcessingFee {...propsWithBranch} />;
      case "otherFees": return <div>Other Fees Component</div>;
      case "generalportfolio": return <GeneralReportTransactionGPT {...propsWithBranch} />;
      case "staffportfolio": return <StaffReportTransactionGPT {...propsWithBranch} />;
      case "performanceMetrics": return <PerformanceMetrics />;
      case "loanAnalytics": return <LoanAnalytics />;
      case "savingsAnalytics": return <SavingsAnalytics />;
      case "overdueLoans": return <OverdueLoans {...propsWithBranch} />;
      case "disbursedLoans": return <DisbursedLoans {...propsWithBranch} />;
      case "outstandingBalances": return <OutstandingBalances {...propsWithBranch} />;
      case "fullypaid": return <FullPaid {...propsWithBranch} />;
      case "paymentdetails": return <PaymentDetails {...propsWithBranch} />;
      case "clientSpecific": return <ClientReports />;
      case "transactionReports": return <div>Transaction Reports Component</div>;
      case "auditLogs": return <div>Audit Logs Component</div>;
      case "dashboard": return <Dashboard branch={branch} />;
      default: return <Dashboard branch={branch} />;
    }
  };

  const getHeaderLabel = () => {
    const findLabel = (items, currentKey) => {
      for (const item of items) {
        if (item.key === currentKey) {
          return item.label;
        }
        if (item.children) {
          const childLabel = findLabel(item.children, currentKey);
          if (childLabel) return childLabel;
        }
      }
      return null;
    };

    const label = findLabel(NAV_ITEMS, activeTab);
    return label || branchName;
  };
  
  const renderNavItems = (items, level = 0, parentKey = null) => {
    // ... (rest of the renderNavItems function remains the same)
    return items.map((item) => (
      <div key={item.key} className={level > 0 ? `pl-${level * 4} pt-1` : ''}>
        {item.children ? (
          <>
            <Button
              variant={openNestedDropdowns[item.key] ? "default" : "ghost"}
              onClick={() => {
                if (level === 0) {
                    setOpenDropdown(openDropdown === item.key ? null : item.key);
                    setOpenNestedDropdowns(prevState => {
                        const newState = {};
                        if (prevState[item.key]) {
                            return {};
                        } else {
                            newState[item.key] = true;
                            return newState;
                        }
                    });
                } else {
                    toggleNestedDropdown(item.key, parentKey);
                }
              }}
              className={`w-full justify-start flex items-center gap-2 py-2 ${level === 0 ? 'text-base' : 'text-sm'}`}
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
              <div className="space-y-1">
                {renderNavItems(item.children, level + 1, item.key)}
              </div>
            )}
          </>
        ) : (
          <Button
            variant={activeTab === item.key ? "default" : "ghost"}
            onClick={() => {
              setActiveTab(item.key);
              const path = findPath(NAV_ITEMS, item.key);
              const newOpenNestedDropdowns = {};
              if (path) {
                  path.forEach(keyInPath => {
                      newOpenNestedDropdowns[keyInPath] = true;
                  });
              }
              setOpenNestedDropdowns(newOpenNestedDropdowns);
              if (path && path.length > 0) {
                  setOpenDropdown(path[0]);
              } else {
                  setOpenDropdown(null);
              }
            }}
            className={`w-full justify-start flex items-center gap-2 py-1 ${level === 0 ? 'text-base' : 'text-sm'}`}
          >
            {item.icon} {item.label}
          </Button>
        )}
      </div>
    ));
  };


  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white p-4 border-r border-gray-200 shadow-lg flex flex-col">
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">{branchName}</h2>
        <div className="space-y-2 flex-grow">
          <Button
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            onClick={() => {
              setActiveTab("dashboard");
              setOpenDropdown(null);
              setOpenNestedDropdowns({});
            }}
            className="w-full justify-start flex items-center gap-2 text-base py-2 mb-2"
          >
            <MdDashboard /> Dashboard
          </Button>
          {renderNavItems(NAV_ITEMS)}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-6 overflow-y-auto ${dashboardBgColor}`}>
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          {getHeaderLabel()}
        </h1>
        {renderContent()}
      </div>
    </div>
  );
}

export default AdminPanel;