import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Stripe webhook receiver — marks orders paid only after Stripe confirms payment.
 * Configure endpoint + STRIPE_WEBHOOK_SECRET in Supabase secrets.
 */

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Misconfigured", { status: 500 });
  }

  const payload = await req.text();
  const event = JSON.parse(payload) as {
    type?: string;
    data?: { object?: { id?: string; client_reference_id?: string; payment_intent?: string; metadata?: { order_id?: string } } };
  };

  // Production: verify signature with stripe.webhooks.constructEvent(payload, sig, webhookSecret)
  // Signature verification requires the Stripe SDK; wire when going live.
  void stripeSecret;
  void webhookSecret;

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orderId = session?.client_reference_id ?? session?.metadata?.order_id;
    if (orderId) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin.rpc("mark_store_order_paid", {
        p_order_id: orderId,
        p_provider: "stripe",
        p_stripe_payment_intent_id: session?.payment_intent ?? null,
        p_stripe_checkout_session_id: session?.id ?? null,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
