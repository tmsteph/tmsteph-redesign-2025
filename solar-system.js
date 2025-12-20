const canvas = document.querySelector('[data-solar-canvas]');
const timestampEl = document.querySelector('[data-solar-timestamp]');

if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let width = 0;
  let height = 0;

  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

  const planets = [
    { name: 'Mercury', color: '#c9c2b2', period: 88, size: 3, phase: 0.1 },
    { name: 'Venus', color: '#f2b07c', period: 225, size: 4, phase: 1.2 },
    { name: 'Earth', color: '#6db7ff', period: 365, size: 4.2, phase: 2.3 },
    { name: 'Mars', color: '#ff6b4a', period: 687, size: 3.6, phase: 3.1 },
    { name: 'Jupiter', color: '#f9d48b', period: 4333, size: 7, phase: 0.5 },
    { name: 'Saturn', color: '#f2d6a0', period: 10759, size: 6.2, phase: 1.7 },
    { name: 'Uranus', color: '#a0e7ff', period: 30687, size: 5, phase: 2.9 },
    { name: 'Neptune', color: '#6fb1ff', period: 60190, size: 5, phase: 4.1 },
  ];

  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    const center = { x: width / 2, y: height / 2 };
    const baseOrbit = Math.min(width, height) * 0.09;
    const orbitStep = Math.min(width, height) * 0.07;

    ctx.fillStyle = '#f9d65c';
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.min(width, height) * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'rgba(255, 221, 120, 0.8)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    const daysSince = (Date.now() - J2000) / 86400000;

    planets.forEach((planet, index) => {
      const orbitRadius = baseOrbit + orbitStep * index;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(center.x, center.y, orbitRadius, 0, Math.PI * 2);
      ctx.stroke();

      const angle = (daysSince / planet.period) * Math.PI * 2 + planet.phase;
      const x = center.x + Math.cos(angle) * orbitRadius;
      const y = center.y + Math.sin(angle) * orbitRadius;

      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(x, y, planet.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px "Quicksand", sans-serif';
      ctx.fillText(planet.name, x + 8, y - 6);
    });

    requestAnimationFrame(draw);
  };

  const updateTimestamp = () => {
    if (!timestampEl) return;
    timestampEl.textContent = new Date().toLocaleString();
  };

  resizeCanvas();
  updateTimestamp();
  draw();
  window.addEventListener('resize', () => {
    resizeCanvas();
  });
  setInterval(updateTimestamp, 1000);
}
