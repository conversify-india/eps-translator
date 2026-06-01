import { useEffect, useRef } from 'react';

export default function PlexusCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = container.offsetWidth);
    let height = (canvas.height = container.offsetHeight);

    const handleResize = () => {
      if (!canvas || !container) return;
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    const spherePoints = [];
    const tags = [
      "हिन्दी", "Español", "Deutsch", "Français", "English",
      "日本語", "العربية", "中文", "Русский", "Português", "Italiano", "한국어"
    ];
    const numPoints = 120;
    const radius = 135;

    const getParticleColor = (type, alpha) => {
      switch (type) {
        case 0: return `rgba(167, 139, 250, ${alpha})`;
        case 1: return `rgba(56, 189, 248, ${alpha})`;
        case 2: return `rgba(244, 114, 182, ${alpha})`;
        default: return `rgba(129, 140, 248, ${alpha})`;
      }
    };

    // Generate random sphere points
    for (let i = 0; i < numPoints; i++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * 2 * Math.PI;
      const theta = Math.acos(u);

      spherePoints.push({
        x: radius * Math.sin(theta) * Math.cos(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(theta),
        isTag: false,
        text: '',
        colorType: Math.floor(Math.random() * 3)
      });
    }

    // Golden Spiral distribution for text tags
    for (let i = 0; i < tags.length; i++) {
      const phi = Math.acos(-1 + (2 * i) / tags.length);
      const theta = Math.sqrt(tags.length * Math.PI) * phi;

      spherePoints.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        isTag: true,
        text: tags[i],
        hovered: false
      });
    }

    let angleX = 0.6;
    let angleY = 0.6;
    let targetAngleX = 0.6;
    let targetAngleY = 0.6;

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const mouse = { x: null, y: null, active: false };
    const ripplePoints = [];

    const handleMouseDown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;

      const dxSphere = mouse.x - width / 2;
      const dySphere = mouse.y - height / 2;
      const distSphere = Math.sqrt(dxSphere * dxSphere + dySphere * dySphere);

      if (distSphere < 185) {
        container.style.cursor = 'pointer';
      } else {
        container.style.cursor = 'default';
      }

      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      targetAngleY += dx * 0.006;
      targetAngleX += dy * 0.006;

      startX = e.clientX;
      startY = e.clientY;
      container.style.cursor = 'grabbing';
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      isDragging = false;
      container.style.cursor = 'default';
    };

    const handleMouseUp = () => {
      isDragging = false;
      if (container) {
        const dxSphere = mouse.x - width / 2;
        const dySphere = mouse.y - height / 2;
        const distSphere = Math.sqrt(dxSphere * dxSphere + dySphere * dySphere);
        container.style.cursor = distSphere < 185 ? 'pointer' : 'default';
      }
    };

    const handleCanvasClick = () => {
      for (let i = 0; i < spherePoints.length; i++) {
        const p = spherePoints[i];
        if (p.isTag && p.hovered) {
          spawnRipples(p.x, p.y, p.z);
          break;
        }
      }
    };

    function spawnRipples(tx, ty, tz) {
      for (let i = 0; i < 8; i++) {
        ripplePoints.push({
          x: tx,
          y: ty,
          z: tz,
          vx: (Math.random() - 0.5) * 35,
          vy: (Math.random() - 0.5) * 35,
          vz: (Math.random() - 0.5) * 35,
          life: 1.0,
          colorType: Math.floor(Math.random() * 3)
        });
      }
    }

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleCanvasClick);
    window.addEventListener('mouseup', handleMouseUp);

    let animationFrameId;

    function drawSphere() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      if (!isDragging) {
        targetAngleY += 0.0025;
        targetAngleX += 0.0008;
      }

      angleX += (targetAngleX - angleX) * 0.12;
      angleY += (targetAngleY - angleY) * 0.12;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      const projected = [];
      const fov = 350;

      for (let i = 0; i < spherePoints.length; i++) {
        const p = spherePoints[i];
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const scale = fov / (fov + z2);
        const projX = width / 2 + x1 * scale;
        const projY = height / 2 + y2 * scale;

        projected.push({
          x: projX,
          y: projY,
          z: z2,
          scale: scale,
          isTag: p.isTag,
          text: p.text,
          orig: p
        });
      }

      const activeRipples = [];
      for (let i = 0; i < ripplePoints.length; i++) {
        const rp = ripplePoints[i];
        rp.x += rp.vx * 0.05;
        rp.y += rp.vy * 0.05;
        rp.z += rp.vz * 0.05;
        rp.life -= 0.025;

        if (rp.life <= 0) {
          ripplePoints.splice(i, 1);
          i--;
          continue;
        }

        const x1 = rp.x * cosY - rp.z * sinY;
        const z1 = rp.x * sinY + rp.z * cosY;
        const y2 = rp.y * cosX - z1 * sinX;
        const z2 = rp.y * sinX + z1 * cosX;

        const scale = fov / (fov + z2);
        const projX = width / 2 + x1 * scale;
        const projY = height / 2 + y2 * scale;

        activeRipples.push({
          x: projX,
          y: projY,
          z: z2,
          scale: scale,
          life: rp.life,
          colorType: rp.colorType
        });
      }

      projected.sort((a, b) => b.z - a.z);

      const connectionDist3D = 75;
      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        if (p1.isTag) continue;

        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          if (p2.isTag) continue;

          const dx = p1.orig.x - p2.orig.x;
          const dy = p1.orig.y - p2.orig.y;
          const dz = p1.orig.z - p2.orig.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDist3D) {
            const depthAlpha = Math.max(0.05, (radius * 1.5 - p1.z) / (radius * 3));
            const distAlpha = 1 - (dist / connectionDist3D);
            const alpha = depthAlpha * distAlpha * 0.35;

            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, getParticleColor(p1.orig.colorType, alpha));
            grad.addColorStop(1, getParticleColor(p2.orig.colorType, alpha));

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.6 * p1.scale;
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const scale = p.scale;
        const opacity = Math.max(0.12, Math.min(1.0, (radius * 1.4 - p.z) / (radius * 2)));

        if (p.isTag) {
          ctx.font = `bold ${Math.round(11.5 * scale)}px 'Plus Jakarta Sans', sans-serif`;
          const textWidth = ctx.measureText(p.text).width;
          const paddingX = 8 * scale;
          const paddingY = 4 * scale;

          let hovered = false;
          if (mouse.active) {
            const mx = mouse.x - p.x;
            const my = mouse.y - p.y;
            if (Math.abs(mx) < textWidth / 2 + paddingX && Math.abs(my) < 10 * scale) {
              hovered = true;
              p.orig.hovered = true;

              ctx.beginPath();
              ctx.roundRect(
                p.x - textWidth / 2 - paddingX,
                p.y - 12 * scale,
                textWidth + paddingX * 2,
                20 * scale,
                6 * scale
              );

              const tagGrad = ctx.createLinearGradient(
                p.x - textWidth / 2 - paddingX,
                p.y,
                p.x + textWidth / 2 + paddingX,
                p.y
              );
              tagGrad.addColorStop(0, '#a78bfa');
              tagGrad.addColorStop(0.5, '#818cf8');
              tagGrad.addColorStop(1, '#f472b6');

              ctx.fillStyle = tagGrad;
              ctx.shadowColor = 'rgba(167, 139, 250, 0.35)';
              ctx.shadowBlur = 12 * scale;
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }

          if (!hovered) {
            p.orig.hovered = false;
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (!hovered && opacity > 0.6) {
            ctx.shadowColor = 'rgba(167, 139, 250, 0.45)';
            ctx.shadowBlur = 8 * scale;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.fillStyle = hovered ? '#ffffff' : `rgba(224, 231, 255, ${opacity * 0.95})`;
          ctx.fillText(p.text, p.x, p.y);
          ctx.shadowBlur = 0;

        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5 * scale, 0, Math.PI * 2);
          ctx.fillStyle = getParticleColor(p.orig.colorType, opacity * 0.75);
          ctx.fill();
        }
      }

      for (let i = 0; i < activeRipples.length; i++) {
        const rp = activeRipples[i];
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 3.5 * rp.scale, 0, Math.PI * 2);
        ctx.fillStyle = getParticleColor(rp.colorType, rp.life * 0.85);
        ctx.fill();
      }

      const coreGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius * 0.65);
      coreGrad.addColorStop(0, 'rgba(196, 181, 253, 0.22)');
      coreGrad.addColorStop(0.35, 'rgba(125, 211, 252, 0.12)');
      coreGrad.addColorStop(0.7, 'rgba(244, 143, 177, 0.05)');
      coreGrad.addColorStop(1, 'rgba(244, 143, 177, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(drawSphere);
    }

    drawSphere();

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="split-left" ref={containerRef} id="split-left-pane">
      <canvas ref={canvasRef} id="split-left-canvas" />
      <div style={{ position: 'absolute', top: '3.5rem', textAlign: 'center', pointerEvents: 'none', zIndex: 10 }}>
        <h1 style={{
          fontSize: '2.2rem',
          fontWeight: 800,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          margin: 0,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #c084fc 0%, #818cf8 55%, #f472b6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Aura Translation Core
        </h1>
        <p style={{
          color: '#a5b4fc',
          fontSize: '0.88rem',
          fontWeight: 800,
          margin: '0.3rem 0 0 0',
          letterSpacing: '0.12em',
          textTransform: 'uppercase'
        }}>
          Neural Localization Engine
        </p>
      </div>
    </div>
  );
}
