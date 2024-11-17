const axios = require("axios");

module.exports = async function(event, context) {
    try {
        // Extract question from the incoming request body
        const { question } = JSON.parse(event.body);

        if (!question) {
            // Handle case where the question is missing
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Error: No question provided" }),
            };
        }

        console.log("Received question:", question); // Log the received question

        let contextData = null;

        // Step 1: Try fetching context from Wikipedia
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&format=json`;
            console.log("Searching Wikipedia with URL:", searchUrl); // Log the URL
            const searchResponse = await axios.get(searchUrl);

            const searchResults = searchResponse.data.query.search;

            if (searchResults && searchResults.length > 0) {
                const pageTitle = searchResults[0].title.replace(" ", "_"); // Use the first search result
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
                console.log("Fetching summary from:", summaryUrl); // Log the summary URL
                const summaryResponse = await axios.get(summaryUrl);
                contextData = summaryResponse.data.extract || "No summary available.";
                console.log("Wikipedia context:", contextData); // Log the fetched context
            } else {
                console.log("No relevant Wikipedia page found.");
            }
        } catch (wikipediaError) {
            console.error("Wikipedia API error:", wikipediaError.message);
            contextData = "No context found from Wikipedia.";
        }

        // Step 2: If no context from Wikipedia, or the context is not sufficient, use the question directly.
        if (!contextData) {
            console.log("Using question directly for Gemini API.");
            contextData = `Question: ${question}`;
        }

        // Step 3: Generate answer using Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`;
        
        if (!process.env.REACT_APP_GEMINI_API_KEY) {
            // Handle case where the Gemini API key is missing
            console.error("Error: Gemini API key is not set in environment variables.");
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Error: Gemini API key is missing" }),
            };
        }

        const data = {
            contents: [
                {
                    parts: [
                        { 
                            text: `Answer the question about crop diseases. If you don't know, give a general answer. Question: ${question}. Context: ${contextData}`
                        },
                    ],
                },
            ],
        };

        console.log("Sending request to Gemini API with data:", JSON.stringify(data, null, 2)); // Log the request payload
        const geminiResponse = await axios.post(geminiUrl, data, {
            headers: { "Content-Type": "application/json" },
        });

        if (!geminiResponse.data || !geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
            // Handle case where Gemini API response is invalid or missing data
            console.error("Error: Invalid response from Gemini API", geminiResponse.data);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Error: Invalid response from Gemini API" }),
            };
        }

        console.log("Gemini API response:", geminiResponse.data); // Log the response

        const answer = geminiResponse.data.candidates[0].content.parts[0].text;

        // Return the response to Vercel
        return {
            statusCode: 200,
            body: JSON.stringify({ answer }),
        };

    } catch (error) {
        console.error("Error occurred:", error.message || error); // Log detailed error
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error occurred, check logs for more details" }),
        };
    }
};
