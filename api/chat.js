const axios = require("axios");

const handler = async (event, context) => {
    const WIKIPEDIA_TIMEOUT = 3000;
    const GEMINI_TIMEOUT = 5000;
    
    const startTime = Date.now();

    try {
        // Safely parse the request body
        let question;
        try {
            const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            question = body?.question;
        } catch (e) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: "Invalid request body",
                    details: "Request body must be valid JSON with a 'question' field"
                })
            };
        }

        // Validate question
        if (!question?.trim()) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: "Missing question",
                    details: "The 'question' field cannot be empty"
                })
            };
        }

        // Wikipedia context fetch
        let contextData = null;
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&format=json`;
            const searchResponse = await axios.get(searchUrl, { timeout: WIKIPEDIA_TIMEOUT });

            if (searchResponse?.data?.query?.search?.[0]) {
                const pageTitle = encodeURIComponent(searchResponse.data.query.search[0].title);
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
                const summaryResponse = await axios.get(summaryUrl, { timeout: WIKIPEDIA_TIMEOUT });
                contextData = summaryResponse.data?.extract;
            }
        } catch (error) {
            // Log but continue without Wikipedia context
            console.warn("Wikipedia fetch failed:", {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
        }

        // Validate Gemini API key
        if (!process.env.REACT_APP_GEMINI_API_KEY) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: "Configuration error",
                    details: "Gemini API key is not configured"
                })
            };
        }

        // Gemini API call
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`;
        
        const prompt = contextData 
            ? `Answer the question about crop diseases using this context: ${contextData}. Question: ${question}`
            : `Answer this question about crop diseases: ${question}`;

        const data = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        try {
            const geminiResponse = await axios.post(geminiUrl, data, {
                headers: { 'Content-Type': 'application/json' },
                timeout: GEMINI_TIMEOUT
            });

            const answer = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!answer) {
                throw new Error("Invalid response format from Gemini API");
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300'
                },
                body: JSON.stringify({
                    answer,
                    executionTime: Date.now() - startTime
                })
            };

        } catch (error) {
            // Handle Gemini API specific errors
            return {
                statusCode: error.response?.status || 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: "Gemini API error",
                    details: error.message || "Failed to get response from Gemini API",
                    executionTime: Date.now() - startTime
                })
            };
        }

    } catch (error) {
        // Handle any other unexpected errors
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: "Internal server error",
                details: error.message,
                executionTime: Date.now() - startTime
            })
        };
    }
};

module.exports = handler;
