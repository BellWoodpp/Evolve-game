import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#updates", label: "Release Notes" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "#docs", label: "Documentation" },
      { href: "#support", label: "Support" },
      { href: "#community", label: "Community" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#about", label: "About" },
      { href: "#careers", label: "Careers" },
      { href: "#contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#privacy", label: "Privacy" },
      { href: "#terms", label: "Terms" },
      { href: "#security", label: "Security" },
    ],
  },
];

const socialLinks = [
  { href: "https://x.com", label: "X" },
  { href: "https://github.com", label: "GitHub" },
  { href: "https://www.linkedin.com", label: "LinkedIn" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 border-t border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Evolve Game Two
            </Link>
            <p className="text-sm text-neutral-300 max-w-xs">
              A focused, fast-paced browser experience built for short bursts of play and evolving progression.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-100">
                {column.title}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-neutral-300 hover:text-neutral-100 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-neutral-800 pt-8">
          <p className="text-sm text-neutral-300">
            © {currentYear} Evolve Game Two. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
