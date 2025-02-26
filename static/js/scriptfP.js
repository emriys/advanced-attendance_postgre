
async function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
        const persisted = await checkPersistentStorage();
        if (persisted) {
            // console.log('Storage is already persistent');
            return;
        }
        const persistent = await navigator.storage.persist();
        // console.log(persistent ? 'Storage will not be cleared' : 'Storage might be cleared by the browser');
    }
}
// Call this early when the page loads
// requestPersistentStorage();

async function checkPersistentStorage() {
    if (navigator.storage && navigator.storage.persisted) {
        return await navigator.storage.persisted();
    }
    return false;
}

/*=============================*/
/* 1. Unique Device ID Utility */
/*=============================*/
// Load FingerprintJS and generate a unique device ID
async function generateDeviceID() {
    const fp = await window.FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId; // Persistent device ID
}

/*=============================*/
/* 2. Cookie Utility Functions */
/*=============================*/
function setCookie(name, value, minutes) {
    let expires = "";
    if (minutes) {
        const date = new Date();
        date.setTime(date.getTime() + (minutes * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let c of ca) {
        c = c.trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

/*==================================*/
/* 3. IndexedDB Utility Functions   */
/*==================================*/
const DB_NAME = "DeviceDB";
const DB_VERSION = 1;
const STORE_NAME = "deviceStore";

function openDB(callback) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
    };

    request.onsuccess = function (event) {
        callback(event.target.result);
    };

    request.onerror = function (event) {
        console.error("IndexedDB error:", event.target.error);
        callback(null);
    };
}

function getFromIndexedDB(callback) {
    openDB((db) => {
        if (!db) {
            callback(null);
            return;
        }
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get("deviceID");

        getRequest.onsuccess = function () {
            const storedID = getRequest.result ? getRequest.result.value : null;
            console.log("Device ID retrieved from IndexedDB:", storedID);
            callback(storedID);
        };

        getRequest.onerror = function (error) {
            console.error("Error retrieving device ID from IndexedDB:", error);
            callback(null);
        };
    });
}

function saveToIndexedDB(deviceID, callback) {
    openDB((db) => {
        if (!db) {
            if (callback) callback(false);
            return;
        }
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const putRequest = store.put({ id: "deviceID", value: deviceID });

        putRequest.onsuccess = function () {
            console.log("Device ID saved in IndexedDB:", deviceID);
            if (callback) callback(true);
        };

        putRequest.onerror = function (error) {
            console.error("Failed to save device ID in IndexedDB:", error);
            if (callback) callback(false);
        };
    });
}

/*=============================*/
/* 4. Window.name Storage Utility */
/*=============================*/
function getFromWindowName() {
    if (window.name && window.name.startsWith("deviceID-")) {
        return window.name.substring(9);
    }
    return null;
}

function saveToWindowName(deviceID) {
    window.name = "deviceID-" + deviceID;
}

/*====================================*/
/* 5. Cache API Utility Functions */
/*====================================*/
const CACHE_NAME = "device-cache";

async function saveToCache(deviceID) {
    if ('caches' in window) {
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = new Response(deviceID, { headers: { "Content-Type": "text/plain" } });
            await cache.put("deviceID", response);
            console.log("Device ID saved in Cache API:", deviceID);
        } catch (error) {
            console.error("Failed to save Device ID in Cache API:", error);
        }
    }
}

async function getFromCache() {
    if ('caches' in window) {
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await cache.match("deviceID");
            if (response) {
                const deviceID = await response.text();
                console.log("Device ID retrieved from Cache API:", deviceID);
                return deviceID;
            }
        } catch (error) {
            console.error("Error retrieving Device ID from Cache API:", error);
        }
    }
    return null;
}

/*=============================*/
/* 6. Session Storage Utility */
/*=============================*/
function saveToSessionStorage(deviceID) {
    sessionStorage.setItem("deviceID", deviceID);
    console.log("Device ID saved in Session Storage:", deviceID);
}

function getFromSessionStorage() {
    const deviceID = sessionStorage.getItem("deviceID");
    if (deviceID) {
        console.log("Device ID retrieved from Session Storage:", deviceID);
    }
    return deviceID;
}

/*=====================================*/
/* 7. SharedWorker Storage Utility */
/*=====================================*/
let sharedWorker;
if (window.SharedWorker) {
    console.log("SharedWorker is supported!");
    sharedWorker = new SharedWorker("/sharedWorker.js");
    sharedWorker.port.start();

    sharedWorker.port.postMessage("Hello, worker!");

    sharedWorker.port.onmessage = function (event) {
        console.log("Message from SharedWorker:", event.data);
    };

    sharedWorker.onerror = function (error) {
        console.error("SharedWorker error:", error);
    };
} else {
    console.error("SharedWorker is NOT supported.");
}

function saveToSharedWorker(deviceID) {
    if (sharedWorker) {
        sharedWorker.port.postMessage({ type: "SAVE_DEVICE_ID", deviceID });
    }
}

async function getFromSharedWorker() {
    return new Promise((resolve) => {
        if (!sharedWorker) {
            resolve(null);
            return;
        }
        sharedWorker.port.onmessage = function (event) {
            resolve(event.data.deviceID || null);
        };
        sharedWorker.port.postMessage({ type: "GET_DEVICE_ID" });
    });
}

/*==========================================*/
/* Store Device ID in Multiple Locations */
/*==========================================*/
function storeDeviceID(deviceID) {
    localStorage.setItem("deviceID", deviceID); // Store in localStorage
    setCookie("deviceID", deviceID, 30); // Store in cookie (expires in 30 minutes)
    saveToIndexedDB(deviceID);
    saveToWindowName(deviceID); // Store in Window.name
    saveToCache(deviceID); // Store in Cache API
    saveToSessionStorage(deviceID);
}

/*================================*/
/* Get or Create the Device ID  */
/*================================*/
async function getDeviceID() {
    return new Promise(async function (resolve) {
        // Check localStorage or cookie first
        let deviceID = localStorage.getItem("deviceID") ||
            getCookie("deviceID") || getFromWindowName() ||
            await getFromCache() ||
            getFromSessionStorage();

        if (deviceID) {
            console.log("Device ID found in localStorage or cookie or CacheID:", deviceID);
            resolve(deviceID);
            return;
        }

        // Try retrieving from SharedWorker first
        const sharedID = await getFromSharedWorker();
        if (sharedID) {
            console.log("Device ID found in sharedWorker:", sharedID);
            storeDeviceID(sharedID);
            resolve(sharedID);
            return;
        }

        // Try retrieving from IndexedDB if nothing is returned yet
        getFromIndexedDB((indexedDBID) => {
            if (indexedDBID) {
                console.log("Using IndexedDB Device ID:", indexedDBID);
                storeDeviceID(indexedDBID);
                saveToServiceWorker(indexedDBID);
                saveToSharedWorker(indexedDBID);
                resolve(indexedDBID);
            } else {
                // Generate a new device ID if not found anywhere
                let newID = generateDeviceID();
                console.log("Generated New Device ID:", newID);
                storeDeviceID(newID);
                saveToServiceWorker(newID);
                saveToSharedWorker(newID);
                resolve(newID);
            }
        });
    });
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
