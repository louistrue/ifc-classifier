"use client";

import React from "react";
import { Github } from "lucide-react";
import { useTranslation } from "react-i18next";

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-transparent text-[var(--color-text)] py-1 relative overflow-hidden">
      <div className="bg-gradient-to-t from-[hsl(var(--background,_0_0%_100%))]/60 to-transparent pointer-events-auto">
        <div className="px-4 py-1 flex flex-col md:flex-row items-center justify-between relative z-10">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 text-sm">
            <a
              href="https://github.com/louistrue/ifc-classifier"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View our GitHub repository"
              className="flex items-center hover:text-[var(--color-primary)] transition-colors duration-300"
            >
              <Github size={16} className="mr-1.5" />
              GitHub
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
          <div className="text-xs text-[var(--color-text-muted)] mt-2 md:mt-0">
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

        @keyframes waveAnimation {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 0%;
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
        */
      `}</style>
    </footer>
  );
};

export default Footer;
