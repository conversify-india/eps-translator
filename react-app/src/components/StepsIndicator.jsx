export default function StepsIndicator({ currentStep, maxUnlockedStep, onStepClick }) {
  const steps = [
    { id: 1, label: 'Upload EPS' },
    { id: 2, label: 'Diagnose' },
    { id: 3, label: 'Translate' },
    { id: 4, label: 'Visual Editor' },
    { id: 5, label: 'QA & Export' }
  ];

  return (
    <div className="steps-container" style={{ width: '100%', overflowX: 'auto', marginBottom: '2rem' }}>
      <div
        className="steps"
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center',
          flexWrap: 'nowrap',
          width: 'max-content',
          margin: '0 auto',
          padding: '0.2rem 1rem'
        }}
      >
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isDone = step.id < currentStep && step.id <= maxUnlockedStep;
          const isClickable = step.id <= maxUnlockedStep;

          let stepClass = 'step';
          if (isActive) stepClass += ' active';
          if (isDone) stepClass += ' done';

          return (
            <div
              key={step.id}
              className={stepClass}
              onClick={() => isClickable && onStepClick(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: isActive ? '#a78bfa' : isDone ? '#34d399' : '#4b5563',
                padding: '0.3rem 0.7rem',
                border: '1px solid',
                borderColor: isActive ? '#4c1d95' : isDone ? '#064e3b' : '#1f2937',
                borderRadius: '100px',
                background: isActive ? '#1a1228' : isDone ? '#0d1f1a' : '#161820',
                cursor: isClickable ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease'
              }}
            >
              <span
                className="step-num"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: isActive ? '#4c1d95' : isDone ? '#064e3b' : '#1f2937',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease'
                }}
              >
                {step.id}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
