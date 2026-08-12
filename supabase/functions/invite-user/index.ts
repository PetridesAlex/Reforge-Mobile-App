import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InviteBody = {
  email?: string;
  fullName?: string;
  phone?: string;
  role?: "member" | "coach";
  coachId?: string;
  gender?: "male" | "female" | "other";
  skipInvite?: boolean;
};

function billingEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `billing+${digits || Date.now()}@reforge.local`;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Missing authorization" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

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

    if (userError || !user) {
      return json(401, { error: "Unauthorized" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: callerError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (callerError) {
      return json(500, { error: callerError.message });
    }

    if (callerProfile?.role !== "admin") {
      return json(403, { error: "Only admins can invite users" });
    }

    const body = (await req.json()) as InviteBody;
    const fullName = body.fullName?.trim() ?? "";
    const phone = body.phone?.trim() || null;
    const role = body.role === "coach" ? "coach" : "member";
    const coachId = body.coachId?.trim() || null;
    const skipInvite = body.skipInvite === true;
    const gender =
      body.gender === "male" || body.gender === "female" || body.gender === "other"
        ? body.gender
        : null;

    const email =
      body.email?.trim().toLowerCase() ??
      (phone ? billingEmailFromPhone(phone) : "");

    if (!fullName) {
      return json(400, { error: "Full name is required" });
    }

    if (!email) {
      return json(400, { error: "Email or phone is required" });
    }

    if (!skipInvite && !body.email?.trim()) {
      return json(400, { error: "Email is required to send an invite" });
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return json(409, { error: "An account with this email already exists" });
    }

    let invitedUserId: string;

    if (skipInvite) {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
          role,
        },
      });

      if (createError) {
        return json(400, { error: createError.message });
      }

      if (!created.user) {
        return json(500, { error: "Member saved but no user was returned" });
      }

      invitedUserId = created.user.id;
    } else {
      const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? "reforge://reset-password";

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo,
          data: {
            full_name: fullName,
            phone,
            role,
          },
        },
      );

      if (inviteError) {
        return json(400, { error: inviteError.message });
      }

      const invitedUser = inviteData.user;
      if (!invitedUser) {
        return json(500, { error: "Invite succeeded but no user was returned" });
      }

      invitedUserId = invitedUser.id;
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        role,
        gender,
      })
      .eq("id", invitedUserId)
      .select("*")
      .single();

    if (profileError) {
      return json(500, { error: profileError.message });
    }

    if (role === "member" && coachId) {
      const { data: coachProfile } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", coachId)
        .maybeSingle();

      if (coachProfile && (coachProfile.role === "coach" || coachProfile.role === "admin")) {
        const { error: linkError } = await adminClient.from("coach_clients").upsert(
          {
            coach_id: coachId,
            member_id: invitedUserId,
          },
          { onConflict: "coach_id,member_id" },
        );

        if (linkError) {
          console.warn("coach_clients link failed:", linkError.message);
        }
      }
    }

    return json(200, { profile, emailSent: !skipInvite });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invite failed";
    return json(500, { error: message });
  }
});
