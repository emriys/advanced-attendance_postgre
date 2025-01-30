/**
 * Generates a persistent device fingerprint using multiple storage methods.
 * Uses EverCookie-like techniques to maximize persistence.
 */
class DeviceFingerprint {
    constructor() {
        this.deviceId = null;
    }

    async getFingerprint() {
        let fingerprint = localStorage.getItem('device_fingerprint');
        if (!fingerprint) {
            fingerprint = await this.generateFingerprint();
            this.storeFingerprint(fingerprint);
        }
        return fingerprint;
    }

    async generateFingerprint() {
        const fpPromise = import('https://openfpcdn.io/fingerprintjs/v4').then(FingerprintJS => FingerprintJS.load());
        const fp = await fpPromise;
        const result = await fp.get();
        return result.visitorId;
    }

    storeFingerprint(fingerprint) {
        localStorage.setItem('device_fingerprint', fingerprint);
        document.cookie = `device_fingerprint=${fingerprint}; path=/; max-age=43200`; // 12 hours
        sessionStorage.setItem('device_fingerprint', fingerprint);
        indexedDB.open('deviceDB', 1).onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction('deviceStore', 'readwrite');
            tx.objectStore('deviceStore').put({ id: 'device_fingerprint', value: fingerprint });
        };
    }
}

async function sendFingerprintToServer() {
    const df = new DeviceFingerprint();
    const deviceId = await df.getFingerprint();
    const ip = await getPublicIP();

    console.log("Device ID: ", deviceId);
    console.log("IP: ", ip);
    if (deviceId && ip){
        final_fingerprint = deviceId;
        final_Ip = ip;
        return true;
    }
    return false;

    // fetch('/log_fingerprint', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ deviceId, ip })
    // });
}

async function getPublicIP() {
    try {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Failed to get public IP:', error);
        return 'Unknown';
    }
}

// Run on page load
// sendFingerprintToServer();
