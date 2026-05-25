# Gains Planner

A dynamic, local-first workout management application built with **React**, **Vite**, and **Express**. 

Gains Planner is designed to give you total control over your training methodology. It acts as a comprehensive dashboard to manage your weekly workout splits, archive historical training blocks, maintain a personal exercise library complete with execution notes and YouTube references, and store a repository of general training wisdom.

## Features

- **Weekly Split Planning:** Map out your workout days, assign specific muscle groups, and select your preferred exercises for the block. Drag and drop to reorder routines.
- **Workout History:** Save "snapshots" of your current weekly plan to your history before moving on to a new mesocycle. You can always view or instantly restore past plans.
- **Dynamic Exercise Library:** A fully editable database of exercises categorized by movement patterns (e.g., Horizontal Pull, Quad Focus, Side Glutes). Attach YouTube video links and detailed form/execution notes to every movement.
- **Wisdom Repository:** An integrated Markdown reader for your personal training notes. Create new notes instantly—the app automatically generates the `.md` files for you.
- **Local-First Storage:** All of your data (library, history, splits, and markdown notes) is saved locally in the `/storage` directory as clean JSON and Markdown files, making it completely private and easy to version control.

---

## Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
Clone the repository and install the dependencies:

```bash
git clone <your-repo-url>
cd gains-planner
npm install
```

### Running the App

Because the app utilizes a lightweight backend server to read/write your local JSON and Markdown files, you must run both the Vite frontend and the Node.js backend simultaneously. We've set up a command to do this automatically:

```bash
npm run dev:full
```

This will concurrently launch:
1. The **Node.js API server** on `http://localhost:3001`
2. The **Vite Frontend** (usually on `http://localhost:5173`)

Once the terminal confirms both are running, open your browser to the Vite local URL to start planning your gains!

---

## Data Architecture

All application state is housed in the `storage/` directory:
- **`storage/data.json`**: The unified database. This holds your current weekly plan, your full exercise library, and your historical session snapshots.
- **`storage/notes/`**: The folder containing all of your "Wisdom" markdown files. Adding a new entry through the UI will create a `.md` file here.
