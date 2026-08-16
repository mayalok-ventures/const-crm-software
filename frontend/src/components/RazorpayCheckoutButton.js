'use client';
import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { CreditCard, Loader2 } from 'lucide-react';

/**
 * Dynamically loads the Razorpay Standard Checkout script.
 */
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.onload = () => resolve(true);
      existingScript.onerror = () => resolve(false);
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Reusable Razorpay Standard Web Checkout Component for Next.js
 */
export default function RazorpayCheckoutButton({
  amount, // In INR (e.g. 499) or in Paise if isAmountInPaise=true
  isAmountInPaise = false,
  planId, // Optional: 'pro', 'agency', 'enterprise'
  cycle = 'monthly',
  couponCode,
  receipt,
  name = 'SalesCRM',
  description = 'Universal Sales Engine Plan Subscription',
  image = '/logo.png',
  prefill = {},
  theme = { color: '#4f46e5' },
  notes = {},
  className = 'btn btn-primary',
  style = {},
  disabled = false,
  loadingText = 'Processing...',
  children,
  onSuccess,
  onError,
  onDismiss,
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (e) => {
    if (e) e.preventDefault();
    if (loading || disabled) return;

    setLoading(true);

    try {
      // 1. Ensure Razorpay SDK script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection and try again.');
      }

      // 2. Prepare Order Payload
      const orderPayload = {
        planId: planId || undefined,
        cycle: cycle || 'monthly',
        couponCode: couponCode || undefined,
        receipt: receipt || undefined,
        notes: notes || undefined,
      };

      if (amount !== undefined && amount !== null) {
        orderPayload.amount = isAmountInPaise ? amount : Math.round(amount * 100);
      }

      // 3. Request Backend to Create Order (POST /api/payment/create-order)
      const { data: orderData } = await api.post('/payment/create-order', orderPayload);

      if (!orderData || !orderData.order_id && !orderData.orderId) {
        throw new Error(orderData?.message || 'Failed to initialize payment order');
      }

      const orderId = orderData.order_id || orderData.orderId;
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || orderData.key_id || orderData.keyId;

      if (!keyId) {
        throw new Error('Razorpay Key ID is not configured.');
      }

      // 4. Configure Razorpay Standard Checkout Modal Options
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: name || 'SalesCRM',
        description: description || orderData.planName || 'Plan Subscription',
        image: image || '/logo.png',
        order_id: orderId,
        handler: async function (response) {
          try {
            toast.loading('Verifying secure payment...', { id: 'rzp-verify' });

            const verifyPayload = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              planId: planId || undefined,
              cycle: cycle || 'monthly',
              couponCode: couponCode || undefined,
            };

            // Call Backend HMAC SHA256 Verification (POST /api/payment/verify)
            const { data: verifyData } = await api.post('/payment/verify', verifyPayload);

            toast.success(verifyData.message || 'Payment successfully verified! 🎉', { id: 'rzp-verify' });

            if (onSuccess) {
              onSuccess(verifyData);
            }
          } catch (err) {
            console.error('[Razorpay] Verification error:', err);
            toast.error(err.response?.data?.message || 'Payment signature verification failed', { id: 'rzp-verify' });
            if (onError) {
              onError(err);
            }
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: prefill.name || orderData.user?.name || '',
          email: prefill.email || orderData.user?.email || '',
          contact: prefill.contact || prefill.phone || orderData.user?.phone || '',
        },
        notes: {
          ...notes,
          orderId,
        },
        theme: {
          color: theme.color || '#4f46e5',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast('Payment window closed', { icon: 'ℹ️' });
            if (onDismiss) {
              onDismiss();
            }
          },
        },
      };

      // 5. Instantiate and Open Razorpay Standard Checkout Modal
      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response) {
        setLoading(false);
        console.error('[Razorpay] Payment failed:', response.error);
        toast.error(response.error?.description || 'Payment failed or was declined by the bank.');
        if (onError) {
          onError(response.error);
        }
      });

      rzp.open();
    } catch (err) {
      console.error('[Razorpay] Checkout initialization error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to start payment checkout');
      setLoading(false);
      if (onError) {
        onError(err);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={disabled || loading}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : children ? (
        children
      ) : (
        <>
          <CreditCard size={16} />
          <span>Pay with Razorpay</span>
        </>
      )}
    </button>
  );
}
