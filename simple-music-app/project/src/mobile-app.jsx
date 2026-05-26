// src/mobile-app.jsx
// Lays out the 5 mobile screens on a design canvas.

const PHONE_W = 390;
const PHONE_H = 844;

const Phone = ({ children }) => (
  <IOSDevice width={PHONE_W} height={PHONE_H} dark={true}>
    {children}
  </IOSDevice>
);

function MobileApp() {
  return (
    <DesignCanvas>
      <DCSection
        id="check"
        title="Check"
        subtitle="At-a-glance views — what to practice, what just happened, what's tied to a piece"
      >
        <DCArtboard id="today" label="01 · Today" width={PHONE_W} height={PHONE_H}>
          <Phone><STodayScreen/></Phone>
        </DCArtboard>

        <DCArtboard id="piece" label="04 · Piece quick view" width={PHONE_W} height={PHONE_H}>
          <Phone><SPieceScreen/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="log"
        title="Log"
        subtitle="The act of practicing, and the after-act of recording it"
      >
        <DCArtboard id="session" label="02 · Active session" width={PHONE_W} height={PHONE_H}>
          <Phone><SSessionScreen/></Phone>
        </DCArtboard>

        <DCArtboard id="logsheet" label="03 · Log session (sheet)" width={PHONE_W} height={PHONE_H}>
          <Phone><SLogScreen/></Phone>
        </DCArtboard>

        <DCArtboard id="capture" label="05 · Quick capture" width={PHONE_W} height={PHONE_H}>
          <Phone><SCaptureScreen/></Phone>
        </DCArtboard>
      </DCSection>

      <DCPostIt x={40} y={40} w={300}>
        <b>Soundings — mobile companion</b><br/><br/>
        Five screens for the things you'd actually pull out at the piano: see your queue,
        run a session, log it, glance at a piece, catch a melody before it leaves.<br/><br/>
        Accent is blue bioluminescence (<code>#5ec8ff</code>) overriding the green default.
      </DCPostIt>

      <DCPostIt x={40} y={PHONE_H + 200} w={320}>
        <b>What this needs from the design system</b><br/><br/>
        • <b>Touch sizes</b> — the desktop tokens never go below 28px tap targets; we have to bake a mobile minimum of 44px (`--touch-min`).<br/><br/>
        • <b>Mobile type ramp</b> — `--t-hero` (96px) is too big for 390px. We're picking 44/26/19/15 here; should be added as `--t-hero-m`, `--t-h1-m` etc.<br/><br/>
        • <b>Tab bar pattern</b> — the system has a sidebar but no mobile nav. Added a floating glass pill (5 tabs, center is a CTA).<br/><br/>
        • <b>Sheet pattern</b> — used here for "Log session". Needs spec for grab handle (40×4) and the top-lumen rule.<br/><br/>
        • <b>Stepper + segmented chips</b> — needed for any logging UI (duration ± and "what was this"). Currently bespoke.
      </DCPostIt>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp/>);
