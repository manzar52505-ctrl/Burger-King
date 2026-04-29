import React from 'react';
import { 
  BarChart3, 
  Settings, 
  Utensils, 
  ClipboardList, 
  LogOut, 
  LayoutDashboard,
  ChefHat,
  Bell,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'menu', label: 'Menu Management', icon: Utensils },
    { id: 'orders', label: 'Live Orders', icon: ClipboardList },
    { id: 'stats', label: 'Analytics', icon: BarChart3 },
    { id: 'admins', label: 'Team', icon: Users },
  ];

  return (
    <div className="w-64 h-full bg-brand-black border-r border-white/10 flex flex-col p-6">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-brand-yellow rounded-xl flex items-center justify-center">
          <ChefHat className="text-brand-black w-6 h-6" />
        </div>
        <div>
          <h2 className="font-display uppercase italic text-sm text-brand-yellow tracking-tighter">Royal Admin</h2>
          <p className="text-[10px] text-white/40 uppercase font-black">Control Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
              activeTab === item.id 
                ? 'bg-brand-yellow text-brand-black' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-wider">{item.label}</span>
            {item.id === 'orders' && (
               <span className="ml-auto bg-brand-red text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">3</span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-brand-red hover:bg-brand-red/10 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-wider text-brand-red">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
