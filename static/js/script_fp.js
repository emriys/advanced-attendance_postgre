window.onload = function() {
    document.querySelectorAll('input').forEach(input => input.value = "");
};
document.addEventListener("DOMContentLoaded", () => {
    // Get the form and its elements
    const form = document.querySelector(".form");

    form.addEventListener('submit', async(event) => {
        event.preventDefault();

        const formData = new FormData(form);

        if (form.id == "signin") {
            let latitude = null;
            let longitude = null;
            let accuracy = null;
            let fingerprint = null;
            let watchId;

            // Generate or retrieve a unique Device ID
            async function getOrSetDeviceId() {
                try {
                    // Check if ID already logged  for the day in device localStorage
                    const storedDeviceId = localStorage.getItem("device_id") || getCookie("device_id");
                    if (storedDeviceId) {
                        console.log("Stored ID:", storedDeviceId);
                        return storedDeviceId;  // Return stored device ID if already exists
                    }

                    // Wait for the FingerprintJS library to load
                    const fp = await fpPromise;
            
                    // Generate the fingerprint and get the result
                    const result = await fp.get();
            
                    // The visitor identifier is available here
                    const visitorId = result.visitorId || crypto.randomUUID();;
                    console.log("Visitor ID:", visitorId);

                    // Store in localStorage
                    localStorage.setItem("device_id", visitorId); 
            
                    // Set the device ID in a cookie for persistence in seconds
                    document.cookie = `device_id=${visitorId}; path=/; max-age=${1 * 24 * 60 * 60}; Secure`;
            
                    return visitorId; // Return the visitorId for further use if needed
                } catch (error) {
                    console.error("Failed to generate fingerprint:", error);
                    throw error;
                }
            }

            // Function to get a cookie's value by name
            function getCookie(name) {
                const nameEQ = name + "=";
                const ca = document.cookie.split(';');
                for (let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
                }
                return null;
            }

            // WATCH LOCATION
            function startRealTimeLocationTracking() {
                return new Promise((resolve, reject) => {
                    if (navigator.geolocation) {
                        watchId = navigator.geolocation.watchPosition(
                            (position) => {
                                latitude = position.coords.latitude;
                                longitude = position.coords.longitude;
                
                                console.log("Real-time location:", { latitude, longitude });
                                console.log("Accuracy (meters):", position.coords.accuracy);
                
                                // Optionally, send location to the server in real-time
                                // updateLocationOnServer(latitude, longitude);
                                resolve(true);
                            },
                            (error) => {
                                console.error("Error tracking location:", error.message);
                                alert("Location tracking is required for this functionality.");
                                reject(false);
                            },
                            {
                                enableHighAccuracy: true,  // Request high accuracy if available
                                maximumAge: 0,            // Prevent caching of location and cached location usage
                                timeout: 15000            // Wait up to 15 seconds for location
                            }
                        );
                    } else {
                        alert("Geolocation is not supported by your browser.");
                        reject(false);
                    }
                });
            }

            function stopRealTimeLocationTracking() {
                if (watchId) {
                    navigator.geolocation.clearWatch(watchId);
                    console.log("Stopped real-time location tracking.");
                }
            }

            // Optionally, send the updated location to the server
            async function updateLocationOnServer(fingerprint, latitude, longitude) {
                if (!fingerprint || latitude === null || longitude === null) {
                        alert("Failed to collect required information. Ensure location access is granted.");
                        return false;
                }
                try {
                    const response = await fetch('/validate-device', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({fingerprint, latitude, longitude}),
                    });
                    const data = await response.json();
                    if (data.success) {
                        console.log("Updated location on the server.");
                        return true;
                    } else {
                        console.error("Failed to update location on the server.");
                        errorMsg(data.message || "Validation Failed");
                        return false;
                    }
                } catch (error) {
                    console.error("Error sending location to the server:", error);
                    return false;
                }
            }

            // Execute the sequence: Device ID -> Location -> Validation
            fingerprint = await getOrSetDeviceId();
            try {
                const locationCollected = await startRealTimeLocationTracking();
                if (locationCollected) {
                    const isValidated = await updateLocationOnServer(fingerprint, latitude, longitude);
                    if (!isValidated) {
                        stopRealTimeLocationTracking();
                        return;   
                    } else{
                        formData.append("deviceId", fingerprint);
                    }
                } else {
                    alert("Failed to collect location. Please try again.")
                    stopRealTimeLocationTracking();
                    return;
                }

            } catch(error){
                console.error("Error collecting or validating data: ", error);
                return;
            }            
        }

        // Proceed with form submission
        try {
            console.log("Trying");
            stopRealTimeLocationTracking();
            const response = await fetch(form.action, {
            method: 'POST',
            body: formData
            });
            // Check content type to handle different responses
            const contentType = response.headers.get("Content-Type");
            if (contentType.includes("text/html")) {
                // For HTML responses, load the new page
                const html = await response.text().then((html) => {
                    document.open();
                    document.write(html);
                    document.close();
                });
            } else if (contentType.includes("application/json")) {
                // For JSON responses, handle as usual
                return response.json().then((data) => {
                    if (response.ok && data.success) {
                        if (data.redirect){
                            successMsg(data.message || "Success!");
                            setTimeout(()=> {
                                window.location.href = data.redirect;
                            }, 3000);
                        } else {
                            successMsg(data.message || "Success!");
                        }
                    }else {
                        errorMsg(data.message || "An error occured");
                    }
                });
            }
        } catch(error) {
            errorMsg("Failed to process your request. Please try again");
            console.error("Error: ", error);
        }

    });

    function errorMsg(message) {
        const msgArea = document.querySelector(".msg-area");
        msgArea.innerHTML = message;
        msgArea.classList.add("error-shown");

        // Hide message after a delay
        setTimeout(() => {
            msgArea.innerHTML = "";
            msgArea.classList.remove("error-shown");
        }, 2000);
    }

    function successMsg(message) {
        const msgArea = document.querySelector(".msg-area");
        msgArea.innerHTML = message;
        msgArea.classList.add("success-shown");

        // Hide message after a delay
        setTimeout(() => {
            msgArea.innerHTML = "";
            msgArea.classList.remove("success-shown");
        }, 2000);
    }
    // stopRealTimeLocationTracking();
});