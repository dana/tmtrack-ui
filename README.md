# tmtrack-ui

A simple, standards-compliant Javascript JQuery application that implements the user interface of a simple time tracking application.

## Features

*   View a list of task days, sorted by most recent.
*   Create new daily task entries.
*   View and edit the details of existing task entries.
*   Save changes back to the REST API.

## Project Structure
tmtrack-ui/
├── css/
│ └── styles.css
├── cypress/
│ └── e2e/
│ └── app_spec.cy.js
├── js/
│ └── app.js
├── .gitignore
├── cypress.config.js
├── index.html
├── LICENSE
├── package.json
└── README.md
code
Code
## Development, Testing, and Deployment on Ubuntu 24

This guide provides detailed steps for setting up, running, and deploying the `tmtrack-ui` project.

### 1. Project Initiation and Setup

These steps will get a new developer started with the project.

**a. Clone the Repository:**

Open a terminal and clone the project from its GitHub repository.

```bash
git clone <your-github-repository-url>
cd tmtrack-ui
b. Local Web Server:
You need to serve the project from a simple local web server. Python provides a straightforward way to do this.
To start the web server, run the following command from the tmtrack-ui directory in its own terminal window:
code
Bash
python3 -m http.server 8000
Now you can access the application by opening a web browser and navigating to http://localhost:8000. This server must be running to perform automated testing.
Cypress Automated Testing
This project uses Cypress for true end-to-end testing against a live backend.
Step 1: Install Dependencies
Cypress is managed through Node.js and npm. First, ensure you have Node.js installed on your system. Then, from the project's root directory, run:
code
Bash
# This will create the node_modules directory and install Cypress
npm install
Step 2: Running Tests
You can run Cypress tests in two modes: interactive (with a browser) or headless (from the command line).
Prerequisites: Before running any tests, you must ensure two services are running in separate terminal windows:
The front-end application server:
code
Bash
python3 -m http.server 8000
The back-end REST API server:
(Instructions for starting your backend server, which must be accessible at http://localhost:5000)
Interactive Mode (for development)
This mode is great for writing and debugging tests. It opens a dedicated browser where you can see the commands execute in real-time.
code
Bash
# Open the Cypress Test Runner
npm run cy:open
# Or use npx directly
npx cypress open
Headless Mode (for CI/automation)
This mode is used for running the full test suite from the command line, as you would in a CI/CD pipeline. It runs the tests without a visible browser window and provides output directly in your terminal.
This is the command-line invocation that will load the web app headless and run all verification tests against the live backend:
code
Bash
# Run all tests in headless mode
npm run cy:run
# Or use npx directly
npx cypress run
Step 3: Test Maintenance
Test Files: All tests are located in the cypress/e2e/ directory. The main test file for this application is app_spec.cy.js.
Live Data: These tests run against a live backend. This means they are dependent on the data in your database. The tests are written to be as resilient as possible (e.g., by selecting the first available user instead of a hardcoded name), but for them to pass, there must be at least one user with at least one task in the database.
Selectors: The tests use IDs and classes to find elements on the page (e.g., cy.get('#userid')). If you change these attributes in index.html, you must update the corresponding selectors in app_spec.cy.js to match.
Simple Production Deployment
For a simple production deployment on an Ubuntu server, we can use a more robust web server like Nginx.
(Deployment instructions continue as before...)

