window.onload = function() {
    document.querySelectorAll('input').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
document.addEventListener("DOMContentLoaded", () => {
    const socket = io(
    {
        transports: ["websocket"] // Force WebSockets instead of polling
    });
    //const socket = io(); // Connect to WebSocket server
    // WebSockets to reload table in realtime
    socket.on("connect", () => {
        //console.log("Connected to WebSocket for Admin Dashboard.");
        socket.emit('update_latelog')
    });
    socket.on("late_log_update", (data) => {
        //console.log("Received attendance update:", data);
        reloadTable(data);
    });
    
    // Get the form and its elements
    const form = document.querySelector(".form");
    const stateCodeInput = document.getElementById('stateCodeInput');
    const updateButton = document.getElementById("update");
    const checkButton = document.getElementById('check-button');
    const amountInput = document.getElementById('amount-id');
    const newStatusInput = document.getElementById('status');
    const msgArea = document.querySelector(".msg-area");
    const tableBody = document.querySelector('.table tbody');

    // Add an event listener for the form submission
    form.addEventListener("submit", (event) => {
        event.preventDefault(); // Prevent default form submission behavior

        // If amount field not filled, return prompt
        if (!amountInput.value) {
            message = "Please run CHECK first.";
            errorMsg(message);
            newStatusInput.value = "";
            return
        }

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
                    //stateCodeInput.value = ""
                    amountInput.value = "";
                    newStatusInput.value = "";
                    //reloadTable(); // Refresh Requests Table
                }

                /*else if (!data.success) {
                    message = data.message;
                    errorMsg(message);
                    amountInput.value = "";
                    newStatusInput.value = "";
                    console.log("Fail:", data);
                }*/

                /*else {
                    message = data.message;
                    pendingMsg(message);
                }*/
            })
            .catch((error) => {
                // Display any fetch errors
                //console.error("Error:", error.message);
                alert("Error: Failed to fetch from server.")
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

        if(!stateCode) {
            return errorMsg("Please enter a statecode");
        }

        // Send a request to the server to fetch the amount based on the state code
        fetch(`/get_details?stateCode=${stateCode}`)
            .then((response) => {
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
                    //console.log("Success:", data);
                    amountInput.value = parseFloat(data.message);
                }
                else {
                    message = data.message;
                    errorMsg(message);
                }

            })
            .catch((error) => {
                // Show an error message in the UI
                alert("Error: Failed to fetch from server.")
            });
    });//, { once: true }); // Ensure the click event fires only once

    // Function to fetch attendance logs
    const reloadTable = (data) => {
        //console.log("Updating table with new data:", data); // Debugging
        // Refresh Requests Table after a delay to allow server to process data.
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
            `;
                tableBody.appendChild(row);
            });
        } else {
            // Add a row indicating no records found
            const row = document.createElement('tr');
            row.innerHTML = `
            <td colspan="6" class="text-center">No late sign-in requests found for
                                    today.</td>
        `;
            tableBody.appendChild(row);
        }
    };
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
