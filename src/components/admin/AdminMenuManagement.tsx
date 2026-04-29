import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Edit2, Trash2, X, Upload, Save, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  calories?: string;
  popular?: boolean;
  new?: boolean;
}

const AdminMenuManagement: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<MenuItem>>({ category: 'burgers', price: 0 });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const response = await fetch(`/api/menu?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const token = localStorage.getItem('king_burger_token');
      const response = await fetch(`/api/menu/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Item deleted');
        fetchMenu();
      }
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for base64 storage
        toast.error('Image is too large. Please use a smaller image (max 1MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentItem(prev => ({ ...prev, image: reader.result as string }));
        toast.success('Image uploaded successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Save process started');
    console.log('Current Item State:', currentItem);
    
    // Validate required fields manually to provide better feedback if browser validation fails
    if (!currentItem.name || !currentItem.description || currentItem.price === undefined) {
      console.warn('Validation failed: missing required fields');
      toast.error('Please fill in all required fields (Name, Description, Price)');
      return;
    }

    // Check both potential token locations during migration/transition
    const token = localStorage.getItem('king_burger_token') || localStorage.getItem('token');
    console.log('Token presence:', !!token);
    
    if (!token) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    const method = currentItem?.id ? 'PUT' : 'POST';
    const url = currentItem?.id ? `/api/menu/${currentItem.id}` : '/api/menu';
    
    // Ensure ID exists for POST (New items) and sanitize types
    const payload = { 
      ...currentItem,
      popular: !!currentItem?.popular,
      is_new: !!currentItem?.new, // Send as is_new to backend if needed, but backend handles 'new' mapping too
      price: parseFloat(currentItem?.price?.toString() || '0') || 0,
    };
    
    // Explicitly handle the 'new' field which is reserved
    if ('new' in (currentItem as any)) {
      (payload as any).new = !!(currentItem as any).new;
    }
    
    if (method === 'POST' && (!payload.id || payload.id === '')) {
      payload.id = 'prod-' + Date.now().toString(36);
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(`Product ${currentItem?.id ? 'updated' : 'created'} successfully!`, {
          description: `${payload.name} is now live on your menu.`
        });
        setIsModalOpen(false);
        fetchMenu();
      } else {
        const errData = await response.json().catch(() => ({ message: 'Server communication error' }));
        console.error('Save failed response:', errData);
        toast.error(errData.message || 'The server rejected this save. Please check your inputs.');
      }
    } catch (error) {
      console.error('Save network error:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text" 
            placeholder="Search menu items..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-all"
          />
        </div>
        <button 
          onClick={() => { setCurrentItem({ category: 'burgers' }); setIsModalOpen(true); }}
          className="bg-brand-yellow text-brand-black px-8 py-4 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Add New Item
        </button>
      </div>

      <div className="bg-white/5 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/5 font-black uppercase text-[10px] text-white/40 tracking-widest">
              <th className="px-8 py-6">Item</th>
              <th className="px-8 py-6">Category</th>
              <th className="px-8 py-6">Price</th>
              <th className="px-8 py-6">Status</th>
              <th className="px-8 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredItems.map((item) => (
              <tr key={item.id} className="group hover:bg-white/[0.02] transition-all">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">{item.name}</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase truncate max-w-[200px]">{item.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                   <span className="text-[10px] font-black uppercase bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-white/60">{item.category}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="text-brand-yellow font-black text-xs">${item.price.toFixed(2)}</span>
                </td>
                <td className="px-8 py-6">
                   <div className="flex gap-2">
                     {item.popular && <span className="w-2 h-2 rounded-full bg-brand-yellow" title="Popular"></span>}
                     {item.new && <span className="w-2 h-2 rounded-full bg-green-400" title="New"></span>}
                   </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                    <button 
                      onClick={() => { setCurrentItem(item); setIsModalOpen(true); }}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all shadow-xl"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-3 bg-brand-red/10 hover:bg-brand-red text-brand-red hover:text-white rounded-xl transition-all shadow-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="p-20 text-center">
             <p className="text-white/20 font-display uppercase italic text-2xl">No items found</p>
          </div>
        )}
      </div>

      <div className="mt-12 flex justify-center">
        <button 
          onClick={() => {
            setCurrentItem({ id: '', name: '', description: '', price: 0, category: 'burgers', image: '', calories: '', popular: false, new: true });
            setIsModalOpen(true);
          }}
          className="bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow px-12 py-5 rounded-2xl flex items-center gap-3 hover:bg-brand-yellow hover:text-brand-black transition-all group shadow-[0_15px_40px_rgba(255,200,0,0.05)] active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">Add Another Product</span>
        </button>
      </div>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-20">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-brand-dark rounded-[50px] border border-white/5 p-12 overflow-y-auto max-h-full custom-scrollbar"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-3xl font-display uppercase italic tracking-tighter mb-10">
                {currentItem?.id ? 'Edit Menu Item' : 'New Menu Item'}
              </h2>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Item Name</label>
                    <input 
                      required
                      value={currentItem?.name || ''}
                      onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-yellow transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Category</label>
                    <select
                      value={currentItem?.category || 'burgers'}
                      onChange={(e) => setCurrentItem({...currentItem, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-yellow transition-all appearance-none"
                    >
                      <option value="burgers">Burgers</option>
                      <option value="sides">Sides</option>
                      <option value="drinks">Drinks</option>
                      <option value="desserts">Desserts</option>
                      <option value="deals">Deals</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Description</label>
                  <textarea 
                    required
                    value={currentItem?.description || ''}
                    onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-yellow transition-all h-32 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Price ($) <span className="text-brand-yellow">*</span></label>
                    <input 
                      type="number" step="0.01" min="0" required
                      value={currentItem?.price ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                        setCurrentItem({...currentItem, price: val});
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-yellow transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Calories</label>
                    <input 
                      value={currentItem?.calories || ''}
                      onChange={(e) => setCurrentItem({...currentItem, calories: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-yellow transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-6 pt-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-md border-2 border-brand-yellow transition-all flex items-center justify-center ${currentItem?.popular ? 'bg-brand-yellow' : 'bg-transparent'}`}>
                        <Check className={`w-3 h-3 text-brand-black ${currentItem?.popular ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                      <input type="checkbox" className="hidden" checked={currentItem?.popular || false} onChange={(e) => setCurrentItem({...currentItem, popular: e.target.checked})} />
                      <span className="text-[10px] font-black uppercase">Popular</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded-md border-2 border-green-400 transition-all flex items-center justify-center ${currentItem?.new ? 'bg-green-400' : 'bg-transparent'}`}>
                        <Check className={`w-3 h-3 text-brand-black ${currentItem?.new ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                      <input type="checkbox" className="hidden" checked={currentItem?.new || false} onChange={(e) => setCurrentItem({...currentItem, new: e.target.checked})} />
                      <span className="text-[10px] font-black uppercase">New</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-2">Product Image</label>
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-32 h-32 rounded-3xl bg-white/5 border border-white/10 shrink-0 overflow-hidden relative group">
                      {currentItem?.image ? (
                        <img src={currentItem.image} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <Upload className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase text-white/20 tracking-widest pl-2">Or Paste Image URL</label>
                        <input 
                          value={currentItem?.image || ''}
                          onChange={(e) => setCurrentItem({...currentItem, image: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[10px] font-bold uppercase tracking-wider outline-none focus:border-brand-yellow transition-all"
                          placeholder="https://images.unsplash.com/..."
                        />
                      </div>
                      <p className="text-[8px] text-white/20 uppercase font-black tracking-widest leading-relaxed">
                        Recommended: Square image (1:1), max 1MB for direct uploads. 
                        Using URLs is better for large high-quality images.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-brand-yellow text-brand-black px-12 py-5 rounded-[24px] font-black uppercase text-xs tracking-widest hover:bg-white transition-all transform active:scale-[0.98] shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {isSaving ? 'Processing...' : (currentItem?.id ? 'Update Item' : 'Create Menu Item')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminMenuManagement;
