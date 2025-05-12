# Frontend Documentation for MTG Web Application

## Overview

This is the frontend part of the MTG Web Application, which serves as a user interface for interacting with the Magic: The Gathering card database. The frontend is built using React and communicates with the backend through a REST API.

## Project Structure

The frontend directory contains the following structure:

- **public/**: Contains static files.
  - **index.html**: The main HTML file that serves as the entry point for the web application.

- **src/**: Contains the source code for the React application.
  - **App.js**: The main React component that renders the application.
  - **api.js**: Contains functions for making API calls to the backend.
  - **components/**: Contains React components.
    - **CardList.js**: A component that displays a list of cards fetched from the backend.

- **package.json**: The configuration file for npm, listing dependencies and scripts for the frontend application.

## Getting Started

To get started with the frontend application, follow these steps:

1. **Install Dependencies**: Navigate to the `frontend` directory and run the following command to install the required dependencies:

   ```
   npm install
   ```

2. **Run the Application**: After installing the dependencies, you can start the development server with:

   ```
   npm start
   ```

   This will launch the application in your default web browser at `http://localhost:3000`.

## API Integration

The frontend communicates with the backend using the REST API. The API functions are defined in `src/api.js`, and they handle requests to fetch card data and other related operations.
