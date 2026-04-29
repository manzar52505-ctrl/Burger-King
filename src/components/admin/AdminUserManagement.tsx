import React, { useState, useEffect } from 'react';
import { db, collection, query, getDocs, doc, setDoc, deleteDoc, where, serverTimestamp } from '../../firebase';
import { UserPlus, UserMinus, Shield, Search, Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  addedAt: any;
}

const AdminUserManagement: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'admins'));
      const querySnapshot = await getDocs(q);
      const adminList: AdminUser[] = [];
      querySnapshot.forEach((doc) => {
        adminList.push({ id: doc.id, ...doc.data() } as AdminUser);
      });
      setAdmins(adminList);
    } catch (error) {
      console.error("Error fetching admins:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingEmail) return;

    setIsAdding(true);
    setMessage(null);

    try {
      // 1. Find user by email in 'users' collection
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', addingEmail.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Option 2: If user not found, we could add to a whitelist collection
        // But for now, let's assume they must be registered
        setMessage({ type: 'error', text: 'No registered user found with this email. They must sign up first.' });
        setIsAdding(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;

      // 2. Add to 'admins' collection
      await setDoc(doc(db, 'admins', userId), {
        email: addingEmail.toLowerCase().trim(),
        displayName: userData.displayName || 'Unnamed User',
        role: 'admin',
        addedAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: `${addingEmail} has been added as an admin.` });
      setAddingEmail('');
      fetchAdmins();
    } catch (error) {
      console.error("Error adding admin:", error);
      setMessage({ type: 'error', text: 'Failed to add admin. Please check your permissions.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAdmin = async (admin: AdminUser) => {
    if (admin.email === 'manzar52505@gmail.com') {
      alert("This is the root administrator and cannot be removed.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove admin privileges from ${admin.email}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'admins', admin.id));
      setAdmins(admins.filter(a => a.id !== admin.id));
      setMessage({ type: 'success', text: 'Admin removed successfully.' });
    } catch (error) {
      console.error("Error removing admin:", error);
      setMessage({ type: 'error', text: 'Failed to remove admin.' });
    }
  };

  const filteredAdmins = admins.filter(admin => 
    admin.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
    (admin.displayName && admin.displayName.toLowerCase().includes(searchEmail.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Add Admin Section */}
      <div className="bg-brand-dark rounded-[40px] border border-white/5 p-8">
        <h2 className="text-xl font-display uppercase italic mb-6 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-brand-yellow" />
          Add New Administrator
        </h2>
        
        <form onSubmit={handleAddAdmin} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="email" 
              placeholder="User's email address..."
              value={addingEmail}
              onChange={(e) => setAddingEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-sm focus:border-brand-yellow focus:ring-0 transition-all uppercase font-medium placeholder:text-white/20"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isAdding}
            className="bg-brand-yellow text-brand-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-w-[160px]"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Grant Access
          </button>
        </form>

        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mt-4 p-4 rounded-2xl flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-brand-red/10 text-brand-red border border-brand-red/20'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-wider">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Admin List Section */}
      <div className="bg-brand-dark rounded-[40px] border border-white/5 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-display uppercase italic flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-yellow" />
            Current Administrators
          </h2>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text" 
              placeholder="Search admins..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-12 py-3 text-xs w-full md:w-64 focus:border-brand-yellow focus:ring-0 transition-all uppercase font-medium placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-brand-yellow animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Loading team...</span>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-20 text-center text-white/20 italic font-medium">
              No administrators found matching your search.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40">Admin</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40">Role</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-brand-yellow border border-white/5">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase tracking-tight">{admin.displayName || 'Administrator'}</p>
                          <p className="text-[10px] text-white/40">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        admin.email === 'manzar52505@gmail.com' ? 'bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20' : 'bg-white/5 text-white/60 border border-white/10'
                      }`}>
                        {admin.email === 'manzar52505@gmail.com' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {admin.email !== 'manzar52505@gmail.com' && (
                        <button 
                          onClick={() => handleRemoveAdmin(admin)}
                          className="p-3 text-white/40 hover:text-brand-red hover:bg-brand-red/10 rounded-2xl transition-all"
                          title="Revoke Admin Access"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
