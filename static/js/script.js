window.onload = function() {
    document.querySelectorAll('input:not([type="submit"])').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
document.addEventListener("DOMContentLoaded", () => {
    // Get the form and its elements
    const form = document.querySelector(".form");
    const button = document.getElementById("button");

    form.addEventListener('submit', async(event) => {
        event.preventDefault();

        spinner.classList.remove("hide");
        button.disabled = true;

        const formData = new FormData(form);

        // if (form.id == "signin") {
        //     let latitude = null;
        //     let longitude = null;
        //     let accuracy = null;
        //     let final_fingerprint = null;
        //     let final_Ip = null;

        //     // Complete function call before moving on
        //     const getDetails = await sendFingerprintToServer();
        //     if (getDetails){
        //         console.log("Moving On!!");
        //         formData.append("deviceId", final_fingerprint);
        //         formData.append("Ip", final_Ip);
        //     } else {
        //         return errorMsg("Device validation Failed!");
        //     }
            
        // }

        

        //---------- Proceed with form submission ----------//
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
                    spinner.classList.add("hide");
                    button.disabled = false;
                });
            } else if (contentType.includes("application/json")) {
                // For JSON responses, handle as usual
                return response.json().then((data) => {
                    if (response.ok && data.success) {
                        if (data.redirect){
                            successMsg(data.message || "Success!");
                            setTimeout(()=> {
                                spinner.classList.add("hide");
                                button.disabled = false;
                                window.location.href = data.redirect;
                            }, 3000);
                        } else {
                            successMsg(data.message || "Success!");
                            spinner.classList.add("hide");
                            button.disabled = false;
                        }
                    }else {
                        errorMsg(data.message || "An error occured");
                        spinner.classList.add("hide");
                        button.disabled = false;
                    }
                });
            }
        } catch(error) {
            errorMsg("Failed to process your request. Please try again.", error);
            spinner.classList.add("hide");
            button.disabled = false;
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
