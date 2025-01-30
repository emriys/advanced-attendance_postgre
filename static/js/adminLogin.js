
// Read the overlay and spinner
const overlay = document.getElementById("overlay");
const spinner = document.getElementById("loadingSpinner");
const messagePopup = document.getElementById("messagePopup");

// Function to show the spinner
const showMsg = (message, color) => {
    overlay.style.display = "flex";
    spinner.style.display = "none";
    messagePopup.style.color = color;
    messagePopup.innerText = message;
    messagePopup.style.display = "block";
};

const loadSpinner = () => {
    overlay.style.display = "flex";
    spinner.style.display = "block";
    messagePopup.style.display = "none";
}

// Function to hide the spinner
const hideMsg = () => {
    overlay.style.display = "none";
    spinner.style.display = "none";
    messagePopup.innerText = "";
    messagePopup.style.display = "none";
};

// Function to handle login form submission
async function handleLogin() {
    event.preventDefault(); // Prevent the default form submission

    // Show spinner
    loadSpinner();

    // Get login form data
    const form = document.getElementById("loginForm");
    const formData = new FormData(form);

    try {
        // Send POST request to verify login details
        fetch(form.action, {
            method: "POST",
            body: formData,
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Error: ${response.status}`);
                }
                //console.log("Response status:", response.status);
                return response.json(); // Adjust response handling as needed
            })
            .then((data) => {
                if (data.success) {
                    document.getElementById("username").value = "" // Clear username input field
                    document.getElementById("password").value = "" // Clear password input field
                    // Show success message
                    message = data.message;
                    color = "#4CAF50"; // Green text for succes
                    showMsg(message, color);

                    // Redirect to dashboard after a delay
                    setTimeout(() => {
                        window.location.href = dashboardUrl;
                        hideMsg(); // Hide overlay
                    }, 2000);
                }
                else {
                    // Show error message
                    message = data.message;
                    color = "#ff4d4d"; // Red text for error
                    showMsg(message, color);
                    document.getElementById("password").value = "" // Clear password input field

                    // Hide the overlay after a delay
                    setTimeout(() => {
                        hideMsg();
                    }, 2000);
                }
            });
    }
    catch (error) {
        //console.error("Error logging in:", error);

        // Hide the overlay and show a network error
        spinner.style.display = "none";
        message = "Network error. Please check your connection and try again.";
        color = "#ff4d4d";
        showMsg(message, color);
        document.getElementById("password").value = "" // Clear password input field

        // Hide overlay after showing error message
        setTimeout(() => {
            hideMsg();
        }, 2000);
    }
}
