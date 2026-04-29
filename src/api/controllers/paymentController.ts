import { Request, Response } from 'express';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

const getStripe = () => {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // Don't throw here to avoid crashing server if key isn't provided yet
      console.warn('STRIPE_SECRET_KEY is missing');
      return null;
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
};

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ message: 'Stripe is not configured' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Stripe error:', error);
    res.status(500).json({ message: error.message });
  }
};
