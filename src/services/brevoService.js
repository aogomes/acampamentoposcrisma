/**
 * Serviço de integração com a API REST do Brevo (v3)
 * Documentação: https://developers.brevo.com/reference/sendtransacemail
 */

export const enviarEmailCodigoRecuperacao = async ({ email, nome, codigo }) => {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;

  if (!apiKey) {
    console.error('VITE_BREVO_API_KEY não configurada no arquivo .env');
    throw new Error('A chave de API do Brevo (VITE_BREVO_API_KEY) não está configurada no arquivo .env.');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
        .content { padding: 32px 24px; text-align: center; }
        .greeting { font-size: 16px; color: #475569; margin-bottom: 16px; text-align: left; }
        .instructions { font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px; text-align: left; }
        .code-box { background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace; margin: 0; }
        .timer-badge { display: inline-block; background: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-top: 12px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Acampamento Pós-Crisma</h1>
        </div>
        <div class="content">
          <p class="greeting">Olá, <strong>${nome || 'Participante'}</strong>!</p>
          <p class="instructions">
            Recebemos uma solicitação para redefinir a sua senha de acesso. Use o código de 6 dígitos abaixo para confirmar sua identidade e cadastrar sua nova senha:
          </p>

          <div class="code-box">
            <div class="code">${codigo}</div>
            <div class="timer-badge">⏱ Válido por 15 minutos</div>
          </div>

          <p class="instructions" style="font-size: 13px; color: #64748b;">
            Se você não solicitou a recuperação de senha, desconsidere este e-mail com segurança. Sua senha atual permanecerá inalterada.
          </p>
        </div>
        <div class="footer">
          VIII Acampamento do Pós-Crisma &bull; Paróquia Santa Maria dos Pobres<br>
          Esta é uma mensagem automática, por favor não responda a este e-mail.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'Acampamento Pós-Crisma PSMP',
          email: 'peregrinacaorosario@gmail.com'
        },
        to: [
          {
            email: email,
            name: nome || email
          }
        ],
        subject: `Código de Recuperação: ${codigo} - Acampamento Pós-Crisma`,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Erro na resposta do Brevo:', errBody);
      throw new Error(errBody.message || `Erro no envio do e-mail (Status ${response.status})`);
    }

    const data = await response.json();
    return { sucesso: true, data };
  } catch (error) {
    console.error('Falha ao enviar e-mail via Brevo:', error);
    throw error;
  }
};
