import React, { memo } from 'react';
import { motion } from 'motion/react';
import { ChefHat, Flame, Plus } from 'lucide-react';
import { MenuItem } from '../constants';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem, rect: DOMRect) => void;
  getTranslatedName: (item: MenuItem) => string;
  t: (key: string) => string;
  hasOrderedBefore?: boolean;
}

const MenuItemCard = ({ item, onSelect, getTranslatedName, t, hasOrderedBefore }: MenuItemCardProps) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -10 }}
      className="modern-card group flex flex-col"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={item.image} 
          alt={item.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 to-transparent" />
        
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {hasOrderedBefore && (
            <div className="bg-brand-black/60 backdrop-blur-md text-brand-yellow px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border border-brand-yellow/30 shadow-xl">
              <Star className="w-3 h-3 fill-current" /> Fast Choice
            </div>
          )}
          {item.popular && (
            <div className="bg-brand-yellow text-brand-black px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-lg">
              <Star className="w-3 h-3 fill-current" /> Popular
            </div>
          )}
          {item.new && (
            <div className="bg-brand-red text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-lg">
              NEW
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          {item.isVeg && (
            <div className="bg-green-500 p-1.5 rounded-lg shadow-lg">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
          )}
          {item.isSpicy && (
            <div className="bg-brand-red p-1.5 rounded-lg shadow-lg">
              <Flame className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-2xl tracking-tight leading-none group-hover:text-brand-yellow transition-colors">{getTranslatedName(item)}</h3>
          <span className="font-display text-2xl text-brand-yellow">${item.price}</span>
        </div>
        <p className="text-white/40 text-sm font-modern mb-6 line-clamp-2">
          {item.description}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/30">
            <Flame className="w-3 h-3" /> {item.calories} {t('calories') || 'KCAL'}
          </div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSelect(item, rect);
            }}
            className="bg-brand-red text-white px-4 py-2 rounded-xl font-display text-lg tracking-wide hover:bg-brand-red/90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> ADD
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default memo(MenuItemCard);
