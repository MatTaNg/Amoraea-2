import { useState, useCallback } from "react";

const T = {
  cream:     "#F5F0E8",
  creamDark: "#EDE6D6",
  ink:       "#1C1917",
  inkLight:  "#44403C",
  inkFaint:  "#A8A29E",
  inkGhost:  "#D6D0C8",
  gold:      "#8B6914",
  goldLight: "#C4914A",
  goldSoft:  "#F5EDD8",
  red:       "#8B1A1A",
  green:     "#1A5C2A",
  blue:      "#1A3A5C",
  surface:   "#FDFAF4",
  border:    "#E2DAC8",
  purple:    "#6B3FA0",
};

const serif = "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
const mono  = "'Courier New', Courier, monospace";

const css = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#F5F0E8; }
  button { transition:all 0.18s ease; }
`;

const BMI_POINTS = [
  { id: 1, bmi: 16,  label: "Very Slender", range: "Under 17.5"  },
  { id: 2, bmi: 19,  label: "Slender",      range: "17.5 – 20.5" },
  { id: 3, bmi: 22,  label: "Lean",         range: "20.5 – 23.5" },
  { id: 4, bmi: 25,  label: "Average",      range: "23.5 – 26.5" },
  { id: 5, bmi: 28,  label: "Solid",        range: "26.5 – 29.5" },
  { id: 6, bmi: 32,  label: "Full",         range: "29.5 – 34"   },
  { id: 7, bmi: 37,  label: "Fuller",       range: "34 – 40"     },
  { id: 8, bmi: 43,  label: "Very Full",    range: "Over 40"     },
];

// ─────────────────────────────────────────────
// FEMALE FULL BODY SILHOUETTE
// Key differences from male:
// - Narrower shoulders relative to hips
// - Wider hips, more pronounced hip flare
// - Defined waist indent (hourglass even at higher BMI)
// - Chest curve
// - Slightly wider thighs relative to torso
// - Arms slimmer and more tapered
// - Longer neck, rounder head
// ─────────────────────────────────────────────
function FemaleSilhouette({ index, color, height = 140 }) {
  const t = index / 7;
  const l = (a, b) => a + (b - a) * t;

  const W = 60;
  const H = 165;
  const cx = W / 2;

  // HEAD — slightly rounder/smaller than male
  const headR    = l(6.8, 8.5);
  const headCY   = headR + 1;

  // NECK — longer and more slender
  const neckHW   = l(2.8, 4.5);
  const neckTop  = headCY + headR;
  const neckBot  = neckTop + l(9, 6);

  // SHOULDERS — narrower than hips (key female proportion)
  const shoulderY  = neckBot + 1;
  const shoulderHW = l(9, 13.5);  // narrower than male

  // CHEST — curves out below shoulders
  const chestHW    = l(9.5, 14);
  const bustHW     = l(10.5, 15.5); // bust is wider than shoulder at higher BMI
  const chestY     = shoulderY + 3;
  const bustY      = shoulderY + l(10, 12);

  // WAIST — more pronounced indent than male
  const waistHW    = l(7, 13);
  const waistY     = shoulderY + l(22, 20);

  // HIPS — wider than shoulders, the defining female proportion
  const hipHW      = l(12, 18.5);  // significantly wider than shoulder
  const hipY       = waistY + l(9, 12);

  // ARMS — slimmer and more tapered
  const elbowX     = cx + l(12, 17);
  const elbowY     = shoulderY + l(19, 17);
  const wristX     = cx + l(10, 14);
  const wristY     = elbowY + l(16, 14);
  const handBotY   = wristY + l(6.5, 8.5);
  const uArmW      = l(2.5, 5);
  const forearmW   = l(2, 4);
  const handW      = l(2.5, 4.5);

  // THIGHS — fuller relative to torso, touch sooner
  const thighTopHW = l(5.8, 10.5);
  const thighBotHW = l(4.2, 8.5);
  const kneeY      = hipY + l(28, 25);

  // CALVES — more tapered
  const calfTopHW  = l(3.2, 6.5);
  const calfBotHW  = l(2.2, 4.5);
  const ankleHW    = l(1.6, 3);
  const ankleY     = kneeY + l(26, 22);

  // FEET — smaller
  const footLen    = l(7, 9.5);
  const footH      = l(2.8, 4);
  const footY      = ankleY + footH;

  // Thigh gap closes faster for women
  const legGap     = l(2.5, 0);

  const mx = (x) => cx - (x - cx); // mirror helper

  // ── ARM PATHS ──
  const rUpper = `
    M ${cx + shoulderHW - uArmW * 0.2} ${shoulderY}
    C ${cx + shoulderHW + uArmW * 0.4} ${shoulderY + 5}, ${elbowX + uArmW} ${elbowY - 7}, ${elbowX + uArmW * 0.6} ${elbowY}
    C ${elbowX} ${elbowY + 3}, ${elbowX - uArmW * 0.6} ${elbowY + 3}, ${elbowX - uArmW * 0.6} ${elbowY}
    C ${elbowX - uArmW} ${elbowY - 7}, ${cx + shoulderHW - uArmW} ${shoulderY + 5}, ${cx + shoulderHW - uArmW * 0.2} ${shoulderY}
    Z
  `;
  const rForearm = `
    M ${elbowX + forearmW * 0.6} ${elbowY}
    C ${wristX + forearmW} ${elbowY + 7}, ${wristX + handW * 0.7} ${wristY - 3}, ${wristX + handW * 0.6} ${wristY}
    L ${wristX} ${wristY + 1}
    L ${wristX - handW * 0.6} ${wristY}
    C ${wristX - handW * 0.7} ${wristY - 3}, ${wristX - forearmW} ${elbowY + 7}, ${elbowX - forearmW * 0.6} ${elbowY}
    C ${elbowX} ${elbowY + 3}, ${elbowX + forearmW * 0.6} ${elbowY}
    Z
  `;
  const rHand = `
    M ${wristX + handW * 0.6} ${wristY}
    C ${wristX + handW} ${wristY + 2}, ${wristX + handW * 0.7} ${handBotY - 1}, ${wristX + handW * 0.3} ${handBotY}
    L ${wristX} ${handBotY + 1}
    L ${wristX - handW * 0.3} ${handBotY}
    C ${wristX - handW * 0.7} ${handBotY - 1}, ${wristX - handW} ${wristY + 2}, ${wristX - handW * 0.6} ${wristY}
    L ${wristX} ${wristY + 1}
    Z
  `;
  const lUpper  = rUpper.replace(/[\d.]+/g, (n, offset, str) => {
    // We'll use the mirror function approach via path transformation below
    return n;
  });

  // Build mirrored arm paths properly
  const mirrorPath = (path) => path.replace(/-?\d+\.?\d*/g, (n, offset, str) => {
    // Only mirror X coordinates — this is tricky in raw string replacement
    // Better approach: recompute mirrored paths explicitly
    return n;
  });

  const lUpper2 = `
    M ${mx(cx + shoulderHW - uArmW * 0.2)} ${shoulderY}
    C ${mx(cx + shoulderHW + uArmW * 0.4)} ${shoulderY + 5}, ${mx(elbowX + uArmW)} ${elbowY - 7}, ${mx(elbowX + uArmW * 0.6)} ${elbowY}
    C ${mx(elbowX)} ${elbowY + 3}, ${mx(elbowX - uArmW * 0.6)} ${elbowY + 3}, ${mx(elbowX - uArmW * 0.6)} ${elbowY}
    C ${mx(elbowX - uArmW)} ${elbowY - 7}, ${mx(cx + shoulderHW - uArmW)} ${shoulderY + 5}, ${mx(cx + shoulderHW - uArmW * 0.2)} ${shoulderY}
    Z
  `;
  const lForearm2 = `
    M ${mx(elbowX + forearmW * 0.6)} ${elbowY}
    C ${mx(wristX + forearmW)} ${elbowY + 7}, ${mx(wristX + handW * 0.7)} ${wristY - 3}, ${mx(wristX + handW * 0.6)} ${wristY}
    L ${mx(wristX)} ${wristY + 1}
    L ${mx(wristX - handW * 0.6)} ${wristY}
    C ${mx(wristX - handW * 0.7)} ${wristY - 3}, ${mx(wristX - forearmW)} ${elbowY + 7}, ${mx(elbowX - forearmW * 0.6)} ${elbowY}
    C ${mx(elbowX)} ${elbowY + 3}, ${mx(elbowX + forearmW * 0.6)} ${elbowY}
    Z
  `;
  const lHand2 = `
    M ${mx(wristX + handW * 0.6)} ${wristY}
    C ${mx(wristX + handW)} ${wristY + 2}, ${mx(wristX + handW * 0.7)} ${handBotY - 1}, ${mx(wristX + handW * 0.3)} ${handBotY}
    L ${mx(wristX)} ${handBotY + 1}
    L ${mx(wristX - handW * 0.3)} ${handBotY}
    C ${mx(wristX - handW * 0.7)} ${handBotY - 1}, ${mx(wristX - handW)} ${wristY + 2}, ${mx(wristX - handW * 0.6)} ${wristY}
    L ${mx(wristX)} ${wristY + 1}
    Z
  `;

  // ── TORSO with chest curve ──
  // The torso has a bust protrusion below the shoulders
  const torso = `
    M ${cx - shoulderHW} ${shoulderY}
    L ${cx - chestHW} ${chestY}
    C ${cx - bustHW} ${chestY + 4}, ${cx - bustHW} ${bustY - 2}, ${cx - bustHW} ${bustY}
    C ${cx - bustHW} ${bustY + 4}, ${cx - waistHW} ${waistY - 4}, ${cx - waistHW} ${waistY}
    C ${cx - waistHW} ${waistY + 4}, ${cx - hipHW} ${hipY - 5}, ${cx - hipHW} ${hipY}
    L ${cx + hipHW} ${hipY}
    C ${cx + hipHW} ${hipY - 5}, ${cx + waistHW} ${waistY + 4}, ${cx + waistHW} ${waistY}
    C ${cx + waistHW} ${waistY - 4}, ${cx + bustHW} ${bustY + 4}, ${cx + bustHW} ${bustY}
    C ${cx + bustHW} ${bustY - 2}, ${cx + bustHW} ${chestY + 4}, ${cx + chestHW} ${chestY}
    L ${cx + shoulderHW} ${shoulderY}
    L ${cx + neckHW} ${neckBot}
    L ${cx + neckHW} ${neckTop}
    A ${headR} ${headR} 0 0 0 ${cx - neckHW} ${neckTop}
    L ${cx - neckHW} ${neckBot}
    Z
  `;

  // ── LEGS ──
  const rLeg = `
    M ${cx + legGap} ${hipY}
    C ${cx + legGap + thighTopHW * 0.4} ${hipY + 2}, ${cx + legGap + thighTopHW} ${hipY + 7}, ${cx + legGap + thighTopHW} ${hipY + 12}
    C ${cx + legGap + thighTopHW} ${hipY + 20}, ${cx + legGap + thighBotHW + 1.5} ${kneeY - 12}, ${cx + legGap + thighBotHW + 1.5} ${kneeY - 3}
    C ${cx + legGap + calfTopHW + 0.5} ${kneeY + 4}, ${cx + legGap + calfTopHW} ${kneeY + 8}, ${cx + legGap + calfTopHW} ${kneeY + 10}
    C ${cx + legGap + calfTopHW} ${kneeY + 16}, ${cx + legGap + calfBotHW} ${ankleY - 8}, ${cx + legGap + ankleHW} ${ankleY}
    L ${cx + legGap + footLen} ${ankleY}
    L ${cx + legGap + footLen + 0.5} ${ankleY + footH * 0.4}
    C ${cx + legGap + footLen} ${ankleY + footH}, ${cx + legGap + footLen * 0.3} ${footY}, ${cx + legGap} ${footY}
    C ${cx + legGap - ankleHW * 1.2} ${footY}, ${cx + legGap - ankleHW} ${ankleY + footH * 0.3}, ${cx + legGap - ankleHW} ${ankleY}
    C ${cx + legGap - calfBotHW} ${ankleY - 8}, ${cx + legGap - calfTopHW} ${kneeY + 16}, ${cx + legGap - calfTopHW} ${kneeY + 10}
    C ${cx + legGap - calfTopHW} ${kneeY + 8}, ${cx + legGap - calfTopHW - 0.5} ${kneeY + 4}, ${cx + legGap - thighBotHW - 1.5} ${kneeY - 3}
    C ${cx + legGap - thighBotHW - 1.5} ${kneeY - 12}, ${cx + legGap - thighTopHW} ${hipY + 20}, ${cx + legGap - thighTopHW} ${hipY + 12}
    C ${cx + legGap - thighTopHW} ${hipY + 7}, ${cx + legGap - thighTopHW * 0.4} ${hipY + 2}, ${cx + legGap} ${hipY}
    Z
  `;

  const lLeg = `
    M ${mx(cx + legGap)} ${hipY}
    C ${mx(cx + legGap + thighTopHW * 0.4)} ${hipY + 2}, ${mx(cx + legGap + thighTopHW)} ${hipY + 7}, ${mx(cx + legGap + thighTopHW)} ${hipY + 12}
    C ${mx(cx + legGap + thighTopHW)} ${hipY + 20}, ${mx(cx + legGap + thighBotHW + 1.5)} ${kneeY - 12}, ${mx(cx + legGap + thighBotHW + 1.5)} ${kneeY - 3}
    C ${mx(cx + legGap + calfTopHW + 0.5)} ${kneeY + 4}, ${mx(cx + legGap + calfTopHW)} ${kneeY + 8}, ${mx(cx + legGap + calfTopHW)} ${kneeY + 10}
    C ${mx(cx + legGap + calfTopHW)} ${kneeY + 16}, ${mx(cx + legGap + calfBotHW)} ${ankleY - 8}, ${mx(cx + legGap + ankleHW)} ${ankleY}
    L ${mx(cx + legGap + footLen)} ${ankleY}
    L ${mx(cx + legGap + footLen + 0.5)} ${ankleY + footH * 0.4}
    C ${mx(cx + legGap + footLen)} ${ankleY + footH}, ${mx(cx + legGap + footLen * 0.3)} ${footY}, ${mx(cx + legGap)} ${footY}
    C ${mx(cx + legGap - ankleHW * 1.2)} ${footY}, ${mx(cx + legGap - ankleHW)} ${ankleY + footH * 0.3}, ${mx(cx + legGap - ankleHW)} ${ankleY}
    C ${mx(cx + legGap - calfBotHW)} ${ankleY - 8}, ${mx(cx + legGap - calfTopHW)} ${kneeY + 16}, ${mx(cx + legGap - calfTopHW)} ${kneeY + 10}
    C ${mx(cx + legGap - calfTopHW)} ${kneeY + 8}, ${mx(cx + legGap - calfTopHW - 0.5)} ${kneeY + 4}, ${mx(cx + legGap - thighBotHW - 1.5)} ${kneeY - 3}
    C ${mx(cx + legGap - thighBotHW - 1.5)} ${kneeY - 12}, ${mx(cx + legGap - thighTopHW)} ${hipY + 20}, ${mx(cx + legGap - thighTopHW)} ${hipY + 12}
    C ${mx(cx + legGap - thighTopHW)} ${hipY + 7}, ${mx(cx + legGap - thighTopHW * 0.4)} ${hipY + 2}, ${mx(cx + legGap)} ${hipY}
    Z
  `;

  const scale = height / H;

  return (
    <svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`} style={{ display:"block", overflow:"visible" }}>
      <g fill={color}>
        <path d={rUpper} />
        <path d={lUpper2} />
        <path d={rForearm} />
        <path d={lForearm2} />
        <path d={rHand} />
        <path d={lHand2} />
        <path d={rLeg} />
        <path d={lLeg} />
        <path d={torso} />
        <circle cx={cx} cy={headCY} r={headR} />
      </g>
    </svg>
  );
}

