import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../auth';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8 || password !== confirmation) {
      setError('Mínimo 8 caracteres y deben coincidir.');
      return;
    }
    if (!supabase) { setError('No configurado'); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setMessage('Contraseña cambiada correctamente.');
  };

  return <div className="login-page">
    <div className="login-brand">
      <img src="/logodm.png" alt="DM Event Lovers" className="login-logo" />
      <div><strong>EVENT LOVERS</strong><small>SDR AGENT</small></div>
    </div>
    <form className="login-form" onSubmit={submit}>
      <h1>Nueva contraseña</h1>
      {message && <div className="login-error" style={{ color: '#38d9a9', background: 'rgba(56,217,169,.08)', border: '1px solid rgba(56,217,169,.18)' }}>{message} <Link to="/login" className="login-forgot">Ir al login</Link></div>}
      {error && <div className="login-error">{error}</div>}
      <label><span>Nueva contraseña</span><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></label>
      <label><span>Confirmar</span><input type="password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Repite la contraseña" /></label>
      <button type="submit">Actualizar contraseña</button>
    </form>
  </div>;
};

export default ResetPassword;