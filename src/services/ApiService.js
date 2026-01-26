
import { offlineService } from './OfflineService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ApiService {
    async getToken() {
        return await AsyncStorage.getItem('AUTH_TOKEN');
    }

    async getheaders(extras = {}) {
        const token = await this.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...extras
        };
    }

    async get(url, headers = {}) {
        const finalHeaders = await this.getheaders(headers);

        // If Online, try fetch and cache
        if (offlineService.isOnline) {
            try {
                const res = await fetch(url, { method: 'GET', headers: finalHeaders });
                if (res.ok) {
                    const json = await res.json();
                    await offlineService.cacheResponse(url, json);
                    return json;
                }
            } catch (e) {
                console.warn(`[Api] GET ${url} failed, checking cache. Error:`, e);
            }
        }

        // If Offline or Fetch Failed, return Cache
        const cached = await offlineService.getCachedResponse(url);
        if (cached) {
            console.log(`[Api] Serving cached: ${url}`);
            return cached;
        }

        if (!offlineService.isOnline) {
            throw new Error('You are offline and no data is cached.');
        }
        throw new Error('Request failed');
    }

    /**
     * Post data handling both online and offline scenarios
     * @param {*} url 
     * @param {*} body 
     * @param {*} options { attachments: [{ uri, type, name, uploadUrl, uploadPath, targetFieldInBody }], headers: {} }
     */

    async put(url, body, options = {}) {
        return this._send('PUT', url, body, options);
    }

    async patch(url, body, options = {}) {
        return this._send('PATCH', url, body, options);
    }

    async post(url, body, options = {}) {
        return this._send('POST', url, body, options);
    }

    async _send(method, url, body, options = {}) {
        const finalHeaders = await this.getheaders(options.headers);

        if (offlineService.isOnline) {
            try {
                // Online: Upload images first if any
                let finalBody = { ...body };

                if (options.attachments && options.attachments.length > 0) {
                    const urls = await offlineService.processAttachments(options.attachments);

                    // Merge uploaded URLs into body
                    options.attachments.forEach((att, idx) => {
                        const field = att.targetFieldInBody || 'pictures';
                        if (!finalBody[field]) finalBody[field] = [];
                        if (!Array.isArray(finalBody[field])) finalBody[field] = [];

                        let val = urls[idx];
                        if (val && att.storeBasename) {
                            const noQuery = String(val).split('?')[0];
                            const lastSlash = noQuery.lastIndexOf('/');
                            val = lastSlash >= 0 ? noQuery.substring(lastSlash + 1) : noQuery;
                        }

                        if (val) finalBody[field].push(val);
                    });
                }

                const res = await fetch(url, { method, body: JSON.stringify(finalBody), headers: finalHeaders });
                const json = await res.json();

                if (!res.ok) {
                    throw new Error(json?.message || json?.error || `Request failed (${res.status})`);
                }
                return json;

            } catch (e) {
                console.warn(`[Api] ${method} failed. Saving to offline queue.`, e);
                // Optional: fallback to queue if online request fails randomly?
                // For now, only queue if explicitly offline or if user wants that behavior.
                // Let's assume if network fetch throws, we queue it.

                await offlineService.addToQueue(url, method, body, finalHeaders, options.attachments);
                return { status: true, offline: true, message: 'Network failed. Saved to offline queue.' };
            }
        } else {
            // Offline
            await offlineService.addToQueue(url, method, body, finalHeaders, options.attachments);
            return { status: true, offline: true, message: 'You are offline. Data saved locally and will sync later.' };
        }
    }

    // Same for PUT/PATCH if needed
}

export const apiService = new ApiService();
