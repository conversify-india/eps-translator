export default function Header({ user, onBackToDashboard, onLogout }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 1.5rem',
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        borderRadius: '16px',
        marginBottom: '1.5rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.03)'
      }}
      className="eps-tool-topbar"
    >
      <button
        onClick={onBackToDashboard}
        className="btn"
        style={{
          padding: '0.45rem 1rem',
          fontSize: '0.78rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          color: '#475569',
          cursor: 'pointer',
          borderRadius: '8px',
          fontWeight: 700,
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none'; }}
      >
        ← Back to Dashboard
      </button>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
          {user.picture ? (
            <img
              src={user.picture}
              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #c084fc', boxShadow: '0 2px 6px rgba(192, 132, 252, 0.2)' }}
              alt=""
            />
          ) : (
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifycontent: 'center', fontWeight: 800 }}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
          )}
          <span>{user.name}</span>
        </div>
        
        <button
          onClick={onLogout}
          className="btn"
          style={{
            padding: '0.45rem 1rem',
            fontSize: '0.78rem',
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            cursor: 'pointer',
            borderRadius: '8px',
            fontWeight: 700,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'none'; }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
