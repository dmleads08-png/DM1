import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Trash2, Power, Plus, Building, UserPlus, Users } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-production-ed91.up.railway.app/api';

interface DbUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string;
  organization_name: string;
  is_active: boolean;
  created_at: string;
}

interface DbOrg {
  id: string;
  name: string;
  plan: string;
}

const Admin: React.FC = () => {
  const [organizationName, setOrganizationName] = useState('');
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', organization_id: '', role: 'user' });
  const [usersList, setUsersList] = useState<DbUser[]>([]);
  const [orgsList, setOrgsList] = useState<DbOrg[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await axios.get(`${API_URL}/admin/users`);
      setUsersList(response.data);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/organizations`);
      setOrgsList(response.data);
      if (response.data.length > 0) {
        setUserForm(prev => {
          const exists = response.data.some((o: DbOrg) => o.id === prev.organization_id);
          if (!exists) {
            return { ...prev, organization_id: response.data[0].id };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchOrgs();
  }, []);

  const createOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/admin/organizations`, { name: organizationName });
      setMessage(`Organización creada: ${response.data.name}.`);
      setOrganizationName('');
      await fetchOrgs();
      setUserForm((current) => ({ ...current, organization_id: response.data.id }));
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'No se pudo crear la organización.');
    }
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/admin/users`, userForm);
      setMessage(`Usuario creado: ${response.data.email}. Ya puede iniciar sesión.`);
      setUserForm(prev => ({ ...prev, email: '', name: '', password: '' }));
      fetchUsers();
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'No se pudo crear el usuario.');
    }
  };

  const toggleUserStatus = async (dbUser: DbUser) => {
    try {
      await axios.patch(`${API_URL}/admin/users/${dbUser.id}`, { is_active: !dbUser.is_active });
      setUsersList(prev => prev.map(u => u.id === dbUser.id ? { ...u, is_active: !u.is_active } : u));
    } catch (error: any) {
      alert(error.response?.data?.detail || 'No se pudo actualizar el estado del usuario.');
    }
  };

  const deleteUser = async (dbUser: DbUser) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${dbUser.name}?`)) return;
    try {
      await axios.delete(`${API_URL}/admin/users/${dbUser.id}`);
      setUsersList(prev => prev.filter(u => u.id !== dbUser.id));
    } catch (error: any) {
      alert(error.response?.data?.detail || 'No se pudo eliminar al usuario.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}><Users /> Panel de Administración</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>Gestiona organizaciones, crea usuarios directamente y administra sus accesos.</p>
        {message && (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(118, 232, 167, 0.1)', border: '1px solid rgba(118, 232, 167, 0.2)', color: 'var(--accent-mint)', fontSize: '0.9rem' }}>
            {message}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Form Organizaciones */}
        <form className="glass-panel" style={{ padding: '24px', display: 'grid', gap: '14px', alignContent: 'start' }} onSubmit={createOrganization}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><Building size={20} /> Crear Organización</h3>
          <input 
            required 
            placeholder="Nombre de la organización" 
            value={organizationName} 
            onChange={(event) => setOrganizationName(event.target.value)} 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#2b2f33', color: '#ffffff' }} 
          />
          <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Plus size={16} /> Crear Organización
          </button>
        </form>

        {/* Form Crear Usuario */}
        <form className="glass-panel" style={{ padding: '24px', display: 'grid', gap: '14px', alignContent: 'start' }} onSubmit={createUser}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><UserPlus size={20} /> Crear Usuario</h3>
          <input 
            required 
            type="email" 
            placeholder="Email" 
            value={userForm.email} 
            onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#2b2f33', color: '#ffffff' }} 
          />
          <input 
            required 
            placeholder="Nombre" 
            value={userForm.name} 
            onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#2b2f33', color: '#ffffff' }} 
          />
          <input 
            required 
            type="password" 
            placeholder="Contraseña" 
            value={userForm.password} 
            onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: '#2b2f33', color: '#ffffff' }} 
          />
          <select 
            value={userForm.organization_id} 
            onChange={(event) => setUserForm({ ...userForm, organization_id: event.target.value })} 
            style={{ 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-light)', 
              backgroundColor: '#2b2f33', 
              color: '#ffffff', 
              cursor: 'pointer' 
            }}
          >
            {orgsList.map(o => (
              <option key={o.id} value={o.id} style={{ backgroundColor: '#2b2f33', color: '#ffffff' }}>
                Organización: {o.name}
              </option>
            ))}
          </select>
          <select 
            value={userForm.role} 
            onChange={(event) => setUserForm({ ...userForm, role: event.target.value })} 
            style={{ 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-light)', 
              backgroundColor: '#2b2f33', 
              color: '#ffffff', 
              cursor: 'pointer' 
            }}
          >
            <option value="user" style={{ backgroundColor: '#2b2f33', color: '#ffffff' }}>Usuario (Rol: User)</option>
            <option value="admin" style={{ backgroundColor: '#2b2f33', color: '#ffffff' }}>Administrador (Rol: Admin)</option>
          </select>
          <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <UserPlus size={16} /> Crear Usuario
          </button>
        </form>
      </div>

      {/* Tabla/Lista de Usuarios */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', margin: 0 }}><Users size={20} /> Usuarios Registrados</h3>
        
        {loadingUsers ? (
          <p style={{ color: 'var(--text-secondary)' }}>Cargando usuarios...</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nombre</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Email</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Rol</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Organización</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estatus</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((dbUser) => (
                  <tr key={dbUser.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '14px 8px', fontWeight: 600 }}>{dbUser.name}</td>
                    <td style={{ padding: '14px 8px', color: 'var(--text-secondary)' }}>{dbUser.email}</td>
                    <td style={{ padding: '14px 8px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: dbUser.role === 'admin' ? '#fff0f6' : '#e6fcf5',
                        color: dbUser.role === 'admin' ? '#c2255c' : '#0ca678'
                      }}>
                        {dbUser.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 8px', color: 'var(--text-secondary)' }}>
                      {dbUser.organization_name} <small style={{ fontSize: '0.7rem', display: 'block', color: 'rgba(255,255,255,0.2)' }}>ID: {dbUser.organization_id}</small>
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: dbUser.is_active ? 'rgba(12, 166, 120, 0.1)' : 'rgba(224, 49, 49, 0.1)',
                        color: dbUser.is_active ? '#0ca678' : '#e03131'
                      }}>
                        {dbUser.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => toggleUserStatus(dbUser)}
                          title={dbUser.is_active ? 'Dar de baja' : 'Dar de alta'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: dbUser.is_active ? '#ffc078' : '#0ca678',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px'
                          }}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => deleteUser(dbUser)}
                          title="Eliminar"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ff8787',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Admin;