function BMICard({ point, isSelected, isInRange, onClick }) {
  const inRange = isInRange && !isSelected;
  const bg = isSelected ? T.ink : inRange ? T.goldSoft : T.surface;
  const border = isSelected ? `2px solid ${T.ink}` : inRange ? `2px solid ${T.goldLight}` : `1px solid ${T.border}`;
  const figureColor = isSelected ? T.cream : inRange ? T.gold : T.inkGhost;
  const labelColor = isSelected ? T.cream : inRange ? T.gold : T.inkLight;

  return (
    <button onClick={onClick} style={{
      background: bg, border, borderRadius: 4,
      padding: "12px 6px 10px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      cursor: "pointer",
      transform: isSelected ? "translateY(-4px)" : "none",
      boxShadow: isSelected ? `0 8px 24px ${T.ink}28` : "none",
      minWidth: 0,
    }}>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", height: 132 }}>
        <FemaleSilhouette index={point.id - 1} color={figureColor} height={118 + (point.id - 1) * 1.8} />
      </div>
      <div style={{ fontFamily: serif, fontSize: 11, color: labelColor, textAlign: "center", lineHeight: 1.3, fontWeight: isSelected ? 600 : 400 }}>
        {point.label}
      </div>
      <div style={{ fontFamily: mono, fontSize: 8.5, color: isSelected ? `${T.cream}88` : T.inkFaint, textAlign: "center" }}>
        BMI {point.range}
      </div>
    </button>
  );
}

