
async function updatePaymentStatus() {
    var status_show = document.getElementById("status");
    const response = await fetch(inquireUrl);
    const data = await response.json();
    if (data.status === "Approved") {
        status_show.innerHTML = data.status;
        status_show.style.color = "#4CAF50";

        setTimeout(() => {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = nextUrl;

            const params = { statecode: stateCode };
            for (const [key, value] of Object.entries(params)) {
                const hiddenField = document.createElement("input");
                hiddenField.type = "hidden";
                hiddenField.name = key;
                hiddenField.value = value;
                form.appendChild(hiddenField);
            }

            document.body.appendChild(form);
            form.submit();
        }, 3000);
    }
    else {
        status_show.innerHTML = "Pending";
        status_show.style.color = "#FFBF00";
    } setTimeout(updatePaymentStatus, 5000); // Call itself after a delay
}  // Check every 5 seconds
updatePaymentStatus();


// Copying Functions
// Copy to clipboard function
number = document.getElementById('account-number').innerHTML
amount = document.getElementById('amount').innerHTML

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    //console.log(text)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showPopup("Copied ✅");
        }).catch(err => {
            alert("Failed to copy text: ", err)
            //console.error("Failed to copy text: ", err);
        });
    }
    else {
        // TO HANDLE COPYING TO CLIPBOARD INCASE PAGE ISN'T SECURE
        // Create a temporary <textarea> element
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);

        // Select the text in the textarea and execute the copy command
        textarea.select();
        textarea.setSelectionRange(0, text.length); // For mobile compatibility

        try {
            document.execCommand('copy');
            //showPopup("Copied: " + text + " \u2713");
            showPopup("Copied ✅");
        } catch (err) {
            alert('Fallback error copying text: ', err);
            //console.error('Fallback error copying text: ', err);
        }

        // Remove the temporary textarea element
        document.body.removeChild(textarea);
    }
}

function showPopup(message) {
    const popup = document.getElementById("popup-notification");
    popup.textContent = message;
    popup.classList.add("show");

    // Remove the popup after 2 seconds
    setTimeout(() => {
        popup.classList.remove("show");
    }, 2000);
}