import React from 'react';
import { useApp } from '../App';
import { 
  Users, 
  Flame, 
  Send, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

const Overview: React.FC = () => {
  const { activeCampaign, leads } = useApp();

  // Filter leads for the active campaign to calculate metrics
  const activeLeads = activeCampaign 
    ? leads.filter(l => l.campaign_id === activeCampaign.id) 
    : leads;

  const totalLeads = activeLeads.length;
  const hotLeads = activeLeads.filter(l => l.priority === 'HOT').length;
  const outreachSent = activeLeads.filter(l => l.status !== 'NEW').length;
  const meetingsBooked = activeLeads.filter(l => l.status === 'MEETING').length;

  const getProgressPercent = () => {
    return activeCampaign ? Math.round(activeCampaign.progress) : 0;
  };

  const getAgentStatus = (stepIndex: number) => {
    if (!activeCampaign) return 'pending';
    
    // Check if campaign failed
    if (activeCampaign.status === 'failed') {
      // Find if this step failed or was pending
      const log = activeCampaign.logs?.find((l: any) => l.agent_name.toLowerCase().includes(getAgentName(stepIndex).toLowerCase()));
      if (log?.status === 'failed') return 'failed';
    }

    const progress = activeCampaign.progress;
    const thresholds = [14, 28, 42, 56, 70, 86, 100];
    
    if (progress >= thresholds[stepIndex]) {
      return 'completed';
    }
    
    if (activeCampaign.status === 'running') {
      if (stepIndex === 0 && progress < thresholds[0]) return 'running';
      if (stepIndex > 0 && progress >= thresholds[stepIndex - 1] && progress < thresholds[stepIndex]) return 'running';
    }
    
    return 'pending';
  };

  const getAgentName = (index: number) => {
    const names = [
      "Supervisor Planning",
      "Agent 1: Prospect Discovery",
      "Agent 2: Deep Research",
      "Agent 3: Contact Discovery",
      "Agent 4: Fit Scoring Engine",
      "Agent 5: Sequence Writer",
      "Agent 6: Tracker & Follow-Up"
    ];
    return names[index];
  };

  const agents = [
    {
      name: "Supervisor Planning",
      desc: "Interpretar necesidad del usuario y preparar estrategias de ejecución",
    },
    {
      name: "Agent 1: Prospect Discovery",
      desc: "Descubrir prospectos objetivo, recolectar sitios web y metadatos",
    },
    {
      name: "Agent 2: Deep Research",
      desc: "Extraer tamaño de negocio, propuesta de valor y puntos de dolor (pain points)",
    },
    {
      name: "Agent 3: Contact Discovery",
      desc: "Localizar tomadores de decisiones clave, roles y correos de contacto",
    },
    {
      name: "Agent 4: Fit Scoring Engine",
      desc: "Evaluar perfiles según métricas de coincidencia con el ICP (0 a 100)",
    },
    {
      name: "Agent 5: Sequence Writer",
      desc: "Redactar secuencias de contacto personalizadas (Email, WhatsApp, LinkedIn)",
    },
    {
      name: "Agent 6: Tracker & Follow-Up",
      desc: "Registrar prospectos calificados en el pipeline general e inicializar Kanban",
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Metrics Row */}
      <div className="metrics-grid">
        
        {/* Metric 1 */}
        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(112, 72, 232, 0.1)', color: '#7048e8' }}>
            <Users size={22} />
          </div>
          <div className="metric-info">
            <h3>TOTAL LEADS</h3>
            <p>{totalLeads}</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(255, 77, 109, 0.1)', color: '#ff4d6d' }}>
            <Flame size={22} />
          </div>
          <div className="metric-info">
            <h3>HOT LEADS (ICP)</h3>
            <p>{hotLeads}</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(28, 126, 214, 0.1)', color: '#1c7ed6' }}>
            <Send size={22} />
          </div>
          <div className="metric-info">
            <h3>OUTREACH SENT</h3>
            <p>{outreachSent}</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(43, 138, 62, 0.1)', color: '#2b8a3e' }}>
            <Calendar size={22} />
          </div>
          <div className="metric-info">
            <h3>MEETINGS BOOKED</h3>
            <p>{meetingsBooked}</p>
          </div>
        </div>

      </div>

      {/* Main Grid: Pipeline and Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
        
        {/* Pipeline Panel */}
        <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.3rem' }}>Autonomous Agent Pipeline</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Secuencia en vivo del orquestador y checkpoints del flujo</span>
            </div>
            
            {/* Progress indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '120px', height: '8px', backgroundColor: '#e4e6eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${getProgressPercent()}%`,
                  backgroundColor: 'var(--accent-mint)',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease-in-out'
                }}></div>
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', minWidth: '40px' }}>
                {getProgressPercent()}% Done
              </span>
            </div>
          </div>

          {/* List of Agents */}
          <div className="pipeline-list">
            {agents.map((agent, idx) => {
              const status = getAgentStatus(idx);
              const isActive = status === 'running';
              const isDone = status === 'completed';
              const isFailed = status === 'failed';

              return (
                <div key={idx} className={`agent-row ${isActive ? 'active' : ''}`} style={{
                  backgroundColor: isDone ? 'rgba(118, 232, 167, 0.02)' : 'var(--bg-card)'
                }}>
                  <div className="agent-info">
                    <div className={`agent-icon ${isDone ? 'completed' : isActive ? 'running' : ''}`} style={{
                      color: isDone ? '#0ca678' : isActive ? '#f59f00' : isFailed ? '#c92a2a' : 'var(--text-muted)',
                      backgroundColor: isDone ? '#e6fcf5' : isActive ? '#fff9db' : isFailed ? '#fff5f5' : '#f8f9fa'
                    }}>
                      {isDone ? (
                        <CheckCircle2 size={18} />
                      ) : isActive ? (
                        <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                      ) : isFailed ? (
                        <AlertCircle size={18} />
                      ) : (
                        <Clock size={18} />
                      )}
                    </div>
                    <div className="agent-text">
                      <h4 style={{ color: isDone ? 'var(--text-primary)' : isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {agent.name}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)' }}>{agent.desc}</p>
                    </div>
                  </div>

                  <span className={`agent-status-badge ${status}`} style={{
                    backgroundColor: isDone ? '#f3f0ff' : isActive ? '#fff9db' : isFailed ? '#fff5f5' : '#f1f3f5',
                    color: isDone ? '#7048e8' : isActive ? '#f59f00' : isFailed ? '#c92a2a' : '#868e96',
                  }}>
                    {status === 'completed' ? 'ACTIVE / COMPLETE' : status === 'running' ? 'EJECUTANDO' : status === 'failed' ? 'ERROR' : 'PENDIENTE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logs Panel (Technical Terminal Console) */}
        <div className="glass-panel-dark" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-mint)', display: 'inline-block' }}></span>
              Consola de Razonamiento del Pipeline
            </h3>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              DeepSeek Log Stream
            </span>
          </div>

          <div style={{
            flexGrow: 1,
            backgroundColor: '#17191a',
            borderRadius: '10px',
            padding: '16px',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            lineHeight: '1.4',
            overflowY: 'auto',
            maxHeight: '480px',
            minHeight: '380px',
            color: '#a9b2c3'
          }}>
            {!activeCampaign ? (
              <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>Ninguna campaña ejecutándose en este momento.</p>
            ) : activeCampaign.logs && activeCampaign.logs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeCampaign.logs.map((log: any, idx: number) => (
                  <div key={log.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--accent-mint)', fontWeight: 'bold' }}>[{log.agent_name}]</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.7rem' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', color: log.status === 'failed' ? '#ff8787' : '#ccd4e0' }}>
                      {log.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255, 255, 255, 0.4)' }}>
                <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>Iniciando supervisor y definiendo tareas...</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Overview;
