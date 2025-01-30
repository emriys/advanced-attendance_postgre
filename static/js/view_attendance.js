// Call functions on page load
window.onload = function() {
    document.getElementById('dateInput').innerHTML = "";
    document.getElementById('endDateInput').innerHTML = "";
    document.querySelectorAll('input').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
document.addEventListener("DOMContentLoaded", () => {
    const checkButton = document.getElementById('check-button');
    const downloadButton = document.getElementById('download-button');
    const formatDropdown = document.getElementById("formatDropdown");
    const dateInput = document.getElementById('dateInput');
    const endDateInput = document.getElementById('endDateInput');
    const tableBody = document.querySelector('.table tbody');
    const overlay = document.getElementById("overlay");
    const spinner = document.getElementById("loadingSpinner");
    const messagePopup = document.getElementById("messagePopup");

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

    // Function to fetch attendance logs
    const fetchAttendanceLogs = (start_date,end_date) => {
        message = "Loading..."
        showSpinner("Loading Table...");
        // Construct the fetch URL
        const url = start_date && end_date ? `/admin/attendance_logs?start_date=${start_date}&end_date=${end_date}` : `/admin/attendance_logs`;

        // Fetch attendance logs from the server
        fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(response => {
                if (response.ok) {
                    //console.log(response);
                    return response.json();
                }
                throw new Error("Failed to fetch attendance logs: Server returned an unexpected response.");
                //return response.json();
            })
            .then(data => {
                // Clear the existing table rows
                tableBody.innerHTML = "";
                //console.log(data);

                // Populate the table with the fetched data
                if (data.length > 0) {
                    data.forEach((log, index) => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                        <td>${index + 1}</td> <!-- Serial Number -->
                        <td>${log.first_name}</td>
                        <td>${log.middle_name}</td>
                        <td>${log.last_name}</td>
                        <td>${log.state_code}</td>
                        <td>${log.meeting_date}</td>
                    `;
                        tableBody.appendChild(row);
                    });
                } else {
                    // Add a row indicating no records found
                    const row = document.createElement('tr');
                    row.innerHTML = ` <td colspan="6" class="text-center">${data.message}</td>`;
                    //`<td colspan="6" class="text-center">No attendance records found for this date.</td>`;

                    tableBody.appendChild(row);
                }
            })
            .catch(error => {
                //console.error(error);
                alert("An error occurred while fetching the attendance logs. Please try again.");
            })
            .finally(() => {
                // Hide spinner after the fetch is complete
                hideSpinner();
            });
    };

    // Add event listener to "Check" button for querying specific dates
    checkButton.addEventListener('click', () => {

        const start_date = dateInput.value;
        const end_date = endDateInput.value;
        if (!start_date || !end_date) {
            alert("Please select a date range before checking.");
        }
        else {
            // Fetch today's attendance logs on page load
            fetchAttendanceLogs(start_date,end_date);
        }
    });

    // Handle download button click
    downloadButton.addEventListener("click", () => {
        const selectedFormat = formatDropdown.value; // Get selected format
        const start_date = dateInput.value; // Get selected date
        const end_date = endDateInput.value;
        if (selectedFormat && start_date && end_date) {
            const url = `/export_attendance?format=${selectedFormat}&start_date=${start_date}&end_date=${end_date}`;
            showSpinner("Getting file...");
            // Fetch attendance logs from the server
            fetch(url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Failed to fetch attendance file: Server returned an unexpected response.");
                    }
                    return response.blob();
                })
                .then(blob => {
                    // Create a download link and trigger it
                    const link = document.createElement('a');
                    const fileURL = window.URL.createObjectURL(blob);
                    link.href = fileURL;
                    if (start_date == end_date) {
                        link.download = `NIESAT_attendance_${start_date}.${selectedFormat}`;
                    }else {
                        link.download = `NIESAT_attendance_${start_date}_to_${end_date}.${selectedFormat}`;
                    }
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                })
                .catch(error => {
                    //console.error(error);
                    alert("An error occurred while fetching attendance file. Please try again.");
                })
                .finally(() => {
                    // Hide spinner after the fetch is complete
                    hideSpinner();
                });
        } else {
            alert("Please select a format and date before downloading.");
        }
    });
});

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

// Get today's date in 'YYYY-MM-DD' format
const today = new Date();
const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD

// Set the max attribute of the start and end date inputs
document.getElementById('dateInput').setAttribute('max', formattedDate);
document.getElementById('endDateInput').setAttribute('max', formattedDate);
