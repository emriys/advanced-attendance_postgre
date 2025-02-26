window.onload = function () {
    document.querySelectorAll('input').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
document.addEventListener("DOMContentLoaded", () => {
    // const socket = io(
    // // const socket = io('https://areyoupresent.vercel.app',
    // {
    //     transports: ["websocket"] // Force WebSockets instead of polling
    // });
    // //const socket = io(); // Connect to WebSocket server
    // // WebSockets to reload table in realtime
    // socket.on("connect", () => {
    //     //console.log("Connected to WebSocket for Admin Dashboard.");
    //     socket.emit('update_latelog')
    // });
    // socket.on("late_log_update", (data) => {
    //     //console.log("Received attendance update:", data);
    //     reloadTable(data);
    // });

    // Get the form and its elements
    const form = document.querySelector(".form");
    const stateCodeInput = document.getElementById('stateCodeInput');
    const updateButton = document.getElementById("update");
    const checkButton = document.getElementById('check-button');
    const amountInput = document.getElementById('amount-id');
    const newStatusInput = document.getElementById('status');
    const msgArea = document.querySelector(".msg-area");
    const tableBody = document.querySelector('.table tbody');
    let retryCount = 0; // Initialize retry counter
    const maxRetries = 5; // Maximum number of retries

    // Add an event listener for the form submission
    form.addEventListener("submit", (event) => {
        event.preventDefault(); // Prevent default form submission behavior

        const button = form.querySelector(".update");
        const spinner = form.querySelector(".updatespn");

        // If amount field not filled, return prompt
        if (!amountInput.value) {
            message = "Please run CHECK first.";
            errorMsg(message);
            newStatusInput.value = "";
            return
        }

        spinner.classList.remove("hide");
        button.disabled = true;

        // Clear any previous messages
        msgArea.innerHTML = "";
        msgArea.classList.remove("error-shown");

        // Get the form data
        const formData = new FormData(form);

        // Send the form data to the server via fetch
        fetch(form.action, {
            method: "POST",
            body: formData,
        })
            .then((response) => {
                return response.json().then((data) => {
                    if (!response.ok) {
                        // Display error messages if the response is not ok
                        message = data.message;
                        errorMsg(message);
                        amountInput.value = "";
                        newStatusInput.value = "";
                        spinner.classList.add("hide");
                        button.disabled = false;
                        //reloadTable(); // Refresh Requests Table
                    }
                    return data; // Allow successful responses to go through
                });
            })
            .then((data) => {
                // On success, let the form submit (if there's further processing needed)
                if (data.success) {
                    message = data.message;
                    successMsg(message);
                    amountInput.value = "";
                    newStatusInput.value = "";
                    spinner.classList.add("hide");
                    button.disabled = false;
                    //reloadTable(); // Refresh Requests Table
                }
            })
            .catch((error) => {
                // Display any fetch errors
                alert("Error: Failed to fetch from server.");
                spinner.classList.add("hide");
                button.disabled = false;
            });
    });

    // Add click event listener to the Update button
    updateButton.addEventListener("click", () => {
        form.requestSubmit(); // Submit the form programmatically when the Update button is clicked

    }, { once: true }); // Ensure the click event fires only once

    // Add event listener to "Check" button
    checkButton.addEventListener('click', () => {
        // Get the statecode value
        const stateCode = stateCodeInput.value;

        const button = form.querySelector(".btn-primary");
        const spinner = form.querySelector(".btnspinner");

        if (!stateCode) {
            return errorMsg("Please enter a statecode");
        }

        spinner.classList.remove("hide");
        button.disabled = true;

        // Send a request to the server to fetch the amount based on the state code
        fetch(`/get_details?stateCode=${stateCode}`)
            .then(async (response) => {
                return response.json().then((data) => {
                    if (!response.ok) {
                        // Display error messages if the response is not ok
                        message = data.message;
                        errorMsg(message);
                        amountInput.value = "";
                    }
                    return data; // Allow successful responses to go through
                });
            })
            .then((data) => {
                if (data.success) {
                    // On success, update field with received value
                    amountInput.value = parseFloat(data.message);
                }
                else {
                    message = data.message;
                    errorMsg(message);
                }
                spinner.classList.add("hide");
                button.disabled = false;
            })
            .catch((error) => {
                // Show an error message in the UI
                spinner.classList.add("hide");
                button.disabled = false;
                alert("Error: Failed to fetch from server.");
            });
    });//, { once: true }); // Ensure the click event fires only once

    // Function to fetch attendance logs
    const reloadTable = () => {
        // Refresh Requests Table after a delay to allow server to process data.
        setTimeout(() => {
            //console.log("Refreshing the Requests Table....");
            // Construct the fetch URL
            const url = dashUrl;

            // Fetch attendance logs from the server
            fetch(url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error("Failed to fetch requests: Server returned an unexpected response.");
                })
                .then(data => {
                    // Clear the existing table rows
                    tableBody.innerHTML = "";

                    // Populate the table with the fetched data
                    if (data.length > 0) {
                        data.forEach((log, index) => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                            <td>${index + 1}</td> <!-- Serial Number -->
                            <td>${log.transaction_date}</td>
                            <td>${log.state_code}</td>
                            <td>${log.request_type}</td>
                            <td>${log.amount}</td>
                            <td>${log.status}</td>
                            <td>${log.log_time}</td>
                        `;
                            tableBody.appendChild(row);
                        });
                    } else {
                        // Add a row indicating no records found
                        const row = document.createElement('tr');
                        row.innerHTML = `
                        <td colspan="7" class="text-center">No late sign-in requests found for
                                                today.</td>
                    `;
                        tableBody.appendChild(row);
                    }
                    retryCount = 0; //Reset retry counter
                })
                .catch(error => {
                    //console.error(error);
                    alert("Server Not Responding. Please try again.");
                    retryCount++; // Increment retry counter
                    return
                });
        }, 5000);

    };

    async function fetchData() {
        if (retryCount >= maxRetries) {
            console.warn("Max retries reached. Stopping further attempts.");
            return; // Stop trying if max retries is reached
        }
        reloadTable();
        setTimeout(fetchData, 30000); // Call itself after a delay
    };  // Check every 30 seconds
    fetchData();

});

// Feedback Prompts
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

function pendingMsg(message) {
    const msgArea = document.querySelector(".msg-area");
    msgArea.innerHTML = message;
    msgArea.classList.add("pending-shown");

    // Hide message after a delay
    setTimeout(() => {
        msgArea.innerHTML = "";
        msgArea.classList.remove("pending-shown");
    }, 2000);
}

// Side bar config
function openNav() {
    document.getElementById("mySidebar").style.width = "230px";
}

// Set the width of the side navigation to 0 and the left margin of the page content to 0
function closeNav() {
    document.getElementById("mySidebar").style.width = "0";
    //document.getElementById("main").style.marginLeft = "0";
    document.querySelector('#body').addEventListener('click', closeNav);
}
