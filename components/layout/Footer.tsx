"use client";

import React from "react";
import { Github } from "lucide-react";
import { useTranslation } from "react-i18next";

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="hidden md:block bg-transparent text-[var(--color-text)] py-1 relative overflow-hidden">
      <div className="bg-gradient-to-t from-[hsl(var(--background,_0_0%_100%))]/60 to-transparent pointer-events-auto">
        <div className="px-4 py-1 flex flex-col items-center justify-center lg:justify-between lg:flex-row relative z-10">
          {/* Desktop: Side-by-side layout */}
          <div className="flex flex-col lg:flex-row items-center space-y-1 lg:space-y-0 lg:space-x-6 text-sm">
            <a
              href="https://github.com/louistrue/ifc-classifier"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View our GitHub repository"
              className="flex items-center hover:text-[var(--color-primary)] transition-colors duration-300"
            >
              <Github size={16} className="mr-1.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.lt.plus"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit our website"
              className="hover:text-[var(--color-primary)] hover:underline transition-colors duration-300"
            >
              lt.plus
            </a>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1 lg:mt-0 text-center">
            <a
              href="https://buymeacoffee.com/louistrue"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('footer.buyMeCoffee')}
              className="hover:text-[var(--color-primary)] transition-colors duration-300 inline-flex items-center"
            >
              <span>{t('footer.madeBy')}</span>
              <img
                src="/icons8-buy-me-a-coffee-100.png"
                alt={t('footer.buyMeCoffee')}
                className="w-6 h-6 mx-1"
              />
              <span>{t('footer.coffeeBillMessage')}</span>
              <img
                src="/icons8-buy-me-a-coffee-100.png"
                alt={t('footer.buyMeCoffee')}
                className="w-6 h-6 ml-1"
              />
            </a>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1 lg:mt-0 text-center lg:text-right">
            <span>© {new Date().getFullYear()} </span>
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View AGPL-3.0 License terms"
              className="font-medium hover:text-[var(--color-primary)] hover:underline transition-colors duration-300"
            >
              AGPL-3.0
            </a>
            <span> {t('footer.license')}</span>
          </div>
        </div>
      </div>
      <style jsx global>{`
        footer {
          color: var(--color-text);
        }
        footer a:hover {
          color: var(--color-primary);
        }

        /* Wave animation - hidden on mobile for better performance */
        footer::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          z-index: 0;
          background-image: linear-gradient(
            90deg,
            var(--color-primary-wave-start, hsla(217, 91%, 60%, 0.18)),
            var(--color-primary-wave-end, hsla(217, 91%, 60%, 0.12)),
            var(--color-primary-wave-start, hsla(217, 91%, 60%, 0.18))
          );
          background-size: 50% 100%;
          animation: waveAnimation 25s linear infinite;
        }

        /* Hide wave animation on mobile devices */
        @media (max-width: 640px) {
          footer::before {
            display: none;
          }
          
          /* Ensure footer has minimal height on mobile */
          footer {
            min-height: auto;
          }
        }

        @keyframes waveAnimation {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 0%;
          }
        }

        /* Mobile-specific optimizations */
        @media (max-width: 768px) {
          /* Mobile footer is now handled by separate div - no additional styles needed */
          footer {
            /* Ensure minimal height on mobile */
            min-height: auto;
          }
        }

        /* 
          CSS Variables (ensure these are defined in your global styles):
          --background (as HSL values, e.g., 0 0% 100% for white, 240 10% 3.9% for dark gray)
          --primary-hsl (e.g., 217 91% 60%)
          --color-primary-wave-start (e.g., hsla(var(--primary-hsl), 0.18))
          --color-primary-wave-end (e.g., hsla(var(--primary-hsl), 0.12))
          --color-text
          --color-primary
          --color-text-muted
          --border
        */
      `}</style>
    </footer>
  );
};

export default Footer;
