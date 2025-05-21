"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Home, Zap, FileText, Cog, ChevronsRight, Info } from "lucide-react";

interface DocumentationModalProps {
    onClose: () => void;
}

const DOC_SECTIONS = [
    { id: "general", title: "Welcome!", icon: <Home className="h-5 w-5" />, content: "General Info Content" },
    { id: "getting-started", title: "Getting Started", icon: <Zap className="h-5 w-5" />, content: "Getting Started Content" },
    { id: "classifications", title: "Classifications", icon: <FileText className="h-5 w-5" />, content: "Classifications Content: Loading default, creating custom, export options." },
    { id: "rules", title: "Rules", icon: <ChevronsRight className="h-5 w-5" />, content: "Rules Content: Import/export, creating custom, managing rules." },
    { id: "settings", title: "Settings", icon: <Cog className="h-5 w-5" />, content: "Settings Content" },
    { id: "workflow", title: "Typical Workflow", icon: <Info className="h-5 w-5" />, content: "Typical Workflow Content: Detailed start-to-end example including rules." },
];

const DocumentationModal: React.FC<DocumentationModalProps> = ({ onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true); // Trigger fade-in animation
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to finish
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
            className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ease-out p-4 sm:p-6 md:p-8 modal-backdrop ${isVisible ? "opacity-100" : "opacity-0"
                }`}
            onClick={handleClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                isolation: 'isolate',
                pointerEvents: 'all'
            }}
        >
            <div
                className={`bg-card text-card-foreground rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col m-auto transform transition-all duration-300 ease-out relative modal-content ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
                    }`}
                onClick={(e) => e.stopPropagation()}
                style={{ pointerEvents: 'all' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/20">
                    <h2 className="text-2xl font-semibold text-primary">IfcClassifier Guide</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label="Close documentation"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <aside className="w-1/4 bg-background/50 p-6 border-r border-border/20 overflow-y-auto">
                        <nav>
                            <ul>
                                {DOC_SECTIONS.map((section, index) => (
                                    <li key={section.id} className="mb-2">
                                        <button
                                            onClick={() => goToStep(index)}
                                            className={`flex items-center space-x-3 w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out group
                        ${currentStep === index
                                                    ? "bg-primary/20 text-primary font-medium"
                                                    : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                                }`}
                                        >
                                            {section.icon}
                                            <span>{section.title}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 p-8 overflow-y-auto">
                        <h3 className="text-3xl font-bold mb-2 text-foreground">{currentSection.title}</h3>
                        <p className="text-sm text-muted-foreground mb-6">Step {currentStep + 1} of {DOC_SECTIONS.length}</p>

                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
                            {/* Placeholder for dynamic content loading */}
                            <p>{currentSection.content}</p>
                            {/* Add more detailed content for each section here */}
                        </div>
                    </main>
                </div>

                {/* Footer with Navigation */}
                <div className="p-6 border-t border-border/20 flex justify-between items-center">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className="px-6 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        <span>Previous</span>
                    </button>
                    <div className="flex items-center space-x-2">
                        {DOC_SECTIONS.map((_, index) => (
                            <button
                                key={`dot-${index}`}
                                onClick={() => goToStep(index)}
                                className={`w-3 h-3 rounded-full transition-all duration-200 ease-in-out
                  ${currentStep === index ? 'bg-primary scale-125' : 'bg-muted-foreground/50 hover:bg-muted-foreground/80'}`}
                                aria-label={`Go to step ${index + 1}`}
                            />
                        ))}
                    </div>
                    <button
                        onClick={nextStep}
                        disabled={currentStep === DOC_SECTIONS.length - 1}
                        className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                        <span>Next</span>
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocumentationModal; 