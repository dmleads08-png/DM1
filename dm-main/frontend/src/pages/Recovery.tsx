import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env.VITE_SUPABASE_URL || '';
const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
const supabase = url && key ? createClient(url, key) : null;

const Recovery: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setMessage(null);
    if (!supabase) return setError('No configurado');
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setMessage('Revisa tu correo para continuar.');
    } catch (err: any) { setError(err.message); }
  };

  return <div className="login-page">
    <Link to="/login" className="login-back"><ArrowLeft size={16}/> Volver</Link>
    <div className="login-brand"><img src="/logodm.png" alt="DM Event Lovers" className="login-logo" /><div><strong>EVENT LOVERS</strong><small>SDR AGENT</small></div></div>
    <form className="login-form" onSubmit={submit}>
      <h1>Recuperar contraseña</h1>
      <p style={{ color:'#8c9399', fontSize:'0.88rem' }}>Te enviaremos un enlace para restablecerla.</p>
      {message && <div className="login-error" style={{ color:'#38d9a9', background:'rgba(56,217,169,.08)', border:'1px solid rgba(56,217,169,.18)' }}>{message}</div>}
      {error && <div className="login-error">{error}</div>}
      <label><span>Email</span><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"/></label>
      <button type="submit"><Mail size={16}/> Enviar</button>
      <Link to="/login" className="login-forgot">Volver al login</Link>
    </form>
  </div>;
};

export default Recovery;
