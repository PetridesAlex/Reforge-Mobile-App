import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * REFORGE Store checkout Edge Function (Phase 5).
 *
 * - Never expose Stripe secret keys to the Expo client.
 * - Creates a Checkout Session (when STRIPE_SECRET_KEY is set) OR
 *   confirms mock payment securely for development.
 * - Payment confirmation for live Stripe should also be handled by
 *   `store-stripe-webhook` — never trust the client alone.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Missing authorization" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(500, { error: "Server misconfigured" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json();
    const orderId = body?.orderId as string | undefined;
    if (!orderId) return json(400, { error: "orderId required" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderErr } = await admin
      .from("store_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) return json(500, { error: orderErr.message });
    if (!order) return json(404, { error: "Order not found" });
    if (order.user_id !== user.id) return json(403, { error: "Forbidden" });
    if (order.payment_status === "paid") {
      return json(200, { alreadyPaid: true, orderId });
    }

    // Live Stripe path (optional until keys are configured)
    if (stripeSecret && order.payment_provider === "stripe") {
      const params = new URLSearchParams();
      params.set("mode", "payment");
      params.set("success_url", body.successUrl ?? "reforge://store/orders/" + orderId);
      params.set("cancel_url", body.cancelUrl ?? "reforge://store/cart");
      params.set("client_reference_id", orderId);
      params.set("metadata[order_id]", orderId);
      params.set("line_items[0][price_data][currency]", (order.currency as string).toLowerCase());
      params.set("line_items[0][price_data][product_data][name]", `REFORGE ${order.order_number}`);
      params.set("line_items[0][price_data][unit_amount]", String(order.total_cents));
      params.set("line_items[0][quantity]", "1");

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        return json(502, { error: session?.error?.message ?? "Stripe error" });
      }

      await admin
        .from("store_orders")
        .update({
          stripe_checkout_session_id: session.id,
          payment_status: "pending",
        })
        .eq("id", orderId);

      return json(200, { checkoutUrl: session.url, sessionId: session.id });
    }

    // Mock / development payment confirmation (server-side)
    const { data: paid, error: payErr } = await admin.rpc("mark_store_order_paid", {
      p_order_id: orderId,
      p_provider: "mock",
      p_stripe_payment_intent_id: null,
      p_stripe_checkout_session_id: null,
    });
    if (payErr) return json(500, { error: payErr.message });

    return json(200, { mockComplete: true, order: paid });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
