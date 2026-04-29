/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';

// Lazy load large components
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard.tsx'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin.tsx'));
const CheckoutForm = lazy(() => import('./components/CheckoutForm.tsx'));

import { 
  ShoppingBag, 
  Menu as MenuIcon, 
  X, 
  Plus, 
  Minus, 
  ChevronRight, 
  Star, 
  Flame, 
  Clock, 
  MapPin, 
  ArrowRight, 
  CheckCircle,
  Truck,
  CreditCard,
  ChefHat,
  Tag,
  Share2,
  Bell,
  Smartphone,
  Globe,
  Navigation,
  Search,
  List as ListIcon,
  Map as MapIcon,
  Phone,
  Heart,
  User,
  Printer,
  Download,
  FileText,
  Gift,
  Loader2,
  Lock,
  LogOut,
  History,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { toast, Toaster } from 'sonner';
import { MENU_ITEMS, MenuItem, CartItem, INGREDIENTS, Ingredient, DEALS, Deal, RESTAURANTS, Restaurant } from './constants';
import { translations, Language } from './translations';
import { analytics } from './services/analytics';
import { recommendationService } from './services/recommendationService';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import MenuItemCard from './components/MenuItemCard.tsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  updateDoc,
  onSnapshot, 
  testConnection, 
  FirebaseUser,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  handleFirestoreError,
  OperationType
} from './firebase';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

type FunnelStep = 'home' | 'menu' | 'deals' | 'locations' | 'rewards' | 'checkout' | 'confirmation' | 'account';

