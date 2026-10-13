-- Payments moved from Stripe to Paystack. The Stripe-specific PaymentIntent id column
-- becomes a provider-neutral transaction reference (Paystack's `reference`).
alter table public.payments rename column stripe_payment_intent_id to reference;
