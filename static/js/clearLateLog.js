window.onload = function() {
    document.querySelectorAll('input').forEach(input => input.value = "");
    document.querySelectorAll('select').forEach(input => input.value = "");
};
// JavaScript to toggle input visibility
function toggleStateCodeInput() {
    const statecode = document.getElementById('statecodeInput');
    const select = document.getElementById('statecodeSelect');
    const inputDiv = document.getElementById('statecodeInputDiv');
    const btn = document.getElementById('submit');

    if (select.value === 'specific') {
        submit.style.display = 'block';
        inputDiv.style.display = 'block'; // Show input field for specific state codes
    }
    else if (select.value == "All") {
        submit.style.display = 'block';
        inputDiv.style.display = 'none';
        statecode.value = "";
    }
    else {
        submit.style.display = 'none';
        inputDiv.style.display = 'none'; // Hide input field
    }
}

function handleData(event) {
    event.preventDefault();
    const statecodeSelect = document.getElementById('statecodeSelect').value;
    //console.log(statecodeSelect);
    const statecode = document.getElementById('statecodeInput').value;
    const form = document.getElementById("lateLogForm");
    //console.log(statecode);

    const url = statecodeSelect === "All"
        ? '/admin/clear_latelogs?statecode=All'
        : `/admin/clear_latelog?statecode=${statecode}`;

    const formData = new FormData();
    if (statecodeSelect === "All") {
        formData.append('statecode', "All");  // For "All", append "All" as statecode
        //console.log("All selected");
    } else if (statecodeSelect === "specific") {
        formData.append('statecode', statecode);  // For specific, append the user-provided statecode
        //console.log("Specific state code entered");
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
            msgArea("Failed to clear records!");
        });
}

function msgArea(message) {
    const msgArea = document.getElementById('msgArea');
    msgArea.innerHTML = message;
    setTimeout(() => {
        msgArea.innerHTML = "";
    }, 2000);
}