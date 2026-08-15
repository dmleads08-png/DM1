import React from 'react';
import { useApp } from '../App';
import { Terminal, Shield, CheckCircle, AlertOctagon, TerminalSquare } from 'lucide-react';

const AgentLogs: React.FC = () => {
  const { activeCampaign } = useApp();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="glass-panel" style={{ border: '1px solid rgba(0, 0, 0, 0.05)', padding: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '6px' }}>
          Consola y Registros de Auditoría (Agent Logs)
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
           Historial completo de auditoría y razonamiento de las etapas del pipeline de prospección.
        </span>
      </div>

      <div className="glass-panel-dark" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '450px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-mint)', fontWeight: 700, fontSize: '0.95rem' }}>
            <TerminalSquare size={18} />
            CONSOLA DE EJECUCIÓN DEL ORQUESTADOR
          </span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.3)' }}>
            Nivel: INFO / DEBUG
          </span>
        </div>

        <div style={{
          backgroundColor: '#17191a',
          borderRadius: '8px',
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          color: '#ccd4e0',
          lineHeight: '1.6',
          overflowY: 'auto',
          flexGrow: 1,
          maxHeight: '550px'
        }}>
          {!activeCampaign ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.2)', fontStyle: 'italic' }}>No hay ninguna campaña activa seleccionada.</p>
          ) : activeCampaign.logs && activeCampaign.logs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Init line */}
              <div>
                <span style={{ color: '#868e96' }}>[SYSTEM]</span> Inicializando pipeline secuencial de agentes...
              </div>

              {activeCampaign.logs.map((log: any, idx: number) => {
                const dateStr = new Date(log.created_at).toISOString();
                
                return (
                  <div key={log.id || idx} style={{ borderLeft: '2px solid rgba(255, 255, 255, 0.05)', paddingLeft: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ color: '#868e96' }}>[{dateStr}]</span>
                      <span style={{ color: 'var(--accent-mint)', fontWeight: 700 }}>[{log.agent_name.toUpperCase()}]</span>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: log.status === 'completed' ? 'rgba(12, 166, 120, 0.2)' : 'rgba(245, 159, 0, 0.2)',
                        color: log.status === 'completed' ? '#0ca678' : '#f59f00',
                        textTransform: 'uppercase'
                      }}>
                        {log.status}
                      </span>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', color: '#ccd4e0', paddingLeft: '4px' }}>
                      {log.message}
                    </p>
                  </div>
                );
              })}

              {activeCampaign.status === 'completed' && (
                <div style={{ color: 'var(--accent-mint)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <CheckCircle size={16} />
                  [SYSTEM] Pipeline secuencial ejecutado de manera exitosa. Estado: COMPLETADO.
                </div>
              )}

            </div>
          ) : (
            <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
              Esperando logs de agentes para la campaña "{activeCampaign.name}"...
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AgentLogs;
