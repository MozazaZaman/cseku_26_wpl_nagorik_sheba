import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './store/auth.jsx';
import { LangProvider } from './lib/i18n.jsx';
import { ThemeProvider } from './lib/theme.jsx';
import BackgroundFX from './components/BackgroundFX.jsx';
import AssistantWidget from './components/AssistantWidget.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import Explore from './pages/Explore.jsx';
import Emergency from './pages/Emergency.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Submit from './pages/Submit.jsx';
import ComplaintDetail from './pages/ComplaintDetail.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import PublicReviews from './pages/PublicReviews.jsx';
import TeamBadges from './pages/TeamBadges.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import FAQ from './pages/FAQ.jsx';
import AboutUs from './pages/AboutUs.jsx';

export default function App() {
  const location = useLocation();
  return (
    <ThemeProvider>
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
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/complaints/:id" element={<ComplaintDetail />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/reviews" element={<PublicReviews />} />
              <Route path="/staff/team-badges" element={<TeamBadges />} />
            </Routes>
          </AnimatePresence>
          <Footer />
          <AssistantWidget />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
