function greeting() {
    let element = document.getElementById("greet");
    let date = new Date();
    let hour = date.getHours();
    let message = "";

    if (hour >= 6 && hour < 11) {
        message = "Good morning! 👋";
    } else if (hour >= 11 && hour < 13) {
        message = "Good day! 👨‍💻";
    } else if (hour >= 13 && hour < 18) {
        message = "Good afternoon! 🍵";
    } else {
        message = "Good evening! 🌃";
    }

    element.textContent = message;
}

greeting();