// AdminPanel.jsx
import React, { useState, useEffect } from "react";
import {
    MdDashboard,
    MdPerson,
    MdBarChart,
    MdFormatListBulleted,
    MdEdit,
    MdExitToApp // Used for Logout
} from "react-icons/md";

// Assuming these components exist in the same directory structure
import StaffPage from "./Staffpage"; 
import StaffDashboard from "./StaffDashboard"; 

// --- Navigation Items (FLAT Structure) ---
const NAV_ITEMS = [
    { key: "StaffDashboard", label: "Dashboard", icon: <MdDashboard /> },
    { key: "StaffPage", label: "Repayment Report", icon: <MdBarChart /> },
    { key: "LoanForms", label: "Loan Forms", icon: <MdEdit /> },
    { key: "ClientList", label: "Client List", icon: <MdFormatListBulleted /> },
    // You can add more flat items here
];

// --- Helper: Get a random staff avatar image URL ---
const getRandomAvatar = () => {
    const avatars = [
        "https://randomuser.me/api/portraits/men/1.jpg",
        "https://randomuser.me/api/portraits/women/2.jpg",
        "https://randomuser.me/api/portraits/men/3.jpg",
        "https://randomuser.me/api/portraits/women/4.jpg",
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
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

// --- Placeholder Component for missing routes ---
const Placeholder = ({ title }) => (
    <div className="p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800">
            {title} Page
        </h2>
        <p className="mt-2 text-gray-600">
            Content for the "{title}" component is under construction.
        </p>
    </div>
);

// --- Staff Panel Component ---
function StaffPanel() {
    const [activeTab, setActiveTab] = useState("StaffDashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [staffData, setStaffData] = useState(null);
    // State to hold the random image URL
    const [staffAvatar, setStaffAvatar] = useState(getRandomAvatar());

    // 1. Load logged-in staff data and set avatar
    useEffect(() => {
        const savedStaff = sessionStorage.getItem("staffData");
        if (savedStaff) {
            setStaffData(JSON.parse(savedStaff));
        }
        // Set a random avatar once on mount
        setStaffAvatar(getRandomAvatar());
    }, []);

    // Function to render the main navigation buttons (flat structure)
    const renderNavItems = (items) =>
        items.map((item) => (
            <Button
                key={item.key}
                variant={activeTab === item.key ? "default" : "ghost"}
                onClick={() => {
                    setActiveTab(item.key);
                    setSidebarOpen(false); // Close sidebar on mobile after selection
                }}
                className="w-full justify-start flex items-center gap-3 text-base py-2"
            >
                {item.icon} {item.label}
            </Button>
        ));

    // Function to render the main content area
    const renderContent = () => {
        switch (activeTab) {
            case "StaffDashboard":
                return <StaffDashboard />;
            case "StaffPage":
                return <StaffPage />;
            // Add cases for your other navigation keys
            case "LoanForms":
            case "ClientList":
            // case "AdminSignup": 
            // case "DataFormsPage": 
            // case "StudentReport":
                return <Placeholder title={activeTab} />;
            default:
                return <StaffDashboard />;
        }
    };

    const handleLogout = () => {
        // Implement your actual logout logic here (e.g., clearing session, redirect)
        sessionStorage.removeItem("staffData");
        window.location.href = "/login"; // Replace with your login route
    };

    const staffName = staffData?.fullName || "Staff Member";
    const branchName = staffData?.branchId || "N/A";

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <div
                className={`fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 border-r border-gray-200 shadow-xl transform transition-transform duration-300 
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:block flex flex-col`}
            >
                
                {/* Logo/Title */}
                <h2 className="text-3xl font-bold text-indigo-700 mb-6">Staff Panel</h2>

                {/* Staff Info Card */}
                <div className="flex items-center space-x-3 p-3 bg-indigo-50 rounded-lg mb-6">
                    <img
                        src={staffAvatar}
                        alt="Staff Avatar"
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-600"
                    />
                    <div>
                        <p className="font-semibold text-gray-800">{staffName}</p>
                        <p className="text-xs text-gray-600">Branch: {branchName}</p>
                    </div>
                </div>

                {/* Navigation Links (Flat) */}
                <div className="space-y-2 flex-grow">
                    {renderNavItems(NAV_ITEMS)}
                </div>

                {/* Logout Button (Fixed at Bottom) */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                     <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="w-full justify-start flex items-center gap-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        <MdExitToApp size={20} /> Logout
                    </Button>
                </div>
            </div>

            {/* Overlay on mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Main Content */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-100">
                {/* Toggle Button (mobile only) */}
                <div className="flex items-center justify-start mb-6 md:hidden">
                    <Button variant="default" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? "Close Menu" : "Open Menu"}
                    </Button>
                </div>

                {/* Content Rendering Area */}
                <div className="min-h-full">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}

export default StaffPanel;