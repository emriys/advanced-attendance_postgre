document.addEventListener("DOMContentLoaded", () => {
    // let statecode = document.getElementById("statecode").value;
    let startDate = document.getElementById("startDate").value;
    let endDate = document.getElementById("endDate").value;
    const tableBody = document.querySelector('.table tbody');
    const overlay = document.getElementById("overlay");
    const spinner = document.getElementById("loadingSpinner");

    // Get the form and its elements
    const form = document.querySelector(".form");

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        showSpinner("Loading history log...");

        // Proceed with form submission
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            // Check content type to handle different responses
            const contentType = response.headers.get("Content-Type") || "";
            if (contentType.includes("application/json")) {
                const data = await response.json();
                if (response.ok) {
                    // Clear the existing table rows
                    tableBody.innerHTML = "";


                    // Iterate through the user record and populate the table with the fetched data
                    if (data.length > 0) {

                        // Extract all unique date keys from the first user entry
                        const dateKeys = Object.keys(data[0]).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
                        if (!dateKeys.length) {
                            hideSpinner();
                            errorMsg("Error Processing Data!")
                            console.error("Error: No valid date keys found!");
                            return;
                        }

                        data.forEach(user => {
                            document.getElementById("user_name").innerHTML = `${user.NAME}`;
                            document.getElementById('user_statecode').innerHTML = `${user.STATE_CODE}`;

                            dateKeys.forEach((date, index) => {
                                let status = user.hasOwnProperty(date) ? user[date] : "Absent";
                                const row = document.createElement('tr');
                                row.innerHTML = `<td>${index + 1}</td><td>${date}</td><td>${status}</td>`;
                                tableBody.appendChild(row);
                            });
                        });
                        successMsg(data.message || "Success!");
                        // Hide spinner after the fetch is complete
                        hideSpinner();
                    } else {
                        // Add a row indicating no records found
                        const row = document.createElement('tr');
                        row.innerHTML = ` <td colspan="3" class="text-center">${data.message}</td>`;
                        //`<td colspan="6" class="text-center">No attendance records found for this date.</td>`;

                        tableBody.appendChild(row);
                        errorMsg(data.message || "Nothing Found!");
                        // Hide spinner after the fetch is complete
                        hideSpinner();
                    }
                } else {
                    hideSpinner();
                    errorMsg(data.message || "An error occured");
                }
                // });

            } else {
                hideSpinner();
                throw new Error("Invalid response format from server.");
            }
        } catch (error) {
            hideSpinner();
            errorMsg("Failed to process your request. Please try again.", error);
            throw error; // Re-throws for better debugging
        }
    })

    // Function to show the spinner
    const showSpinner = (message) => {
        overlay.style.display = "flex";
        spinner.style.display = "block";
        messagePopup.innerText = message;
        messagePopup.style.display = "block";
    };

    // Function to hide the spinner
    const hideSpinner = () => {
        overlay.style.display = "none";
        spinner.style.display = "none";
        messagePopup.innerText = "";
        messagePopup.style.display = "none";
    };


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


    // Get today's date in 'YYYY-MM-DD' format
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD

    // Set the max attribute of the start and end date inputs
    document.getElementById('startDate').setAttribute('max', formattedDate);
    document.getElementById('endDate').setAttribute('max', formattedDate);
});