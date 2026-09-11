export default function BackgroundFX() {
  return (
    <div className="ns-bgfx pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-accent/25 blur-[140px]" />
      <div className="absolute -left-52 top-1/3 h-[460px] w-[520px] rounded-full bg-accent2/20 blur-[130px]" />
      <div className="absolute -right-40 bottom-[-120px] h-[480px] w-[560px] rounded-full bg-accent3/15 blur-[150px]" />
      <div className="ns-grid absolute inset-0 opacity-[0.14]" />
    </div>
  );
}
