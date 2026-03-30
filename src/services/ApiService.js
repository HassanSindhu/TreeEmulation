
import { offlineService } from './OfflineService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

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
                if (res.status === 401 || res.status === 403) {
                    const json = await res.json().catch(() => null);
                    if (json && json.statusCode === 401) {
                         DeviceEventEmitter.emit('auth_unauthorized');
                    } else if (!json) {
                         DeviceEventEmitter.emit('auth_unauthorized');
                    }
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

                let res;
                try {
                    res = await fetch(url, { method, body: JSON.stringify(finalBody), headers: finalHeaders });
                } catch (networkError) {
                    console.warn(`[Api] ${method} network failed. Saving to offline queue.`, networkError);
                    if (options.skipQueue) throw networkError;
                    await offlineService.addToQueue(url, method, body, finalHeaders, options.attachments);
                    return { status: true, offline: true, message: 'Network failed. Saved to offline queue.' };
                }

                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    const errorMsg = json?.message || json?.error || `Request failed (${res.status})`;

                    // If it's a 5xx error, we might want to queue it as the server is down, unless it's login.
                    // But for 4xx (400, 401, 403, 404, 409, 422), it's a permanent client/auth error. NEVER queue 4xx.
                    if (res.status >= 500 && !options.skipQueue) {
                        console.warn(`[Api] Server error ${res.status}. Saving to offline queue.`);
                        await offlineService.addToQueue(url, method, body, finalHeaders, options.attachments);
                        return { status: true, offline: true, message: 'Server unavailable. Saved to offline queue.' };
                    }

                    if (res.status === 401 || res.status === 403) {
                        if ((json && json.statusCode === 401) || !json) {
                             DeviceEventEmitter.emit('auth_unauthorized');
                        }
                    }

                    throw new Error(errorMsg);
                }

                return json;

            } catch (e) {
                // If it's a manually thrown Error (like the 4xx check above or processAttachments error), bubble it up
                throw e;
            }
        } else {
            // Offline
            if (options.skipQueue) {
                throw new Error('You are offline.');
            }
            await offlineService.addToQueue(url, method, body, finalHeaders, options.attachments);
            return { status: true, offline: true, message: 'You are offline. Data saved locally and will sync later.' };
        }
    }

    // Same for PUT/PATCH if needed
}

export const apiService = new ApiService();
