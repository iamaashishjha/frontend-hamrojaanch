import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Lock,
  Mail,
  ShieldCheck,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { getExam } from "@/lib/exams-module-api";
import { confirmPayment, createOrder, createPaymentIntent, validateCoupon } from "@/lib/payments-api";
import { paymentProviders } from "@/lib/payments-providers";
import { useExamSession } from "@/hooks/useExamSession";
import type { AdminExam } from "@/lib/exams-module-types";
import type { PaymentProvider } from "@/lib/payments-types";
import "./CheckoutPage.css";

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { update } = useExamSession();
  const { settings } = useSiteSettings();
  const footerLinks = settings.footer.links.filter((link) => link.label && link.href);
  const supportEmail = settings.contact.email?.trim();
  const supportChatLink = settings.support.chatLink?.trim() || null;
  const supportTicketLink = settings.support.ticketLink?.trim() || null;
  const supportLink =
    supportChatLink || supportTicketLink || (supportEmail ? `mailto:${supportEmail}` : null);
  const supportLabel = supportChatLink
    ? "Live Chat"
    : supportTicketLink
    ? "Open Ticket"
    : "Contact Support";
  const examId = searchParams.get("examId");
  const [selectedExam, setSelectedExam] = useState<AdminExam | null>(null);
  const [loading, setLoading] = useState(Boolean(examId));
  const [errorMessage, setErrorMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerEmailError, setBuyerEmailError] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>("stripe");
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; finalAmount: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const primaryCtaRef = useRef<HTMLButtonElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!examId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorMessage("");
      try {
        const exam = await getExam(examId);
        if (!exam) {
          setErrorMessage("Exam not found.");
        } else if (exam.pricing.mode !== "PAID") {
          // Free/Demo: no payment — send to system-check then exam (login only)
          navigate(`/system-check?examId=${examId}`, { replace: true });
          return;
        } else {
          setSelectedExam(exam);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load exam details.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [examId, navigate]);

  const pricingLabel = useMemo(() => {
    if (!selectedExam) return "Free";
    if (selectedExam.pricing.mode === "PAID") return "Paid";
    if (selectedExam.pricing.isDemo) return "Demo";
    return "Free";
  }, [selectedExam]);

  const subtotalValue = useMemo(() => {
    if (!selectedExam) return 0;
    if (selectedExam.pricing.mode !== "PAID") return 0;
    return selectedExam.pricing.discountPrice ?? selectedExam.pricing.price ?? 0;
  }, [selectedExam]);

  const priceValue = appliedCoupon ? appliedCoupon.finalAmount : subtotalValue;

  const currency = selectedExam?.pricing.currency ?? "";
  const totalLabel = selectedExam
    ? currency
      ? `${currency} ${priceValue}`
      : String(priceValue)
    : "--";
  const buyerInitials = useMemo(() => {
    const value = buyerName.trim();
    if (!value) return "G";
    const parts = value.split(" ").filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
    return initials.join("") || "G";
  }, [buyerName]);

  const cartItems = selectedExam
    ? [
        {
          title: selectedExam.name,
          duration: `${selectedExam.durationMinutes} Minutes`,
          price: pricingLabel === "Paid" ? totalLabel : pricingLabel,
        },
    ]
    : [];

  const providerOptions = useMemo(
    () => paymentProviders.filter((provider) => provider.id !== "manual"),
    []
  );

  const isCardProvider = selectedProvider === "stripe";

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || selectedExam?.pricing.mode !== "PAID") return;
    setPromoApplying(true);
    setPromoError("");
    try {
      const result = await validateCoupon(promoCode.trim(), subtotalValue);
      if (result.valid && result.discountAmount != null && result.finalAmount != null) {
        setAppliedCoupon({ code: result.code ?? promoCode.trim(), discountAmount: result.discountAmount, finalAmount: result.finalAmount });
      } else {
        setAppliedCoupon(null);
        setPromoError(result.error ?? "Invalid or expired coupon");
      }
    } catch {
      setAppliedCoupon(null);
      setPromoError("Unable to validate coupon");
    } finally {
      setPromoApplying(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedCoupon(null);
    setPromoCode("");
    setPromoError("");
  };

  const handleCheckout = async () => {
    if (!selectedExam) return;
    if (!buyerEmail.trim()) {
      const message = "Email is required to complete checkout.";
      setErrorMessage(message);
      setBuyerEmailError(message);
      emailInputRef.current?.focus();
      return;
    }
    setProcessing(true);
    setErrorMessage("");
    setBuyerEmailError("");
    try {
      const order = await createOrder({
        examId: selectedExam.id,
        buyerName: buyerName.trim() || "Guest",
        buyerEmail: buyerEmail.trim(),
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      });
      if (order.amount > 0) {
        const intent = await createPaymentIntent({
          orderId: order.id,
          provider: selectedProvider,
        });
        await confirmPayment(intent.id);
      }
      update({ examId: selectedExam.id, email: buyerEmail.trim() });
      navigate(`/system-check?examId=${selectedExam.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete checkout.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="checkout-page public-page-scale">
      <div className="checkout-shell">
        <header className="checkout-nav">
          <Link to="/" className="brand">
            <LogoMark className="h-9 w-9" />
            <BrandText />
          </Link>
          <nav className="checkout-links" aria-label="Primary">
            <Link to="/">Home</Link>
            <Link to="/all-exams">All Exams</Link>
            <a href="#how">How it Works</a>
            <a href="#faq">FAQ</a>
            <Link to="/student-dashboard">My Account</Link>
          </nav>
          <div className="checkout-actions">
            <div className="cart-pill">
              <Ticket size={16} />
              <span>{loading ? "..." : totalLabel}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => primaryCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              disabled={processing}
            >
              Checkout
            </button>
          </div>
        </header>

        <section className="checkout-hero">
          <div className="hero-title">
            <Lock size={18} />
            <h1>Secure Checkout</h1>
          </div>
          <div className="checkout-steps">
            <div className="step active">
              <span>1</span>
              <p>Review Cart</p>
            </div>
            <div className="step active">
              <span>2</span>
              <p>Payment</p>
            </div>
            <div className="step">
              <span>3</span>
              <p>Confirmation</p>
            </div>
          </div>
        </section>

        <section className="checkout-main">
          <div className="payment-panel">
            <h2>Payment Details</h2>
            <div className="form-block">
              <label>
                Billing Information
                <div className="input">
                  <User size={16} />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={buyerName}
                    onChange={(event) => setBuyerName(event.target.value)}
                  />
                </div>
              </label>
              <label>
                Email Address
                <div className="input">
                  <Mail size={16} />
                  <input
                    type="email"
                    placeholder="johndoe@email.com"
                    value={buyerEmail}
                    onChange={(event) => {
                      setBuyerEmail(event.target.value);
                      if (buyerEmailError) setBuyerEmailError("");
                      if (errorMessage === "Email is required to complete checkout.") {
                        setErrorMessage("");
                      }
                    }}
                    ref={emailInputRef}
                  />
                </div>
              </label>
              {buyerEmailError && (
                <p className="field-error" role="alert">
                  {buyerEmailError}
                </p>
              )}
              <label>
                Country
                <div className="input">
                  <span className="flag">NP</span>
                  <select defaultValue="NP">
                    <option value="NP">Nepal (NPR)</option>
                    <option value="IN">India</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>
              </label>
            </div>

            <div className="form-block">
              <h3>Payment Method</h3>
              <div className="pay-tabs">
                {providerOptions.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className={selectedProvider === provider.id ? "active" : ""}
                    onClick={() => setSelectedProvider(provider.id)}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {providerOptions.find((provider) => provider.id === selectedProvider)?.description ??
                  "Choose a payment option to continue."}
              </p>
              {isCardProvider ? (
                <>
                  <label>
                    Card Number
                    <div className="input">
                      <CreditCard size={16} />
                      <input type="text" placeholder="1234 - 5678 - 9101 1234" />
                    </div>
                  </label>
                  <div className="split-row">
                    <label>
                      Expiration Date
                      <div className="input">
                        <CalendarDays size={16} />
                        <input type="text" placeholder="08/26" />
                      </div>
                    </label>
                    <label>
                      CVC
                      <div className="input">
                        <Wallet size={16} />
                        <input type="text" placeholder="123" />
                      </div>
                    </label>
                  </div>
                  <label>
                    Cardholder Name
                    <div className="input">
                      <User size={16} />
                      <input type="text" placeholder="John Doe" />
                    </div>
                  </label>
                </>
              ) : (
                <p className="redirect-hint">
                  You&apos;ll be redirected to {providerOptions.find((p) => p.id === selectedProvider)?.label} to
                  complete this payment securely. No card details are stored by HamroJaanch.
                </p>
              )}
              <div className="payment-logos">
                <span>VISA</span>
                <span>Mastercard</span>
                <span>Amex</span>
                <span>PayPal</span>
              </div>
              <div className="payment-safe">
                <span>
                  <ShieldCheck size={16} /> GDPR Compliant
                </span>
                <span>
                  <Lock size={16} /> SSL Encrypted Payment
                </span>
              </div>
            </div>

            <div className="secure-banner">
              <div>
                <h4>100% Secure Payment</h4>
                <p>Payments are encrypted and securely processed by your chosen method.</p>
              </div>
              <div className="secure-grid">
                <span>
                  <ShieldCheck size={16} /> AI &amp; Live Proctoring
                </span>
                <span>
                  <BadgeCheck size={16} /> Instant Results
                </span>
                <span>
                  <CalendarDays size={16} /> Flexible Scheduling
                </span>
                <span>
                  <Lock size={16} /> GDPR Compliant
                </span>
              </div>
            </div>
          </div>

          <aside className="summary-panel">
            <div className="summary-card">
              <h3>Order Summary</h3>
              <div className="summary-user">
                <div className="avatar">{buyerInitials}</div>
                <div>
                  <strong>{buyerName.trim() || "Guest"}</strong>
                  <span>{buyerEmail.trim() || "email@domain.com"}</span>
                </div>
              </div>
              <div className="summary-list">
                {loading ? (
                  <p className="summary-empty">Loading exam details...</p>
                ) : errorMessage ? (
                  <p className="summary-empty">{errorMessage}</p>
                ) : cartItems.length === 0 ? (
                  <div className="summary-empty space-y-2">
                    <p>Select an exam to continue.</p>
                    <Link to="/all-exams" className="text-sm text-primary underline">
                      Browse exams
                    </Link>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.title} className="summary-item">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.duration}</span>
                      </div>
                      <span className="price">{item.price}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="promo-row">
                <input
                  type="text"
                  placeholder="Promo Code"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); }}
                  disabled={!!appliedCoupon || selectedExam?.pricing.mode !== "PAID"}
                />
                {appliedCoupon ? (
                  <button type="button" onClick={handleRemovePromo}>Remove</button>
                ) : (
                  <button type="button" onClick={() => void handleApplyPromo()} disabled={promoApplying || !promoCode.trim() || selectedExam?.pricing.mode !== "PAID"}>
                    {promoApplying ? "..." : "Apply"}
                  </button>
                )}
              </div>
              {promoError && <p className="text-xs text-red-600 mt-1">{promoError}</p>}
              {appliedCoupon && (
                <p className="text-xs text-emerald-600 mt-1">
                  {appliedCoupon.code}: -{currency} {appliedCoupon.discountAmount}
                </p>
              )}
              <div className="summary-total">
                <div>
                  <span>Subtotal</span>
                  <span>{pricingLabel === "Paid" ? (currency ? `${currency} ${subtotalValue}` : String(subtotalValue)) : pricingLabel}</span>
                </div>
                {appliedCoupon && (
                  <div>
                    <span>Discount</span>
                    <span className="text-emerald-600">-{currency} {appliedCoupon.discountAmount}</span>
                  </div>
                )}
                <div>
                  <span>Service Fee</span>
                  <span>{selectedExam ? (pricingLabel === "Paid" ? `${currency || "NPR"} 0` : "Included") : "--"}</span>
                </div>
                <div className="grand">
                  <strong>Total</strong>
                  <strong>{pricingLabel === "Paid" ? totalLabel : pricingLabel}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary full"
                onClick={() => void handleCheckout()}
                disabled={processing || loading || !selectedExam}
                ref={primaryCtaRef}
              >
                {processing
                  ? "Processing..."
                  : pricingLabel === "Paid"
                  ? "Complete Payment"
                  : "Confirm Access"}
              </button>
              <div className="summary-logos">
                <span>VISA</span>
                <span>Mastercard</span>
                <span>Amex</span>
                <span>PayPal</span>
              </div>
            </div>

            <div className="support-card">
              <h3>Need Assistance?</h3>
              {supportLink ? (
                <a className="support-btn" href={supportLink} target="_blank" rel="noreferrer">
                  {supportLabel}
                </a>
              ) : (
                <button type="button" className="support-btn" disabled>
                  Contact Support
                </button>
              )}
              <div className="support-footer">
                <span>
                  <Lock size={14} /> GDPR Compliant
                </span>
                {supportEmail ? <span>{supportEmail}</span> : null}
              </div>
            </div>
          </aside>
        </section>

        <footer className="checkout-footer">
          <div className="footer-strip">
            <span>
              <ShieldCheck size={16} /> AI &amp; Live Proctoring
            </span>
            <span>
              <BadgeCheck size={16} /> Secure &amp; Private
            </span>
            <span>
              <CalendarDays size={16} /> 24/7 Support
            </span>
            <span>
              <Lock size={16} /> GDPR Compliant
            </span>
          </div>
          <div className="footer-links">
            {footerLinks.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}


