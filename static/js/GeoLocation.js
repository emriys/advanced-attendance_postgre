window.onload = function () {
    getUserPermission();
}
let latitude = null;
let longitude = null;
let permitted = false;

async function getUserPermission() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                permitted = true;
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
                accuracy = position.coords.accuracy;
                // console.log(`Permitted: ${permitted}`);
            },
            (error) => {
                console.error("Error getting location:", error.message);
            },
            {
                enableHighAccuracy: true, // Improves accuracy using GPS & Wi-Fi
                timeout: 10000, // Max time to wait (10 seconds)
                maximumAge: 0, // No cached position
            }
        );
    }
}

async function getUserLocation() {
    return new Promise(async function (resolve) {
        if (permitted === true) {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        latitude = position.coords.latitude;
                        longitude = position.coords.longitude;
                        accuracy = position.coords.accuracy;
                        resolve();
                        // console.log(`Latitude: ${latitude}, Longitude: ${longitude}, Accuracy: ${accuracy}`);
                    },
                    (error) => {
                        console.error("Error getting location:", error.message);
                    },
                    {
                        enableHighAccuracy: true, // Improves accuracy using GPS & Wi-Fi
                        timeout: 10000, // Max time to wait (10 seconds)
                        maximumAge: 0, // No cached position
                    }
                );
            } else {
                console.error("Geolocation is not supported by this browser.");
                alert("Geolocation is not supported by this browser. Please use a different browser.");
            }
        } else {
            console.error("Location permission declined");
            alert("Location access is required for logging");
        }
    });
}

async function getLocation(event) {
    event.preventDefault();
    await getUserLocation();
    const formData = new FormData;
    formData.append('lat', latitude);
    formData.append('long', longitude);

    fetch("/location", {
        method: 'POST',
        body: formData
    })
        .then((response) => {
            if (response.ok) {
                return response.json();
            } throw new Error('Server Error');
        })
        .then((data) => {
            msgArea(data.message);
        })
        .catch((error) => {
            msgArea('Failed to send location:', error);
        });
}