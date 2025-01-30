window.onload = function() {
    document.querySelectorAll('input:not([type="submit"])').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
document.addEventListener("DOMContentLoaded", () => {
    // Get the form and its elements
    const form = document.querySelector(".form");

    form.addEventListener('submit', async(event) => {
        event.preventDefault();

        const formData = new FormData(form);

        // Proceed with form submission
        try {
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
            errorMsg("Failed to process your request. Please try again.", error);
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
});
