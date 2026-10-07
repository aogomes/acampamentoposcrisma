import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { enviarEmailCodigoRecuperacao } from '../services/brevoService';
import { registrarAuditoria } from '../services/auditoriaService';
import {
  LogIn,
  KeyRound,
  Mail,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Estados do Modal de Recuperação de Senha (Etapa 1 e Etapa 2)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = solicitar email, 2 = validar código e nova senha
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNome, setForgotNome] = useState('');
  const [forgotCodigo, setForgotCodigo] = useState('');
  const [forgotNovaSenha, setForgotNovaSenha] = useState('');
  const [forgotConfirmarSenha, setForgotConfirmarSenha] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [tempoRestante, setTempoRestante] = useState(900); // 15 minutos em segundos

  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Temporizador regressivo de 15 minutos na Etapa 2
  useEffect(() => {
    let timer = null;
    if (showForgotModal && forgotStep === 2 && tempoRestante > 0) {
      timer = setInterval(() => {
        setTempoRestante((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showForgotModal, forgotStep, tempoRestante]);

  const formatarTempo = (segundos) => {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Falha ao conectar com o Google');
      registrarAuditoria({
        acao: 'LOGIN_GOOGLE_FALHA',
        categoria: 'AUTENTICACAO',
        nivel: 'WARNING',
        descricao: `Falha no login Google: ${err.message}`,
        detalhes: { erro: err.message }
      });
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn({ email, password });
      if (error) throw error;

      registrarAuditoria({
        acao: 'LOGIN',
        categoria: 'AUTENTICACAO',
        nivel: 'INFO',
        descricao: `Usuário efetuou login com sucesso: ${email.trim()}`,
        userEmail: email.trim(),
        detalhes: { metodo: 'email_senha' }
      });

      navigate('/');
    } catch (err) {
      registrarAuditoria({
        acao: 'LOGIN_FALHA',
        categoria: 'AUTENTICACAO',
        nivel: 'WARNING',
        descricao: `Tentativa de login sem sucesso para ${email.trim()}: ${err.message}`,
        userEmail: email.trim(),
        detalhes: { erro: err.message, metodo: 'email_senha' }
      });
      setError(err.message || 'Falha ao fazer login. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de recuperação
  const handleOpenForgot = () => {
    registrarAuditoria({
      acao: 'RECUPERAR_SENHA_CLIQUE',
      categoria: 'AUTENTICACAO',
      nivel: 'INFO',
      descricao: `Usuário clicou em Esqueci Minha Senha`,
      userEmail: email.trim() || null
    });

    setForgotEmail(email || '');
    setForgotStep(1);
    setForgotCodigo('');
    setForgotNovaSenha('');
    setForgotConfirmarSenha('');
    setForgotMessage('');
    setForgotError('');
    setTempoRestante(900);
    setShowForgotModal(true);
  };

  // Etapa 1: Gerar código e enviar pelo Brevo
  const handleEnviarCodigo = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);

    try {
      // 1. Gerar o código de 6 dígitos no Supabase
      const { data, error: rpcError } = await supabase.rpc('gerar_codigo_recuperacao', {
        p_email: forgotEmail
      });

      if (rpcError) throw rpcError;
      if (!data?.codigo) throw new Error('Não foi possível gerar o código de recuperação.');

      setForgotNome(data.nome || 'Participante');

      // 2. Disparar o e-mail via API REST do Brevo
      await enviarEmailCodigoRecuperacao({
        email: forgotEmail,
        nome: data.nome,
        codigo: data.codigo
      });

      registrarAuditoria({
        acao: 'RECUPERAR_SENHA_CODIGO_ENVIADO',
        categoria: 'AUTENTICACAO',
        nivel: 'INFO',
        descricao: `Código de verificação enviado para ${forgotEmail.trim()}`,
        userEmail: forgotEmail.trim(),
        userNome: data.nome || null
      });

      // 3. Sucesso: iniciar contador de 15 minutos e avançar para etapa 2
      setTempoRestante(900);
      setForgotStep(2);
      setForgotMessage(`Código enviado com sucesso para ${forgotEmail}!`);
    } catch (err) {
      console.error('Erro na solicitação de código:', err);
      registrarAuditoria({
        acao: 'RECUPERAR_SENHA_CODIGO_ERRO',
        categoria: 'AUTENTICACAO',
        nivel: 'WARNING',
        descricao: `Falha ao gerar/enviar código de recuperação para ${forgotEmail.trim()}: ${err.message}`,
        userEmail: forgotEmail.trim(),
        detalhes: { erro: err.message }
      });
      setForgotError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Etapa 2: Validar código de 6 dígitos e gravar nova senha
  const handleValidarCodigoERedefinir = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');

    if (tempoRestante <= 0) {
      setForgotError('O prazo de 15 minutos expirou. Por favor, solicite um novo código.');
      return;
    }

    if (!forgotCodigo || forgotCodigo.trim().length !== 6) {
      setForgotError('O código deve conter exatamente 6 dígitos.');
      return;
    }

    if (forgotNovaSenha.length < 6) {
      setForgotError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (forgotNovaSenha !== forgotConfirmarSenha) {
      setForgotError('As senhas não coincidem.');
      return;
    }

    try {
      setForgotLoading(true);

      const { error: rpcErr } = await supabase.rpc('validar_codigo_e_alterar_senha', {
        p_email: forgotEmail,
        p_codigo: forgotCodigo.trim(),
        p_nova_senha: forgotNovaSenha
      });

      if (rpcErr) throw rpcErr;

      registrarAuditoria({
        acao: 'RECUPERAR_SENHA_CONCLUIDA',
        categoria: 'AUTENTICACAO',
        nivel: 'INFO',
        descricao: `Senha redefinida com sucesso via código para ${forgotEmail.trim()}`,
        userEmail: forgotEmail.trim()
      });

      setForgotMessage('Senha alterada com sucesso! Você já pode entrar.');

      // Preenche os campos do formulário principal
      setEmail(forgotEmail);
      setPassword(forgotNovaSenha);

      setTimeout(() => {
        setShowForgotModal(false);
      }, 1800);
    } catch (err) {
      console.error('Erro ao validar código:', err);
      registrarAuditoria({
        acao: 'RECUPERAR_SENHA_CONCLUSAO_ERRO',
        categoria: 'AUTENTICACAO',
        nivel: 'WARNING',
        descricao: `Falha ao validar código e redefinir senha para ${forgotEmail.trim()}: ${err.message}`,
        userEmail: forgotEmail.trim(),
        detalhes: { erro: err.message }
      });
      setForgotError(err.message || 'Código inválido ou erro ao atualizar senha.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <h4 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.25rem' }}>Acampamento Pós-Crisma</h4>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="btn-google"
          disabled={googleLoading || loading}
          style={{ marginBottom: '1rem' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          {googleLoading ? 'Conectando ao Google...' : 'Continuar com o Google'}
        </button>

        <div className="auth-divider">ou continue com e-mail</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.75rem' }}>
            <button
              type="button"
              onClick={handleOpenForgot}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: '500',
                padding: 0
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            <LogIn size={20} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Não tem uma conta? <Link to="/register">Cadastre-se</Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: RECUPERAÇÃO DE SENHA COM CÓDIGO DE 6 DÍGITOS (15 MINUTOS)           */}
      {/* ========================================================================= */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={22} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {forgotStep === 1 ? 'Recuperar Senha' : 'Validar Código'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {forgotError && (
              <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotMessage && (
              <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <CheckCircle size={18} style={{ flexShrink: 0 }} />
                <span>{forgotMessage}</span>
              </div>
            )}

            {/* ETAPA 1: DIGITAR E-MAIL */}
            {forgotStep === 1 && (
              <form onSubmit={handleEnviarCodigo}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Informe o seu e-mail. Enviaremos um <strong>código de 6 dígitos</strong> com validade de <strong>15 minutos</strong> para você redefinir sua senha.
                </p>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" htmlFor="forgot-email" style={{ fontWeight: '600' }}>
                    Seu E-mail Cadastrado
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    className="form-input"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn btn-secondary"
                    disabled={forgotLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading || !forgotEmail}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Mail size={16} />
                    {forgotLoading ? 'Enviando...' : 'Enviar Código'}
                  </button>
                </div>
              </form>
            )}

            {/* ETAPA 2: VALIDAR CÓDIGO E DEFINIR NOVA SENHA */}
            {forgotStep === 2 && (
              <form onSubmit={handleValidarCodigoERedefinir}>
                {/* Badge do temporizador de 15 minutos */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: tempoRestante > 120 ? '#eff6ff' : '#fee2e2',
                    border: `1px solid ${tempoRestante > 120 ? '#bfdbfe' : '#fca5a5'}`,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: tempoRestante > 120 ? '#1e40af' : '#991b1b' }}>
                    <Clock size={16} />
                    <span>Validade do código:</span>
                  </div>
                  <strong style={{ fontFamily: 'monospace', fontSize: '1rem', color: tempoRestante > 120 ? '#1e40af' : '#991b1b' }}>
                    {formatarTempo(tempoRestante)}
                  </strong>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: '600' }}>
                      Código de 6 Dígitos
                    </label>
                    <button
                      type="button"
                      onClick={handleEnviarCodigo}
                      disabled={forgotLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontWeight: '600'
                      }}
                    >
                      <RefreshCw size={12} /> Reenviar Código
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    placeholder="000000"
                    value={forgotCodigo}
                    onChange={(e) => setForgotCodigo(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      letterSpacing: '8px',
                      fontFamily: 'monospace',
                      fontWeight: 'bold'
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Nova Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Mínimo de 6 caracteres"
                      value={forgotNovaSenha}
                      onChange={(e) => setForgotNovaSenha(e.target.value)}
                      required
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>
                    Confirmar Nova Senha
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Digite a nova senha novamente"
                    value={forgotConfirmarSenha}
                    onChange={(e) => setForgotConfirmarSenha(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="btn btn-secondary"
                    disabled={forgotLoading}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Trocar E-mail
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={forgotLoading || forgotCodigo.length !== 6 || tempoRestante <= 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <ArrowRight size={16} />
                    {forgotLoading ? 'Validando...' : 'Redefinir Senha'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
