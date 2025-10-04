// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminPanel from "./Component/Admin/Admin";
import LoginPage from "./Component/Admin/LoginPage";
import PaymentDetails from "./Component/Load Details/PaymentDetails";
import BranchForm from "./Component/Admin/BranchForm";
import UserForm from "./Component/Admin/UserForm";
import UpdateLoanOutcome from "./Component/LoanApplicationForm";
import Staffpage from "./Component/StaffPage/staffpage";
import StaffPanel from "./Component/StaffPage/StaffPanel";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Default route goes to login */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/user" element={<UserForm />} />
        <Route path="/branch" element={<BranchForm />} />
        <Route path="/StaffPanel" element={<StaffPanel />} />


        {/* After login, go to dashboard */}
        <Route path="/dashboard" element={<AdminPanel />} />

        {/* Example: payment details page */}
        <Route path="/payments" element={<PaymentDetails />} />
      </Routes>
    </Router>
  );
}
