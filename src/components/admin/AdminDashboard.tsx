import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminSidebar from './AdminSidebar.tsx';
import AdminMenuManagement from './AdminMenuManagement.tsx';
import AdminOrderManagement from './AdminOrderManagement.tsx';
import AdminStats from './AdminStats.tsx';
import AdminUserManagement from './AdminUserManagement.tsx';
import { Bell, Search, User, Loader2, ShieldAlert } from 'lucide-react';
import { auth, db, doc, onSnapshot } from '../../firebase';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      setIsVerifying(false);
      setIsAuthorized(false);
      return;
    }

    // Double check with whitelist for the user who requested this
    if (auth.currentUser.email === 'manzar52505@gmail.com') {
      setIsAuthorized(true);
      setIsVerifying(false);
      return;
    }

    const adminRef = doc(db, 'admins', auth.currentUser.uid);
    const unsubscribe = onSnapshot(adminRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
      setIsVerifying(false);
    }, (err) => {
      console.error("Admin verification error:", err);
      setIsAuthorized(false);
      setIsVerifying(false);
    });

    return () => unsubscribe();
  }, []);

  if (isVerifying) {
    return (
      <div className="h-screen bg-brand-black flex flex-col items-center justify-center text-white p-10">
        <Loader2 className="w-12 h-12 text-brand-yellow animate-spin mb-6" />
        <p className="font-display uppercase tracking-widest text-xs">Verifying Credentials...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="h-screen bg-brand-black flex flex-col items-center justify-center text-white p-10 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mb-8 border border-red-500/30">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-4xl font-display uppercase mb-4 tracking-tight">Access Denied</h1>
        <p className="text-white/40 max-w-md mx-auto mb-10 text-sm font-modern">
          You do not have administrative privileges to access this area. If you believe this is an error, please contact the system administrator.
        </p>
        <button 
          onClick={onLogout}
          className="bg-white/10 hover:bg-white/20 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Return to Safety
        </button>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminStats />;
      case 'menu':
        return <AdminMenuManagement />;
      case 'orders':
        return <AdminOrderManagement />;
      case 'stats':
        return <AdminStats />; // Reusing stats for analytics
      case 'admins':
        return <AdminUserManagement />;
      default:
        return <AdminStats />;
    }
  };

  return (
    <div className="flex h-screen bg-brand-black text-white selection:bg-brand-yellow/30 font-sans overflow-hidden">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} />
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 shrink-0">
          <div>
            <h1 className="text-xl font-display uppercase italic tracking-tighter">
              {activeTab === 'dashboard' ? 'Overview' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-0.5">Welcome back, Admin</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
              <Search className="w-4 h-4 text-white/40" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none text-[10px] focus:ring-0 uppercase font-bold w-48 placeholder:text-white/20"
              />
            </div>
            
            <button className="relative p-2 hover:bg-white/5 rounded-full transition-all">
              <Bell className="w-5 h-5 text-white/60" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-red rounded-full border-2 border-brand-black"></span>
            </button>
            
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase">Admin Profile</p>
                <p className="text-[8px] text-brand-yellow uppercase font-bold">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-brand-yellow to-white/20 rounded-xl flex items-center justify-center border border-white/10">
                <User className="text-brand-black w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
