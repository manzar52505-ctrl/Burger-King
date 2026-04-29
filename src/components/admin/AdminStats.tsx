import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  popularItems: { name: string; sales: number; revenue: number }[];
  dailyStats: { name: string; orders: number; revenue: number }[];
  changes: {
    revenue: string;
    orders: string;
    customers: string;
  };
}

const AdminStats: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const token = localStorage.getItem('king_burger_token') || localStorage.getItem('token');
      try {
        const response = await fetch('/api/analytics', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-yellow animate-spin" />
      </div>
    );
  }

  const stats = [
    { 
      label: 'Total Revenue', 
      value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data?.totalRevenue || 0), 
      change: data?.changes.revenue || '+0%', 
      isUp: true, 
      icon: DollarSign, 
      color: 'text-brand-yellow' 
    },
    { 
      label: 'Total Orders', 
      value: data?.totalOrders.toLocaleString() || '0', 
      change: data?.changes.orders || '+0%', 
      isUp: true, 
      icon: ShoppingBag, 
      color: 'text-blue-400' 
    },
    { 
      label: 'Active Customers', 
      value: '842', // Mocked as we don't track sessions/logins yet
      change: data?.changes.customers || '+0%', 
      isUp: true, 
      icon: Users, 
      color: 'text-purple-400' 
    },
    { 
      label: 'Growth Rate', 
      value: '18.4%', 
      change: '+4.1%', 
      isUp: true, 
      icon: TrendingUp, 
      color: 'text-green-400' 
    },
  ];

  return (
    <div className="space-y-10">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${stat.isUp ? 'text-green-400' : 'text-brand-red'}`}>
                {stat.change}
                {stat.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              </div>
            </div>
            <h3 className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-1">{stat.label}</h3>
            <p className="text-2xl font-display uppercase italic">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 bg-white/5 rounded-3xl border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-sm font-display uppercase italic tracking-tighter">Daily Performance</h3>
            <select className="bg-brand-black text-[10px] font-black border border-white/10 rounded-full px-4 py-2 outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dailyStats}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FBFF00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FBFF00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#FBFF00', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#FBFF00" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                <Area type="monotone" dataKey="orders" name="Orders" stroke="#00A3FF" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 bg-white/5 rounded-3xl border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-sm font-display uppercase italic tracking-tighter">Popular Products</h3>
            <button className="text-[10px] font-black text-brand-yellow uppercase">View Full List</button>
          </div>
          <div className="space-y-6">
            {data?.popularItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-brand-yellow/10 rounded-lg flex items-center justify-center text-brand-yellow font-black text-xs">
                    #{i+1}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider">{item.name}</p>
                    <p className="text-[10px] text-white/40 font-bold uppercase">{item.sales} Units Sold</p>
                  </div>
                </div>
                <p className="text-brand-yellow font-black text-xs">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.revenue)}
                </p>
              </div>
            ))}
            {(!data?.popularItems || data.popularItems.length === 0) && (
              <div className="text-center py-10 text-white/20 uppercase font-black text-[10px] tracking-widest">
                No orders yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
