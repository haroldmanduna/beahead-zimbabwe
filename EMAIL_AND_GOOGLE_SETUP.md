# BeAhead - Gmail SMTP + Google Auth Setup (Free)

## Part 1: Gmail Free SMTP (for transactional emails)

You said you want to use Gmail free SMTP. Here's how:

### Step 1: Create Gmail App Password
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (required)
3. Search "App Passwords" or go to https://myaccount.google.com/apppasswords
4. Create new app: Select "Mail" + "Other (Custom name)" → Type "BeAhead"
5. Copy the 16-char password: e.g. `abcd efgh ijkl mnop` (remove spaces → `abcdefghijklmnop`)

### Step 2: Configure Supabase Auth SMTP (for login emails, OTP, etc)
1. Go to https://supabase.com/dashboard/project/clqqnipibcnouwinzbuc/auth/smtp
2. Enable Custom SMTP
3. Fill:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: Your Gmail, e.g. `haroldmanduna4@gmail.com`
   - Password: The App Password you copied
   - Sender email: Same Gmail
   - Sender name: `BeAhead`
4. Save

Now all Supabase auth emails (confirm signup, password reset) come from your Gmail for free.

### Step 3: Configure Transactional Emails (welcome, deposit verified)
For custom emails like "Welcome to BeAhead", "Deposit received", we built an Edge Function.

1. Go to https://supabase.com/dashboard/project/clqqnipibcnouwinzbuc/functions
2. Create new function: `send-email`
3. Copy code from `supabase/functions/send-email/index.ts` in this repo
4. Go to **Edge Functions > Secrets** and add:
   - `GMAIL_USER` = your Gmail
   - `GMAIL_APP_PASSWORD` = your 16-char app password (no spaces)
5. Deploy function

The Edge Function uses Deno SMTP to send via `smtp.gmail.com:465` with your Gmail.

**Free limits:** Gmail allows 500 emails/day for free. Perfect for pilot (25 users). For scale, switch to Resend/SendGrid later.

**Code already added in app:**
- `src/lib/email.js` has `sendEmail()` helper + templates for welcome, depositReceived, depositVerified, goalCreated
- App.jsx calls `sendEmail()` on signup, goal creation, deposit

If Edge Function not deployed yet, emails fallback to logging in `beahead_activities` table — no crash.

---

## Part 2: Google Sign-Up / Sign-In (Free)

### Step 1: Google Cloud Console
1. Go to https://console.cloud.google.com
2. Create new project: "BeAhead Zimbabwe"
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth Client ID**
5. If asked, configure OAuth consent screen:
   - User Type: External
   - App name: BeAhead
   - Support email: your Gmail
   - Scopes: email, profile, openid
   - Add test user: your Gmail
6. Create OAuth Client ID:
   - Application type: Web application
   - Name: BeAhead Web
   - Authorized JavaScript origins:
     - `https://clqqnipibcnouwinzbuc.supabase.co`
     - `https://beahead-zimbabwe.onrender.com`
     - `http://localhost:5173`
   - Authorized redirect URIs:
     - `https://clqqnipibcnouwinzbuc.supabase.co/auth/v1/callback`
     - `https://beahead-zimbabwe.onrender.com`
     - `http://localhost:5173`
7. Copy **Client ID** and **Client Secret**

### Step 2: Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/clqqnipibcnouwinzbuc/auth/providers
2. Find **Google** → Enable
3. Paste Client ID + Client Secret from Google Cloud
4. Save

### Step 3: Test
- In app, click "Continue with Google"
- Should redirect to Google, then back to BeAhead dashboard
- Profile auto-created in `beahead_profiles` with escrow reference BA-XXXXXX
- Welcome email sent via Gmail SMTP

**Code already added:**
- App.jsx has `handleGoogleAuth()` using `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Auth state listener auto-creates profile for Google users
- Button with Google logo in auth page

---

## Part 3: Environment Variables

For local dev, create `.env`:
```
VITE_SUPABASE_URL=https://clqqnipibcnouwinzbuc.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_AZJtat5-kvLSIPt9o_ChKA_veXLms5D
```

For Render, already set in dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

For Edge Function secrets (in Supabase Dashboard > Functions > Secrets):
- `GMAIL_USER=your@gmail.com`
- `GMAIL_APP_PASSWORD=your16charapppassword`

---

## Part 4: What Emails Are Sent

1. **Welcome** — On signup (email + Google) — escrow reference
2. **Goal Created** — When user creates savings plan — car + total
3. **Deposit Received** — When user submits deposit — pending verification
4. **Deposit Verified** — After bank verifies — total saved + progress (you can trigger manually or auto after 1.5s in current code)

All templates in `src/lib/email.js` — edit HTML there.

---

## Free Tier Summary

- Gmail SMTP: 500 emails/day free
- Google OAuth: Free, unlimited
- Supabase Auth: 50k MAU free
- Supabase Edge Functions: 500k invocations free
- No billing needed until scale

Once you hit 500 emails/day, switch to Resend (free 3k/month) or SendGrid.

---

## Quick Checklist

- [ ] Gmail 2FA enabled + App Password created
- [ ] Supabase Auth SMTP configured with Gmail
- [ ] Edge Function `send-email` deployed + secrets set
- [ ] Google Cloud OAuth Client ID + Secret created
- [ ] Google provider enabled in Supabase with Client ID/Secret
- [ ] Test Google sign-in + email welcome

Done — you have free Gmail SMTP + Google auth.
