import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion } from 'motion/react';
import { CreditCard, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CheckoutFormProps {
  amount: number;
  onSuccess: () => void;
  isLoading: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, onSuccess, isLoading: isOrderProcessing }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    const toastId = toast.loading('Processing payment...');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      toast.error(error.message || 'Payment failed', { id: toastId });
      setIsProcessing(false);
    } else if (paymentIntent) {
      switch (paymentIntent.status) {
        case 'succeeded':
          toast.success('Payment successful!', { id: toastId });
          onSuccess();
          break;
        case 'processing':
          toast.success('Your payment is processing.', { id: toastId });
          onSuccess();
          break;
        case 'requires_payment_method':
          toast.error('Your payment was not successful, please try again.', { id: toastId });
          setIsProcessing(false);
          break;
        default:
          toast.error('Something went wrong.', { id: toastId });
          setIsProcessing(false);
          break;
      }
    } else {
      setIsProcessing(false);
      toast.error('An unexpected error occurred.', { id: toastId });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-brand-yellow" />
          <h3 className="text-lg font-display uppercase tracking-tight">Secure Payment</h3>
        </div>
        
        <PaymentElement options={{ layout: 'tabs' }} />
        
        <div className="mt-6 flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest">
          <Lock className="w-3 h-3" />
          Your payment data is encrypted and secure
        </div>
      </div>

      <button 
        type="submit"
        disabled={!stripe || isProcessing || isOrderProcessing}
        className="w-full bg-brand-yellow text-brand-black py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {isProcessing || isOrderProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>Pay ${amount.toFixed(2)} Now</>
        )}
      </button>
    </form>
  );
};
