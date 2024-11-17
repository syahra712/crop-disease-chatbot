require('dotenv').config({ path: '/Users/admin/Desktop/crop-disease-chatbot/.env' }); // Specify the full path to the .env file
// Add this log at the start of your file
console.log("Gemini API Key from Environment:", process.env.REACT_APP_GEMINI_API_KEY);

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 5000; // Port changed to 5001

// Middleware
app.use(bodyParser.json());
app.use(cors());

// API Route
app.post("/chat", async (req, res) => {
    const { question } = req.body;

    console.log("Received question:", question); // Log the received question

    let context = null;

    try {
        // Step 1: Try fetching context from Wikipedia
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&format=json`;
        console.log("Searching Wikipedia with URL:", searchUrl); // Log the URL
        const searchResponse = await axios.get(searchUrl);

        const searchResults = searchResponse.data.query.search;

        if (searchResults && searchResults.length > 0) {
            const pageTitle = searchResults[0].title.replace(" ", "_"); // Use the first search result
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
            console.log("Fetching summary from:", summaryUrl); // Log the summary URL
            const summaryResponse = await axios.get(summaryUrl);
            context = summaryResponse.data.extract || "No summary available.";
            console.log("Wikipedia context:", context); // Log the fetched context
        } else {
            console.log("No relevant Wikipedia page found.");
        }

        // Step 2: If no context from Wikipedia, or the context is not sufficient, use the question directly.
        if (!context) {
            console.log("Using question directly for Gemini API.");
            context = `Question: ${question}`;
        }

        // Step 3: Generate answer using Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`;
        const data = {
            contents: [
                {
                    parts: [
                        { 
                            text: `Answer the question about crop diseases. If you don't know, give a general answer. Question: ${question}. Context: ${context}`
                        },
                    ],
                },
            ],
        };

        console.log("Sending request to Gemini API with data:", JSON.stringify(data, null, 2)); // Log the request payload
        const geminiResponse = await axios.post(geminiUrl, data, {
            headers: { "Content-Type": "application/json" },
        });
        console.log("Gemini API response:", geminiResponse.data); // Log the response

        const answer = geminiResponse.data.candidates[0].content.parts[0].text;
        res.json({ answer });

    } catch (error) {
        console.error("Error occurred:", error.response?.data || error.message); // Log detailed error
        res.json({ answer: "Error: Unable to generate a response." });
    }
});

// Start the server on port 5001
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
