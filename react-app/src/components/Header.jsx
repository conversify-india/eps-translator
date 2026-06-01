export default function Header({ user, onBackToDashboard, onLogout }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1.25rem',
        background: '#161820',
        border: '1px solid #1f2937',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}
      className="eps-tool-topbar"
    >
      <button
        onClick={onBackToDashboard}
        className="btn btn-ghost"
        style={{
          padding: '0.4rem 0.8rem',
          fontSize: '0.78rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          border: '1px solid #1f2937',
          cursor: 'pointer',
          borderRadius: '6px'
        }}
      >
        ← Back to Dashboard
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#9ca3af' }}>
          {user.picture && (
            <img
              src={user.picture}
              style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #a78bfa' }}
              alt=""
            />
          )}
          <span>{user.name}</span>
        </div>
        <button
          onClick={onLogout}
          className="btn btn-ghost"
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.78rem',
            border: '1px solid #7f1d1d',
            color: '#fca5a5',
            cursor: 'pointer',
            background: 'transparent',
            borderRadius: '6px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#7f1d1d'; e.currentTarget.style.color = '#fff'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#fca5a5'; }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
