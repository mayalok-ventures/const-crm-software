'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';

const ensureRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.getElementById('razorpay-checkout-script');
    if (existing) {
      if (window.Razorpay) return resolve(true);
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};
import {
  Zap,
  Shield,
  Star,
  Check,
  User,
  Sparkles,
  ArrowRight,
  MessageCircle,
  QrCode,
  CheckCircle2,
  ChevronRight,
  Layers,
  GraduationCap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { isOwner, isSuperAdmin } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || '918796475107';
const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || '8193948870-2@ybl';

// ─────────────────────────────────────────────────────────────────────────────
// ENTERPRISE PLAN DEFINITIONS (DUAL-TIER)
// ─────────────────────────────────────────────────────────────────────────────
const SOLO_PLANS = [
  {
    id: 'basic_solo',
    name: 'Basic Solo',
    subtitle: 'For individual sales reps closing up to 2k deals',
    monthlyPrice: 399,
    yearlyPrice: 3999,
    icon: Zap,
    color: '#3b82f6',
    popular: false,
    features: [
      'Up to 2,000 active leads',
      '5 custom contact groups',
      '500 broadcast recipients / job',
      '2 concurrent campaign jobs',
      'WhatsApp messaging & voice notes',
      'Dynamic lead form builder',
      'Full pipeline stages customization',
    ],
  },
  {
    id: 'smart_solo',
    name: 'Smart Solo',
    subtitle: 'Top choice for high-volume sales agents',
    monthlyPrice: 799,
    yearlyPrice: 7999,
    icon: Star,
    color: '#f59e0b',
    popular: true,
    features: [
      'Up to 10,000 active leads',
      '20 custom contact groups',
      '2,000 broadcast recipients / job',
      '5 concurrent campaign jobs',
      'Automated follow-up scheduler',
      'Win rate & conversion KPI reports',
      'Priority alert notifications',
    ],
  },
  {
    id: 'power_solo',
    name: 'Power Solo',
    subtitle: 'Maximum sales velocity for top solo producers',
    monthlyPrice: 1299,
    yearlyPrice: 12999,
    icon: Shield,
    color: '#8b5cf6',
    popular: false,
    features: [
      'Up to 25,000 active leads',
      '50 custom contact groups',
      '5,000 broadcast recipients / job',
      '10 concurrent campaign jobs',
      'Export permissions & data backup',
      'Multi-channel tags & filters',
      'Priority VIP WhatsApp support',
    ],
  },
];

const INDIVIDUAL_PLANS = SOLO_PLANS;

export default function PlansPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [loadingOrder, setLoadingOrder] = useState(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [validatedCoupon, setValidatedCoupon] = useState(null);

  // Dynamic Plans from Database
  const [dynamicSoloPlans, setDynamicSoloPlans] = useState(SOLO_PLANS);

  // Manual payment state
  const [showManualUpi, setShowManualUpi] = useState(false);
  const [selectedManualPlan, setSelectedManualPlan] = useState(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);

  const fetchStatus = () => {
    api.get('/auth/me')
      .then(res => {
        const u = res.data;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
        if (u.billingCycle) {
          setBillingCycle(u.billingCycle);
        }
      })
      .catch(() => {
        try {
          const local = localStorage.getItem('user');
          if (local) {
            const parsed = JSON.parse(local);
            setUser(parsed);
          }
        } catch {}
      })
      .finally(() => {
        setLoadingUser(false);
      });

    // Dynamic Plan Catalog Fetching from MongoDB
    api.get('/plans')
      .then(res => {
        if (res.data?.plans) {
          if (Array.isArray(res.data.plans.individual) && res.data.plans.individual.length > 0) {
            setDynamicSoloPlans(res.data.plans.individual.map((p, idx) => ({
              ...p,
              icon: idx === 0 ? Zap : (idx === 1 ? Star : Shield),
              color: idx === 0 ? '#3b82f6' : (idx === 1 ? '#f59e0b' : '#8b5cf6'),
            })));
          }
        }
      })
      .catch(() => {});

    api.get('/payments/my-request')
      .then(res => {
        if (res.data && res.data.status === 'pending') {
          setPendingPayment(res.data);
        } else {
          setPendingPayment(null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const calculatePrice = (plan) => {
    const rawPrice = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    let finalPrice = rawPrice;
    let discount = 0;

    if (validatedCoupon) {
      if (validatedCoupon.discountType === 'PERCENTAGE') {
        discount = Math.round((rawPrice * (validatedCoupon.discountValue || validatedCoupon.discountPercent || 0)) / 100);
        if (validatedCoupon.maxDiscountAmount && validatedCoupon.maxDiscountAmount > 0) {
          discount = Math.min(discount, validatedCoupon.maxDiscountAmount);
        }
      } else if (validatedCoupon.discountType === 'FLAT') {
        discount = validatedCoupon.discountValue || 0;
      } else {
        discount = Math.round((rawPrice * (validatedCoupon.discountPercent || 0)) / 100);
      }
      discount = Math.min(discount, rawPrice);
      finalPrice = Math.max(0, rawPrice - discount);
    }

    return {
      rawPrice,
      finalPrice,
      discount,
      monthlyEquivalent: billingCycle === 'yearly' ? Math.round(finalPrice / 12) : finalPrice,
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RAZORPAY AUTOMATED CHECKOUT
  // ─────────────────────────────────────────────────────────────────────────
  const handleRazorpayCheckout = async (plan) => {
    if (!user) {
      toast.error('Please sign in to subscribe to a plan.');
      return;
    }

    setLoadingOrder(plan.id);

    try {
      // 1. Create Razorpay order on backend
      const { data: orderData } = await api.post('/payments/create-order', {
        planId: plan.id,
        cycle: billingCycle,
        couponCode: validatedCoupon?.couponCode || validatedCoupon?.code || '',
      });

      if (!orderData || !orderData.orderId) {
        throw new Error('Failed to generate Razorpay order');
      }

      // 2. Open Razorpay Modal
      await ensureRazorpayScript();
      if (typeof window !== 'undefined' && window.Razorpay) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'SalesCRM Subscription',
          description: `${orderData.planName} (${billingCycle.toUpperCase()})`,
          order_id: orderData.orderId,
          prefill: {
            name: user.name || '',
            email: user.email || '',
            contact: user.phone || '',
          },
          theme: {
            color: '#6366f1',
          },
          handler: async function (response) {
            // 3. Cryptographic Signature Verification
            const verifyToast = toast.loading('Verifying secure payment signature...');
            try {
              const verifyRes = await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: orderData.planId,
                cycle: orderData.cycle,
                couponCode: validatedCoupon?.couponCode || validatedCoupon?.code || '',
              });

              toast.dismiss(verifyToast);
              toast.success(verifyRes.data.message || 'Payment verified! Plan activated.', { duration: 5000 });
              fetchStatus();
            } catch (vErr) {
              toast.dismiss(verifyToast);
              toast.error(vErr.response?.data?.message || 'Payment signature verification failed.');
            } finally {
              setLoadingOrder(null);
            }
          },
          modal: {
            ondismiss: function () {
              setLoadingOrder(null);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          toast.error(`Payment Failed: ${resp.error?.description || 'Transaction declined'}`);
          setLoadingOrder(null);
        });
        rzp.open();
      } else {
        toast.error('Razorpay SDK loading. Please retry in a few seconds.');
        setLoadingOrder(null);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to initiate checkout.');
      setLoadingOrder(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COUPON VALIDATION
  // ─────────────────────────────────────────────────────────────────────────
  const handleValidateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setValidatingCoupon(true);
    try {
      const res = await api.post('/coupons/validate', {
        couponCode: couponCode.trim(),
        cycle: billingCycle,
      });
      if (res.data?.valid) {
        setValidatedCoupon(res.data);
        toast.success(res.data.message || `Coupon "${res.data.couponCode}" applied successfully! 🎉`);
      } else {
        setValidatedCoupon(null);
        toast.error(res.data?.message || 'Invalid coupon code');
      }
    } catch (err) {
      setValidatedCoupon(null);
      toast.error(err.response?.data?.message || 'Invalid or expired coupon code.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL UPI PROOF SUBMISSION (LEGACY FALLBACK)
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmitManualProof = async (e) => {
    e.preventDefault();
    if (!utrNumber.trim() || utrNumber.trim().length < 10) {
      return toast.error('Please enter a valid 12-digit UPI UTR transaction reference number.');
    }
    if (!screenshotFile) {
      return toast.error('Please attach your payment screenshot receipt.');
    }

    setSubmittingManual(true);
    const formData = new FormData();
    formData.append('planSelected', selectedManualPlan.id);
    formData.append('originalPrice', calculatePrice(selectedManualPlan).rawPrice);
    formData.append('finalPrice', calculatePrice(selectedManualPlan).finalPrice);
    formData.append('utrNumber', utrNumber.trim());
    formData.append('screenshot', screenshotFile);
    if (validatedCoupon) formData.append('couponCodeUsed', validatedCoupon.code);

    try {
      const res = await api.post('/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'Payment submitted! Admin will verify within 5–15 mins.');
      setShowManualUpi(false);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit payment proof.');
    } finally {
      setSubmittingManual(false);
    }
  };

  const lifecycle = user?.subscriptionLifecycle;

  // Single-user Consultant Plans
  const activePlans = dynamicSoloPlans;

  if (loadingUser) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-6xl mx-auto w-full px-3 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div style={{ textAlign: 'center', margin: '32px 0 28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 12,
            border: '1px solid var(--accent)'
          }}>
            <Sparkles size={14} /> Admission Consultant CRM Plans
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, margin: '0 0 10px', color: 'var(--text)' }}>
            Scale Your Admission Consulting Practice
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 580, margin: '0 auto' }}>
            Choose a high-impact plan tailored for your solo admission consulting practice. Upgrade or cancel anytime.
          </p>
        </div>

        {/* Current Active Plan Card */}
        {user && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '18px 24px',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--accent-glow)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active Tier:</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    background: 'var(--accent-glow)',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    {user.plan || 'Free'} Plan
                  </span>
                  {lifecycle?.state === 'EXPIRING_SOON' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      ⚠️ Expires in {lifecycle.daysLeft}d
                    </span>
                  )}
                  {lifecycle?.state === 'GRACE_PERIOD' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      🚨 Grace Period ({lifecycle.graceDaysLeft}d left)
                    </span>
                  )}
                  {lifecycle?.state === 'LOCKED' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: 'rgba(185,28,28,0.2)', padding: '2px 8px', borderRadius: 6 }}>
                      🔒 Account Locked
                    </span>
                  )}
                </div>

                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  {user.planEndDate ? (
                    <>Renewal Date: <strong>{new Date(user.planEndDate).toLocaleDateString()}</strong> ({lifecycle?.daysLeft ?? 0} days remaining)</>
                  ) : (
                    <>Trial mode. 10 leads limit. Upgrade to unlock full candidate pipeline scale.</>
                  )}
                </p>
              </div>
            </div>

            {pendingPayment && (
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid #f59e0b',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                color: '#d97706',
                fontWeight: 600
              }}>
                ⏳ Verification Pending for <strong>{pendingPayment.planSelected}</strong> (UTR: {pendingPayment.utrNumber})
              </div>
            )}
          </div>
        )}

        {/* Audience Indicator & Billing Cycle Toggle */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          marginBottom: 32
        }}>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 12,
            padding: '8px 20px',
            color: '#818cf8',
            fontSize: 13,
            fontWeight: 700
          }}>
            <GraduationCap size={16} /> Admission Consultant Subscription Plans
          </div>

          {/* Monthly / Yearly Billing Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: billingCycle === 'monthly' ? 700 : 500, color: billingCycle === 'monthly' ? 'var(--text)' : 'var(--text-muted)' }}>
              Monthly Billing
            </span>
            <button
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
              style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                background: billingCycle === 'yearly' ? 'var(--accent)' : 'var(--border)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s ease',
                padding: 3
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#ffffff',
                transform: billingCycle === 'yearly' ? 'translateX(24px)' : 'translateX(0)',
                transition: 'transform 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: billingCycle === 'yearly' ? 700 : 500, color: billingCycle === 'yearly' ? 'var(--text)' : 'var(--text-muted)' }}>
                Annual Billing
              </span>
              <span style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 12,
                boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
              }}>
                Save ~16%
              </span>
            </div>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 24,
          marginBottom: 36
        }}>
          {activePlans.map(plan => {
            const Icon = plan.icon;
            const { rawPrice, finalPrice, discount, monthlyEquivalent } = calculatePrice(plan);
            const isCurrent = user?.plan === plan.id;
            const isLoading = loadingOrder === plan.id;

            return (
              <div
                key={plan.id}
                style={{
                  background: 'var(--card)',
                  borderRadius: 20,
                  border: plan.popular ? '2px solid var(--accent)' : '1px solid var(--border)',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: plan.popular ? '0 12px 32px rgba(99,102,241,0.18)' : 'var(--shadow-sm)',
                  transform: plan.popular ? 'scale(1.02)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--accent)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    padding: '4px 14px',
                    borderRadius: 20,
                    boxShadow: '0 4px 10px rgba(99,102,241,0.4)'
                  }}>
                    ★ Most Popular
                  </div>
                )}

                {/* Plan Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${plan.color}18`,
                    color: plan.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                      {plan.name}
                    </h3>
                    {plan.seats && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                        👥 {plan.seats} Team Seats
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', minHeight: 34 }}>
                  {plan.subtitle}
                </p>

                {/* Pricing Box */}
                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>
                      ₹{finalPrice.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>

                  {billingCycle === 'yearly' && (
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginTop: 4 }}>
                      ≈ ₹{monthlyEquivalent}/mo (billed annually)
                    </div>
                  )}
                  {discount > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>
                      🎉 {discount}% Coupon discount applied
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div style={{ flex: 1, marginBottom: 24 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                    What&apos;s Included:
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan.features.map((feat, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                        <Check size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action CTA */}
                {isCurrent ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: (plan.id === 'power_solo' || plan.id === 'enterprise' || plan.id === 'custom_enterprise')
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(99, 102, 241, 0.15)',
                      color: (plan.id === 'power_solo' || plan.id === 'enterprise' || plan.id === 'custom_enterprise')
                        ? '#10b981'
                        : 'var(--accent)',
                      border: `1px solid ${(plan.id === 'power_solo' || plan.id === 'enterprise' || plan.id === 'custom_enterprise') ? 'rgba(16, 185, 129, 0.35)' : 'rgba(99, 102, 241, 0.3)'}`,
                      fontWeight: 700,
                      fontSize: 13,
                      textAlign: 'center'
                    }}
                  >
                    {(plan.id === 'power_solo' || plan.id === 'enterprise' || plan.id === 'custom_enterprise') ? (
                      <>👑 Top Tier Active ({lifecycle?.daysLeft ?? 0}d left)</>
                    ) : (
                      <><CheckCircle2 size={16} color="var(--green)" /> Current Active ({lifecycle?.daysLeft ?? 0}d left)</>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleRazorpayCheckout(plan)}
                    disabled={isLoading}
                    className="btn btn-primary btn-full"
                    style={{
                      justifyContent: 'center',
                      gap: 8,
                      background: plan.popular ? 'var(--accent)' : 'transparent',
                      color: plan.popular ? '#ffffff' : 'var(--accent)',
                      border: `1.5px solid var(--accent)`
                    }}
                  >
                    {isLoading ? (
                      <div className="spinner" style={{ width: 18, height: 18 }} />
                    ) : (
                      <>
                        {user && user.plan !== 'free' ? 'Upgrade to ' + plan.name : 'Choose ' + plan.name} <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Custom Enterprise Plan Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: 20,
          padding: '28px 32px',
          marginBottom: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 24,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}>
          <div style={{ maxWidth: 620 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.3)', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#a5b4fc', marginBottom: 10 }}>
              <Layers size={14} /> High-Volume Custom Practice
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>
              Need Unlimited Candidate Capacity or Custom WhatsApp Gateways?
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              We build custom high-capacity solutions with dedicated multi-number WhatsApp routers, SLA support, tailored college ERP webhooks, and private cloud deployment.
            </p>
          </div>

          <a
            href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hi AdmissionCRM Team, I want to inquire about the Custom High-Volume Plan for my admission consulting practice.')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#22c55e',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(34,197,94,0.35)'
            }}
          >
            <MessageCircle size={18} /> Contact Sales on WhatsApp
          </a>
        </div>

        {/* Promo Coupon Card */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              Have a Promo Code or Organization Voucher?
            </h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Enter an active coupon code to redeem instant trial extensions or plan discounts.
            </p>
          </div>

          {validatedCoupon ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.35)',
                color: '#10b981',
                padding: '6px 14px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}>
                <CheckCircle2 size={16} />
                <span>Coupon Applied: <strong>{validatedCoupon.couponCode}</strong> ({validatedCoupon.discountType === 'PERCENTAGE' ? `${validatedCoupon.discountValue}% OFF` : `₹${validatedCoupon.discountValue} OFF`})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValidatedCoupon(null);
                  setCouponCode('');
                  toast.success('Coupon removed');
                }}
                className="btn btn-secondary"
                style={{ height: 36, padding: '0 12px', fontSize: 12 }}
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleValidateCoupon} style={{ display: 'flex', gap: 8, minWidth: 280 }}>
              <input
                type="text"
                placeholder="ENTER COUPON CODE"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                className="input"
                style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, height: 40, fontSize: 13 }}
              />
              <button
                type="submit"
                disabled={validatingCoupon || !couponCode.trim()}
                className="btn btn-primary"
                style={{ height: 40, padding: '0 16px', fontSize: 13 }}
              >
                {validatingCoupon ? 'Validating...' : 'Apply'}
              </button>
            </form>
          )}
        </div>

        {/* Secondary Manual UPI Transfer Drawer (Legacy fallback) */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '20px 24px'
        }}>
          <div
            onClick={() => setShowManualUpi(!showManualUpi)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <QrCode size={20} color="var(--accent)" />
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  Alternative Payment Option: Manual UPI Transfer & Proof Upload
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Click to transfer directly to UPI ID <strong>{UPI_ID}</strong> and submit 12-digit UTR receipt.
                </p>
              </div>
            </div>
            <ChevronRight size={18} style={{ transform: showManualUpi ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>

          {showManualUpi && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <form onSubmit={handleSubmitManualProof} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
                <div>
                  <label className="label">1. Select Desired Plan</label>
                  <select
                    className="input"
                    value={selectedManualPlan?.id || ''}
                    onChange={e => {
                      setSelectedManualPlan(activePlans.find(p => p.id === e.target.value) || null);
                    }}
                    required
                  >
                    <option value="">Choose plan...</option>
                    {activePlans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{calculatePrice(p).finalPrice}/{billingCycle}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedManualPlan && (
                  <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 10, fontSize: 13, border: '1px solid var(--border)' }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Pay via UPI App (GPay / PhonePe / Paytm):</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{UPI_ID}</span>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>₹{calculatePrice(selectedManualPlan).finalPrice}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">2. Enter 12-Digit UPI UTR Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 423819827364"
                    value={utrNumber}
                    onChange={e => setUtrNumber(e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">3. Upload Payment Screenshot Receipt</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setScreenshotFile(e.target.files[0] || null)}
                    className="input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingManual || !selectedManualPlan}
                  className="btn btn-primary"
                  style={{ justifyContent: 'center' }}
                >
                  {submittingManual ? 'Submitting Receipt...' : 'Submit UTR Receipt for Verification'}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" id="razorpay-checkout-script" />
      <BottomNav active="plans" />
    </div>
  );
}
