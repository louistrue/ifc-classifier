"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    ExternalLink,
    Info,
    X,
    Wifi,
    WifiOff,
    Database,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SchemaCache } from "@/lib/cache-manager";

interface CorsStatusBannerProps {
    className?: string;
    onDismiss?: () => void;
}

type ProxyStatus = 'checking' | 'working' | 'limited' | 'failed';

interface ProxyService {
    name: string;
    status: ProxyStatus;
    lastChecked?: Date;
    responseTime?: number;
}

export function CorsStatusBanner({ className, onDismiss }: CorsStatusBannerProps) {
    const [proxyServices, setProxyServices] = useState<ProxyService[]>([
        { name: "local", status: 'checking' },
        { name: "thingproxy.freeboard.io", status: 'checking' },
        { name: "crossorigin.me", status: 'checking' },
        { name: "cors.sh", status: 'checking' },
        { name: "corsproxy.io", status: 'checking' },
    ]);
    const [isDismissed, setIsDismissed] = useState(false);
    const [lastGlobalCheck, setLastGlobalCheck] = useState<Date | null>(null);
    const [cacheStats, setCacheStats] = useState<any>(null);
    const [showCacheDetails, setShowCacheDetails] = useState(false);

    // Check proxy service health
    const checkProxyHealth = useCallback(async (service: ProxyService): Promise<ProxyService> => {
        const testUrl = 'https://ifc43-docs.standards.buildingsmart.org/robots.txt';
        let proxyUrl: string;

        switch (service.name) {
            case 'local':
                proxyUrl = `/api/proxy?url=${encodeURIComponent(testUrl)}`;
                break;
            case 'thingproxy.freeboard.io':
                proxyUrl = `https://thingproxy.freeboard.io/fetch/${testUrl}`;
                break;
            case 'crossorigin.me':
                proxyUrl = `https://crossorigin.me/${testUrl}`;
                break;
            case 'cors.sh':
                proxyUrl = `https://cors.sh/${testUrl}`;
                break;
            case 'corsproxy.io':
                proxyUrl = `https://corsproxy.io/?${encodeURIComponent(testUrl)}`;
                break;
            default:
                proxyUrl = testUrl;
        }

        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(proxyUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'text/plain',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (response.ok) {
                return {
                    ...service,
                    status: responseTime > 4000 ? 'limited' : 'working',
                    lastChecked: new Date(),
                    responseTime
                };
            } else if (response.status === 429) {
                return {
                    ...service,
                    status: 'limited',
                    lastChecked: new Date(),
                    responseTime
                };
            } else if (response.status === 403) {
                return {
                    ...service,
                    status: 'failed',
                    lastChecked: new Date(),
                    responseTime
                };
            } else {
                return {
                    ...service,
                    status: 'failed',
                    lastChecked: new Date(),
                    responseTime
                };
            }
        } catch (error) {
            return {
                ...service,
                status: 'failed',
                lastChecked: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }, []);

    // Check all services
    const checkAllServices = useCallback(async () => {
        const updatedServices = await Promise.all(
            proxyServices.map(service => checkProxyHealth(service))
        );
        setProxyServices(updatedServices);
        setLastGlobalCheck(new Date());
    }, [proxyServices, checkProxyHealth]);

    // Update cache stats
    const updateCacheStats = useCallback(() => {
        try {
            const stats = SchemaCache.getCacheStats();
            const health = SchemaCache.getCacheHealth();
            setCacheStats({ ...stats, health });
        } catch (error) {
            console.warn('Failed to get cache stats:', error);
        }
    }, []);

    // Initial check and periodic updates
    useEffect(() => {
        checkAllServices();
        updateCacheStats();

        // Check every 10 minutes
        const interval = setInterval(() => {
            checkAllServices();
            updateCacheStats();
        }, 10 * 60 * 1000);

        return () => clearInterval(interval);
    }, [checkAllServices, updateCacheStats]);

    // Don't show if dismissed
    if (isDismissed) return null;

    const workingServices = proxyServices.filter(s => s.status === 'working');
    const limitedServices = proxyServices.filter(s => s.status === 'limited');
    const failedServices = proxyServices.filter(s => s.status === 'failed');

    const getStatusIcon = (status: ProxyStatus) => {
        switch (status) {
            case 'checking': return <Clock className="w-4 h-4 animate-spin" />;
            case 'working': return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'limited': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
            case 'failed': return <WifiOff className="w-4 h-4 text-red-600" />;
        }
    };

    const getStatusColor = (status: ProxyStatus) => {
        switch (status) {
            case 'checking': return 'bg-blue-50 border-blue-200';
            case 'working': return 'bg-green-50 border-green-200';
            case 'limited': return 'bg-yellow-50 border-yellow-200';
            case 'failed': return 'bg-red-50 border-red-200';
        }
    };

    const getOverallStatus = () => {
        if (workingServices.length > 0) return 'working';
        if (limitedServices.length > 0) return 'limited';
        if (failedServices.length > 0) return 'failed';
        return 'checking';
    };

    const getBannerMessage = () => {
        const overallStatus = getOverallStatus();

        switch (overallStatus) {
            case 'working':
                return {
                    icon: <Wifi className="w-4 h-4 text-green-600" />,
                    title: "Documentation Access: Good",
                    description: `${workingServices.length} proxy service${workingServices.length !== 1 ? 's' : ''} available for loading IFC documentation.`,
                    variant: "default" as const
                };
            case 'limited':
                return {
                    icon: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
                    title: "Documentation Access: Limited",
                    description: "Some proxy services are experiencing issues. Documentation may load slower or from cache.",
                    variant: "default" as const
                };
            case 'failed':
                return {
                    icon: <WifiOff className="w-4 h-4 text-red-600" />,
                    title: "Documentation Access: Restricted",
                    description: "All proxy services are currently unavailable. Using cached content and fallback information.",
                    variant: "destructive" as const
                };
            default:
                return {
                    icon: <Clock className="w-4 h-4 text-blue-600" />,
                    title: "Checking Documentation Access...",
                    description: "Testing proxy services for IFC documentation access.",
                    variant: "default" as const
                };
        }
    };

    const handleClearCache = async () => {
        const success = SchemaCache.clearAllCache();
        if (success) {
            updateCacheStats();
            // Show a brief success message
            setTimeout(() => {
                updateCacheStats();
            }, 100);
        }
    };

    const bannerInfo = getBannerMessage();
    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    return (
        <Alert className={cn("border-l-4", getStatusColor(getOverallStatus()), className)}>
            <div className="flex items-start justify-between w-full">
                <div className="flex items-start gap-3 flex-1">
                    {bannerInfo.icon}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium">{bannerInfo.title}</h4>
                            {lastGlobalCheck && (
                                <Badge variant="outline" className="text-xs">
                                    Last checked: {lastGlobalCheck.toLocaleTimeString()}
                                </Badge>
                            )}
                        </div>
                        <AlertDescription className="text-sm">
                            {bannerInfo.description}
                        </AlertDescription>

                        {/* Service Status Details */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {proxyServices.map((service) => (
                                <div
                                    key={service.name}
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 rounded text-xs border",
                                        getStatusColor(service.status)
                                    )}
                                >
                                    {getStatusIcon(service.status)}
                                    <span className="font-mono text-xs">{service.name}</span>
                                    {service.responseTime && (
                                        <span className="text-muted-foreground">
                                            ({service.responseTime}ms)
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Cache Information */}
                        {cacheStats && (
                            <div className="mt-3 p-2 bg-muted/50 rounded border">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-4 h-4" />
                                        <span className="text-sm font-medium">
                                            Cache: {cacheStats.previewCache.entries + cacheStats.schemaCache.entries} entries ({cacheStats.totalSize})
                                        </span>
                                        <Badge
                                            variant={cacheStats.health.status === 'healthy' ? 'default' :
                                                cacheStats.health.status === 'warning' ? 'secondary' : 'destructive'}
                                            className="text-xs"
                                        >
                                            {cacheStats.health.status}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowCacheDetails(!showCacheDetails)}
                                        className="text-xs"
                                    >
                                        {showCacheDetails ? 'Hide' : 'Details'}
                                    </Button>
                                </div>

                                {showCacheDetails && (
                                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                        <div>Preview cache: {cacheStats.previewCache.entries} entries ({cacheStats.previewCache.size})</div>
                                        <div>Schema cache: {cacheStats.schemaCache.entries} entries ({cacheStats.schemaCache.size})</div>
                                        <div className="text-xs">{cacheStats.health.message}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Help Actions */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={checkAllServices}
                                disabled={proxyServices.some(s => s.status === 'checking')}
                            >
                                <Wifi className="w-3 h-3 mr-1" />
                                Recheck Services
                            </Button>

                            {cacheStats && cacheStats.previewCache.entries + cacheStats.schemaCache.entries > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearCache}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Clear Cache
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open('https://standards.buildingsmart.org/IFC/', '_blank')}
                            >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                IFC Documentation
                            </Button>
                        </div>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDismiss}
                    className="h-6 w-6 -mt-1 -mr-1"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </Alert>
    );
} 