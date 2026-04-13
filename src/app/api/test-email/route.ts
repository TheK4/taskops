import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const to = searchParams.get('to')

  if (!to) {
    return NextResponse.json(
      { error: 'Parâmetro "to" é obrigatório.' },
      { status: 400 }
    )
  }

  const { data, error } = await resend.emails.send({
    from: 'TaskOps <onboarding@resend.dev>',
    to,
    subject: 'Teste de email do TaskOps',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Teste de email</h2>
        <p>Seu sistema TaskOps está conseguindo enviar emails.</p>
        <p>Se você recebeu esta mensagem, a integração com o Resend está funcionando.</p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data,
  })
}