
import { apiService } from './ApiService';
import { Platform } from 'react-native';

const APP_VERSION = '1.0.0'; // Current App Version
const VERSION_CHECK_URL = 'https://be.punjabtreeenumeration.com/lpe3/app-config'; // Hypothetical endpoint

class VersionService {
    constructor() {
        this.currentVersion = APP_VERSION;
    }

    /**
     * Checks if an update is required.
     * Returns { updateRequired: boolean, latestVersion: string }
     */
    async checkForUpdate() {
        try {
            // In a real scenario, this would be a real endpoint.
            // If it fails, we assume no update is required to avoid blocking the user.
            const response = await apiService.get(VERSION_CHECK_URL);

            if (response && response.data && response.data.min_version) {
                const minVersion = response.data.min_version;
                const isUpdateRequired = this.compareVersions(this.currentVersion, minVersion) < 0;

                return {
                    updateRequired: isUpdateRequired,
                    latestVersion: response.data.latest_version || minVersion,
                };
            }

            return { updateRequired: false, latestVersion: this.currentVersion };
        } catch (error) {
            console.warn('[VersionService] Check failed:', error);
            return { updateRequired: false, latestVersion: this.currentVersion };
        }
    }

    /**
     * Simple version comparison
     * Returns -1 if v1 < v2, 1 if v1 > v2, 0 if equal
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 < p2) return -1;
            if (p1 > p2) return 1;
        }
        return 0;
    }
}

export const versionService = new VersionService();
