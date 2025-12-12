# ZenReddit 🌿

ZenReddit is a peaceful, AI-powered Reddit client designed to filter out rage-bait, divisive politics, and high-stress content. It uses the Google Gemini API to analyze posts in real-time, assigning a "Zen Score" to content and shielding you from negativity.

![ZenReddit App](https://via.placeholder.com/800x450?text=ZenReddit+Preview)

## ✨ Features

*   **AI Content Filtering**: Automatically detects and hides "rage bait," toxic arguments, and stress-inducing news using Google Gemini.
*   **Zen Score**: Every post is graded from 0-100 based on how peaceful, constructive, or wholesome it is.
*   **Smart Feed**:
    *   **Popular & Peaceful**: A curated version of r/all.
    *   **Subreddit Search**: Browse specific communities with AI filtering applied.
*   **Zen Mode Customization**: Adjust the strictness of the AI filter (Relaxed, Balanced, Strict).
*   **Privacy Focused**: Your API keys are stored locally in your browser.
*   **Visualizer**: Beautiful scanning animations while the AI processes your feed.

## 🚀 Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js** (v18 or higher)
*   **npm** (Node Package Manager)

You will also need an API Key for the AI analysis:
*   **Recommended**: [Google Gemini API Key](https://aistudio.google.com/app/apikey) (Free tier available).
*   **Optional**: An [OpenRouter Key](https://openrouter.ai/) if you wish to use other models (DeepSeek, Llama, etc.).

## 🛠️ Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/zen-reddit.git
    cd zen-reddit
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory of your project to store your API key safely.

    ```bash
    touch .env
    ```

    Open the `.env` file and add your Google Gemini API key:
    ```env
    # The application expects the key to be available via process.env.API_KEY
    # If using Vite, you might need to adjust the code to use import.meta.env.VITE_API_KEY
    # or configure your bundler to define process.env.API_KEY.
    
    API_KEY=your_actual_api_key_here
    ```

    *Note: If you do not wish to hardcode the API key, the application allows you to manually enter OpenRouter keys in the Settings menu within the UI, but the default Gemini integration requires this environment variable.*

4.  **Run the Application**
    Start the local development server:

    ```bash
    npm start
    # OR if using Vite
    npm run dev
    ```

5.  **Open in Browser**
    Navigate to `http://localhost:3000` (or the port shown in your terminal).

## 📖 Usage Guide

### Navigation
*   **All Popular**: The default view. Shows trending content from Reddit, filtered for positivity.
*   **Home**: Shows content from your followed subreddits.
*   **Sidebar**: Search for subreddits (e.g., "CozyPlaces", "Woodworking") and click the `+` to follow them.

### Adjusting AI Settings
1.  Click the **Settings (Gear Icon)** in the top right corner.
2.  **Filter Strictness**: Use the slider to determine how aggressive the filtering is.
    *   *< 30*: Relaxed (Allows mild controversy).
    *   *50*: Balanced (Standard filtering).
    *   *> 70*: Strict (Wholesome content only).
3.  **AI Provider**: Switch between the built-in Gemini integration or use OpenRouter to bring your own keys/models.

### Video Support
Video posts are automatically detected.
*   **Thumbnails**: Video posts display a "Play" icon overlay on the thumbnail.
*   **Playback**: Click a post to open the Detail View, where the video will be embedded (using Reddit's secure media fallback).

## 🔧 Troubleshooting

*   **"Rate limited by Reddit"**: Reddit has strict API limits for unauthenticated requests. If you refresh too often, wait a minute and try again.
*   **Images/Videos not loading**: The app uses a CORS proxy (`corsproxy.io`) to fetch data from Reddit, as Reddit does not support client-side CORS natively. If the proxy is down, content may fail to load.
*   **AI Analysis Stuck**: If the "Analyzing..." visualizer runs forever, check your browser console (`F12`) for API Key errors.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open-source.
