"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { getDocSections } from "./docsContent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useI18n } from "@/context/i18n-context";

interface DocumentationModalProps {
  onClose: () => void;
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ onClose }) => {
  const { lang, t } = useI18n();
  const DOC_SECTIONS = getDocSections(lang);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, DOC_SECTIONS.length - 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
  };

  const currentSection = DOC_SECTIONS[currentStep];

  return (
    <div
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ease-out p-2 sm:p-4 md:p-8 modal-backdrop z-50 ${isVisible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        isolation: "isolate",
        pointerEvents: "all",
      }}
    >
      <div
        className={`bg-card text-card-foreground rounded-lg sm:rounded-xl shadow-2xl w-full max-w-sm sm:max-w-2xl md:max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col m-auto transform transition-all duration-300 ease-out relative modal-content ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "all" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <div className="w-4 h-4 sm:w-5 sm:h-5 text-primary">📚</div>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{t("docModalTitle")}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Step {currentStep + 1} of {DOC_SECTIONS.length}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t("closeDocs")}
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar Navigation - Hidden on Mobile */}
          <aside className="hidden md:block w-1/3 bg-background/50 p-4 lg:p-6 border-r border-border/20 overflow-y-auto">
            <nav>
              <ul>
                {DOC_SECTIONS.map((section, index) => (
                  <li key={section.id} className="mb-2 lg:mb-3">
                    <button
                      onClick={() => goToStep(index)}
                      className={`flex items-center space-x-3 lg:space-x-4 w-full text-left px-3 lg:px-4 py-2 lg:py-3 rounded-lg transition-colors duration-150 ease-in-out group ${currentStep === index ? "bg-primary/20 text-primary font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"}`}
                    >
                      <div className="w-5 h-5 lg:w-6 lg:h-6 flex-shrink-0 flex items-center justify-center">
                        {section.icon}
                      </div>
                      <span className="text-sm lg:text-base">{section.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Section Selector */}
            <div className="md:hidden p-4 border-b border-border/20 bg-background/50">
              <div className="flex items-center justify-between">
                <select
                  value={currentStep}
                  onChange={(e) => goToStep(parseInt(e.target.value))}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {DOC_SECTIONS.map((section, index) => (
                    <option key={section.id} value={index}>
                      {section.title}
                    </option>
                  ))}
                </select>
                <span className="ml-3 text-xs text-muted-foreground whitespace-nowrap">
                  {currentStep + 1}/{DOC_SECTIONS.length}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
              <div className="max-w-none">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <div className="w-6 h-6 md:w-8 md:h-8 flex-shrink-0 flex items-center justify-center text-primary">
                    {currentSection.icon}
                  </div>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">{currentSection.title}</h3>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 md:hidden">
                  {t('stepOf', { current: currentStep + 1, total: DOC_SECTIONS.length })}
                </p>

                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground/90 prose-headings:text-primary prose-a:text-primary prose-strong:text-primary/90 prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:text-primary prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed prose-li:leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                          {props.children}
                          <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
                        </a>
                      ),
                    }}
                  >
                    {currentSection.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Footer with Navigation */}
        <div className="p-4 sm:p-6 border-t border-border/20 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 bg-background/30">
          {/* Mobile: Progress indicators on top */}
          <div className="sm:hidden flex items-center space-x-2 order-1">
            {DOC_SECTIONS.map((_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => goToStep(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ease-in-out ${currentStep === index ? "bg-primary scale-125" : "bg-muted-foreground/50 hover:bg-muted-foreground/80"}`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-0 order-2 sm:order-1">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 transition-colors text-sm sm:text-base"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t("prev")}</span>
              <span className="sm:hidden">←</span>
            </button>

            {/* Desktop Progress Indicators */}
            <div className="hidden sm:flex items-center space-x-2 mx-6">
              {DOC_SECTIONS.map((_, index) => (
                <button
                  key={`dot-${index}`}
                  onClick={() => goToStep(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ease-in-out ${currentStep === index ? "bg-primary scale-125" : "bg-muted-foreground/50 hover:bg-muted-foreground/80"}`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={nextStep}
              disabled={currentStep === DOC_SECTIONS.length - 1}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 transition-colors text-sm sm:text-base"
            >
              <span className="hidden sm:inline">{t("next")}</span>
              <span className="sm:hidden">→</span>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentationModal;
