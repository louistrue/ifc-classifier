"use client";

// Cache management utility for IFC schema data
export class SchemaCache {
    private static readonly PREVIEW_CACHE_KEY = 'ifc-schema-preview-cache';
    private static readonly SCHEMA_CACHE_KEY = 'ifc-schema-full-cache';
    private static readonly CACHE_VERSION = 'v1';

    // Get cache statistics
    static getCacheStats(): {
        previewCache: { entries: number; size: string; lastUpdated?: string };
        schemaCache: { entries: number; size: string; lastUpdated?: string };
        totalSize: string;
    } {
        const getStorageSize = (key: string): number => {
            try {
                const item = localStorage.getItem(key);
                return item ? new Blob([item]).size : 0;
            } catch {
                return 0;
            }
        };

        const getStorageInfo = (key: string) => {
            try {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const entries = Object.keys(parsed.data || {}).length;
                    const size = this.formatBytes(getStorageSize(key));
                    const lastUpdated = parsed.lastUpdated ? new Date(parsed.lastUpdated).toLocaleString() : undefined;
                    return { entries, size, lastUpdated };
                }
            } catch (error) {
                console.warn(`Failed to get cache info for ${key}:`, error);
            }
            return { entries: 0, size: '0 B' };
        };

        const previewCache = getStorageInfo(this.PREVIEW_CACHE_KEY);
        const schemaCache = getStorageInfo(this.SCHEMA_CACHE_KEY);
        const totalSize = this.formatBytes(
            getStorageSize(this.PREVIEW_CACHE_KEY) + getStorageSize(this.SCHEMA_CACHE_KEY)
        );

        return { previewCache, schemaCache, totalSize };
    }

    // Clean up expired cache entries
    static cleanupExpiredEntries(): { removed: number; errors: number } {
        let removed = 0;
        let errors = 0;

        const cleanupCache = (key: string) => {
            try {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.version === this.CACHE_VERSION && parsed.data) {
                        const now = Date.now();
                        const validEntries: Record<string, any> = {};
                        let removedFromThis = 0;

                        Object.entries(parsed.data).forEach(([url, entry]: [string, any]) => {
                            if (entry.expires && entry.expires > now) {
                                validEntries[url] = entry;
                            } else {
                                removedFromThis++;
                            }
                        });

                        if (removedFromThis > 0) {
                            localStorage.setItem(key, JSON.stringify({
                                ...parsed,
                                data: validEntries,
                                lastUpdated: now
                            }));
                            removed += removedFromThis;
                            console.log(`Cleaned up ${removedFromThis} expired entries from ${key}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to cleanup cache ${key}:`, error);
                errors++;
            }
        };

        cleanupCache(this.PREVIEW_CACHE_KEY);
        cleanupCache(this.SCHEMA_CACHE_KEY);

        return { removed, errors };
    }

    // Clear all cache data
    static clearAllCache(): boolean {
        try {
            localStorage.removeItem(this.PREVIEW_CACHE_KEY);
            localStorage.removeItem(this.SCHEMA_CACHE_KEY);
            console.log('All schema cache cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear cache:', error);
            return false;
        }
    }

    // Clear specific cache
    static clearPreviewCache(): boolean {
        try {
            localStorage.removeItem(this.PREVIEW_CACHE_KEY);
            console.log('Preview cache cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear preview cache:', error);
            return false;
        }
    }

    static clearSchemaCache(): boolean {
        try {
            localStorage.removeItem(this.SCHEMA_CACHE_KEY);
            console.log('Schema cache cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear schema cache:', error);
            return false;
        }
    }

    // Check if cache needs cleanup (based on size or age)
    static needsCleanup(): boolean {
        const stats = this.getCacheStats();
        const totalEntries = stats.previewCache.entries + stats.schemaCache.entries;

        // Cleanup if more than 100 total entries or cache is older than 7 days
        if (totalEntries > 100) {
            return true;
        }

        // Check if any cache is older than 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        try {
            const checkCacheAge = (key: string): boolean => {
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    return parsed.lastUpdated && parsed.lastUpdated < sevenDaysAgo;
                }
                return false;
            };

            return checkCacheAge(this.PREVIEW_CACHE_KEY) || checkCacheAge(this.SCHEMA_CACHE_KEY);
        } catch {
            return false;
        }
    }

    // Auto cleanup - run this periodically
    static autoCleanup(): void {
        if (this.needsCleanup()) {
            const result = this.cleanupExpiredEntries();
            console.log(`Auto cleanup completed: ${result.removed} entries removed, ${result.errors} errors`);
        }
    }

    // Format bytes to human readable
    private static formatBytes(bytes: number, decimals: number = 2): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Get cache health status
    static getCacheHealth(): {
        status: 'healthy' | 'warning' | 'critical';
        message: string;
        recommendations: string[];
    } {
        const stats = this.getCacheStats();
        const totalEntries = stats.previewCache.entries + stats.schemaCache.entries;
        const recommendations: string[] = [];

        if (totalEntries === 0) {
            return {
                status: 'healthy',
                message: 'Cache is empty - will populate as you browse documentation',
                recommendations: ['Browse IFC documentation to build cache']
            };
        }

        if (totalEntries > 150) {
            recommendations.push('Consider clearing old cache entries');
            return {
                status: 'warning',
                message: `Cache has ${totalEntries} entries - consider cleanup`,
                recommendations
            };
        }

        if (totalEntries > 200) {
            recommendations.push('Clear cache to free up space');
            recommendations.push('Cache cleanup recommended');
            return {
                status: 'critical',
                message: `Cache has ${totalEntries} entries - cleanup needed`,
                recommendations
            };
        }

        if (this.needsCleanup()) {
            recommendations.push('Run cache cleanup to remove expired entries');
            return {
                status: 'warning',
                message: 'Cache contains expired entries',
                recommendations
            };
        }

        return {
            status: 'healthy',
            message: `Cache is healthy with ${totalEntries} entries`,
            recommendations: ['Cache is working optimally']
        };
    }
}

// Auto-run cleanup on module load
if (typeof window !== 'undefined') {
    // Run cleanup after a short delay to avoid blocking initial load
    setTimeout(() => {
        SchemaCache.autoCleanup();
    }, 5000);
} 