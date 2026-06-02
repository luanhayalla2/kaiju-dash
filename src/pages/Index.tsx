import KaijuRunner from "@/components/KaijuRunner";

const Index = () => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/40 text-foreground py-3 sm:py-6 md:py-10 px-2 sm:px-4">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div
          className="absolute bottom-[-15%] right-[-10%] w-[36rem] h-[36rem] rounded-full bg-destructive/10 blur-3xl animate-pulse"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      <KaijuRunner />
    </main>
  );
};

export default Index;
