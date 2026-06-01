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
      <div className="steps">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isDone = step.id < currentStep && step.id <= maxUnlockedStep;
          const isClickable = step.id <= maxUnlockedStep;

          let stepClass = 'step';
          if (isActive) stepClass += ' active';
          if (isDone) stepClass += ' done';
          if (isClickable) stepClass += ' clickable';

          return (
            <div
              key={step.id}
              className={stepClass}
              onClick={() => isClickable && onStepClick(step.id)}
            >
              <span className="step-num">
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
