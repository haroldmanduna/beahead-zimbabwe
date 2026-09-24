import { serve } from "https://deno.land/std@0.200.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html } = await req.json()

    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailUser || !gmailPass) {
      console.log('Gmail not configured, logging email instead:', { to, subject })
      return new Response(
        JSON.stringify({ success: true, mocked: true, message: 'Gmail not configured - email logged', to, subject }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const client = new SmtpClient()
    
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: gmailUser,
      password: gmailPass,
    })

    await client.send({
      from: `BeAhead <${gmailUser}>`,
      to: to,
      subject: subject,
      content: "BeAhead notification",
      html: html,
    })

    await client.close()

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent via Gmail SMTP', to }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Email error:', error)
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
