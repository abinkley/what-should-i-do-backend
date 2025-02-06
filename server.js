import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

app.post('/generate-activity', async (req, res) => {
    try {
        const isSpicier = req.body.spicier || false;
        const baseActivity = req.body.activity || '';
        
        let prompt;
        if (isSpicier && baseActivity) {
            prompt = `Make this activity more detailed and creative, but keep your response STRICTLY under 100 characters - no exceptions.

Original activity: "${baseActivity}"

Requirements:
1. Must be the EXACT same type of activity - no changing the core concept
2. Add more adult-oriented, spicier details to the EXISTING activity only
3. Keep it tasteful but not explicit
4. STRICT 100 character limit - longer responses will be rejected
5. Respond with ONLY the enhanced version

Example:
Input: "Go for a hike near a waterfall" 
Output: "Go for a stroll along a mossy path near a waterfall"`;
        } else {
            prompt = `Generate a unique and specific activity suggestion. Be creative and detailed, but keep it under 100 characters.
                     Respond with just the activity itself - no explanations or additional text.
                     Example: "Create a miniature indoor zen garden with colored sand and tiny succulents" or "Go for a hike by a waterfall"`;
        }

        // Add timeout and retry logic
        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'x-api-key': process.env.CLAUDE_API_KEY
                    },
                    body: JSON.stringify({
                        model: "claude-3-opus-20240229",
                        max_tokens: 50,
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
                console.log('Raw API response:', JSON.stringify(data, null, 2));

                // Extract the activity text from the response
                const activityText = data.content[0].text.trim();
                console.log('Activity being sent to client:', activityText);

                // Verify the response is within length limit
                if (activityText.length > 150) {
                    throw new Error('Response exceeded character limit');
                }

                return res.json({ activity: activityText });

            } catch (error) {
                lastError = error;
                console.error(`Attempt ${i + 1} failed:`, error);
                
                // Only retry on certain errors
                if (!error.message.includes('API request failed') && 
                    error.name !== 'AbortError') {
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
