// Email helper using Gmail SMTP via Supabase Edge Function
// Free Gmail SMTP: smtp.gmail.com:587 with App Password

import { supabase } from './supabase'

export const sendEmail = async ({ to, subject, html, type = 'transactional' }) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, type }
    })
    if (error) throw error
    return { success: true, data }
  } catch (err) {
    console.error('Email failed:', err)
    // Fallback: log to beahead_activities for manual follow-up
    return { success: false, error: err.message }
  }
}

// Pre-built email templates
export const emailTemplates = {
  welcome: (name, escrowRef) => ({
    subject: `Welcome to BeAhead — Your escrow reference ${escrowRef}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <img src="https://beahead-zimbabwe.onrender.com/logo.png" style="width: 40px; height: 40px; border-radius: 10px;"/>
        <h2 style="font-size: 20px; font-weight: 600; margin-top: 24px;">Welcome to BeAhead, ${name}</h2>
        <p style="font-size: 14px; color: #555; line-height: 1.6;">Your escrow reference is <b>${escrowRef}</b>. Save monthly into your own bank account. We'll help you import your BeForward car when you're ready.</p>
        <p style="font-size: 13px; color: #777;">No fees to start. 7% fee only if you cancel early.</p>
        <a href="https://beahead-zimbabwe.onrender.com" style="display: inline-block; background: #18181b; color: white; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-size: 13px; margin-top: 16px;">Go to dashboard</a>
        <p style="font-size: 11px; color: #999; margin-top: 32px;">Built in Bulawayo • Pilot phase</p>
      </div>
    `
  }),
  
  depositReceived: (name, amount, car, ref) => ({
    subject: `Deposit received — ${amount} for ${car}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="font-size: 18px; font-weight: 600;">Deposit received, ${name}</h2>
        <p style="font-size: 14px; color: #555;">We received <b>${amount}</b> for your <b>${car}</b> plan.</p>
        <p style="font-size: 13px; color: #555;">Reference: <code>${ref}</code><br/>Status: Pending verification by bank (usually a few hours)</p>
        <p style="font-size: 12px; color: #777; margin-top: 16px;">You'll get an SMS once verified.</p>
      </div>
    `
  }),
  
  depositVerified: (name, amount, car, totalSaved, progress) => ({
    subject: `Verified — ${amount} added to your ${car} plan`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="font-size: 18px; font-weight: 600;">Deposit verified ✓</h2>
        <p style="font-size: 14px; color: #555;"><b>${amount}</b> added to your ${car} plan.</p>
        <p style="font-size: 14px; color: #555;">Total saved: <b>${totalSaved}</b> (${progress}% of goal)</p>
        <a href="https://beahead-zimbabwe.onrender.com" style="display: inline-block; background: #18181b; color: white; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-size: 12px; margin-top: 12px;">View progress</a>
      </div>
    `
  }),
  
  goalCreated: (name, car, total) => ({
    subject: `Savings plan created — ${car} — ${total} total`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="font-size: 18px; font-weight: 600;">Your savings plan is live</h2>
        <p style="font-size: 14px; color: #555;">Car: <b>${car}</b><br/>Total needed: <b>${total}</b> (car + shipping + duty + delivery)</p>
        <p style="font-size: 13px; color: #555;">Add money via EcoCash, InnBucks, bank transfer or cash. Upload proof. Bank verifies.</p>
      </div>
    `
  })
}
