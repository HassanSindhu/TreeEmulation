
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

const QUEUE_KEY = 'OFFLINE_QUEUE';
const CACHE_PREFIX = 'CACHE_';

const generateId = () => Math.random().toString(36).substr(2, 9);

class OfflineService {
    constructor() {
        this.queue = [];
        this.isOnline = true;
        this.subscribers = [];

        // Initialize NetInfo listener
        NetInfo.addEventListener(state => {
            const wasOffline = !this.isOnline;
            this.isOnline = state.isConnected && state.isInternetReachable !== false;

            // If we came online, trigger sync
            if (wasOffline && this.isOnline) {
                this.processQueue();
            }
        });

        // Load queue on startup
        this.loadQueue();
    }

    async loadQueue() {
        try {
            const stored = await AsyncStorage.getItem(QUEUE_KEY);
            this.queue = stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to load offline queue details:', e);
            this.queue = [];
        }
    }

    async saveQueue() {
        try {
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error('Failed to save offline queue:', e);
        }
    }

    // Caching for GET requests
    async cacheResponse(url, data) {
        try {
            await AsyncStorage.setItem(`${CACHE_PREFIX}${url}`, JSON.stringify({
                timestamp: Date.now(),
                data
            }));
        } catch (e) {
            console.error('Cache save failed', e);
        }
    }

    async getCachedResponse(url) {
        try {
            const item = await AsyncStorage.getItem(`${CACHE_PREFIX}${url}`);
            return item ? JSON.parse(item).data : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Enqueue a request that needs to happen.
     * @param {string} url - info The API URL
     * @param {string} method - 'POST', 'PUT', 'PATCH', etc.
     * @param {object} body - The JSON body
     * @param {object} headers - Headers info
     * @param {array} attachments - Optional: [{ uri, uploadUrl, uploadPath, fileName, targetFieldInBody }]
     */
    async addToQueue(url, method, body, headers, attachments = []) {
        const item = {
            id: generateId(),
            url,
            method,
            body,
            headers,
            attachments,
            createdAt: Date.now(),
            status: 'pending' // pending, processing, failed
        };

        this.queue.push(item);
        await this.saveQueue();
        Alert.alert('Offline', 'Data saved locally. Will sync when online.');
        this.notifySubscribers();

        // Try to process immediately if online
        if (this.isOnline) {
            this.processQueue();
        }
    }

    async processQueue() {
        // Double check network state effectively
        const state = await NetInfo.fetch();
        this.isOnline = state.isConnected && state.isInternetReachable !== false;

        if (this.queue.length === 0 || !this.isOnline) return;

        console.log('Sync: Processing Queue...');
        const queueCopy = [...this.queue];

        // Process items one by one
        for (const item of queueCopy) {
            if (item.status === 'processing') continue;

            try {
                console.log(`Syncing item ${item.id}: ${item.method} ${item.url}`);

                // 1. Handle Attachments (Upload first)
                let finalBody = { ...item.body };

                if (item.attachments && item.attachments.length > 0) {
                    const uploadedUrls = await this.processAttachments(item.attachments);

                    const fields = {};
                    item.attachments.forEach((att, idx) => {
                        const field = att.targetFieldInBody || 'pictures';
                        if (!fields[field]) fields[field] = [];

                        let val = uploadedUrls[idx];
                        if (val && att.storeBasename) {
                            // Extract basename logic
                            const noQuery = String(val).split('?')[0];
                            const lastSlash = noQuery.lastIndexOf('/');
                            val = lastSlash >= 0 ? noQuery.substring(lastSlash + 1) : noQuery;
                        }

                        if (val) fields[field].push(val);
                    });

                    Object.keys(fields).forEach(key => {
                        // If the body already has this key, we might be appending or replacing. 
                        // We'll replace or append based on simple logic: if array, append.
                        if (Array.isArray(finalBody[key])) {
                            finalBody[key] = [...finalBody[key], ...fields[key]];
                        } else {
                            finalBody[key] = fields[key];
                        }
                    });
                }

                // 2. Perform actual API Request
                // REFRESH AUTH TOKEN: The token stored in headers might be stale.
                const token = await AsyncStorage.getItem('AUTH_TOKEN');
                const headers = { ...item.headers };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const res = await fetch(item.url, {
                    method: item.method,
                    headers: headers,
                    body: JSON.stringify(finalBody)
                });

                if (!res.ok) {
                    if (res.status >= 400 && res.status < 500) {
                        console.warn('Sync failed with client error, removing:', res.status);
                        this.removeFromQueue(item.id);
                    } else {
                        throw new Error(`Status ${res.status}`);
                    }
                } else {
                    // Success!
                    console.log(`Sync item ${item.id} complete.`);
                    this.removeFromQueue(item.id);
                }
            } catch (e) {
                console.error(`Sync item ${item.id} failed:`, e);
                // Item remains until success
            }
        }
    }

    async removeFromQueue(id) {
        this.queue = this.queue.filter(q => q.id !== id);
        await this.saveQueue();
        this.notifySubscribers();
    }

    /**
     * Get pending items that match a predicate
     * @param {function} predicate (item) => boolean
     */
    getPendingItems(predicate) {
        if (!predicate) return this.queue;
        return this.queue.filter(predicate);
    }

    /**
     * Subscribe to queue changes (e.g., sync completion)
     * @param {function} callback 
     * @returns {function} unsubscribe
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    notifySubscribers() {
        this.subscribers.forEach(cb => {
            try { cb(); } catch (e) { console.warn(e); }
        });
    }

    async processAttachments(attachments) {
        const results = new Array(attachments.length).fill(null);

        for (let i = 0; i < attachments.length; i++) {
            const att = attachments[i];
            try {
                const form = new FormData();
                form.append('uploadPath', att.uploadPath || 'General');
                form.append('isMulti', 'false');
                form.append('fileName', att.fileName || 'offline_sync');

                const fileObj = {
                    uri: att.uri,
                    type: att.type || 'image/jpeg',
                    name: att.name || 'image.jpg'
                };

                form.append('files', fileObj);

                const res = await fetch(att.uploadUrl, {
                    method: 'POST',
                    body: form,
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    }
                });

                const json = await res.json();
                if (json?.status) {
                    const data = Array.isArray(json.data) ? json.data : [json.data];
                    const url = data[0]?.availableSizes?.image || data[0]?.url?.[0] || data[0]?.url;
                    results[i] = url;
                }
            } catch (e) {
                console.error('Attachment upload failed', e);
                throw e;
            }
        }
        return results;
    }
}

export const offlineService = new OfflineService();
