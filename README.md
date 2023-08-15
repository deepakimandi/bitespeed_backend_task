# Identity Reconciliation

A web service designed to facilitate contact identification, connecting related contacts and associating them based on email or phone number.

## Technology Stack

- Database: MySQL
- Backend Framework: Node.js with Express.js

## Local Setup

Follow these steps to set up the project locally:

1. **Clone the Repository:** Clone this repository to your local machine and navigate to the root directory.

    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2. **Environment Variables:** Update the environment variables to match your local settings.

3. **Database Setup:** Create the required database table using the `create-table.sql` file provided.

4. **Install Dependencies:** Install the necessary Node.js packages using the following command:

    ```bash
    npm install
    ```

5. **Start the Server:** Launch the server with the following command:

    ```bash
    npm start
    ```

    The service will be accessible through the endpoint `/identify`.

## Deployment

The service has been successfully deployed online using Render.com. Here are the details:

- **Base URL:** [https://identity-reconciliation-qgbk.onrender.com](https://identity-reconciliation-qgbk.onrender.com)
- **API Endpoint:** `/identify`

Feel free to explore and use the service via this URL.

