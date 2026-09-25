// How to make animated gradient border
// https://cruip-tutorials.vercel.app/animated-gradient-border/
function BorderAnimatedContainer({ children }) {
  return (
    <div
      className="w-full h-full rounded-2xl border border-transparent animate-border flex overflow-hidden
        [background:linear-gradient(45deg,#f8fafc,theme(colors.slate.100)_50%,#f8fafc)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.slate.300/.6)_80%,_theme(colors.cyan.500)_86%,_theme(colors.cyan.400)_90%,_theme(colors.cyan.500)_94%,_theme(colors.slate.300/.6))_border-box]
        dark:[background:linear-gradient(45deg,#172033,theme(colors.slate.800)_50%,#172033)_padding-box,conic-gradient(from_var(--border-angle),theme(colors.slate.600/.48)_80%,_theme(colors.cyan.500)_86%,_theme(colors.cyan.300)_90%,_theme(colors.cyan.500)_94%,_theme(colors.slate.600/.48))_border-box]"
    >
      {children}
    </div>
  );
}

export default BorderAnimatedContainer;