function RangeTrack({ minId, maxId }) {
  const total = BMI_POINTS.length;
  const leftPct  = minId !== null ? ((minId - 1) / (total - 1)) * 100 : 0;
  const rightPct = maxId !== null ? ((maxId - 1) / (total - 1)) * 100 : 0;
  return (
    <div style={{ position:"relative", height:3, background:T.border, borderRadius:2, margin:"0 4px" }}>
      {minId !== null && (
        <div style={{ position:"absolute", left:`${leftPct}%`, width:`${Math.max(rightPct - leftPct, 2)}%`, height:"100%", background:T.gold, borderRadius:2, transition:"all 0.2s ease" }} />
      )}
    </div>
  );
}

function ReciprocityNote({ userBMI, minId, maxId }) {
  if (!userBMI || minId === null || maxId === null) return null;
  const userPoint = BMI_POINTS.reduce((c, p) => Math.abs(p.bmi - userBMI) < Math.abs(c.bmi - userBMI) ? p : c);
  if (userPoint.id >= minId && userPoint.id <= maxId) return null;
  return (
    <div style={{ background:T.goldSoft, border:`1px solid ${T.goldLight}`, borderLeft:`3px solid ${T.gold}`, padding:"12px 16px", fontFamily:serif, fontSize:13, color:T.inkLight, lineHeight:1.65, animation:"fadeIn 0.3s ease" }}>
      <span style={{ fontFamily:mono, fontSize:9, color:T.gold, letterSpacing:2, textTransform:"uppercase", display:"block", marginBottom:4 }}>Worth knowing</span>
      Your own body type falls outside your selected preference range. People whose preferences include your body type will still be able to see your profile — but this range determines who you see.
    </div>
  );
}

