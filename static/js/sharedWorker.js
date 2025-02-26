let deviceID = null; // Shared across all connected tabs
const connections = [];

self.onconnect = function (event) {
    const port = event.ports[0];

    port.onmessage = function (e) {
        const { type, value } = e.data;
        // console.log("SharedWorker received:", e.data);
        connections.forEach(conn => conn.postMessage('SharedWorker says: ' + e.data));
            
        if (type === "GET_DEVICE_ID") {
            port.postMessage({ deviceID });
            // console.log("DeviceID found:", deviceID);
        } 
        else if (type === "SET_DEVICE_ID") {
            deviceID = value;
            port.postMessage({ status: "Device ID Stored" });
            // console.log("DeviceID stored:", deviceID);
        }
    };
    port.start();

    // Send the existing device ID to the new tab
    if (deviceID) {
        port.postMessage({ deviceID });
        // console.log("DeviceID found:", deviceID);
    }
};
