import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './store/auth.jsx';
import { LangProvider } from './lib/i18n.jsx';
import BackgroundFX from './components/BackgroundFX.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import Explore from './pages/Explore.jsx';
import Emergency from './pages/Emergency.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Submit from './pages/Submit.jsx';
import ComplaintDetail from './pages/ComplaintDetail.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';

export default function App() {
  const location = useLocation();
  return (
    <LangProvider>
      <AuthProvider>
        <BackgroundFX />
        <Navbar />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/complaints/:id" element={<ComplaintDetail />} />
            <Route path="/staff" element={<StaffDashboard />} />
          </Routes>
        </AnimatePresence>
        <Footer />
      </AuthProvider>
    </LangProvider>
  );
}
