"use strict";

const ACCOUNTS_KEY = "studentQueueAccounts";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Admin123";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

function getAccounts() {
    try {
        const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
        return Array.isArray(accounts) ? accounts : [];
    } catch {
        return [];
    }
}

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "message " + type;
}

function showLogin() {
    loginForm.hidden = false;
    registerForm.hidden = true;
    showMessage("");
}

function showRegister() {
    loginForm.hidden = true;
    registerForm.hidden = false;
    showMessage("");
}

document.getElementById("showRegister").addEventListener("click", showRegister);
document.getElementById("showLogin").addEventListener("click", showLogin);

registerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const fullName = document.getElementById("registerFullName").value.trim();
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!fullName || !username || !password || !confirmPassword) {
        return showMessage("Please complete all fields.");
    }

    if (username.length < 3) {
        return showMessage("Username must be at least 3 characters.");
    }

    if (password.length < 6) {
        return showMessage("Password must be at least 6 characters.");
    }

    if (password !== confirmPassword) {
        return showMessage("Passwords do not match.");
    }

    if (username.toLowerCase() === ADMIN_USERNAME) {
        return showMessage("That username is reserved.");
    }

    const accounts = getAccounts();

    if (accounts.some(account =>
        account.username.toLowerCase() === username.toLowerCase()
    )) {
        return showMessage("Username already exists. Choose another.");
    }

    accounts.push({
        fullName,
        username,
        password,
        role: "student"
    });

    try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
        return showMessage("Unable to save your account in this browser.");
    }

    registerForm.reset();
    document.getElementById("loginUsername").value = username;

    showLogin();
    showMessage("Account created! You can now log in.", "success");
});

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (
        username.toLowerCase() === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
    ) {
        startSession("admin", "System Administrator", "admin");
        return;
    }

    const account = getAccounts().find(item =>
        item.username.toLowerCase() === username.toLowerCase() &&
        item.password === password
    );

    if (!account) {
        return showMessage("Incorrect login. Check your details or register first.");
    }

    startSession(account.username, account.fullName, "student");
});

function startSession(username, fullName, role) {
    sessionStorage.setItem("loggedIn", "true");
    sessionStorage.setItem("username", username);
    sessionStorage.setItem("fullName", fullName);
    sessionStorage.setItem("userRole", role);

    window.location.href = "dashboard.html";
}