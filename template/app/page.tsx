export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="bg-slate-900 text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">Welcome to Our Business</h1>
          <p className="text-xl text-slate-300 mb-8">
            We provide professional services tailored to your needs.
          </p>
          <a
            href="#contact"
            className="inline-block bg-white text-slate-900 font-semibold px-8 py-3 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Get in Touch
          </a>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Consulting",
                description: "Expert advice to help your business grow and succeed.",
              },
              {
                title: "Design",
                description: "Beautiful designs that capture your brand identity.",
              },
              {
                title: "Support",
                description: "Ongoing support to keep your operations running smoothly.",
              },
            ].map((service) => (
              <div
                key={service.title}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold mb-3">{service.title}</h3>
                <p className="text-slate-600">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-slate-50 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Contact Us</h2>
          <p className="text-slate-600 mb-4">
            Have a question? We&apos;d love to hear from you.
          </p>
          <p className="text-slate-800 font-medium">hello@mybusiness.com</p>
          <p className="text-slate-800 font-medium">+1 (555) 123-4567</p>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-8 px-6 text-center">
        <p>&copy; {new Date().getFullYear()} My Business. All rights reserved.</p>
      </footer>
    </main>
  );
}
