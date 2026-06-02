import KaijuRunner from "@/components/KaijuRunner";

const Index = () => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/40 text-foreground py-3 sm:py-6 md:py-10 px-2 sm:px-4">
      {/* Ambient background — static, GPU-friendly (no animation, no blur) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            "radial-gradient(40rem 40rem at 0% 0%, hsl(var(--primary) / 0.10), transparent 60%)",
            "radial-gradient(36rem 36rem at 100% 100%, hsl(var(--destructive) / 0.10), transparent 60%)",
          ].join(","),
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <KaijuRunner />
    </main>
  );
};

export default Index;