export default function App() {
  const [step, setStep] = useState<FunnelStep>('home');
  const [activeCategory, setActiveCategory] = useState<string>('burgers');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [customization, setCustomization] = useState<{ added: string[], removed: string[] }>({ added: [], removed: [] });
  const [itemQuantity, setItemQuantity] = useState(1);
  const [animatingItemId, setAnimatingItemId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 42, seconds: 15 });
  const [orderCount, setOrderCount] = useState(1284);
  const [filters, setFilters] = useState({
    vegOnly: false,
    spicyOnly: false,
    maxCalories: 3000
  });
  const [emailSubscribed, setEmailSubscribed] = useState(false);
  const [email, setEmail] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [deals, setDeals] = useState<Deal[]>(DEALS);
  const [categories, setCategories] = useState<string[]>(['burgers', 'sides', 'drinks', 'desserts', 'deals']);

  const [dealTimers, setDealTimers] = useState<Record<string, number>>(
    Object.fromEntries(deals.map(d => [d.id, d.expiresInSeconds]))
  );
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('burgerLanguage');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      // Small delay on initial attempt to ensure server is ready
      if (isAppLoading) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const ts = Date.now();
      try {
        const [menuRes, catRes, dealRes] = await Promise.all([
          fetch(`/api/menu?t=${ts}`),
          fetch(`/api/menu/categories?t=${ts}`),
          fetch(`/api/deals?t=${ts}`)
        ]);

        if (menuRes.ok) {
          const data = await menuRes.json();
          if (data && Array.isArray(data)) setMenuItems(data);
        }
        if (catRes.ok) {
          const data = await catRes.json();
          if (data && Array.isArray(data)) setCategories(data);
        }
        if (dealRes.ok) {
          const data = await dealRes.json();
          if (data && Array.isArray(data)) setDeals(data);
        }
      } catch (err) {
        console.error('Failed to fetch royal data:', err);
        // Silently retry on next interval
      }
    };

    fetchInitialData();

    // Poll for menu updates every 30 seconds
    const interval = setInterval(fetchInitialData, 30000);
    return () => clearInterval(interval);
  }, []);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 800], [1, 1.2]);

  useEffect(() => {
    localStorage.setItem('burgerLanguage', language);
  }, [language]);

  const t = (key: string) => {
    return (translations[language] as any)[key] || (translations['en'] as any)[key] || key;
  };

  const getTranslatedItemName = (item: MenuItem | CartItem) => {
    return (translations[language] as any)[item.id] || item.name;
  };
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

  const recommendations = useMemo(() => {
    return {
      personalized: recommendationService.getPersonalized(orderHistory, menuItems),
      frequentlyBoughtTogether: recommendationService.getFrequentlyBoughtTogether(cart, menuItems),
      trending: recommendationService.getTrending(menuItems)
    };
  }, [orderHistory, cart, menuItems]);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Restaurant | null>(RESTAURANTS[0]);
  const [user, setUser] = useState<FirebaseUser | any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', displayName: '' });
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is an admin
  useEffect(() => {
    if (user) {
      const adminRef = doc(db, 'admins', user.uid);
      getDocs(query(collection(db, 'admins'), where('__name__', '==', user.uid)))
        .then(snap => {
          if (!snap.empty || user.email === 'manzar52505@gmail.com') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        })
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [user]);
  const [isOrderProcessing, setIsOrderProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentInitError, setPaymentInitError] = useState<string | null>(null);

  const initPayment = async (amount: number) => {
    setPaymentInitError(null);
    setClientSecret(null);
    try {
      const response = await fetch('/api/payment/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (response.ok) {
        setClientSecret(data.clientSecret);
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      setPaymentInitError(error.message);
      toast.error("Failed to initialize payment", { description: error.message });
    }
  };
  const [showReceipt, setShowReceipt] = useState(false);
  
  // Form States
  const [checkoutData, setCheckoutData] = useState({
    fullName: '',
    phone: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const validateCheckout = () => {
    const errors: Record<string, string> = {};
    if (!checkoutData.fullName.trim()) errors.fullName = "Full name is required";
    if (!checkoutData.phone.trim()) errors.phone = "Phone number is required";
    else if (checkoutData.phone.replace(/\D/g, '').length < 10) errors.phone = "Invalid phone number";
    if (!checkoutData.address.trim()) errors.address = "Delivery address is required";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const [trackingStatus, setTrackingStatus] = useState<number>(0);
  const [flyingItem, setFlyingItem] = useState<{ x: number, y: number, image: string } | null>(null);
  const [trackingTime, setTrackingTime] = useState(1500); // 25 minutes in seconds
  const [activePopup, setActivePopup] = useState<'welcome' | 'exit' | 'deals' | null>(null);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [hasShownDeals, setHasShownDeals] = useState(false);

  useEffect(() => {
    let interval: any;
    if (step === 'confirmation' && trackingTime > 0) {
      interval = setInterval(() => {
        setTrackingTime(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, trackingTime]);

  useEffect(() => {
    // Welcome Popup - Much later, only for guests
    if (!isAppLoading && !hasShownWelcome && !user) {
      const timer = setTimeout(() => {
        setActivePopup('welcome');
        setHasShownWelcome(true);
      }, 30000); // 30 seconds delay
      return () => clearTimeout(timer);
    }
  }, [isAppLoading, hasShownWelcome, user]);

  useEffect(() => {
    // Exit Intent and Deals popups removed as they were intrusive
  }, []);

  useEffect(() => {
    // Simulated Initial Loading
    const timer = setTimeout(() => setIsAppLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (step === 'confirmation') {
      const interval = setInterval(() => {
        setTrackingStatus(prev => prev < 3 ? prev + 1 : prev);
      }, 10000); // Slower updates (10 seconds)
      return () => clearInterval(interval);
    } else {
      setTrackingStatus(0);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'confirmation') {
      const messages = [
        "Order Placed!",
        "Preparing your feast...",
        "On the way!",
        "Delivered! Enjoy, King!"
      ];
      
      // Only show toast for the final state or specific milestones to reduce noise
      if (trackingStatus === 0 || trackingStatus === 3) {
        toast.info(messages[trackingStatus], {
          icon: trackingStatus === 3 ? '👑' : undefined,
          description: `Order #${lastOrderNumber || 'BK-6117'}`
        });
      }
    }
  }, [trackingStatus, step, lastOrderNumber]);

  useEffect(() => {
    analytics.trackStep(step);
  }, [step]);

  // Test Firebase Connection & Initialize Auth
  useEffect(() => {
    testConnection();
    
    // Check for traditional session first
    const token = localStorage.getItem('king_burger_token');
    if (token) {
      // Decode user from token or fetch profile
      // For this demo, we'll try to sync with the sync endpoint but we need a saved user object
      const savedUser = localStorage.getItem('king_burger_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setUserData(parsedUser);
        
        // Fetch history from API
        fetch(`/api/orders/history/${parsedUser.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setOrderHistory(data);
        })
        .catch(console.error);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Sync user data
        const userRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeSnapshot = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserData(data);
            if (data.cart && cart.length === 0) {
              setCart(data.cart);
            }
          } else {
            // New user init
            const newUser = {
              userId: firebaseUser.uid, // Fix: mapping uid to userId for Firestore rules
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              points: 100, // 100 Welcome points!
              totalOrders: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            setDoc(userRef, newUser).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
            });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        // Load order history
        const ordersQuery = query(collection(db, 'orders'), where('userId', '==', firebaseUser.uid));
        getDocs(ordersQuery).then(snap => {
          setOrderHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(error => {
          handleFirestoreError(error, OperationType.LIST, 'orders');
        });

        return () => {
          unsubscribeSnapshot();
        };
      } else {
        setUserData(null);
        setOrderHistory([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    const loginToast = toast.loading("Connecting to the Kingdom...", {
      description: "Authenticating with Google"
    });
    
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome back, King!", { id: loginToast });
    } catch (error: any) {
      console.error("Login failed:", error);
      let message = "Could not authenticate. Please try again.";
      if (error.code === 'auth/popup-closed-by-user') message = "Sign-in cancelled.";
      if (error.code === 'auth/network-request-failed') message = "Network error. Check your connection.";
      
      toast.error("Access Denied", { 
        id: loginToast,
        description: message 
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleTraditionalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    
    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const authToast = toast.loading(authMode === 'signup' ? "Creating your account..." : "Entering the Kingdom...");

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('king_burger_token', data.token);
      localStorage.setItem('king_burger_user', JSON.stringify(data.user));
      setUser(data.user);
      setUserData(data.user);
      toast.success(authMode === 'signup' ? "Account created! Welcome, King!" : "Welcome back, King!", { id: authToast });
      setStep('home');
    } catch (error: any) {
      toast.error(error.message || "Something went wrong", { id: authToast });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('king_burger_token');
    localStorage.removeItem('king_burger_user');
    auth.signOut();
    setUser(null);
    setUserData(null);
    setIsAdminLoggedIn(false);
    setIsAdminMode(false);
    setStep('home');
    toast.success('Logged out successfully');
  };

  const handleAdminLogin = (token: string, userData: any) => {
    localStorage.setItem('king_burger_token', token);
    localStorage.setItem('king_burger_user', JSON.stringify(userData));
    setUser(userData);
    setUserData(userData);
    setIsAdminLoggedIn(true);
  };

  const handlePlaceOrder = async () => {
    if (isOrderProcessing) return;
    
    if (!validateCheckout()) {
      toast.error("Missing Information", {
        description: "Please fill in all delivery details correctly."
      });
      return;
    }

    setIsOrderProcessing(true);
    const orderToast = toast.loading("Flavor in Progress...", {
      description: "Securing your royal banquet"
    });

    const total = subtotal + 2.99;
    const orderId = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    setLastOrderNumber(orderId);
    
    analytics.trackConversion(orderId, total);
    
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('king_burger_token')}`
        },
        body: JSON.stringify({
          userId: user?.id || user?.uid, // Handle both traditional and firebase users if needed
          items: cart,
          total: total,
          orderNumber: orderId,
          deliveryDetails: checkoutData
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to secure your banquet");
      }

      // Update local state if necessary
      if (user) {
        // Refresh local user data or points
        const earnedPoints = Math.floor(subtotal * 10);
        setUserData(prev => prev ? { ...prev, points: (prev.points || 0) + earnedPoints } : null);
      }
      
      // Simulate payment processing delay for professionalism
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Banquet Secured!", { id: orderToast });
      setStep('confirmation');
      setCart([]); // Clear cart after success
    } catch (error: any) {
      console.error("Error placing order:", error);
      toast.error("The Kitchen is Overwhelmed", {
        id: orderToast,
        description: error.message || "Something went wrong. Your card was not charged."
      });
    } finally {
      setIsOrderProcessing(false);
    }
  };

  const handleLocateMe = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {
        // In a real app we'd filter by actual lat/lng
        setTimeout(() => setIsLocating(false), 1500);
      }, () => {
        setIsLocating(false);
        alert("Location permission denied.");
      });
    }
  };

  const filteredRestaurants = useMemo(() => {
    return RESTAURANTS.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDealTimers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          if (next[id] > 0) next[id] -= 1;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDealTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleShareDeal = (deal: Deal) => {
    if (navigator.share) {
      navigator.share({
        title: deal.title,
        text: `Check out this deal at King Burgers: ${deal.title}!`,
        url: window.location.href
      }).catch(console.error);
    } else {
      alert('Link copied to clipboard!');
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      const receiptElement = document.getElementById('digital-receipt');
      if (!receiptElement) {
        toast.error("Receipt element not found");
        return;
      }

      const downloadToast = toast.loading("Forging your royal document...");
      
      const canvas = await html2canvas(receiptElement, {
        scale: 3, // Higher resolution for crisp text
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: receiptElement.scrollWidth,
        height: receiptElement.scrollHeight,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('digital-receipt');
          if (el) {
            // Remove scroll constraints for the capture
            el.style.maxHeight = 'none';
            el.style.height = 'auto';
            el.style.overflow = 'visible';
            el.style.width = '500px'; // Force a standard width for the receipt look
            el.style.padding = '48px';
            
            // Safe fallback for any remaining oklch colors
            const allElements = el.getElementsByTagName("*");
            for (let i = 0; i < allElements.length; i++) {
              const node = allElements[i] as HTMLElement;
              const style = window.getComputedStyle(node);
              if (style.color.includes('oklch')) node.style.color = '#050505';
              if (style.backgroundColor.includes('oklch')) node.style.backgroundColor = 'transparent';
              if (style.borderColor.includes('oklch')) node.style.borderColor = '#e5e7eb';
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = 140; // Keeps it looking like a receipt in the center of A4
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const xOffset = (pageWidth - imgWidth) / 2;
      const yOffset = 20;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
      pdf.save(`KingBurger_Receipt_${lastOrderNumber || 'BK-6117'}.pdf`);
      
      toast.success("Receipt downloaded!", { id: downloadToast, description: "Your banquet record is saved." });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Download failed", { description: "The scribes were unable to finalize your receipt." });
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrderCount(prev => prev + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory = item.category === activeCategory;
      const matchesVeg = !filters.vegOnly || item.isVeg;
      const matchesSpicy = !filters.spicyOnly || item.isSpicy;
      const matchesCalories = item.calories <= filters.maxCalories;
      return matchesCategory && matchesVeg && matchesSpicy && matchesCalories;
    });
  }, [menuItems, activeCategory, filters]);

  // Calculate current price and calories for the selected item
  const currentTotal = useMemo(() => {
    if (!selectedItem) return { price: 0, calories: 0 };
    let price = selectedItem.price;
    let calories = selectedItem.calories;

    customization.added.forEach(id => {
      const ing = INGREDIENTS.find(i => i.id === id);
      if (ing) {
        price += ing.price;
        calories += ing.calories;
      }
    });

    customization.removed.forEach(id => {
      const ing = INGREDIENTS.find(i => i.id === id);
      if (ing) {
        calories -= ing.calories;
      }
    });

    return { price: price * itemQuantity, calories: calories * itemQuantity };
  }, [selectedItem, customization, itemQuantity]);

  // Persist cart to Firestore
  useEffect(() => {
    if (user && cart.length > 0 && auth.currentUser) {
      const currentUid = auth.currentUser.uid;
      const userRef = doc(db, 'users', currentUid);
      updateDoc(userRef, {
        cart: cart,
        updatedAt: serverTimestamp()
      }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUid}`);
      });
    }
  }, [cart, user]);

  const addToCartWithCustomization = () => {
    if (!selectedItem) return;
    const cartId = `${selectedItem.id}-${Date.now()}`;
    const cartItem: CartItem = {
      ...selectedItem,
      price: currentTotal.price / itemQuantity, // Base unit price with customization
      calories: currentTotal.calories / itemQuantity,
      cartId,
      quantity: itemQuantity,
      customizations: { ...customization }
    };
    setCart(prev => [...prev, cartItem]);
    toast.success(`Added ${selectedItem.name} to cart!`, {
      description: "Customize more or head to checkout."
    });
    analytics.track({ 
      type: 'ADD_TO_CART', 
      itemId: selectedItem.id, 
      name: selectedItem.name, 
      price: currentTotal.price / itemQuantity 
    });
    setAnimatingItemId(selectedItem.id);
    setTimeout(() => setAnimatingItemId(null), 600);
    setSelectedItem(null);
    setCustomization({ added: [], removed: [] });
    setItemQuantity(1);
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const [checkoutSubStep, setCheckoutSubStep] = useState<'details' | 'payment'>('details');

  // Smart Suggestions helper
  const addToCartFromRecs = (item: MenuItem) => {
    const cartId = `rec-${item.id}-${Date.now()}`;
    setCart(prev => [...prev, { ...item, cartId, quantity: 1, customizations: { added: [], removed: [] } }]);
    toast.success(`Great choice! ${item.name} added.`, {
      description: "Your banquet just got better."
    });
    analytics.track({ type: 'ADD_TO_CART', itemId: item.id, name: item.name, price: item.price });
  };

  // Auto-scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, checkoutSubStep]);

  if (isAdminMode) {
    if (!isAdminLoggedIn) {
      return (
        <div className="relative">
        <Suspense fallback={
          <div className="min-h-screen bg-brand-black flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-yellow animate-spin" />
          </div>
        }>
          <AdminLogin onLoginSuccess={handleAdminLogin} />
        </Suspense>
          <button 
            onClick={() => setIsAdminMode(false)}
            className="fixed top-6 left-6 text-white/40 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest z-[150]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Restaurant
          </button>
        </div>
      );
    }
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-brand-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-yellow animate-spin" />
        </div>
      }>
        <AdminDashboard onLogout={handleLogout} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-white selection:bg-brand-red selection:text-white pb-20 lg:pb-0">
      <Toaster position="top-right" expand={true} richColors closeButton theme="dark" />
      
      {/* Fly to Cart Animation */}
      <AnimatePresence>
        {flyingItem && (
          <motion.img
            src={flyingItem.image}
            initial={{ 
              position: 'fixed',
              left: flyingItem.x,
              top: flyingItem.y,
              width: 100,
              height: 100,
              zIndex: 1000,
              borderRadius: 20
            }}
            animate={{ 
              left: window.innerWidth > 1024 ? window.innerWidth - 100 : window.innerWidth - 60,
              top: 20,
              scale: 0.2,
              opacity: [1, 1, 0]
            }}
            transition={{ duration: 0.8, ease: "circIn" }}
            onAnimationComplete={() => setFlyingItem(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAppLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-brand-black flex flex-col items-center justify-center p-4"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-8xl mb-8"
            >
              👑
            </motion.div>
            <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden relative">
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="absolute inset-0 bg-brand-yellow w-1/2 rounded-full"
              />
            </div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/40">{t('preparing') || 'Preparing the Kingdom'}</p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-brand-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => step !== 'home' ? setStep('home') : null}
              className="font-display text-4xl tracking-tighter cursor-pointer"
            >
              KING<span className="text-brand-yellow">BURGERS</span>
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { name: t('menu'), step: 'menu', original: 'Menu' },
              { name: t('deals'), step: 'deals', original: 'Deals' },
              { name: t('locations'), step: 'locations', original: 'Locations' },
              { name: t('rewards'), step: 'rewards', original: 'Rewards' }
            ].map((link) => (
              <motion.button 
                key={link.original} 
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`font-modern uppercase text-xs tracking-widest font-bold transition-all relative ${step === link.step ? 'text-brand-yellow opacity-100' : 'opacity-60 hover:opacity-100'}`}
                onClick={() => setStep(link.step as FunnelStep)}
              >
                {link.name}
                {step === link.step && (
                  <motion.div 
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-brand-yellow rounded-full"
                  />
                )}
              </motion.button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setLanguage(prev => prev === 'en' ? 'ru' : 'en')}
              className="p-3 bg-brand-dark rounded-2xl border border-white/10 hover:border-brand-yellow/50 transition-all group flex items-center gap-2"
              title={t('language')}
            >
              <Globe className="w-5 h-5 text-brand-yellow group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">{language}</span>
            </motion.button>

            {user ? (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep('account')}
                className="flex items-center gap-3 bg-brand-dark px-4 py-2 rounded-2xl border border-white/5 hover:border-brand-yellow/30 transition-all"
              >
                <img 
                  src={user.photoURL || ''} 
                  className="w-8 h-8 rounded-full border border-white/10" 
                  alt="" 
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left hidden sm:block">
                  <span className="block text-[10px] font-black uppercase tracking-widest leading-none mb-1">{user.displayName?.split(' ')[0]}</span>
                  <span className="block text-[10px] text-brand-yellow font-bold leading-none">{userData?.points || 0} PTS</span>
                </div>
              </motion.button>
            ) : (
              <button 
                onClick={handleLogin}
                className="hidden sm:flex items-center gap-2 bg-brand-yellow text-brand-black px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                {t('signIn')}
              </button>
            )}
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 bg-brand-dark rounded-2xl border border-white/10 hover:border-brand-yellow/50 transition-all group"
            >
              <ShoppingBag className="w-5 h-5 text-brand-yellow group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-red text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-brand-black">
                  {totalItems}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Funnel */}
      <main className="max-w-7xl mx-auto px-4">
        <AnimatePresence mode="wait">
          {step === 'home' && (
            <div key="home-full" className="flex flex-col gap-24 py-12">
              <motion.section 
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ opacity: heroOpacity }}
                className="relative min-h-[95vh] flex items-center justify-center text-center -mx-4 px-4 overflow-hidden rounded-[4rem]"
              >
                {/* Immersive Background */}
                <motion.div 
                  className="absolute inset-0 z-0"
                  style={{ y: heroY, scale: heroScale }}
                >
                  <img 
                    src="https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=2000" 
                    alt="Sizzling Cinematic Burger"
                    className="w-full h-full object-cover scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-brand-black/80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-brand-black/60" />
                  <div className="absolute inset-0 cinematic-overlay" />
                </motion.div>
   
                <div className="relative z-10 w-full max-w-4xl mx-auto">
                  <motion.div 
                    className="flex flex-col items-center"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex items-center gap-2 px-3 py-1 bg-brand-red text-brand-black font-bold text-[10px] tracking-widest uppercase rounded-lg w-fit mb-6 mx-auto">
                      <Clock className="w-3 h-3" /> {t('flashDeal') || 'Flash Deal Ending'}: 
                      <span className="font-modern">
                        {String(timeLeft.hours).padStart(2, '0')}:
                        {String(timeLeft.minutes).padStart(2, '0')}:
                        {String(timeLeft.seconds).padStart(2, '0')}
                      </span>
                    </div>
 
                    <h1 className="text-5xl md:text-8xl font-display leading-none mb-6 italic">
                      {user ? (
                        <>{t('welcomeBack') || 'WELCOME BACK'}<br /> <span className="text-brand-red font-black">{user.displayName?.split(' ')[0].toUpperCase()}</span></>
                      ) : (
                        <>CRUNCH <br /><span className="text-brand-red">MEETS</span> <br />FLAME.</>
                      )}
                    </h1>
                    
                    <p className="text-xl text-white/70 mb-10 mx-auto font-modern leading-relaxed text-balance">
                      Experience the legendary crunch of our signature flame-grilled patties. Limited time only.
                    </p>

                    {user && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-brand-dark/80 backdrop-blur-md p-6 rounded-3xl border border-white/10 mb-10 max-w-lg group cursor-pointer hover:border-brand-yellow/30 transition-all"
                        onClick={() => setStep('rewards')}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-yellow mb-1 block">Your Kingdom</span>
                            <h4 className="text-2xl font-display uppercase italic">The King's Bounty</h4>
                          </div>
                          <div className="text-right">
                             <span className="text-3xl font-display text-brand-yellow">{userData?.points || 0}</span>
                             <span className="text-[10px] block font-bold uppercase text-white/40">Points</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(((userData?.points || 0) / 1000) * 100, 100)}%` }}
                            className="h-full bg-brand-yellow"
                          />
                        </div>
                        <p className="text-[9px] font-modern text-white/40 mt-3 uppercase tracking-widest">
                          {Math.max(1000 - (userData?.points || 0), 0)} PTS UNTIL YOUR NEXT <span className="text-white">FREE WHOPPER</span>
                        </p>
                      </motion.div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                      <motion.button 
                        whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(215, 25, 33, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setStep('menu')}
                        className="btn-primary !px-12 !py-6 text-3xl shadow-2xl bg-brand-red shadow-brand-red/40 animate-bounce-subtle"
                      >
                        {t('orderNow')}
                      </motion.button>

                      {/* Delivery/Pickup Toggle */}
                      <div className="bg-brand-dark/80 backdrop-blur-md p-1 rounded-2xl border border-white/10 flex mx-auto sm:mx-0">
                        <button 
                          onClick={() => setOrderType('delivery')}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${orderType === 'delivery' ? 'bg-brand-red text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                          <Truck className="w-4 h-4" /> {t('delivery')}
                        </button>
                        <button 
                          onClick={() => setOrderType('pickup')}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${orderType === 'pickup' ? 'bg-brand-red text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                          <MapPin className="w-4 h-4" /> {t('pickup')}
                        </button>
                      </div>
                    </div>

                    {user && orderHistory.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                        className="mt-16"
                      >
                        <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6 font-modern">Your Favorite Feasts</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {orderHistory.slice(0, 3).map((order) => (
                            <motion.button
                              key={order.id}
                              whileHover={{ y: -5, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const newItems = (order.items || []).map((item: any) => ({
                                  ...item,
                                  cartId: Math.random().toString(36).substr(2, 9)
                                }));
                                setCart([...cart, ...newItems]);
                                setIsCartOpen(true);
                              }}
                              className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl transition-all text-left flex flex-col gap-2 group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                  <img src={order.items[0]?.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-white/40 font-modern uppercase">Order #{order.orderNumber}</span>
                                    <ArrowRight className="w-3 h-3 text-brand-yellow transition-transform group-hover:translate-x-1" />
                                  </div>
                                  <span className="text-xs font-display uppercase tracking-wider truncate">
                                    {order.items[0]?.name} {order.items.length > 1 ? `& ${order.items.length - 1} more` : ''}
                                  </span>
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.section>

            {/* Cinematic Quote Section */}
            <motion.section 
              initial={{ opacity: 0, y: 100 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="py-32 text-center border-y border-white/5 relative"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-24 bg-gradient-to-t from-brand-yellow to-transparent" />
              <div className="max-w-4xl mx-auto px-6">
                <span className="text-brand-yellow font-display text-xl tracking-[0.4em] uppercase mb-10 block font-black">King's Philosophy</span>
                <blockquote className="text-4xl md:text-7xl font-display uppercase italic leading-tight mb-16">
                  "Flame-grilled is not just a method. It's a <span className="text-brand-red">legacy</span> of flavor that <span className="text-reveal">defines</span> the <span className="text-brand-yellow underline decoration-brand-red underline-offset-[12px]">banquet</span>."
                </blockquote>
                <div className="flex items-center justify-center gap-4 mb-4">
                   <div className="w-12 h-px bg-white/10" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Since 1954 • Royal Kitchens</p>
                   <div className="w-12 h-px bg-white/10" />
                </div>
              </div>
            </motion.section>

            {/* Immersive Feature Split */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 min-h-[80vh]">
               <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative group rounded-[4rem] overflow-hidden cursor-pointer"
                onClick={() => setStep('menu')}
               >
                 <img 
                  src="https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&q=80&w=1200" 
                  alt="Premium Ingredients" 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent" />
                 <div className="absolute inset-0 bg-brand-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                      <Plus className="w-8 h-8 text-white" />
                    </div>
                 </div>
                 <div className="absolute bottom-16 left-16 right-16">
                    <span className="text-brand-yellow font-display text-2xl tracking-widest uppercase mb-4 block">Premium Sourcing</span>
                    <h3 className="text-6xl font-display uppercase leading-none mb-6 italic">100% Wagyu <br />Beef Patties</h3>
                    <div className="h-0.5 w-0 group-hover:w-full bg-brand-yellow transition-all duration-500" />
                 </div>
               </motion.div>

               <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative group rounded-[4rem] overflow-hidden cursor-pointer"
                onClick={() => setStep('menu')}
               >
                 <img 
                  src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&q=80&w=1200" 
                  alt="Artisanal Buns" 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent" />
                 <div className="absolute inset-0 bg-brand-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                      <Plus className="w-8 h-8 text-white" />
                    </div>
                 </div>
                 <div className="absolute bottom-16 left-16 right-16">
                    <span className="text-brand-yellow font-display text-2xl tracking-widest uppercase mb-4 block">Hand-Crafted</span>
                    <h3 className="text-6xl font-display uppercase leading-none mb-6 italic">Freshly Baked <br />Brioche Buns</h3>
                    <div className="h-0.5 w-0 group-hover:w-full bg-brand-yellow transition-all duration-500" />
                 </div>
               </motion.div>
            </section>

            {/* Newsletter & Immersive Close */}
            <motion.section 
               initial={{ opacity: 0, y: 100 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               className="relative py-32 rounded-[5rem] overflow-hidden bg-brand-dark border border-white/5 text-center px-6"
            >
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 gold-shimmer" />
                </div>
                <div className="relative z-10 max-w-3xl mx-auto">
                  <motion.div
                    animate={{ 
                      y: [0, -10, 0],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ repeat: Infinity, duration: 4 }}
                  >
                    <ChefHat className="w-20 h-20 text-brand-yellow mx-auto mb-10" />
                  </motion.div>
                  <h2 className="text-7xl font-display uppercase italic mb-8">Join the <span className="text-brand-yellow">Royal Circle</span></h2>
                  <p className="text-xl text-white/60 mb-12 font-modern text-balance">Get exclusive first access to seasonal banquet drops, secret menu items, and royal invites.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-6 max-w-xl mx-auto">
                    <input 
                      type="email" 
                      placeholder="KING@PALACE.DOM" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-grow bg-brand-black border border-white/10 rounded-3xl px-8 py-5 outline-none focus:border-brand-yellow transition-all uppercase font-bold text-xs tracking-[0.3em] font-modern"
                    />
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (validateEmail(email)) {
                          setEmailSubscribed(true);
                          toast.success("Welcome to the Circle", { description: "You're on the list, King." });
                        } else {
                          toast.error("Invalid Email", { description: "Please provide a valid royal address." });
                        }
                      }}
                      className="bg-brand-red text-white font-display text-2xl px-16 py-5 rounded-3xl shadow-2xl shadow-brand-red/40"
                    >
                      INVITE ME
                    </motion.button>
                  </div>
                </div>
            </motion.section>
          </div>
        )}

        {step === 'menu' && (
            <motion.section 
              key="menu"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="funnel-step py-8"
            >
              <div className="flex flex-col mb-12 gap-8">
                {/* Smart Recommendations Section */}
                {recommendations.personalized.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1.5 h-6 bg-brand-yellow rounded-full" />
                      <h2 className="text-2xl font-display uppercase tracking-tight">
                        {orderHistory.length > 0 ? 'Recommended For You' : 'Trending Now'}
                      </h2>
                    </div>
                    <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                      {recommendations.personalized.map((item) => (
                        <motion.div
                          key={`rec-${item.id}`}
                          whileHover={{ y: -5 }}
                          className="min-w-[280px] sm:min-w-[320px] bg-brand-dark rounded-3xl border border-white/5 overflow-hidden group cursor-pointer"
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="relative aspect-[16/9]">
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-transparent" />
                            <div className="absolute top-3 left-3 bg-brand-yellow/90 backdrop-blur-md text-brand-black text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> Personalized
                            </div>
                          </div>
                          <div className="p-4 flex items-center justify-between">
                            <div>
                               <h3 className="font-display text-lg uppercase tracking-tight group-hover:text-brand-yellow transition-colors">{getTranslatedItemName(item)}</h3>
                               <p className="text-[10px] text-white/40 font-modern uppercase tracking-widest">{item.calories} {t('calories') || 'KCAL'}</p>
                            </div>
                            <span className="text-xl font-display text-brand-yellow">${item.price}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h2 className="text-5xl font-display uppercase tracking-tight mb-2">The Culinary <span className="text-brand-yellow">Collection</span></h2>
                    <p className="text-white/40 font-modern">Select your favorites and customize them to perfection.</p>
                  </div>
                  
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none bg-brand-dark/50 p-2 rounded-2xl border border-white/5">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          analytics.track({ type: 'MENU_INTERACT', category: cat });
                        }}
                        className={`px-6 py-3 rounded-xl font-display text-xl transition-all whitespace-nowrap relative ${
                          activeCategory === cat 
                            ? 'text-brand-black' 
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {activeCategory === cat && (
                          <motion.div 
                            layoutId="active-cat"
                            className="absolute inset-0 bg-brand-yellow rounded-xl -z-10"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        {t(cat).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-6 p-6 bg-brand-dark rounded-3xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setFilters(prev => ({ ...prev, vegOnly: !prev.vegOnly }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${filters.vegOnly ? 'bg-green-500/20 border-green-500 text-green-500' : 'border-white/10 text-white/40'}`}
                    >
                      <ChefHat className="w-3 h-3" /> {t('veg') || 'Veg Only'}
                    </button>
                    <button 
                      onClick={() => setFilters(prev => ({ ...prev, spicyOnly: !prev.spicyOnly }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${filters.spicyOnly ? 'bg-brand-red/20 border-brand-red text-brand-red' : 'border-white/10 text-white/40'}`}
                    >
                      <Flame className="w-3 h-3" /> {t('spicy') || 'Spicy'}
                    </button>
                  </div>

                  <div className="flex-grow flex items-center gap-4 min-w-[200px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 whitespace-nowrap">{t('calories') || 'Calories'}: {filters.maxCalories}</span>
                    <input 
                      type="range" 
                      min="100" 
                      max="3000" 
                      step="50"
                      value={filters.maxCalories}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxCalories: parseInt(e.target.value) }))}
                      className="w-full accent-brand-yellow bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="text-[10px] uppercase font-bold tracking-widest text-white/20">
                    Showing {filteredItems.length} items
                  </div>
                </div>
              </div>

              <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => {
                    const hasOrderedBefore = orderHistory.some(order => 
                      (order.items || []).some((orderItem: any) => orderItem.id === item.id)
                    );
                    
                    return (
                      <MenuItemCard 
                        key={item.id}
                        item={item}
                        hasOrderedBefore={hasOrderedBefore}
                        onSelect={(selected, rect) => {
                          setFlyingItem({
                            x: rect.left,
                            y: rect.top,
                            image: selected.image
                          });
                          setSelectedItem(selected);
                        }}
                        getTranslatedName={getTranslatedItemName}
                        t={t}
                      />
                    );
                  })}
              </AnimatePresence>
                {filteredItems.length === 0 && (
                  <div className="col-span-full py-24 text-center opacity-40">
                    <ChefHat className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-display text-4xl uppercase">No items found</p>
                    <button 
                      onClick={() => setFilters({ vegOnly: false, spicyOnly: false, maxCalories: 3000 })}
                      className="text-brand-yellow underline mt-4 font-modern"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.section>
          )}

          {step === 'deals' && (
            <motion.section 
              key="deals"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="funnel-step py-12"
            >
              <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                <div>
                  <h2 className="text-6xl font-display uppercase italic tracking-tighter leading-none mb-4">
                    ROYAL <span className="text-brand-yellow">OFFERS</span>
                  </h2>
                  <p className="text-white/40 font-modern max-w-md">Exclusive savings for the King\'s loyal subjects. Act fast—these won\'t last forever.</p>
                </div>
                <div className="bg-brand-red/10 border border-brand-red/30 px-6 py-4 rounded-3xl flex items-center gap-4 animate-pulse">
                  <Bell className="w-6 h-6 text-brand-yellow" />
                  <div className="text-xs font-bold font-modern uppercase tracking-widest text-brand-red">
                    NEW DEAL DROPPING IN: 04:12:09
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-24">
                {deals.map((deal) => (
                  <motion.div 
                    key={deal.id}
                    className="modern-card group flex flex-col h-full bg-brand-grey/50 hover:scale-[1.02]"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img 
                        src={deal.image} 
                        alt={deal.title} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-black pr-4 pb-4 flex items-end justify-end" />
                      
                      {deal.isAppOnly ? (
                        <div className="absolute top-4 left-4 bg-brand-yellow text-brand-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-brand-yellow/20">
                          <Smartphone className="w-3 h-3" /> APP ONLY
                        </div>
                      ) : (
                        <div className="absolute top-4 left-4 bg-white text-brand-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Globe className="w-3 h-3" /> WEB & APP
                        </div>
                      )}

                      <div className="absolute top-4 right-4 bg-brand-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                        <Clock className="w-3 h-3 text-brand-red" />
                        <span className="text-[10px] font-bold font-modern">{formatDealTime(dealTimers[deal.id] || 0)}</span>
                      </div>
                    </div>

                    <div className="p-8 flex flex-col flex-grow">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-4xl font-display text-brand-yellow">${deal.discountPrice.toFixed(2)}</span>
                        <span className="text-lg font-display text-white/20 line-through">${deal.originalPrice.toFixed(2)}</span>
                        <div className="ml-auto bg-brand-red/20 text-brand-red px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                          -{Math.round((1 - deal.discountPrice/deal.originalPrice)*100)}%
                        </div>
                      </div>

                      <h3 className="text-3xl font-display uppercase tracking-tight mb-4 group-hover:text-brand-yellow transition-colors">{deal.title}</h3>
                      <p className="text-white/40 text-sm font-modern mb-8 line-clamp-2">{deal.description}</p>

                      <div className="mt-auto flex gap-3">
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setStep('menu');
                            analytics.track({ type: 'DEAL_CLAIM', dealId: deal.id });
                          }}
                          className="btn-secondary !py-3 flex-grow text-xl"
                        >
                          CLAIM & ORDER
                        </motion.button>
                        <button 
                          onClick={() => handleShareDeal(deal)}
                          className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-colors border border-white/10"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Email Capture Section */}
              <div className="relative overflow-hidden bg-brand-yellow rounded-[40px] p-12 lg:p-24 text-brand-black">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Tag className="w-64 h-64 -rotate-12" />
                </div>

                <div className="relative z-10 max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div>
                    <h2 className="text-5xl lg:text-7xl font-display uppercase italic leading-[0.85] mb-8">
                      DON\'T MISS <br />
                      A SINGLE <br />
                      <span className="text-brand-red">DROP.</span>
                    </h2>
                    <p className="font-modern font-bold text-lg opacity-80 max-w-sm">
                      Be the first to know about exclusive drops, secret menu items, and app-only deals.
                    </p>
                  </div>

                   <div className="bg-brand-black/5 p-8 rounded-[32px] backdrop-blur-sm border border-brand-black/5">
                    {emailSubscribed ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-6"
                      >
                        <div className="w-20 h-20 bg-brand-red rounded-full flex items-center justify-center mx-auto mb-6">
                          <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h4 className="text-3xl font-display mb-2 uppercase">WELCOME TO THE COURT</h4>
                        <p className="text-sm font-modern opacity-60">Check your inbox for a special 50% discount code.</p>
                      </motion.div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold tracking-widest ml-2 opacity-40">Your Royal Email</label>
                          <input 
                            type="email" 
                            placeholder="king@palace.com"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (formErrors.subscriptionEmail) setFormErrors(prev => ({ ...prev, subscriptionEmail: '' }));
                            }}
                            className={`w-full bg-brand-black/90 text-white border-2 ${formErrors.subscriptionEmail ? 'border-brand-red' : 'border-transparent'} rounded-2xl px-6 py-4 outline-none focus:border-brand-red transition-all`}
                          />
                          {formErrors.subscriptionEmail && <p className="text-[10px] text-brand-red ml-2 uppercase font-bold">{formErrors.subscriptionEmail}</p>}
                        </div>
                        <button 
                          onClick={() => {
                            if (validateEmail(email)) {
                              setEmailSubscribed(true);
                              toast.success("Subscribed!", { description: "You are now part of the royal circle." });
                            } else {
                              setFormErrors(prev => ({ ...prev, subscriptionEmail: 'Invalid email address' }));
                              toast.error("Invalid Email", { description: "Please enter a valid royal email." });
                            }
                          }}
                          className="w-full bg-brand-red text-white py-4 rounded-2xl font-display text-2xl tracking-wide hover:shadow-xl hover:shadow-brand-red/20 active:scale-95 transition-all"
                        >
                          SUBSCRIBE FOR DEALS
                        </button>
                        <div className="flex items-center justify-center gap-4 opacity-40">
                          <Smartphone className="w-4 h-4" />
                          <span className="text-[9px] uppercase font-bold tracking-widest italic">Join 10,000+ others</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {step === 'locations' && (
            <motion.section 
              key="locations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="funnel-step py-12"
            >
              <div className="flex flex-col lg:flex-row gap-8 min-h-[70vh]">
                {/* Search & List Panel */}
                <div className="w-full lg:w-[400px] flex flex-col gap-6">
                  <div className="space-y-4">
                    <h2 className="text-4xl font-display uppercase italic tracking-tighter">Find a <span className="text-brand-yellow">Restaurant</span></h2>
                    
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input 
                        type="text" 
                        placeholder="Enter City or Zip"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-brand-dark border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-brand-yellow transition-colors"
                      />
                    </div>

                    <button 
                      onClick={handleLocateMe}
                      disabled={isLocating}
                      className={`w-full flex items-center justify-center gap-2 py-4 bg-brand-red/10 border border-brand-red/20 rounded-2xl text-brand-red text-[10px] font-black uppercase tracking-widest hover:bg-brand-red/20 transition-all ${isLocating ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      {isLocating ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-brand-red border-t-transparent rounded-full"
                        />
                      ) : (
                        <Navigation className="w-3 h-3" />
                      )}
                      {isLocating ? 'Locating...' : 'Use My Current Location'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 p-1 bg-brand-dark rounded-xl border border-white/5 lg:hidden">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`flex-grow flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === 'list' ? 'bg-white/10' : 'opacity-40'}`}
                    >
                      <ListIcon className="w-3 h-3" /> List
                    </button>
                    <button 
                      onClick={() => setViewMode('map')}
                      className={`flex-grow flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === 'map' ? 'bg-white/10' : 'opacity-40'}`}
                    >
                      <MapIcon className="w-3 h-3" /> Map
                    </button>
                  </div>

                  <div className={`flex-grow space-y-4 overflow-y-auto pr-2 scrollbar-none ${viewMode === 'map' ? 'hidden lg:block' : 'block'}`}>
                    {filteredRestaurants.map((restaurant) => (
                      <button 
                        key={restaurant.id}
                        onClick={() => {
                          setSelectedLocation(restaurant);
                          analytics.track({ type: 'LOCATION_SELECT', locationId: restaurant.id });
                        }}
                        className={`w-full text-left p-6 rounded-3xl border transition-all ${selectedLocation?.id === restaurant.id ? 'bg-brand-red/10 border-brand-red' : 'bg-brand-dark border-white/5 hover:border-white/20'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-display text-xl uppercase italic">{restaurant.name}</h4>
                          <span className="text-[10px] font-bold font-modern text-brand-yellow">{restaurant.distance}</span>
                        </div>
                        <p className="text-white/40 text-xs mb-4 font-modern">{restaurant.address}</p>
                        
                        <div className="flex items-center gap-4 mb-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${restaurant.isOpen ? 'bg-green-500 animate-pulse' : 'bg-brand-red'}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${restaurant.isOpen ? 'text-green-500' : 'text-brand-red'}`}>
                              {restaurant.isOpen ? `OPEN UNTIL ${restaurant.closingTime}` : 'CLOSED'}
                            </span>
                          </div>
                        </div>

                        {selectedLocation?.id === restaurant.id && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setStep('menu')}
                              className="flex-grow bg-brand-yellow text-brand-black py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                            >
                              ORDER FROM HERE
                            </button>
                            <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10">
                              <Phone className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map View */}
                <div className={`flex-grow bg-brand-dark rounded-[40px] border border-white/10 overflow-hidden relative ${viewMode === 'list' ? 'hidden lg:block' : 'block'}`}>
                  {/* Simulated Map Background */}
                  <div className="absolute inset-0 bg-[#0f1013] opacity-50">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
                    <svg className="w-full h-full" viewBox="0 0 800 600">
                      <path d="M0,300 Q200,280 400,310 T800,290" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.05" />
                      <path d="M400,0 Q420,200 390,400 T410,600" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.05" />
                    </svg>
                  </div>
                  
                  {/* Pins */}
                  {filteredRestaurants.map((r) => (
                    <motion.button
                      key={r.id}
                      initial={false}
                      animate={{ 
                        scale: selectedLocation?.id === r.id ? 1.2 : 1,
                        y: selectedLocation?.id === r.id ? -10 : 0
                      }}
                      onClick={() => setSelectedLocation(r)}
                      className="absolute group"
                      style={{ 
                        left: `${((r.lng + 74.01) * 3000) % 80}%`, 
                        top: `${((r.lat - 40.71) * 4000) % 70}%` 
                      }}
                    >
                      <div className={`relative flex flex-col items-center gap-2`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-2xl transition-all ${selectedLocation?.id === r.id ? 'bg-brand-red scale-125' : 'bg-brand-black border border-white/20 group-hover:border-brand-yellow'}`}>
                          <MapPin className={`w-4 h-4 ${selectedLocation?.id === r.id ? 'text-white' : 'text-brand-yellow'}`} />
                        </div>
                        <div className={`px-3 py-1 rounded-lg bg-brand-black/80 backdrop-blur-md border border-white/10 whitespace-nowrap transition-all ${selectedLocation?.id === r.id ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'}`}>
                          <span className="text-[10px] font-bold font-modern uppercase tracking-widest">{r.name}</span>
                        </div>
                      </div>
                    </motion.button>
                  ))}

                  {/* UI Overlay on Map */}
                  <div className="absolute top-8 right-8 flex flex-col gap-2">
                    <button className="bg-brand-black/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 hover:border-brand-yellow transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button className="bg-brand-black/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 hover:border-brand-yellow transition-all">
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {step === 'rewards' && (
            <motion.section 
              key="rewards"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="funnel-step py-12"
            >
              <div className="max-w-5xl mx-auto space-y-12">
                <div className="relative overflow-hidden bg-brand-dark rounded-[40px] p-12 border border-white/5">
                  <div className="absolute top-0 right-0 p-12 opacity-5">
                    <Star className="w-64 h-64 rotate-12" />
                  </div>
                  
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                      <h2 className="text-6xl font-display uppercase italic tracking-tighter leading-none mb-8">
                        JOIN THE <br />
                        <span className="text-brand-yellow">ROYAL COURT</span>
                      </h2>
                      <p className="text-white/40 font-modern max-w-sm mb-8 italic">Eat like a King, earn like a Legend. Reach the Gold tier for 1.5x points on every flame-grilled order.</p>
                      
                      {!user ? (
                        <button 
                          onClick={handleLogin}
                          className="btn-primary"
                        >
                          JOIN NOW & GET 100 PTS
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] uppercase font-black tracking-widest text-white/40">Current Points</span>
                            <span className="text-brand-yellow font-display text-4xl">{userData?.points || 0} PTS</span>
                          </div>
                          <div className="h-4 bg-brand-black rounded-full border border-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, ((userData?.points || 0) / 1000) * 100)}%` }}
                              className="h-full bg-brand-yellow shadow-[0_0_20px_rgba(255,184,0,0.4)]"
                            />
                          </div>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-center opacity-40 italic">
                            {1000 - (userData?.points || 0)} PTS UNTIL GOLD TIER
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Earning Rate', val: '10 pts / $1', icon: Flame },
                        { label: 'Royal Tier', val: 'Silver', icon: Star },
                        { label: 'Orders Done', val: userData?.totalOrders || 0, icon: Truck },
                        { label: 'Special Perks', val: 'Available', icon: Tag }
                      ].map(stat => (
                        <div key={stat.label} className="bg-brand-black/40 p-6 rounded-3xl border border-white/5 group hover:border-brand-yellow/30 transition-all">
                          <stat.icon className="w-5 h-5 text-brand-yellow mb-4 group-hover:scale-110 transition-transform" />
                          <span className="block text-[10px] uppercase font-bold tracking-widest text-white/30 mb-1">{stat.label}</span>
                          <span className="block font-display text-xl">{stat.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-4xl font-display uppercase italic mb-8">Redeem <span className="text-brand-yellow">Rewards</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { name: 'Free Coca-Cola®', cost: 250, img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400' },
                      { name: 'Large French Fries', cost: 400, img: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=400' },
                      { name: 'THE WHOPPER®', cost: 800, img: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&q=80&w=400' }
                    ].map(reward => (
                      <div key={reward.name} className="bg-brand-dark rounded-3xl border border-white/5 overflow-hidden group hover:border-brand-yellow/50 transition-all flex flex-col">
                        <div className="aspect-video relative overflow-hidden">
                          <img 
                            src={reward.img} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                            alt="" 
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 right-4 bg-brand-yellow text-brand-black px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {reward.cost} PTS
                          </div>
                        </div>
                        <div className="p-6">
                          <h4 className="font-display text-xl uppercase mb-4">{reward.name}</h4>
                          <button 
                            disabled={!user || (userData?.points || 0) < reward.cost}
                            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              user && (userData?.points || 0) >= reward.cost 
                                ? 'bg-brand-yellow text-brand-black hover:scale-105 active:scale-95' 
                                : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                            }`}
                          >
                            {user && (userData?.points || 0) >= reward.cost ? 'REDEEM NOW' : 'NOT ENOUGH POINTS'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {step === 'account' && (
            <motion.section 
              key="account"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="funnel-step py-12"
            >
              {!user ? (
                <div className="max-w-md mx-auto bg-brand-dark p-8 sm:p-12 rounded-[40px] border border-white/10 shadow-2xl">
                  <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-brand-yellow rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-yellow/20">
                      <ChefHat className="w-10 h-10 text-brand-black" />
                    </div>
                    <h2 className="text-4xl font-display uppercase tracking-tight mb-2">
                      {authMode === 'login' ? 'Welcome Back' : 'Join the Kingdom'}
                    </h2>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                      {authMode === 'login' ? 'Enter your credentials to continue' : 'Sign up for royal rewards and faster checkout'}
                    </p>
                  </div>

                  <form onSubmit={handleTraditionalAuth} className="space-y-6">
                    {authMode === 'signup' && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-brand-yellow ml-4">Display Name</label>
                        <input 
                          type="text"
                          required
                          value={authForm.displayName}
                          onChange={e => setAuthForm({ ...authForm, displayName: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white font-modern focus:outline-none focus:border-brand-yellow transition-all"
                          placeholder="e.g. King Burger"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-brand-yellow ml-4">Email Address</label>
                      <input 
                        type="email"
                        required
                        value={authForm.email}
                        onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white font-modern focus:outline-none focus:border-brand-yellow transition-all"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-brand-yellow ml-4">Password</label>
                      <input 
                        type="password"
                        required
                        value={authForm.password}
                        onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-4 text-white font-modern focus:outline-none focus:border-brand-yellow transition-all"
                        placeholder="••••••••"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full bg-brand-yellow text-brand-black py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isAuthenticating ? (
                        <div className="w-5 h-5 border-2 border-brand-black/30 border-t-brand-black rounded-full animate-spin" />
                      ) : (
                        <>
                          {authMode === 'login' ? 'Login to Kingdom' : 'Create Account'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
                    <button 
                      onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                      className="w-full text-center text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-brand-yellow transition-colors"
                    >
                      {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="px-4 bg-brand-dark text-white/20 tracking-widest leading-none translate-y-[-2px]">Or continue with</span></div>
                    </div>

                    <button 
                      onClick={handleLogin}
                      disabled={isAuthenticating}
                      className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" className="w-4 h-4" alt="" />
                      Google Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-1 space-y-8">
                    <div className="bg-brand-dark p-8 rounded-[40px] border border-white/10 text-center">
                    <img 
                      src={user?.photoURL || ''} 
                      className="w-24 h-24 rounded-full mx-auto mb-6 border-4 border-brand-yellow p-1" 
                      alt="" 
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <h2 className="text-3xl font-display uppercase mb-2">{user?.displayName}</h2>
                    <p className="text-white/40 text-xs font-modern mb-8">{user?.email}</p>
                    
                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setIsAdminMode(true);
                          setIsAdminLoggedIn(true);
                        }}
                        className="w-full py-4 mb-4 bg-brand-yellow text-brand-black rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2"
                      >
                        <Lock className="w-3 h-3" />
                        Go to Admin Panel
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-8">
                      <div className="text-center">
                        <span className="block text-[10px] font-black text-brand-yellow uppercase tracking-widest mb-1">{t('points') || 'Points'}</span>
                        <span className="text-2xl font-display">{userData?.points || 0}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-[10px] font-black text-brand-yellow uppercase tracking-widest mb-1">{t('orders') || 'Orders'}</span>
                        <span className="text-2xl font-display">{userData?.totalOrders || 0}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full py-4 bg-brand-red/10 border border-brand-red/30 text-brand-red rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-red/20 transition-all"
                  >
                    {t('logout').toUpperCase()}
                  </button>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <h3 className="text-4xl font-display uppercase italic">{t('orderHistory').split(' ')[0]} <span className="text-brand-yellow font-display uppercase">{t('orderHistory').split(' ')[1]}</span></h3>
                  
                  {orderHistory.length === 0 ? (
                    <div className="bg-brand-dark p-12 rounded-[40px] border border-white/5 text-center opacity-40 italic">
                      {t('noOrders')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orderHistory.map(order => (
                        <div key={order.id} className="bg-brand-dark p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-brand-yellow/30 transition-all">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-brand-yellow">{t('order')} {order.orderNumber}</span>
                              <span className="text-[10px] font-bold text-white/30">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-display text-xl uppercase mb-1">
                              {order.items?.length} {t('items')} • ${order.total?.toFixed(2)}
                            </h4>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-green-500">{order.status}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              const newItems = (order.items || []).map((item: any) => ({
                                ...item,
                                cartId: Math.random().toString(36).substr(2, 9)
                              }));
                              setCart([...cart, ...newItems]);
                              setIsCartOpen(true);
                              setStep('menu');
                            }}
                            className="btn-secondary !py-2.5 !px-6 text-[10px]"
                          >
                            {t('reorder')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        )}

          {step === 'checkout' && (
            <motion.section 
              key="checkout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="funnel-step py-12"
            >
              <div className="max-w-4xl mx-auto">
                {/* Checkout Progress Bar */}
                <div className="flex items-center justify-between mb-12 relative px-4">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2 z-0" />
                  {[
                    { id: 'details', label: 'Details', icon: MapPin },
                    { id: 'payment', label: 'Payment', icon: CreditCard },
                    { id: 'confirm', label: 'Finish', icon: CheckCircle }
                  ].map((s, i) => {
                    const isActive = checkoutSubStep === s.id || (s.id === 'confirm' && step === 'confirmation');
                    const isCompleted = (s.id === 'details' && checkoutSubStep === 'payment') || step === 'confirmation';
                    return (
                      <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          isActive 
                            ? 'bg-brand-red border-brand-red shadow-lg shadow-brand-red/20 scale-110' 
                            : isCompleted 
                              ? 'bg-brand-yellow border-brand-yellow text-brand-black' 
                              : 'bg-brand-dark border-white/10 text-white/40'
                        }`}>
                          {isCompleted ? <CheckCircle className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                        </div>
                        <span className={`text-[10px] uppercase font-bold tracking-widest ${isActive ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => checkoutSubStep === 'payment' ? setCheckoutSubStep('details') : setStep('menu')}
                  className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 group"
                >
                  <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> {t('back')}
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <AnimatePresence mode="wait">
                    {checkoutSubStep === 'details' ? (
                      <motion.div 
                        key="details"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-6"
                      >
                        <h2 className="text-4xl font-display uppercase italic mb-8">{t('deliveryDetails')}</h2>
                        <div className="bg-brand-dark p-6 rounded-3xl border border-white/5 space-y-4">
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold tracking-widest text-white/30 ml-2">{t('fullName')}</label>
                              <input 
                                type="text" 
                                placeholder="e.g. John Doe" 
                                value={checkoutData.fullName}
                                onChange={(e) => setCheckoutData(prev => ({ ...prev, fullName: e.target.value }))}
                                className={`w-full bg-brand-black border ${formErrors.fullName ? 'border-brand-red' : 'border-white/10'} rounded-xl px-4 py-3 focus:border-brand-yellow outline-none transition-colors`} 
                              />
                              {formErrors.fullName && <p className="text-[10px] text-brand-red ml-2 uppercase font-bold">{formErrors.fullName}</p>}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold tracking-widest text-white/30 ml-2">{t('phoneNumber')}</label>
                              <input 
                                type="tel" 
                                placeholder="+1 (555) 000-0000" 
                                value={checkoutData.phone}
                                onChange={(e) => setCheckoutData(prev => ({ ...prev, phone: e.target.value }))}
                                className={`w-full bg-brand-black border ${formErrors.phone ? 'border-brand-red' : 'border-white/10'} rounded-xl px-4 py-3 focus:border-brand-yellow outline-none transition-colors`} 
                              />
                              {formErrors.phone && <p className="text-[10px] text-brand-red ml-2 uppercase font-bold">{formErrors.phone}</p>}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold tracking-widest text-white/30 ml-2">{t('deliveryAddress')}</label>
                              <input 
                                type="text" 
                                placeholder="123 Flame St, Grill City" 
                                value={checkoutData.address}
                                onChange={(e) => setCheckoutData(prev => ({ ...prev, address: e.target.value }))}
                                className={`w-full bg-brand-black border ${formErrors.address ? 'border-brand-red' : 'border-white/10'} rounded-xl px-4 py-3 focus:border-brand-yellow outline-none transition-colors`} 
                              />
                              {formErrors.address && <p className="text-[10px] text-brand-red ml-2 uppercase font-bold">{formErrors.address}</p>}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (validateCheckout()) {
                              setCheckoutSubStep('payment');
                              initPayment(subtotal + 2.99);
                            } else {
                              toast.error("Validation Failed", { description: "Please correct the errors before proceeding." });
                            }
                          }}
                          className="btn-primary w-full"
                        >
                          {t('continueToPayment').toUpperCase()} <ArrowRight className="w-5 h-5" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="payment"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <h2 className="text-4xl font-display uppercase italic mb-8">Payment</h2>
                        
                        {clientSecret ? (
                          stripePromise ? (
                            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                            <Suspense fallback={
                              <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-8 h-8 text-brand-yellow animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Initializing Secure Payment...</span>
                              </div>
                            }>
                              <CheckoutForm 
                                amount={subtotal + 2.99} 
                                onSuccess={handlePlaceOrder} 
                                isLoading={isOrderProcessing} 
                              />
                            </Suspense>
                            </Elements>
                          ) : (
                            <div className="bg-brand-dark p-12 rounded-3xl border border-white/5 text-center">
                              <p className="text-brand-yellow font-display uppercase mb-4">Payment System Offline</p>
                              <p className="text-xs text-white/60 mb-6">Stripe configuration is missing or invalid. Payment of ${(subtotal + 2.99).toFixed(2)} is required to place an order.</p>
                              <button 
                                onClick={handlePlaceOrder}
                                className="bg-brand-yellow text-brand-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all w-full flex items-center justify-center gap-2"
                                disabled={isOrderProcessing}
                              >
                                {isOrderProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>Skip Payment (Demo Mode)</>
                                )}
                              </button>
                            </div>
                          )
                        ) : paymentInitError ? (
                          <div className="bg-brand-dark p-12 rounded-3xl border border-brand-red/30 text-center">
                            <p className="text-brand-red font-display uppercase mb-4">Payment Error</p>
                            <p className="text-xs text-white/60 mb-8">{paymentInitError}</p>
                            <div className="flex flex-col gap-3">
                              <button 
                                onClick={() => initPayment(subtotal + 2.99)}
                                className="bg-white text-brand-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-brand-yellow transition-all flex items-center justify-center gap-2"
                              >
                                Try Again
                              </button>
                              <button 
                                onClick={handlePlaceOrder}
                                className="bg-brand-yellow text-brand-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2"
                                disabled={isOrderProcessing}
                              >
                                {isOrderProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>Skip & Confirm (Demo)</>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-brand-dark p-12 rounded-3xl border border-white/5 flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-brand-yellow/20 border-t-brand-yellow rounded-full animate-spin" />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="bg-brand-dark p-8 rounded-[40px] border border-white/5 h-fit sticky top-32">
                    <h3 className="font-display text-2xl mb-6 flex items-center justify-between">
                      Summary 
                      <span className="text-xs px-3 py-1 bg-white/5 rounded-full text-white/40 font-modern font-bold tracking-widest">
                        {totalItems} ITEMS
                      </span>
                    </h3>
                    <div className="max-h-[300px] overflow-y-auto space-y-4 mb-8 pr-2 scrollbar-none">
                      {cart.map(item => (
                        <div key={item.cartId} className="flex justify-between items-start text-sm font-modern gap-4">
                          <div className="flex flex-col">
                            <span className="font-bold">{item.quantity}x {item.name}</span>
                            {item.customizations?.added.length ? (
                              <span className="text-[10px] text-brand-yellow capitalize italic">+{item.customizations.added.join(', ')}</span>
                            ) : null}
                          </div>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/5 pt-6 space-y-4">
                      <div className="flex justify-between text-white/40 text-sm">
                        <span>{t('subtotal')}</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-white/40 text-sm">
                        <span>{t('deliveryFee')}</span>
                        <span>$2.99</span>
                      </div>
                      <div className="flex justify-between text-2xl font-display text-brand-yellow pt-2">
                        <span>{t('totalDue')}</span>
                        <span>${(subtotal + 2.99).toFixed(2)}</span>
                      </div>
                    </div>
                    {checkoutSubStep === 'payment' && (
                      <button 
                        onClick={handlePlaceOrder}
                        className="btn-primary w-full mt-8 animate-pulse-gold uppercase"
                      >
                        {t('confirmAndPay')} ${(subtotal + 2.99).toFixed(2)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {step === 'confirmation' && (
            <motion.section 
              key="confirmation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="funnel-step py-12 lg:py-24"
            >
              {/* Confetti Celebration */}
              {trackingStatus === 0 && Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="fixed z-[150] w-2 h-2 rounded-full pointer-events-none"
                  style={{ 
                    background: i % 2 === 0 ? '#D71921' : '#FFB800',
                    left: '50%',
                    top: '50%'
                  }}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ 
                    scale: [0, 1, 0.5, 0],
                    x: (Math.random() - 0.5) * 800,
                    y: (Math.random() - 0.8) * 800,
                    rotate: Math.random() * 360
                  }}
                  transition={{ duration: 2, ease: "easeOut", delay: i * 0.02 }}
                />
              ))}

              <div className="max-w-4xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                  {/* Left Column: Tracking Status */}
                  <div className="bg-brand-dark rounded-[40px] p-8 sm:p-12 border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-yellow/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                    
                    <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-brand-yellow rounded-2xl flex items-center justify-center animate-pulse-gold">
                          <CheckCircle className="w-8 h-8 text-brand-black" />
                        </div>
                        <div>
                          <h2 className="text-3xl font-display uppercase tracking-tight leading-none mb-1">{t('orderConfirmed')}</h2>
                          <div className="flex items-center gap-2 text-white/40 font-bold text-[10px] tracking-widest uppercase">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                            Live Tracking ID: <span className="text-brand-yellow">{lastOrderNumber || 'BK-9283'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-12">
                      {/* Driver Status Card */}
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/10"
                      >
                        <div className="relative">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-brand-yellow">
                            <img 
                              src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200" 
                              className="w-full h-full object-cover" 
                              alt="Driver Profile" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-brand-yellow text-brand-black p-1.5 rounded-lg shadow-lg">
                            <Star className="w-4 h-4 fill-current" />
                          </div>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-display text-xl">MARCUS V.</h4>
                            <span className="text-[10px] font-black bg-brand-yellow text-brand-black px-2 py-0.5 rounded tracking-tighter uppercase">5.0 RATING</span>
                          </div>
                          <p className="text-xs text-white/40 font-modern leading-none">{trackingStatus < 2 ? t('kingCooking') : t('dispatched')}</p>
                          <div className="flex items-center gap-3 mt-4">
                            <button className="p-2 bg-white/10 rounded-xl hover:bg-brand-yellow hover:text-brand-black transition-all">
                              <Phone className="w-4 h-4" />
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all">
                              Message
                            </button>
                          </div>
                        </div>
                      </motion.div>

                      {/* Timeline Tracker */}
                      <div className="relative pl-10 space-y-12">
                        <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-white/5" />
                        {[
                          { id: 0, icon: Clock, title: t('orderConfirmed'), desc: t('orderPlaced') },
                          { id: 1, icon: ChefHat, title: t('flameGrilled'), desc: t('kingCooking') },
                          { id: 2, icon: Truck, title: t('onTheWay'), desc: t('dispatched') },
                          { id: 3, icon: ShoppingBag, title: t('delivered'), desc: t('deliveredSuccess') }
                        ].map((s, i) => (
                          <div key={s.id} className="relative">
                            <motion.div 
                              initial={false}
                              animate={{ 
                                scale: i === trackingStatus ? 1.2 : 1,
                                backgroundColor: i <= trackingStatus ? '#FFB800' : 'rgba(255,255,255,0.05)',
                                color: i <= trackingStatus ? '#000' : 'rgba(255,255,255,0.2)'
                              }}
                              className="absolute -left-[30px] top-0 w-10 h-10 rounded-full border-4 border-brand-black z-10 flex items-center justify-center transition-all duration-500"
                            >
                              <s.icon className="w-5 h-5 text-current shrink-0" />
                            </motion.div>
                            <div className={`transition-all duration-500 ${i <= trackingStatus ? 'opacity-100' : 'opacity-20 translate-x-4'}`}>
                              <h5 className="font-display text-xl uppercase tracking-tight">{s.title}</h5>
                              <p className="text-xs text-white/40 font-modern font-bold uppercase tracking-widest">{s.desc}</p>
                            </div>
                            {i === trackingStatus && i < 3 && (
                                <motion.div 
                                    className="absolute -left-10 top-12 bottom-[-48px] w-0.5 bg-brand-yellow rounded-full z-0"
                                    initial={{ height: 0 }}
                                    animate={{ height: "100%" }}
                                    transition={{ duration: 5, repeat: Infinity }}
                                />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Order Map and Summary */}
                  <div className="space-y-8">
                    <div className="bg-brand-dark rounded-[40px] p-8 border border-white/5 overflow-hidden relative group h-[300px] sm:h-[400px]">
                      {/* Fake Map UI */}
                      <div className="absolute inset-0 z-0">
                        <img 
                          src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1000" 
                          className="w-full h-full object-cover opacity-30 group-hover:scale-110 transition-transform duration-[10s]" 
                          alt="Live Map"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent" />
                      </div>
                      
                      <div className="relative z-10 h-full flex flex-col">
                        <div className="flex items-center justify-between">
                          <div className="bg-brand-red text-white text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] shadow-2xl">Live Map</div>
                          <div className="bg-brand-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                             <Navigation className="w-3 h-3 text-brand-yellow animate-pulse" />
                             <span className="text-[10px] font-bold tracking-widest text-white/60">GPS ACTIVE</span>
                          </div>
                        </div>

                        <div className="mt-auto p-6 bg-brand-black/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Estimated Arrival</span>
                            <div className="text-3xl font-display text-brand-yellow leading-none italic">
                              {Math.floor(trackingTime / 60)}:{(trackingTime % 60).toString().padStart(2, '0')}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="h-1 flex-grow bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-brand-yellow" 
                                    animate={{ width: `${(trackingStatus/3)*100}%` }}
                                    transition={{ duration: 1 }}
                                />
                             </div>
                             <span className="text-[10px] font-bold text-white/40 uppercase whitespace-nowrap">{trackingTime > 0 ? 'Descending' : 'Arriving...'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-brand-dark rounded-[40px] p-8 border border-white/5">
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="font-display text-2xl uppercase italic">Your Feast Summary</h4>
                        <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase text-white/40">{cart.length} ITEMS</span>
                      </div>
                      <div className="space-y-4 mb-8">
                         {cart.map(item => (
                             <div key={item.cartId} className="flex justify-between items-start">
                                 <div className="flex flex-col">
                                     <span className="text-sm font-bold uppercase tracking-tight">{item.quantity}x {item.name}</span>
                                     <span className="text-[10px] text-white/30 uppercase tracking-widest leading-none mt-1">Standard Grill</span>
                                 </div>
                                 <span className="text-sm font-display text-brand-yellow">${(item.price * item.quantity).toFixed(2)}</span>
                             </div>
                         ))}
                      </div>
                      <div className="border-t border-white/5 pt-6 flex flex-col gap-4">
                         <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/30">
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between text-2xl font-display text-brand-yellow">
                            <span>TOTAL PAID</span>
                            <span>${(subtotal + 2.99).toFixed(2)}</span>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                         <button 
                            onClick={() => {
                                setCart([]);
                                setStep('home');
                            }}
                            className="bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                         >
                            Cancel Order
                         </button>
                         <button 
                            onClick={() => setShowReceipt(true)}
                            className="bg-brand-yellow text-brand-black hover:bg-brand-yellow/80 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-yellow/10 flex items-center justify-center gap-2"
                         >
                            <Printer className="w-4 h-4" /> Digital Receipt
                         </button>
                         <button 
                            onClick={() => {
                                setCart([]);
                                setStep('home');
                            }}
                            className="sm:col-span-2 bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                         >
                            Live Support
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        {/* Receipt Modal */}
        <AnimatePresence>
          {showReceipt && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowReceipt(false)}
                className="fixed inset-0 bg-brand-black/95 backdrop-blur-xl z-[200]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg bg-white text-brand-black rounded-[2.5rem] z-[201] overflow-hidden shadow-2xl flex flex-col"
              >
                <div id="digital-receipt" className="p-8 sm:p-12 overflow-y-auto max-h-[80vh] scrollbar-none bg-white" style={{ backgroundColor: '#ffffff', color: '#050505' }}>
                  {/* Receipt Header */}
                  <div className="text-center mb-10 pb-10 border-b-2 border-dashed" style={{ borderColor: '#e5e7eb' }}>
                    <div className="w-20 h-20 bg-brand-black rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl" style={{ backgroundColor: '#050505' }}>
                       <ChefHat className="w-10 h-10" style={{ color: '#FFB800' }} />
                    </div>
                    <h2 className="text-3xl font-display uppercase tracking-tight mb-2">KING BURGERS</h2>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#9ca3af' }}>{t('receiptSubtitle') || 'Official Royal Banquet Receipt'}</p>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-8 mb-10">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>{t('receiptId') || 'Receipt ID'}</span>
                        <span className="text-xl font-display">#{lastOrderNumber || 'BK-9283'}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>{t('dateTime') || 'Date & Time'}</span>
                        <span className="text-sm font-bold font-modern">{new Date().toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <span className="block text-[10px] font-black uppercase tracking-widest" style={{ color: '#9ca3af' }}>{t('orderSummary') || 'Order Summary'}</span>
                      {cart.map(item => (
                        <div key={item.cartId} className="flex justify-between items-start py-2">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold uppercase tracking-tight">{item.quantity}x {getTranslatedItemName(item)}</span>
                             {item.customizations?.added.length ? (
                               <span className="text-[10px] font-bold uppercase italic mt-1 leading-none" style={{ color: '#D71921' }}>
                                 +{item.customizations.added.join(', ')}
                               </span>
                             ) : null}
                          </div>
                          <span className="text-sm font-bold font-modern">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 space-y-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest" style={{ color: '#9ca3af' }}>
                        <span>{t('subtotal')}</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest" style={{ color: '#9ca3af' }}>
                        <span>{t('deliveryFee')}</span>
                        <span>$2.99</span>
                      </div>
                      <div className="flex justify-between text-3xl font-display pt-4 mt-4" style={{ borderTop: '1px solid #f3f4f6', color: '#050505' }}>
                        <span>{t('total').toUpperCase()}</span>
                        <span>${(subtotal + 2.99).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Branding */}
                  <div className="rounded-3xl p-6 text-center" style={{ backgroundColor: '#f9fafb' }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed" style={{ color: '#9ca3af' }}>
                      Thank you for choosing the King's table.<br />
                      Show this receipt to claim your <span style={{ color: '#050505' }}>100 Loyalty Points</span>.
                    </p>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="p-6 bg-brand-black flex gap-4">
                   <button 
                    onClick={handleDownloadReceipt}
                    className="flex-grow bg-white text-brand-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-200 transition-all"
                   >
                     <Download className="w-4 h-4" /> Download PDF
                   </button>
                   <button 
                    onClick={() => setShowReceipt(false)}
                    className="p-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all"
                   >
                     <X className="w-5 h-5" />
                   </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-brand-black/90 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md glass-panel z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-8 flex items-center justify-between border-b border-white/5">
                <h2 className="text-3xl font-display uppercase tracking-tight">{t('your') || 'Your'} <span className="text-brand-yellow font-display">{t('loot') || 'Loot'}</span></h2>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-3 hover:bg-white/5 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <ShoppingBag className="w-16 h-16 mb-4" />
                    <p className="font-modern uppercase tracking-widest text-sm">{t('cartEmpty') || 'Cart is empty'}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <motion.div 
                          key={item.cartId}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex gap-4 items-center p-4 bg-white/5 rounded-2xl group transition-all hover:bg-white/10"
                        >
                          <img 
                            src={item.image} 
                            alt={getTranslatedItemName(item)} 
                            className="w-16 h-16 object-cover rounded-xl" 
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-grow min-w-0">
                            <h4 className="font-display text-lg mb-0.5 truncate">{getTranslatedItemName(item)}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-brand-yellow font-display text-sm">${item.price.toFixed(2)}</span>
                              {item.customizations?.added.length ? (
                                <span className="text-[10px] text-white/40 italic">{t('customized') || 'Customized'}</span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center bg-brand-black rounded-lg p-0.5 border border-white/5">
                                <button 
                                  onClick={() => updateQuantity(item.cartId, -1)}
                                  className="p-1 hover:text-brand-red transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.cartId, 1)}
                                  className="p-1 hover:text-brand-yellow transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button 
                                onClick={() => removeFromCart(item.cartId)}
                                className="text-white/20 hover:text-brand-red transition-colors ml-auto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Smart Recommendations: Frequently Bought Together */}
                    {recommendations.frequentlyBoughtTogether.length > 0 && (
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                          <Tag className="w-3 h-3 text-brand-yellow" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 font-modern">Frequently Bought Together</h4>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
                          {recommendations.frequentlyBoughtTogether.map(item => (
                            <motion.div 
                              key={`cart-rec-${item.id}`}
                              whileHover={{ y: -4 }}
                              className="min-w-[160px] bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col gap-2 group"
                            >
                              <img src={item.image} className="w-full h-16 object-cover rounded-xl" alt={item.name} />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase truncate">{item.name}</span>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-brand-yellow font-display text-sm">${item.price}</span>
                                  <button 
                                    onClick={() => addToCartFromRecs(item)}
                                    className="p-1.5 bg-brand-yellow hover:bg-brand-yellow/80 rounded-lg text-brand-black transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

                  <div className="p-8 border-t border-white/5 bg-brand-dark/50">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-modern uppercase tracking-widest text-xs text-white/40 font-bold">{t('subtotal')}</span>
                  <span className="text-3xl font-display text-brand-yellow tracking-tighter">${subtotal.toFixed(2)}</span>
                </div>
                <button 
                  disabled={cart.length === 0}
                  onClick={() => {
                    setIsCartOpen(false);
                    setStep('checkout');
                  }}
                  className="btn-primary w-full shadow-lg shadow-brand-red/20"
                >
                  {t('checkout').toUpperCase()}
                </button>
                <div className="mt-6 flex items-center justify-center gap-4 opacity-40">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Est. Ready in 12-15 Mins</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Customize Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedItem(null);
                setCustomization({ added: [], removed: [] });
                setItemQuantity(1);
              }}
              className="absolute inset-0 bg-brand-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-brand-dark rounded-[40px] overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 flex-grow overflow-hidden">
                <div className="relative h-[200px] lg:h-full">
                  <img 
                    src={selectedItem.image} 
                    alt={selectedItem.name} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-dark/50 to-transparent" />
                  
                  {/* Nutritional Info overlay */}
                  <div className="absolute bottom-8 left-8 space-y-2">
                    <div className="flex items-center gap-2 bg-brand-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 w-fit">
                      <Flame className="w-4 h-4 text-brand-yellow" />
                      <span className="font-display text-xl">{currentTotal.calories} KCAL</span>
                    </div>
                    {selectedItem.allergens && (
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.allergens.map(a => (
                          <span key={a} className="text-[9px] uppercase font-bold tracking-widest bg-white/10 px-2 py-1 rounded-md border border-white/10">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-6 lg:p-10 flex flex-col overflow-y-auto">
                  <button 
                    onClick={() => {
                      setSelectedItem(null);
                      setCustomization({ added: [], removed: [] });
                      setItemQuantity(1);
                    }}
                    className="absolute top-6 right-6 p-2 bg-brand-black/50 hover:bg-white/10 rounded-full transition-colors z-10"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  <h3 className="text-4xl lg:text-5xl font-display mb-2 uppercase italic leading-none">Customize Your <span className="text-brand-yellow">{selectedItem.name}</span></h3>
                  <p className="text-white/40 font-modern mb-8 text-sm">{selectedItem.description}</p>
                  
                  {/* Individual Ingredient Toggles */}
                  <div className="space-y-6 mb-8">
                    <div>
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-4 border-b border-white/5 pb-2">PREMIUM ADD-ONS</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {INGREDIENTS.filter(i => i.price > 0).map(ing => (
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={ing.id}
                            onClick={() => {
                              setCustomization(prev => {
                                const isAdded = prev.added.includes(ing.id);
                                return isAdded 
                                  ? { ...prev, added: prev.added.filter(id => id !== ing.id) }
                                  : { ...prev, added: [...prev.added, ing.id] };
                              });
                            }}
                            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${customization.added.includes(ing.id) ? 'bg-brand-red border-brand-red' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                          >
                            <div className="text-left">
                              <span className="block text-xs font-bold font-modern">{ing.name}</span>
                              <span className="text-[10px] opacity-60">+{ing.calories} kcal</span>
                            </div>
                            <span className="font-display text-lg">${ing.price.toFixed(2)}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-4 border-b border-white/5 pb-2">REMOVE INGREDIENTS</h4>
                      <div className="flex flex-wrap gap-2">
                        {INGREDIENTS.filter(i => i.removable).map(ing => (
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            key={ing.id}
                            onClick={() => {
                              setCustomization(prev => {
                                const isRemoved = prev.removed.includes(ing.id);
                                return isRemoved 
                                  ? { ...prev, removed: prev.removed.filter(id => id !== ing.id) }
                                  : { ...prev, removed: [...prev.removed, ing.id] };
                              });
                            }}
                            className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase transition-all ${customization.removed.includes(ing.id) ? 'bg-white/10 border-white/40 opacity-40 line-through' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                          >
                            NO {ing.name}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>

                   {/* People Also Order */}
                   <div className="mt-auto pt-6 border-t border-white/5 mb-8">
                     <h4 className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-4">SMART PAIRINGS</h4>
                     <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                       {recommendations.frequentlyBoughtTogether.map(item => (
                         <motion.button 
                           key={`modal-rec-${item.id}`}
                           whileHover={{ y: -4, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                           whileTap={{ scale: 0.98 }}
                           onClick={() => addToCartFromRecs(item)}
                           className="min-w-[140px] bg-brand-black/40 rounded-2xl p-3 border border-white/5 flex flex-col gap-2 group text-left"
                         >
                           <img 
                             src={item.image} 
                             className="w-full h-12 object-cover rounded-lg group-hover:scale-105 transition-transform" 
                             alt="" 
                             loading="lazy"
                             referrerPolicy="no-referrer"
                           />
                           <div className="flex flex-col">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold uppercase truncate">{item.name}</span>
                               <Plus className="w-3 h-3 text-brand-yellow" />
                             </div>
                             <span className="text-brand-yellow font-display text-sm">${item.price}</span>
                           </div>
                         </motion.button>
                       ))}
                     </div>
                   </div>

                  {/* Summary Bar */}
                  <div className="flex items-center gap-6 mt-auto">
                    <div className="flex items-center bg-brand-black rounded-2xl p-2 border border-white/10">
                      <motion.button 
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setItemQuantity(q => Math.max(1, q - 1))}
                        className="w-8 h-8 flex items-center justify-center hover:text-brand-red transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>
                      <motion.span 
                        key={itemQuantity}
                        initial={{ scale: 1.2, color: '#FFB800' }}
                        animate={{ scale: 1, color: '#FFF' }}
                        className="w-8 text-center font-bold text-xl block"
                      >
                        {itemQuantity}
                      </motion.span>
                      <motion.button 
                        whileTap={{ scale: 0.8 }}
                        onClick={() => setItemQuantity(q => q + 1)}
                        className="w-8 h-8 flex items-center justify-center hover:text-brand-yellow transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>

                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={addToCartWithCustomization}
                      className="btn-secondary flex-grow justify-between group"
                    >
                      <span className="flex items-center gap-2">ADD TO CART <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" /></span>
                      <span className="text-3xl tracking-tighter">${currentTotal.price.toFixed(2)}</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Mobile Bar */}
      {step === 'menu' && !isCartOpen && totalItems > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="sticky-order-bar"
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{totalItems} ITEMS</span>
            <span className="text-2xl font-display text-brand-yellow">${subtotal.toFixed(2)}</span>
          </div>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="btn-primary py-3 !px-6 text-lg"
          >
            VIEW CART <ShoppingBag className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Footer */}
      <footer className="bg-brand-black border-t border-white/5 py-24 px-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red/5 blur-[150px] -z-10" />
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-24">
            <div className="md:col-span-1">
              <span className="font-display text-5xl mb-6 block tracking-tighter">KING<span className="text-brand-yellow">BURGERS</span></span>
              <p className="text-white/40 font-modern text-sm leading-relaxed">
                Premium flame-grilled burgers served with pride and passion since day one. Experience the royalty of flavor.
              </p>
            </div>
            {['Services', 'Social', 'Legal'].map((col) => (
              <div key={col}>
                <h5 className="font-modern uppercase text-[10px] font-black tracking-widest text-brand-yellow mb-8">{col}</h5>
                <ul className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <li key={i}>
                      <button className="text-sm font-modern text-white/60 hover:text-white transition-colors">
                        Link Component {i}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] uppercase font-bold tracking-widest text-white/20">© 2026 KING BURGERS. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-8">
              {['Instagram', 'Twitter', 'TikTok'].map(s => (
                <button key={s} className="text-[10px] uppercase font-black tracking-widest text-white/40 hover:text-brand-yellow transition-colors">{s}</button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Marketing Popups */}
      <AnimatePresence>
        {activePopup && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePopup(null)}
              className="absolute inset-0 bg-brand-black/90 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-brand-dark rounded-[40px] overflow-hidden border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setActivePopup(null)}
                className="absolute top-6 right-6 p-2 bg-brand-black/50 hover:bg-white/10 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {activePopup === 'welcome' && (
                <div className="flex flex-col">
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&q=80&w=1000" 
                      className="w-full h-full object-cover" 
                      alt="Tasty Burger"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-dark to-transparent" />
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 text-center flex flex-col items-center">
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }} 
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="bg-brand-yellow text-brand-black w-20 h-20 rounded-full flex items-center justify-center shadow-2xl shadow-brand-yellow/30 mb-4"
                      >
                        <Gift className="w-10 h-10" />
                      </motion.div>
                      <h2 className="text-5xl font-display uppercase italic tracking-tighter leading-none mb-2">{t('welcomeTitle')}</h2>
                      <p className="text-brand-yellow text-xs font-black uppercase tracking-[0.2em]">{t('welcomeSubtitle')}</p>
                    </div>
                  </div>
                  <div className="p-10 text-center">
                    <p className="text-white/60 font-modern mb-8 text-sm leading-relaxed">
                      Join the King's Court today and unlock exclusive access to legendary flavors, secret deals, and your royal welcome discount.
                    </p>
                    <div className="space-y-4">
                      <input 
                        type="email" 
                        placeholder={t('emailPlaceholder') || "Enter your royal email..."} 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full bg-brand-black border ${formErrors.welcomeEmail ? 'border-brand-red' : 'border-white/10'} rounded-2xl px-6 py-4 focus:border-brand-yellow outline-none transition-all text-center font-modern`}
                      />
                      {formErrors.welcomeEmail && <p className="text-[10px] text-brand-red uppercase font-bold">{formErrors.welcomeEmail}</p>}
                      <button 
                        onClick={() => {
                          if (validateEmail(email)) {
                            setActivePopup(null);
                            toast.success("Welcome to the Kingdom!", { description: "Your 10% discount has been applied to your account." });
                          } else {
                            setFormErrors(prev => ({ ...prev, welcomeEmail: 'Please enter a valid royal email.' }));
                            toast.error("Invalid Email", { description: "You need a valid email to receive the royal discount." });
                          }
                        }}
                        className="btn-primary w-full py-5 text-xl"
                      >
                        CLAIM MY DISCOUNT
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activePopup === 'exit' && (
                <div className="flex flex-col">
                  <div className="p-12 text-center">
                    <div className="w-24 h-24 bg-brand-red rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-red/20 rotate-12">
                      <ShoppingBag className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-5xl font-display uppercase italic mb-4 leading-none">WAIT! <br />DON'T GO <span className="text-brand-red">EMPTY HANDED.</span></h2>
                    <p className="text-white/60 font-modern mb-10 text-sm leading-relaxed max-w-xs mx-auto">
                      Your flame-grilled favorites are waiting in your cart. Complete your order now and we'll prioritize your delivery.
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      <button 
                        onClick={() => {
                          setActivePopup(null);
                          setIsCartOpen(true);
                        }}
                        className="btn-primary py-5 text-xl shadow-2xl shadow-brand-red/30"
                      >
                        FINISH MY ORDER
                      </button>
                      <button 
                        onClick={() => setActivePopup(null)}
                        className="text-white/20 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest"
                      >
                        I'll come back later
                      </button>
                    </div>
                  </div>
                  <div className="bg-brand-red/10 border-t border-white/5 p-6 flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-brand-red" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-red">Cart expires in 12:45 mins</span>
                  </div>
                </div>
              )}

              {activePopup === 'deals' && (
                <div className="flex flex-col">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1000" 
                      className="w-full h-full object-cover" 
                      alt="Flash Deal"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-brand-black/60" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Bell className="w-10 h-10 text-brand-yellow animate-bounce" />
                      <h2 className="text-4xl font-display uppercase tracking-tight">FLASH <span className="text-brand-yellow text-5xl">DEAL</span></h2>
                    </div>
                  </div>
                  <div className="p-10">
                    <div className="flex items-center gap-6 mb-8">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex-shrink-0 flex items-center justify-center border border-white/10">
                        <Star className="w-8 h-8 text-brand-yellow" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-display text-2xl uppercase">2X ROYAL CRISPY</h4>
                        <p className="text-white/40 text-xs font-modern font-bold uppercase tracking-widest">Limited availability today</p>
                      </div>
                    </div>
                    <div className="bg-brand-black p-6 rounded-3xl border border-white/5 space-y-4 mb-10">
                      <div className="flex justify-between items-center">
                         <span className="text-3xl font-display text-brand-yellow">$12.99</span>
                         <span className="text-white/20 line-through font-display text-xl">$18.49</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: "90%" }}
                          animate={{ width: "15%" }}
                          transition={{ duration: 15, ease: "linear" }}
                          className="h-full bg-brand-red"
                        />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-red text-center">85% claimed - selling fast!</p>
                    </div>
                    <button 
                      onClick={() => {
                        setActivePopup(null);
                        setStep('deals');
                      }}
                      className="btn-primary w-full py-5 text-xl"
                    >
                      TAKE THE DEAL
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
