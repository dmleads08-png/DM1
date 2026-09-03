import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { Sparkles, Play, Search, AlertTriangle } from 'lucide-react';

const Landing: React.FC = () => {
  const { org, campaigns, startCampaign, setActiveCampaign } = useApp();
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [maxLeads, setMaxLeads] = useState(12);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || !name || !city) {
      setLocalError("Por favor completa el nombre, la ciudad y la necesidad de la campaña.");
      return;
    }

    if (org && org.plan === 'free' && org.leads_used >= org.leads_limit) {
      setLocalError("Límite de leads excedido en Plan Gratuito (máximo 5 leads). Actualiza a Plan Premium.");
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      await startCampaign(name, prompt, city, maxLeads);
      navigate('/dashboard/overview');
    } catch (err: any) {
      setLocalError(err.message || "Error al iniciar la campaña");
    } finally {
      setLoading(false);
    }
  };

  const selectCampaign = (camp: any) => {
    setActiveCampaign(camp);
    navigate('/dashboard/overview');
  };

  return (
    <div style={{
      maxWidth: '850px',
      margin: '40px auto 0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px'
    }}>
      {/* Brand & Introduction Header */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#242729',
          border: '2px solid var(--accent-mint)',
          borderRadius: '12px',
          padding: '10px 24px',
          fontWeight: 900,
          fontSize: '2.5rem',
          color: 'var(--accent-mint)',
          fontStyle: 'italic',
          letterSpacing: '-1.5px',
          boxShadow: '0 0 20px rgba(118, 232, 167, 0.15)',
          marginBottom: '16px'
        }}>
          dm
        </div>
        <h1 style={{ color: 'var(--text-light)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px' }}>
          Event Lovers - SDR Multi-Agente
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            Automatiza la prospección, análisis profundo y redacción de secuencias frías mediante un pipeline secuencial de agentes con el razonamiento de DeepSeek.
        </p>
      </div>

      {/* Main Campaign Setup Card (Glassmorphic) */}
      <div className="glass-panel" style={{ padding: '36px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles style={{ color: 'var(--accent-mint)' }} />
          Iniciar Nueva Campaña de Prospección
        </h2>

        {localError && (
          <div style={{
            backgroundColor: '#fff5f5',
            color: '#c92a2a',
            border: '1px solid #ffc9c9',
            padding: '14px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertTriangle size={18} />
            {localError}
          </div>
        )}

        <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
              Nombre de la Campaña:
            </label>
            <input 
              type="text" 
              placeholder="Ej: Prospección de Restaurantes en Guadalajara"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
              Ciudad objetivo:
            </label>
            <input
              type="text"
              placeholder="Ej: Guadalajara, Jalisco"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px' }}>
              Se usará directamente para orientar las búsquedas y validar la ubicación.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
              ¿Cuál es tu necesidad de prospección? (Prompt del Orquestador):
            </label>
            <textarea
              rows={4}
              placeholder="Ej: necesito crear una campaña para ofrecer nuestro servicio de organización de eventos corporativos a restaurantes premium y salones en Guadalajara, buscando decisores y redactando secuencias."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
              Cantidad máxima de prospectos:
            </label>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={maxLeads}
              onChange={(e) => setMaxLeads(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              style={{
                width: '160px',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px' }}>
              Es un límite superior; la campaña puede devolver menos si no encuentra prospectos válidos.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ 
              alignSelf: 'flex-start', 
              padding: '14px 32px', 
              fontSize: '1rem',
              backgroundColor: 'var(--bg-dark)',
              color: 'var(--accent-mint)',
              border: '2px solid var(--accent-mint)',
              boxShadow: 'none'
            }}
          >
            <Search size={18} />
            {loading ? 'Inicializando Agentes...' : 'Start Research'}
          </button>
        </form>
      </div>

      {/* Past Campaigns List */}
      <div>
        <h3 style={{ color: 'var(--text-light)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>
          Campañas Anteriores
        </h3>
        
        {campaigns.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay campañas previas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campaigns.map((camp) => (
              <div 
                key={camp.id}
                onClick={() => selectCampaign(camp)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              >
                <div>
                  <h4 style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                    {camp.name}
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {camp.prompt}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: camp.status === 'completed' ? 'rgba(118, 232, 167, 0.15)' : camp.status === 'completed_with_review' ? 'rgba(245, 159, 0, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                    color: camp.status === 'completed' ? 'var(--accent-mint)' : camp.status === 'completed_with_review' ? '#f59f00' : 'var(--text-muted)',
                    textTransform: 'uppercase'
                  }}>
                    {camp.status}
                  </span>
                  <Play size={16} style={{ color: 'var(--accent-mint)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Landing;
