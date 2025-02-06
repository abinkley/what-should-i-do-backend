// ... existing code ...

app.post('/generate-activity', async (req, res) => {
    try {
        const isSpicier = req.body.spicier || false;
        const baseActivity = req.body.activity || '';
        
        let prompt;
        if (isSpicier && baseActivity) {
            prompt = `Make this activity more exciting, adventurous and creative (while keeping it safe): "${baseActivity}"
                     Respond with just the spicier version - no explanations.
                     Example: If the activity is "Build a sandcastle", a spicier version might be 
                     "Build an elaborate sand fortress with a working moat, bridges, and decorated with seashells and driftwood."`;
        } else {
            prompt = `Generate a unique and specific activity suggestion. Be creative and detailed, but keep it under 150 characters.
                     Respond with just the activity itself - no explanations or additional text.
                     Example: "Create a miniature indoor zen garden with colored sand and tiny succulents"`;
        }

        // Add timeout and retry logic
        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'x-api-key': process.env.CLAUDE_API_KEY
                    },
                    body: JSON.stringify({
                        model: "claude-3-opus-20240229",
                        max_tokens: 100,
                        messages: [{
                            role: "user",
                            content: prompt
                        }],
                        temperature: 0.9
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.content || !data.content[0] || !data.content[0].text) {
                    throw new Error('Invalid response format from API');
                }

                return res.json({ activity: data.content[0].text });

            } catch (error) {
                lastError = error;
                console.error(`Attempt ${i + 1} failed:`, error);
                
                // Only retry on certain errors
                if (!error.message.includes('API request failed') && 
                    !error.name === 'AbortError') {
                    throw error;
                }
                
                // Wait before retrying (exponential backoff)
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }

        // If we get here, all retries failed
        console.error('All retries failed:', lastError);
        res.status(503).json({ 
            error: 'Service temporarily unavailable',
            message: 'Failed to generate activity after multiple attempts. Please try again later.'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'An unexpected error occurred while processing your request.'
        });
    }
});
