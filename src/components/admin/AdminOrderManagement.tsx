import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle2, Truck, Package, Search, ChevronDown, Filter, MapPin, Phone, User, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  total_price: number;
  delivery_address: string;
  contact_number: string;
  status: 'pending' | 'cooking' | 'delivered';
  created_at: string;
}

const AdminOrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'cooking' | 'delivered'>('all');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('king_burger_token');
      const response = await fetch('/api/orders/admin/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('king_burger_token');
      const response = await fetch(`/api/orders/admin/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        toast.success(`Order marked as ${status}`);
        fetchOrders();
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const filteredOrders = orders.filter(o => filter === 'all' || o.status === filter);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending': return { icon: Clock, color: 'text-brand-yellow', bg: 'bg-brand-yellow/10', border: 'border-brand-yellow/20', label: 'Processing' };
      case 'cooking': return { icon: Package, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', label: 'Cooking' };
      case 'delivered': return { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Delivered' };
      default: return { icon: Clock, color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/5', label: status };
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
          {['all', 'pending', 'cooking', 'delivered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f ? 'bg-brand-yellow text-brand-black shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={fetchOrders} className="text-[10px] font-black uppercase text-brand-yellow hover:white transition-all">Refresh feed</button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order, i) => {
            const config = getStatusConfig(order.status);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-all flex flex-col lg:flex-row gap-8 lg:items-center group"
              >
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${config.bg} ${config.color} ${config.border} border`}>
                      <config.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display uppercase italic tracking-tighter">Order #{order.order_number}</h3>
                      <p className="text-[10px] text-white/40 font-black uppercase tracking-wider">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="ml-auto lg:ml-0 lg:pl-6 lg:border-l lg:border-white/10 hidden sm:block">
                      <p className="text-[10px] text-white/40 font-black uppercase mb-1">Customer</p>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-brand-yellow" />
                        <span className="text-xs font-bold">{order.user_id ? 'Registered User' : 'Guest'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-white/40 font-black uppercase flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> Delivery Address
                      </p>
                      <p className="text-xs font-bold text-white/80">{order.delivery_address}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-white/40 font-black uppercase flex items-center gap-2">
                        <Phone className="w-3 h-3" /> Contact
                      </p>
                      <p className="text-xs font-bold text-white/80">{order.contact_number}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-4 lg:w-64 shrink-0 lg:pl-10 lg:border-l lg:border-white/5">
                  <div className="flex flex-col">
                    <p className="text-[10px] text-white/40 font-black uppercase mb-1">Status</p>
                    <div className="relative group/select">
                       <select 
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={`w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-yellow transition-all ${config.color}`}
                       >
                         <option value="pending">Processing</option>
                         <option value="cooking">Cooking</option>
                         <option value="delivered">Delivered</option>
                       </select>
                       <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none group-hover/select:text-brand-yellow transition-all" />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-end">
                    <p className="text-[10px] text-white/40 font-black uppercase mb-1">Total Bill</p>
                    <p className="text-2xl font-display uppercase italic text-brand-yellow">${parseFloat(order.total_price as any).toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="p-20 text-center bg-white/5 rounded-[40px] border border-white/5 border-dashed">
            <Package className="w-16 h-16 text-white/10 mx-auto mb-6" />
            <p className="text-white/20 font-display uppercase italic text-2xl">No orders in this category</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrderManagement;
