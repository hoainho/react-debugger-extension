import React from 'react'

export interface UserCardProps {
  name: string
  role: string
  avatarUrl?: string
}

const UserCard: React.FC<UserCardProps> = ({ name, role, avatarUrl }) => {
  return (
    <div data-testid="user-card" style={styles.card}>
      <div style={styles.avatar}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} style={styles.avatarImg} />
        ) : (
          <span style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div style={styles.info}>
        <h2 style={styles.name}>{name}</h2>
        <p style={styles.role}>{role}</p>
      </div>
    </div>
  )
}

UserCard.displayName = 'UserCard'

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '20px 24px', borderRadius: '12px',
    background: '#ffffff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    maxWidth: '360px', fontFamily: 'system-ui, sans-serif',
  },
  avatar: {
    width: '56px', height: '56px', borderRadius: '50%',
    background: '#6366f1', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { color: '#fff', fontSize: '22px', fontWeight: 700 },
  info: { display: 'flex', flexDirection: 'column', gap: '4px' },
  name: { margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' },
  role: { margin: 0, fontSize: '14px', color: '#6b7280' },
}

export default UserCard