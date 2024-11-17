const axios = require("axios");

const handler = async (event, context) => {
    // Vercel has a default timeout of 10 seconds for Hobby tier
    const VERCEL_TIMEOUT = 10000;
    const WIKIPEDIA_TIMEOUT = 3000;
    const GEMINI_TIMEOUT = 5000;
    
    const startTime = Date.now();

    try {
        // Extract question and validate request
        const { question } = JSON.parse(event.body);
        if (!question?.trim()) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Error: No question provided" }),
            };
        }

        // Create an AbortController for timeouts
        const wikiController = new AbortController();
        const geminiController = new AbortController();

        // Initialize context data
        let contextData = null;

        // Step 1: Try fetching context from Wikipedia with timeout
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&format=json`;
            
            const searchResponse = await Promise.race([
                axios.get(searchUrl, {
                    signal: wikiController.signal,
                    timeout: WIKIPEDIA_TIMEOUT
                }),
                new Promise((_, reject) => 
                    setTimeout(() => {
                        wikiController.abort();
                        reject(new Error('Wikipedia search timeout'));
                    }, WIKIPEDIA_TIMEOUT)
                )
            ]);

            if (searchResponse?.data?.query?.search?.[0]) {
                const pageTitle = encodeURIComponent(searchResponse.data.query.search[0].title);
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
                
                const summaryResponse = await axios.get(summaryUrl, {
                    signal: wikiController.signal,
                    timeout: WIKIPEDIA_TIMEOUT
                });
                
                contextData = summaryResponse.data?.extract || null;
            }
        } catch (error) {
            console.warn("Wikipedia context fetch failed:", error.message);
            // Continue without Wikipedia context
        }

        // Validate Gemini API key
        if (!process.env.REACT_APP_GEMINI_API_KEY) {
            throw new Error("Gemini API key is missing");
        }

        // Step 2: Call Gemini API with strict timeout
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.REACT_APP_GEMINI_API_KEY}`;
        
        const prompt = contextData 
            ? `Answer the question about crop diseases using this context: ${contextData}. Question: ${question}`
            : `Answer this question about crop diseases: ${question}`;

        const data = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        const geminiResponse = await Promise.race([
            axios.post(geminiUrl, data, {
                headers: { "Content-Type": "application/json" },
                signal: geminiController.signal,
                timeout: GEMINI_TIMEOUT
            }),
            new Promise((_, reject) => 
                setTimeout(() => {
                    geminiController.abort();
                    reject(new Error('Gemini API timeout'));
                }, GEMINI_TIMEOUT)
            )
        ]);

        if (!geminiResponse?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error("Invalid response format from Gemini API");
        }

        const answer = geminiResponse.data.candidates[0].content.parts[0].text;
        const executionTime = Date.now() - startTime;

        console.log(`Request completed in ${executionTime}ms`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache successful responses for 5 minutes
            },
            body: JSON.stringify({ 
                answer,
                executionTime 
            })
        };

    } catch (error) {
        const errorMessage = error.message || "Internal server error";
        console.error("Error:", errorMessage);
        
        return {
            statusCode: error.response?.status || 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: errorMessage,
                executionTime: Date.now() - startTime
            })
        };
    }
};

module.exports = handler;
