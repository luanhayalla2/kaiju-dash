import KaijuRunner from "@/components/KaijuRunner";

const Index = () => {
  return (
    <main className="min-h-screen bg-background text-foreground py-6 px-4">
      <header className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          🐲 Kaiju Runner
        </h1>
        <p className="text-muted-foreground mt-2">
          Endless runner — pule, atire e ative o escudo!
        </p>
      </header>
      <KaijuRunner />
    </main>
  );
};

export default Index;
