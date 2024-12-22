const LandingPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Welcome to OpenTask</h1>
        <p className="text-xl text-gray-600">
          A decentralized marketplace connecting task providers with developers and auditors
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-8 mb-12">
        <RoleCard 
          title="Task Provider"
          description="Create and manage tasks, hire developers, and get your projects done"
          icon="🏢"
        />
        <RoleCard 
          title="Developer"
          description="Find tasks, showcase your skills, and earn rewards"
          icon="👨‍💻"
        />
        <RoleCard 
          title="Auditor"
          description="Review code, ensure quality, and maintain platform integrity"
          icon="🔍"
        />
      </section>

      <section className="text-center mb-16">
        <h2 className="text-2xl font-bold mb-4">Get Started</h2>
        <p className="mb-4">Connect your wallet to start using OpenTask</p>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-bold mb-8">Project Roadmap</h2>
        <div className="relative w-full max-w-4xl mx-auto">
          <img 
            src="/opentask-roadmap.png" 
            alt="OpenTask Roadmap" 
            className="w-full h-auto rounded-lg shadow-lg"
          />
          <p className="mt-4 text-sm text-gray-600">
            Our vision for the future of decentralized task management
          </p>
        </div>
      </section>
    </div>
  );
};

const RoleCard = ({ title, description, icon }) => {
  return (
    <div className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default LandingPage; 