export function BMIPreferenceSelector({ userHeightCm, userWeightKg, onComplete, embedded = false }) {
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd,   setRangeEnd]   = useState(null);
  const [confirmed,  setConfirmed]  = useState(false);

  const userBMI = (userHeightCm && userWeightKg) ? userWeightKg / ((userHeightCm / 100) ** 2) : null;
  const minId = rangeStart !== null && rangeEnd !== null ? Math.min(rangeStart, rangeEnd) : rangeStart;
  const maxId = rangeStart !== null && rangeEnd !== null ? Math.max(rangeStart, rangeEnd) : rangeStart;

  const handleCardClick = useCallback((id) => {
    if (confirmed) return;
    if (rangeStart === null) { setRangeStart(id); setRangeEnd(null); }
    else if (rangeEnd === null) { setRangeEnd(id); }
    else { setRangeStart(id); setRangeEnd(null); }
  }, [rangeStart, rangeEnd, confirmed]);

  const handleConfirm = useCallback(() => {
    if (minId === null) return;
    const effectiveMax = maxId ?? minId;
    setConfirmed(true);
    onComplete?.({ minBMI: BMI_POINTS.find(p => p.id === minId)?.bmi, maxBMI: BMI_POINTS.find(p => p.id === effectiveMax)?.bmi, minId, maxId: effectiveMax });
  }, [minId, maxId, onComplete]);

  const isInRange = (id) => minId !== null && id >= minId && id <= (maxId ?? minId);
  const step = rangeStart === null ? 1 : rangeEnd === null ? 2 : 3;

  const selectionLabel = () => {
    if (minId === null) return null;
    const effectiveMax = maxId ?? minId;
    if (minId === effectiveMax) return BMI_POINTS.find(p => p.id === minId)?.label;
    return `${BMI_POINTS.find(p => p.id === minId)?.label} to ${BMI_POINTS.find(p => p.id === effectiveMax)?.label}`;
  };

  return (
    <div style={{
      ...(embedded ? { width: '100%', padding: '16px 0' } : { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }),
      background: T.cream,
      fontFamily: serif,
    }}>
      <style>{css}</style>
      <div style={{ maxWidth: embedded ? '100%' : 860, width: '100%', animation: 'fadeUp 0.5s ease' }}>

        <div style={{ marginBottom: embedded ? 16 : 28, textAlign: 'center' }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: T.gold, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>◆ Physical Preference</div>
          <h1 style={{ fontSize: embedded ? 18 : 26, fontWeight: 400, color: T.ink, lineHeight: 1.2, marginBottom: 12 }}>Which body types are you attracted to?</h1>
          <p style={{ fontSize: 13, color: T.inkFaint, lineHeight: 1.75, maxWidth: 460, margin: embedded ? '0' : '0 auto' }}>
            Tap your lower limit, then your upper limit. Tap the same figure twice for a single type.
          </p>
        </div>

        <div style={{ display:"flex", justifyContent:"center", gap:28, marginBottom:24, fontFamily:mono, fontSize:10, letterSpacing:2, textTransform:"uppercase" }}>
          {[{n:1,label:"Lower limit"},{n:2,label:"Upper limit"},{n:3,label:"Confirm"}].map(s => (
            <div key={s.n} style={{ display:"flex", alignItems:"center", gap:6, color: step >= s.n ? (step === s.n ? T.gold : T.inkLight) : T.inkGhost }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background: step > s.n ? T.ink : step === s.n ? T.gold : "transparent", border:`1px solid ${step >= s.n ? (step > s.n ? T.ink : T.gold) : T.inkGhost}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color: step > s.n ? T.cream : "inherit", flexShrink:0 }}>
                {step > s.n ? "✓" : s.n}
              </div>
              {s.label}
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:8, marginBottom:14 }}>
          {BMI_POINTS.map(point => (
            <BMICard key={point.id} point={point}
              isSelected={point.id === rangeStart || (rangeEnd !== null && (point.id === Math.min(rangeStart, rangeEnd) || point.id === Math.max(rangeStart, rangeEnd)))}
              isInRange={isInRange(point.id)}
              onClick={() => handleCardClick(point.id)}
            />
          ))}
        </div>

        <div style={{ marginBottom:22 }}><RangeTrack minId={minId} maxId={maxId ?? minId} /></div>

        {minId !== null && (
          <div style={{ textAlign:"center", marginBottom:18, animation:"fadeIn 0.25s ease" }}>
            <span style={{ fontFamily:serif, fontSize:16, color:T.ink }}>{selectionLabel()}</span>
            {rangeEnd === null && <span style={{ fontFamily:mono, fontSize:10, color:T.inkFaint, marginLeft:10, letterSpacing:1 }}>— now tap your upper limit</span>}
          </div>
        )}

        {minId !== null && maxId !== null && (
          <div style={{ marginBottom:22 }}>
            <ReciprocityNote userBMI={userBMI} minId={minId} maxId={maxId} />
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
          <button onClick={handleConfirm} disabled={minId === null || maxId === null || confirmed} style={{
            background: minId !== null && maxId !== null && !confirmed ? T.ink : T.inkGhost,
            color:T.cream, border:"none", fontFamily:mono, fontSize:12, letterSpacing:2,
            textTransform:"uppercase", padding:"16px 52px",
            cursor: minId !== null && maxId !== null && !confirmed ? "pointer" : "not-allowed",
          }}>
            {confirmed ? "Saved ✓" : "Confirm preference →"}
          </button>
          <button onClick={() => onComplete?.({ noPreference:true })} style={{
            background:"transparent", border:"none", fontFamily:mono, fontSize:10,
            color:T.inkFaint, letterSpacing:1, textTransform:"uppercase", textDecoration:"underline", cursor:"pointer",
          }}>No preference</button>
        </div>
      </div>
    </div>
  );
}

function StandaloneDemo() {
  const [result, setResult] = useState(null);
  if (result) {
    return (
      <div style={{ minHeight:"100vh", background:T.cream, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:serif, padding:24 }}>
        <style>{css}</style>
        <div style={{ textAlign:"center", maxWidth:400 }}>
          <div style={{ fontFamily:mono, fontSize:32, color:T.green, marginBottom:16 }}>✓</div>
          <h2 style={{ fontSize:22, fontWeight:400, color:T.ink, marginBottom:16 }}>Preference saved.</h2>
          {result.noPreference
            ? <p style={{ color:T.inkFaint, fontFamily:serif }}>No body type preference set.</p>
            : <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${T.gold}`, padding:"16px 20px", textAlign:"left" }}>
                <div style={{ fontFamily:mono, fontSize:10, color:T.gold, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Stored preference</div>
                <div style={{ fontSize:14, color:T.inkLight, lineHeight:1.8, fontFamily:serif }}>
                  <div>{BMI_POINTS.find(p=>p.id===result.minId)?.label} → {BMI_POINTS.find(p=>p.id===result.maxId)?.label}</div>
                  <div style={{ fontFamily:mono, fontSize:11, color:T.inkFaint, marginTop:4 }}>BMI {result.minBMI} – {result.maxBMI}</div>
                </div>
              </div>
          }
          <button onClick={() => setResult(null)} style={{ marginTop:24, background:"transparent", border:`1px solid ${T.border}`, fontFamily:mono, fontSize:11, letterSpacing:2, color:T.inkFaint, padding:"10px 24px", cursor:"pointer" }}>
            RESET
          </button>
        </div>
      </div>
    );
  }
  return <BMIPreferenceSelector userHeightCm={165} userWeightKg={65} onComplete={setResult} />;
}

export default StandaloneDemo;
