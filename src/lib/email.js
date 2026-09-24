// Email helper using Gmail SMTP via Render service
// Service: https://beahead-email.onrender.com
// Free Gmail SMTP: 500 emails/day

const EMAIL_SERVICE_URL = 'https://beahead-email.onrender.com';

export const sendEmail = async ({ to, subject, html, type = 'transactional' }) => {
  try {
    // Try Render email service first (real Gmail SMTP)
    const res = await fetch(`${EMAIL_SERVICE_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, type })
    });
    
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Email failed');
    
    console.log('✅ Email sent via Gmail SMTP:', data.messageId, 'to', to);
    return { success: true, data };
  } catch (err) {
    console.error('Email via Render failed, trying Supabase fallback:', err.message);
    
    // Fallback to Supabase Edge Function (if configured)
    try {
      const { supabase } = await import('./supabase');
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, type }
      });
      if (error) throw error;
      return { success: true, data, fallback: true };
    } catch (fallbackErr) {
      console.error('Both email methods failed:', fallbackErr.message);
      // Final fallback: just log - don't break app
      return { success: false, error: err.message, mocked: true };
    }
  }
}

// Pre-built email templates - premium design
export const emailTemplates = {
  welcome: (name, escrowRef) => ({
    subject: `Welcome to BeAhead — Your escrow reference ${escrowRef}`,
    html: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #fafaf9;">
        <div style="background: white; border-radius: 20px; padding: 32px; border: 1px solid #e4e4e7;">
          <img src="https://beahead-zimbabwe.onrender.com/logo.png" style="width: 40px; height: 40px; border-radius: 10px;"/>
          <h2 style="font-size: 20px; font-weight: 600; margin-top: 24px; letter-spacing: -0.02em; color: #18181b;">Welcome to BeAhead, ${name}</h2>
          <p style="font-size: 14px; color: #52525b; line-height: 1.6; margin-top: 12px;">Your escrow reference is <b style="color: #18181b; background: #f4f4f5; padding: 2px 8px; border-radius: 999px; font-size: 12px;">${escrowRef}</b></p>
          <p style="font-size: 14px; color: #52525b; line-height: 1.6;">Save monthly into your own bank account. We'll help you import your BeForward car when you're ready. No fees to start.</p>
          <a href="https://beahead-zimbabwe.onrender.com" style="display: inline-block; background: #18181b; color: white; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-size: 13px; font-weight: 500; margin-top: 20px;">Go to dashboard →</a>
          <p style="font-size: 11px; color: #a1a1aa; margin-top: 32px; border-top: 1px solid #f4f4f5; padding-top: 16px;">Built in Bulawayo • Pilot phase • Your money stays in your bank</p>
        </div>
      </div>
    `
  }),
  
  depositReceived: (name, amount, car, ref) => ({
    subject: `Deposit received — ${amount} for ${car}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #fafaf9;">
        <div style="background: white; border-radius: 20px; padding: 32px; border: 1px solid #e4e4e7;">
          <h2 style="font-size: 18px; font-weight: 600; color: #18181b;">Deposit received</h2>
          <p style="font-size: 14px; color: #52525b; margin-top: 8px;">Hi ${name}, we received <b style="color: #18181b;">${amount}</b> for your <b style="color: #18181b;">${car}</b> plan.</p>
          <div style="background: #f4f4f5; border-radius: 12px; padding: 12px 16px; margin-top: 16px; font-size: 12px;">
            <div>Reference: <code style="background: white; padding: 2px 6px; border-radius: 4px;">${ref}</code></div>
            <div style="margin-top: 4px; color: #71717a;">Status: Pending verification (usually a few hours)</div>
          </div>
          <p style="font-size: 12px; color: #a1a1aa; margin-top: 16px;">You'll get an SMS once verified by your bank.</p>
        </div>
      </div>
    `
  }),
  
  depositVerified: (name, amount, car, totalSaved, progress) => ({
    subject: `Verified ✓ — ${amount} added to your ${car} plan`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #fafaf9;">
        <div style="background: white; border-radius: 20px; padding: 32px; border: 1px solid #e4e4e7;">
          <div style="width: 32px; height: 32px; background: #18181b; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">✓</div>
          <h2 style="font-size: 18px; font-weight: 600; margin-top: 16px; color: #18181b;">Deposit verified</h2>
          <p style="font-size: 14px; color: #52525b; margin-top: 8px;"><b style="color: #18181b;">${amount}</b> added to your ${car} plan.</p>
          <p style="font-size: 14px; color: #52525b;">Total saved: <b style="color: #18181b;">${totalSaved}</b> (${progress}% of goal)</p>
          <a href="https://beahead-zimbabwe.onrender.com" style="display: inline-block; background: #18181b; color: white; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-size: 12px; font-weight: 500; margin-top: 16px;">View progress →</a>
        </div>
      </div>
    `
  }),
  
  goalCreated: (name, car, total) => ({
    subject: `Savings plan created — ${car}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #fafaf9;">
        <div style="background: white; border-radius: 20px; padding: 32px; border: 1px solid #e4e4e7;">
          <h2 style="font-size: 18px; font-weight: 600; color: #18181b;">Your savings plan is live</h2>
          <p style="font-size: 14px; color: #52525b; margin-top: 8px;">Car: <b style="color: #18181b;">${car}</b><br/>Total needed: <b style="color: #18181b;">${total}</b></p>
          <p style="font-size: 13px; color: #71717a; line-height: 1.5; margin-top: 12px;">This includes car price, shipping, ZIMRA duty estimate and delivery to Zimbabwe. Add money via EcoCash, InnBucks, bank transfer or cash.</p>
          <a href="https://beahead-zimbabwe.onrender.com" style="display: inline-block; background: #18181b; color: white; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-size: 12px; font-weight: 500; margin-top: 16px;">Add first deposit →</a>
        </div>
      </div>
    `
  })
}
