import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminPanel from "./Component/Admin/Admin";
import CeoControlPanel from "./Component/Admin/CeoControlPanel";
import LoginPage from "./Component/Admin/LoginPage";
import PaymentDetails from "./Component/Load Details/PaymentDetails";
import BranchForm from "./Component/Admin/BranchForm";
import UserForm from "./Component/Admin/UserForm";
import StaffPanel from "./Component/StaffPage/StaffPanel";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Login routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ceologin" element={<LoginPage />} />

        <Route path="/user" element={<UserForm />} />
        <Route path="/branch" element={<BranchForm />} />
        <Route path="/StaffPanel" element={<StaffPanel />} />

        {/* CEO Control Panel & Dashboard */}
        <Route path="/CeoControlPanel" element={<CeoControlPanel />} />
        <Route path="/dashboard" element={<AdminPanel />} />

        <Route path="/payments" element={<PaymentDetails />} />
      </Routes>
    </Router>
  );
}