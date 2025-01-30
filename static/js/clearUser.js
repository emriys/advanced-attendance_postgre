window.onload = function() {
    document.querySelectorAll('input').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
// JavaScript to toggle input visibility
function toggleDetailsInput() {
    const select = document.getElementById('actionSelect');
    const statecode = document.getElementById('statecodeInput');
    const name = document.getElementById('nameInput');
    const inputDiv = document.getElementById('detailsInputDiv');
    const btn = document.getElementById('submit');

    if (select.value == '') {
        submit.style.display = 'none';
        inputDiv.style.display = 'none'; // Show input field for specific state codes
    } else {
        submit.style.display = 'block';
        inputDiv.style.display = 'block';
    }
}

function handleData(event) {
    event.preventDefault();
    const actionSelect = document.getElementById('actionSelect').value;
    const statecode = document.getElementById('statecodeInput').value;
    const name = document.getElementById('nameInput').value;
    const form = document.getElementById("userForm");

    if (!actionSelect || !statecode || !name) {
        msgArea(message = "Please enter all details!");
        alert("Please enter all details.");
    }

    const formData = new FormData();
    if (actionSelect === "attendance" || "delete") {
        formData.append('action', actionSelect);
        formData.append('statecode', statecode);
        formData.append('last_name', name);
        //console.log("All inputted");
    }

    //console.log(formData);

    fetch(nextUrl, {
        method: "POST",
        body: formData
    })
        .then((response) => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('SERVER ERROR.');
        })
        .then((data) => {
            msgArea(data.message);
        })
        .catch((error) => {
            //console.log('Error:', error);
            msgArea(message = "Failed to clear records!");
            //alert("Failed to clear records!")
        });
}

function msgArea(message) {
    const msgArea = document.getElementById('msgArea');
    msgArea.innerHTML = message;
    setTimeout(() => {
        msgArea.innerHTML = "";
    }, 2000);
}