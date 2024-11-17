const axios = require("axios");

exports.handler = async function(event, context) {
    const { question } = JSON.parse(event.body); // Parse the incoming JSON to get the question

    let contextData = null;

    try {
        // Step 1: Try fetching context from Wikipedia
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&format=json`;
        const searchResponse = await axios.get(searchUrl);
        const searchResults = searchResponse.data.query.search;

        // Step 2: If a relevant page is found, fetch its summary
        if (searchResults && searchResults.length > 0) {
            const pageTitle = searchResults[0].title.replace(" ", "_"); // Clean up spaces in the page title
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
            const summaryResponse = await axios.get(summaryUrl);
            contextData = summaryResponse.data.extract || "No summary available.";
        }

        // Step 3: If no context found, use the question directly
        if (!contextData) {
            contextData = `Question: ${question}`;
        }

        // Step 4: Send the request to Gemini API to get the answer
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`;
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

        const geminiResponse = await axios.post(geminiUrl, data, {
            headers: { "Content-Type": "application/json" },
        });

        // Step 5: Get the generated answer from the Gemini API response
        const answer = geminiResponse.data.candidates[0].content.parts[0].text;

        // Return the response to Netlify
        return {
            statusCode: 200,
            body: JSON.stringify({ answer }),
        };
    } catch (error) {
        // Handle errors
        return {
            statusCode: 500,
            body: JSON.stringify({ answer: "Error: Unable to generate a response." }),
        };
    }
};
