import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env.VITE_SUPABASE_URL || '';
const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
const supabase = url && key ? createClient(url, key) : null;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!supabase) { setSessionChecked(true); navigate('/login'); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSessionChecked(true);
      if (data.session) {
        axios.defaults.headers.common.Authorization = `Bearer ${data.session.access_token}`;
        resolveRoleAndRedirect();
      }
    }).catch(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        axios.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
        resolveRoleAndRedirect();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const resolveRoleAndRedirect = async () => {
    try {
      const VITE_API = import.meta.env.VITE_API_URL || 'http://localhost:3378/api';
      const res = await axios.get(`${VITE_API}/me`);
      navigate(res.data.role === 'admin' ? '/dashboard/admin' : '/dashboard/campaigns', { replace: true });
    } catch { navigate('/dashboard/campaigns', { replace: true }); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) { setError('Supabase no configurado'); return; }
    setLoading(true); setError(null);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
      setLoading(false);
    }
  };

  const sendRecovery = async () => {
    if (!email) { setError('Ingresa tu email'); return; }
    if (!supabase) return;
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setError('');
      alert('Si el email existe, recibirás un enlace de recuperación.');
    } catch (err: any) { setError(err.message); }
  };

  if (!sessionChecked) return <div className="splash"><img src="/favicon1.png" alt="Cargando..." /></div>;

  return <div className="login-page">
    <Link to="/" className="login-back"><ArrowLeft size={16}/> Volver</Link>
    <div className="login-brand"><img src="/logodm.png" alt="DM Event Lovers" className="login-logo" /><div><strong>EVENT LOVERS</strong><small>SDR AGENT</small></div></div>
    <form className="login-form" onSubmit={submit}>
      <h1>Iniciar sesión</h1>
      {error && <div className="login-error">{error}</div>}
      <label><span>Email</span><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"/></label>
      <label><span>Contraseña</span><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/></label>
      <button type="submit" disabled={loading || !supabase}><LogIn size={16}/>{loading?'Verificando...':'Acceder'}</button>
      <button type="button" onClick={sendRecovery} style={{ background:'transparent', color:'var(--accent-mint)', border:'1px solid var(--accent-mint)', padding:'12px', borderRadius:'9px', cursor:'pointer', fontSize:'0.88rem' }}>Recuperar contraseña</button>
    </form>
  </div>;
};

export default Login;
