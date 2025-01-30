window.onload = function () {
    document.querySelectorAll('input').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};

// Fetch the previously set parameters from server and display as placeholder
function fetchData() {

    const url = '/admin/settings'

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
            throw new Error('Failed to fetch current settings: Server Error');
        })
        .then(data => {
            if (data) {

                document.getElementById('late-fee-id').placeholder = data.lateness_fine || "N/A";  //data.balance
                document.getElementById('due-id').placeholder = data.monthly_due || "N/A";
                document.getElementById('acct-num-id').placeholder = data.account_number || "N/A";
                document.getElementById('acct-name-id').placeholder = data.account_name || "N/A";
                document.getElementById('bank-name-id').placeholder = data.bank_name || "N/A";
                document.getElementById('username').placeholder = data.admin_username || "N/A";
                document.getElementById('meeting_day').innerHTML = data.meeting_day || "N/A"
                document.getElementById('allow_attendance').innerHTML = data.allow_attendance || "N/A"
            }
            else {
                alert("NO DATA!!")
                //console.log("NO DATA!!")
            }
        })
        .catch(error => {
            //console.log(error);
            //alert("Failed to get settings data.");
            return
        });
    console.log("Waiting");
    setTimeout(fetchData, 60000); // Call itself after a delay of 60 seconds
    console.log("Called");
};
fetchData();
console.log("External");


// Attach event listeners to all forms with a common class
document.querySelectorAll('.ajax-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent default form submission
        showPopup();

        const confirmSubmit = document.getElementById('confirmBtn');
        confirmSubmit.addEventListener('click', function () {
            hidePopup();

            const formData = new FormData(form); // Get form data
            //const alert = form.getElementById('msg-area');
            const targetDiv = form.querySelector('.msg-area');

            // Fetch the form's action URL and method dynamically
            const actionUrl = form.getAttribute('action');
            const method = form.getAttribute('method') || 'POST';

            fetch(actionUrl, {
                method: method,
                body: formData,
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status}`);
                    }
                    return response.json(); // Adjust response handling as needed
                })
                .then((data) => {
                    //console.log('Success:', data); // Handle success response
                    if (data.success) {
                        if (targetDiv) {
                            targetDiv.innerHTML = data.message;
                            targetDiv.style.color = "#4CAF50"; // Green text for success
                        }

                        // Clear all input fields in the form
                        form.querySelectorAll('input').forEach((input) => {
                            if (input.type !== 'password') {
                                input.value = '';
                            }
                        });
                    }
                    // Clear password fields regardless of the outcome
                    form.querySelectorAll('input[type="password"]').forEach((input) => {
                        input.value = '';
                    });

                    // Hide message after a delay
                    setTimeout(() => {
                        targetDiv.innerHTML = "";
                        fetchData();
                    }, 3000);
                })
                .catch((error) => {
                    //console.error('Error:', error); // Handle errors
                    // Clear password fields in case of error
                    form.querySelectorAll('input[type="password"]').forEach((input) => {
                        input.value = '';
                    });
                    // Show an error message in the UI
                    alert('Submission failed. Please try again.');
                });

        }, { once: true }); // Ensure the click event fires only once


    });
});

// Function to toggle form visibility
function toggleForm(headingElement) {
    // Get the ID of the target form from the data attribute
    const targetFormId = headingElement.getAttribute('data-target');
    const form = document.getElementById(targetFormId);

    // Toggle the hidden class for the form
    //form.classList.toggle('hidden');
    form.classList.toggle('visible');

    // Toggle the shown class for the heading
    headingElement.classList.toggle('shown');
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

// Function to show the popup window
function showPopup() {
    document.getElementById('overlay').style.display = 'block'
    document.getElementById('popupContainer').style.display = 'block';
}

// Function to hide the popup window
function hidePopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('popupContainer').style.display = 'none';
}

// Handle cancellation when the user clicks "Cancel"
document.getElementById('cancelBtn').addEventListener('click', function () {
    // Hide the popup window
    hidePopup();
});
