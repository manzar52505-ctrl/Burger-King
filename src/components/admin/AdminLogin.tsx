import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChefHat, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { auth, googleProvider, signInWithPopup } from '../../firebase';

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Exchange Firebase auth for our server's JWT
        const response = await fetch('/api/auth/admin-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: result.user.email,
            uid: result.user.uid 
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          toast.success('Admin authenticated via Google');
          onLoginSuccess(data.token, data.user);
        } else {
          toast.error('SSO Failed', { description: data.message });
        }
      }
    } catch (error) {
      toast.error('Google Auth Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Simplified role check for demo: only certain emails or if role is admin
        // Ideally the DB has a 'role' column
        if (email.includes('admin') || data.user.role === 'admin') {
          toast.success('Admin access granted');
          onLoginSuccess(data.token, data.user);
        } else {
          toast.error('Access Denied', { description: 'You do not have administrator privileges.' });
        }
      } else {
        toast.error('Login Failed', { description: data.message });
      }
    } catch (error) {
      toast.error('Connection Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-yellow rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-white rounded-full blur-[120px] animate-pulse transition-delay-1000" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-brand-dark border border-white/5 p-12 rounded-[50px] shadow-2xl backdrop-blur-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-brand-yellow rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(251,255,0,0.2)]">
              <ChefHat className="text-brand-black w-8 h-8" />
            </div>
            <h1 className="text-3xl font-display uppercase italic tracking-tighter text-center">Royal Admin</h1>
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-2">Administrator Access Only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Admin Email</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@royalburger.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold tracking-wider outline-none focus:border-brand-yellow transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Security Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold tracking-wider outline-none focus:border-brand-yellow transition-all"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-yellow text-brand-black py-5 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all transform active:scale-[0.98] mt-4 shadow-xl"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Authenticate Access
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[8px] uppercase font-black"><span className="px-4 bg-brand-dark text-white/20 tracking-widest leading-none translate-y-[-2px]">Or Admin SSO</span></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full mt-6 bg-white/5 border border-white/10 text-white py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" className="w-4 h-4" alt="" />
            Continue with Google
          </button>

          <div className="mt-10 text-center">
            <p className="text-[8px] text-white/20 uppercase font-bold tracking-widest leading-loose">
              By accessing this area you agree to our internal security protocols. All activities are logged and monitored for quality assurance.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
